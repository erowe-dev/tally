import crypto from 'node:crypto';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { Prisma, User } from '@prisma/client';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncRoute, requireUser } from '../lib/route-helpers';
import { dateWindowFromLooseFields, parseDateWindow } from '../lib/date-window';
import { createFixedWindowRateLimiter } from '../lib/fixed-window-rate-limit';
import { parseProgramIdArray } from '../lib/program-ids';
import { sendError } from '../lib/http-response';

const router = Router();

const LIVE_RESULT_TTL_MS = 10 * 60 * 1000;
const HOTEL_CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_TTL_MS = HOTEL_CACHE_TTL_MS;
const PROVIDER = 'tally_hybrid_award_search';
const SOURCE = 'owned_compliant_provider_adapter';
const CABIN_TYPES = new Set(['economy', 'premium', 'business', 'first']);
const IATA_RE = /^[A-Z]{3}$/;
const SEARCH_RATE_LIMIT_WINDOW_MS = 60_000;
const SEARCH_RATE_LIMIT_MAX_REQUESTS = 30;
const PLANNING_NOTICE = 'Planning guidance only. Live award pricing appears only after Tally verifies current bookable availability.';
const SEATS_AERO_DEFAULT_BASE_URL = 'https://seats.aero/partnerapi';
const SEATS_AERO_SOURCES = ['aeroplan', 'united', 'flyingblue', 'virginatlantic'];
const searchRateLimiter = createFixedWindowRateLimiter({
  maxRequests: SEARCH_RATE_LIMIT_MAX_REQUESTS,
  windowMs: SEARCH_RATE_LIMIT_WINDOW_MS,
});

router.post(
  '/award-availability',
  checkJwt,
  jwtErrorHandler,
  limitProviderSearch,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const normalized = normalizeAwardRequest(req.body);
    if ('error' in normalized) {
      sendError(res, 400, normalized.error);
      return;
    }

    const result = await runHybridAwardSearch(user, normalized.data);
    res.json(result);
  }),
);

router.post(
  '/hotel-fit',
  checkJwt,
  jwtErrorHandler,
  limitProviderSearch,
  asyncRoute(async (req, res) => {
    await requireUser(getAuth0Id(req));
    const normalized = normalizeHotelRequest(req.body);
    if ('error' in normalized) {
      sendError(res, 400, normalized.error);
      return;
    }

    const result = await getOrCreateProviderCache('hotel_fit', normalized.data, buildHotelSignal);
    res.json(result);
  }),
);

export default router;

type AwardSearchStatus =
  | 'searching'
  | 'live_results'
  | 'no_live_results'
  | 'source_unavailable'
  | 'rate_limited'
  | 'stale_discovery_only';
type CacheStatus = 'fresh' | 'miss' | 'stale';
type VerificationStatus = 'verified_live' | 'not_available' | 'source_unavailable' | 'stale';
type JsonObject = Record<string, Prisma.InputJsonValue>;
type ParseResult<T> = { data: T } | { error: string };
type SignalBuilder = (request: JsonObject) => JsonObject;

type AwardRequest = {
  originAirport: string;
  destinationAirport: string;
  cabin: string;
  passengers: number;
  dateWindow: Prisma.InputJsonObject;
  programs: string[];
};

type AwardCandidate = {
  source: string;
  sourceKey?: string;
  originAirport: string;
  destinationAirport: string;
  departureDate: string;
  returnDate?: string;
  cabin: string;
  program: string;
  points?: number;
  taxesUsd?: number;
  seatCount?: number;
  bookingUrl?: string;
  raw: JsonObject;
  expiresAt?: string;
};

type ProviderEndpointResult = {
  originAirport?: unknown;
  destinationAirport?: unknown;
  departureDate?: unknown;
  returnDate?: unknown;
  cabin?: unknown;
  program?: unknown;
  points?: unknown;
  taxesUsd?: unknown;
  seatCount?: unknown;
  bookingUrl?: unknown;
  sourceKey?: unknown;
  expiresAt?: unknown;
  verificationStatus?: unknown;
  isLive?: unknown;
};

type VerifiedAwardResult = AwardCandidate & {
  id: string;
  provider: string;
  source: string;
  isLive: true;
  verificationStatus: 'verified_live';
  checkedAt: string;
  expiresAt: string;
};

type VerificationResult =
  | { status: 'verified_live'; result: Omit<VerifiedAwardResult, 'id' | 'provider' | 'checkedAt' | 'expiresAt'>; expiresAt?: string }
  | { status: Exclude<VerificationStatus, 'verified_live'>; raw?: JsonObject };

type AwardProviderAdapter = {
  name: string;
  enabled(): boolean;
  discoverCandidates(request: AwardRequest): Promise<AwardCandidate[]>;
  verifyCandidate(candidate: AwardCandidate, request: AwardRequest): Promise<VerificationResult>;
};

const awardAdapters: AwardProviderAdapter[] = [
  createSeatsAeroProvider(),
  createConfiguredHttpProvider('flying_blue', 'Flying Blue'),
  createConfiguredHttpProvider('aeroplan', 'Air Canada Aeroplan'),
  createConfiguredHttpProvider('virgin_atlantic', 'Virgin Atlantic Flying Club'),
  createConfiguredHttpProvider('united', 'United MileagePlus'),
];

function limitProviderSearch(req: Request, res: Response, next: NextFunction): void {
  const auth0Id = getAuth0Id(req);
  const key = `${auth0Id}:${req.path}`;
  const result = searchRateLimiter.hit(key);

  res.setHeader('X-RateLimit-Limit', result.limit.toString());
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

  if (!result.allowed) {
    sendError(res, 429, 'Search rate limit exceeded');
    return;
  }

  next();
}

async function runHybridAwardSearch(user: User, request: AwardRequest) {
  const checkedAt = new Date();
  const enabledAdapters = awardAdapters.filter(adapter => adapter.enabled());
  const sourcesAttempted = enabledAdapters.map(adapter => adapter.name);

  if (enabledAdapters.length === 0) {
    return persistAwardRun(user.id, request, {
      status: 'source_unavailable',
      sourcesAttempted: [],
      results: [],
      checkedAt,
      expiresAt: checkedAt,
      message: 'No compliant live award data source is configured yet.',
    });
  }

  const verifiedResults: VerifiedAwardResult[] = [];
  let discoveredCandidates = 0;
  let sourceFailures = 0;

  for (const adapter of enabledAdapters) {
    let candidates: AwardCandidate[] = [];
    try {
      candidates = await adapter.discoverCandidates(request);
    } catch (error) {
      sourceFailures += 1;
      console.error(`[award-search] ${adapter.name} discovery failed`, error);
      continue;
    }
    discoveredCandidates += candidates.length;
    for (const candidate of candidates) {
      let verification: VerificationResult;
      try {
        verification = await adapter.verifyCandidate(candidate, request);
      } catch (error) {
        sourceFailures += 1;
        console.error(`[award-search] ${adapter.name} verification failed`, error);
        continue;
      }
      if (verification.status !== 'verified_live') continue;
      const expiresAt = new Date(verification.expiresAt ?? checkedAt.getTime() + LIVE_RESULT_TTL_MS).toISOString();
      verifiedResults.push({
        ...verification.result,
        id: hashStableJson({ ...verification.result, checkedAt: checkedAt.toISOString() }),
        provider: PROVIDER,
        checkedAt: checkedAt.toISOString(),
        expiresAt,
      });
    }
  }

  const status: AwardSearchStatus = verifiedResults.length > 0
    ? 'live_results'
    : sourceFailures >= enabledAdapters.length && discoveredCandidates === 0
      ? 'source_unavailable'
      : discoveredCandidates > 0
      ? 'stale_discovery_only'
      : 'no_live_results';

  return persistAwardRun(user.id, request, {
    status,
    sourcesAttempted,
    results: verifiedResults,
    checkedAt,
    expiresAt: verifiedResults.reduce(
      (earliest, result) => result.expiresAt < earliest ? result.expiresAt : earliest,
      new Date(checkedAt.getTime() + LIVE_RESULT_TTL_MS).toISOString(),
    ),
    message: status === 'live_results'
      ? 'Verified live award availability returned by configured sources.'
      : 'No currently verified bookable award availability was found.',
  });
}

async function persistAwardRun(
  userId: string,
  request: AwardRequest,
  response: {
    status: AwardSearchStatus;
    sourcesAttempted: string[];
    results: VerifiedAwardResult[];
    checkedAt: Date;
    expiresAt: Date | string;
    message: string;
  },
) {
  const body = {
    provider: PROVIDER,
    source: SOURCE,
    status: response.status,
    isLive: response.status === 'live_results',
    checkedAt: response.checkedAt.toISOString(),
    lastChecked: response.checkedAt.toISOString(),
    expiresAt: typeof response.expiresAt === 'string' ? response.expiresAt : response.expiresAt.toISOString(),
    sourcesAttempted: response.sourcesAttempted,
    message: response.message,
    notice: PLANNING_NOTICE,
    results: response.results,
  };

  try {
    await prisma.awardSearchRun.create({
      data: {
        userId,
        originAirport: request.originAirport,
        destinationAirport: request.destinationAirport,
        cabin: request.cabin,
        passengers: request.passengers,
        dateWindow: request.dateWindow,
        status: response.status,
        sourcesAttempted: response.sourcesAttempted,
        message: response.message,
        verifications: {
          create: response.results.map(result => ({
            source: result.source,
            verificationStatus: result.verificationStatus,
            originAirport: result.originAirport,
            destinationAirport: result.destinationAirport,
            departureDate: result.departureDate,
            returnDate: result.returnDate,
            cabin: result.cabin,
            program: result.program,
            points: result.points,
            taxesUsd: result.taxesUsd,
            seatCount: result.seatCount,
            bookingUrl: result.bookingUrl,
            raw: result.raw,
            expiresAt: new Date(result.expiresAt),
          })),
        },
      },
    });
  } catch (error) {
    console.error('[award-search] failed to persist search run', error);
  }

  return body;
}

function createSeatsAeroProvider(): AwardProviderAdapter {
  const config = () => ({
    enabled: process.env['TALLY_SEATS_AERO_ENABLED'] === '1',
    liveEnabled: process.env['TALLY_SEATS_AERO_LIVE_ENABLED'] === '1',
    baseUrl: cleanBaseUrl(process.env['TALLY_SEATS_AERO_BASE_URL']) || SEATS_AERO_DEFAULT_BASE_URL,
    apiKey: process.env['TALLY_SEATS_AERO_API_KEY']?.trim() ?? '',
  });

  return {
    name: 'seats_aero',
    enabled: () => {
      const resolved = config();
      return resolved.enabled && Boolean(resolved.apiKey);
    },
    discoverCandidates: async request => {
      const resolved = config();
      if (!resolved.apiKey) return [];
      const dateWindow = asRecord(request.dateWindow) ?? {};
      const params = new URLSearchParams({
        origin_airport: request.originAirport,
        destination_airport: request.destinationAirport,
        start_date: String(dateWindow['startDate'] ?? ''),
        end_date: String(dateWindow['endDate'] || dateWindow['startDate'] || ''),
        sources: SEATS_AERO_SOURCES.join(','),
        cabins: request.cabin,
        order_by: 'lowest_mileage',
        take: '50',
        include_filtered: 'false',
      });
      const payload = await getSeatsAeroRequest(`${resolved.baseUrl}/search?${params.toString()}`, resolved.apiKey);
      return normalizeSeatsAeroResults(payload, request);
    },
    verifyCandidate: async (candidate, request) => {
      const resolved = config();
      if (!resolved.apiKey || !resolved.liveEnabled) return { status: 'stale' };
      const payload = await postSeatsAeroRequest(`${resolved.baseUrl}/live`, resolved.apiKey, {
        origin_airport: request.originAirport,
        destination_airport: request.destinationAirport,
        departure_date: candidate.departureDate,
        source: candidate.sourceKey?.split(':')[0] || seatsAeroSourceForProgram(candidate.program),
        seat_count: request.passengers,
        disable_filters: false,
        show_dynamic_pricing: false,
      });
      const [verified] = normalizeSeatsAeroResults(payload, request)
        .filter(result =>
          result.departureDate === candidate.departureDate &&
          result.program === candidate.program &&
          result.points > 0,
        );
      if (!verified) return { status: 'not_available', raw: asJsonObject(payload) };
      return {
        status: 'verified_live',
        expiresAt: verified.expiresAt,
        result: {
          source: 'seats_aero',
          sourceKey: verified.sourceKey,
          originAirport: verified.originAirport,
          destinationAirport: verified.destinationAirport,
          departureDate: verified.departureDate,
          returnDate: verified.returnDate,
          cabin: verified.cabin,
          program: verified.program,
          points: verified.points,
          taxesUsd: verified.taxesUsd,
          seatCount: verified.seatCount,
          bookingUrl: verified.bookingUrl,
          raw: verified.raw,
          isLive: true,
          verificationStatus: 'verified_live',
        },
      };
    },
  };
}

function createConfiguredHttpProvider(name: string, defaultProgram: string): AwardProviderAdapter {
  const envPrefix = `TALLY_${name.toUpperCase()}_`;
  const config = () => ({
    baseUrl: cleanBaseUrl(process.env[`${envPrefix}BASE_URL`]),
    apiKey: process.env[`${envPrefix}API_KEY`]?.trim() ?? '',
  });

  return {
    name,
    enabled: () => {
      const resolved = config();
      return process.env[`${envPrefix}ENABLED`] === '1' && Boolean(resolved.baseUrl && resolved.apiKey);
    },
    discoverCandidates: async request => {
      const resolved = config();
      if (!resolved.baseUrl || !resolved.apiKey) return [];
      const payload = await postProviderRequest(`${resolved.baseUrl}/discover`, resolved.apiKey, request);
      const results = normalizeProviderResults(payload, name, defaultProgram, request);
      return results.map(result => ({
        source: name,
        sourceKey: result.sourceKey,
        originAirport: result.originAirport,
        destinationAirport: result.destinationAirport,
        departureDate: result.departureDate,
        returnDate: result.returnDate,
        cabin: result.cabin,
        program: result.program,
        points: result.points,
        taxesUsd: result.taxesUsd,
        seatCount: result.seatCount,
        bookingUrl: result.bookingUrl,
        expiresAt: result.expiresAt,
        raw: result.raw,
      }));
    },
    verifyCandidate: async (candidate, request) => {
      const resolved = config();
      if (!resolved.baseUrl || !resolved.apiKey) return { status: 'source_unavailable' };
      const payload = await postProviderRequest(`${resolved.baseUrl}/verify`, resolved.apiKey, {
        ...request,
        candidate,
      });
      const [result] = normalizeProviderResults(payload, name, defaultProgram, request)
        .filter(item => item.verificationStatus === 'verified_live' && item.isLive === true);
      if (!result) return { status: 'not_available', raw: asJsonObject(payload) };
      return {
        status: 'verified_live',
        expiresAt: result.expiresAt,
        result: {
          source: name,
          sourceKey: result.sourceKey ?? candidate.sourceKey,
          originAirport: result.originAirport,
          destinationAirport: result.destinationAirport,
          departureDate: result.departureDate,
          returnDate: result.returnDate,
          cabin: result.cabin,
          program: result.program,
          points: result.points,
          taxesUsd: result.taxesUsd,
          seatCount: result.seatCount,
          bookingUrl: result.bookingUrl,
          raw: result.raw,
          isLive: true,
          verificationStatus: 'verified_live',
        },
      };
    },
  };
}

async function getSeatsAeroRequest(url: string, apiKey: string): Promise<unknown> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'Partner-Authorization': apiKey,
    },
  });
  if (!response.ok) return {};
  return response.json() as Promise<unknown>;
}

async function postSeatsAeroRequest(url: string, apiKey: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'Partner-Authorization': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) return {};
  return response.json() as Promise<unknown>;
}

async function postProviderRequest(url: string, apiKey: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) return {};
  return response.json() as Promise<unknown>;
}

function normalizeProviderResults(
  payload: unknown,
  source: string,
  defaultProgram: string,
  request: AwardRequest,
): Array<{
  sourceKey?: string;
  originAirport: string;
  destinationAirport: string;
  departureDate: string;
  returnDate?: string;
  cabin: string;
  program: string;
  points: number;
  taxesUsd?: number;
  seatCount?: number;
  bookingUrl?: string;
  expiresAt?: string;
  verificationStatus?: string;
  isLive?: boolean;
  raw: JsonObject;
}> {
  const records = Array.isArray(payload)
    ? payload
    : asRecord(payload)?.['results'];
  if (!Array.isArray(records)) return [];

  return records.flatMap(record => {
    const raw = asRecord(record);
    if (!raw) return [];
    const candidate = raw as ProviderEndpointResult;
    const originAirport = normalizeIata(candidate.originAirport) ?? request.originAirport;
    const destinationAirport = normalizeIata(candidate.destinationAirport) ?? request.destinationAirport;
    const departureDate = validDateOnly(candidate.departureDate) ?? validDateOnly(asRecord(request.dateWindow)?.['startDate']);
    const returnDate = validDateOnly(candidate.returnDate) ?? validDateOnly(asRecord(request.dateWindow)?.['endDate']) ?? undefined;
    const cabin = typeof candidate.cabin === 'string' && CABIN_TYPES.has(candidate.cabin) ? candidate.cabin : request.cabin;
    const program = normalizeText(candidate.program, 120) ?? defaultProgram;
    const points = positiveInteger(candidate.points);
    if (!departureDate || !points) return [];

    return [{
      sourceKey: normalizeText(candidate.sourceKey, 160) ?? `${source}:${originAirport}:${destinationAirport}:${departureDate}:${cabin}:${program}:${points}`,
      originAirport,
      destinationAirport,
      departureDate,
      returnDate,
      cabin,
      program,
      points,
      taxesUsd: nonNegativeNumber(candidate.taxesUsd),
      seatCount: positiveInteger(candidate.seatCount),
      bookingUrl: safeHttpsUrl(candidate.bookingUrl),
      expiresAt: validIsoString(candidate.expiresAt) ?? undefined,
      verificationStatus: candidate.verificationStatus === 'verified_live' ? 'verified_live' : undefined,
      isLive: candidate.isLive === true,
      raw: asJsonObject(raw),
    }];
  });
}

function normalizeSeatsAeroResults(payload: unknown, request: AwardRequest): Array<AwardCandidate & { points: number }> {
  const records = Array.isArray(payload)
    ? payload
    : firstArrayValue(asRecord(payload), ['results', 'data', 'Data', 'availability', 'Availability']);
  if (!Array.isArray(records)) return [];

  return records.flatMap(record => {
    const raw = asRecord(record);
    if (!raw) return [];
    const source = normalizeText(firstField(raw, ['Source', 'source', 'Program', 'program']), 80) ?? '';
    const program = seatsAeroProgramName(source);
    const originAirport = normalizeIata(firstField(raw, ['OriginAirport', 'origin_airport', 'originAirport', 'Origin', 'origin'])) ?? request.originAirport;
    const destinationAirport = normalizeIata(firstField(raw, ['DestinationAirport', 'destination_airport', 'destinationAirport', 'Destination', 'destination'])) ?? request.destinationAirport;
    const departureDate = validDateOnly(firstField(raw, ['Date', 'date', 'DepartureDate', 'departure_date', 'departureDate'])) ??
      validDateOnly(asRecord(request.dateWindow)?.['startDate']);
    const returnDate = validDateOnly(firstField(raw, ['ReturnDate', 'return_date', 'returnDate'])) ?? undefined;
    const cabin = seatsAeroCabinFromResult(raw, request.cabin);
    const points = positiveInteger(firstField(raw, [
      'MileageCost',
      'mileageCost',
      'mileage_cost',
      'Miles',
      'miles',
      'Points',
      'points',
      `${cabin}MileageCost`,
      `${cabin}_mileage_cost`,
    ]));
    if (!departureDate || !program || !points) return [];

    return [{
      source: 'seats_aero',
      sourceKey: `${source || seatsAeroSourceForProgram(program)}:${originAirport}:${destinationAirport}:${departureDate}:${cabin}:${points}`,
      originAirport,
      destinationAirport,
      departureDate,
      returnDate,
      cabin,
      program,
      points,
      taxesUsd: nonNegativeNumber(firstField(raw, ['TotalTaxes', 'totalTaxes', 'Taxes', 'taxes', 'taxesUsd', 'taxes_usd'])),
      seatCount: positiveInteger(firstField(raw, ['SeatCount', 'seatCount', 'seat_count', 'Seats', 'seats'])),
      bookingUrl: safeHttpsUrl(firstField(raw, ['BookingURL', 'bookingUrl', 'booking_url', 'URL', 'url'])),
      expiresAt: validIsoString(firstField(raw, ['ExpiresAt', 'expiresAt', 'expires_at'])) ?? undefined,
      raw: asJsonObject(raw),
    }];
  });
}

function firstArrayValue(record: Record<string, unknown> | null, keys: string[]): unknown[] | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return null;
}

function firstField(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  }
  return undefined;
}

function seatsAeroProgramName(source: string): string {
  const normalized = source.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.includes('flyingblue') || normalized === 'fb') return 'Flying Blue';
  if (normalized.includes('aeroplan')) return 'Air Canada Aeroplan';
  if (normalized.includes('virgin')) return 'Virgin Atlantic Flying Club';
  if (normalized.includes('united')) return 'United MileagePlus';
  return source;
}

function seatsAeroSourceForProgram(program: string): string {
  const normalized = program.toLowerCase();
  if (normalized.includes('flying blue')) return 'flyingblue';
  if (normalized.includes('aeroplan')) return 'aeroplan';
  if (normalized.includes('virgin')) return 'virginatlantic';
  if (normalized.includes('united')) return 'united';
  return 'aeroplan';
}

function seatsAeroCabinFromResult(record: Record<string, unknown>, fallback: string): string {
  const cabin = normalizeText(firstField(record, ['Cabin', 'cabin']), 30);
  if (cabin && CABIN_TYPES.has(cabin)) return cabin;
  for (const value of ['first', 'business', 'premium', 'economy']) {
    const marker = firstField(record, [
      `${value}Available`,
      `${value}_available`,
      `${value}MileageCost`,
      `${value}_mileage_cost`,
    ]);
    if (marker === true || positiveInteger(marker)) return value;
  }
  return fallback;
}

function cleanBaseUrl(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString().replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

function asJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => isJsonValue(item)),
  ) as JsonObject;
}

function isJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (value && typeof value === 'object') return Object.values(value).every(isJsonValue);
  return false;
}

async function getOrCreateProviderCache(
  searchType: 'hotel_fit',
  normalizedRequest: JsonObject,
  buildSignal: SignalBuilder,
) {
  const cacheKey = `${searchType}:${hashStableJson(normalizedRequest)}`;
  const now = new Date();
  const existing = await prisma.providerCache.findUnique({ where: { cacheKey } });

  if (existing && existing.expiresAt > now) {
    return toProviderResponse(existing, 'fresh', false);
  }

  if (existing && process.env['TALLY_PROVIDER_REFRESH_DISABLED'] === '1') {
    return toProviderResponse(existing, 'stale', true);
  }

  const response = buildSignal(normalizedRequest);
  const expiresAt = new Date(now.getTime() + HOTEL_CACHE_TTL_MS);
  const cache = await prisma.providerCache.upsert({
    where: { cacheKey },
    update: {
      normalizedRequest,
      response,
      source: 'hotel_planning_model',
      confidence: confidenceFromRequest(normalizedRequest),
      expiresAt,
    },
    create: {
      cacheKey,
      provider: 'tally_hotel_planning',
      searchType,
      normalizedRequest,
      response,
      source: 'hotel_planning_model',
      confidence: confidenceFromRequest(normalizedRequest),
      expiresAt,
    },
  });

  return toProviderResponse(cache, 'miss', false);
}

function toProviderResponse(
  cache: {
    provider: string;
    source: string;
    confidence: number;
    normalizedRequest: Prisma.JsonValue;
    response: Prisma.JsonValue;
    updatedAt: Date;
    expiresAt: Date;
  },
  cacheStatus: CacheStatus,
  stale: boolean,
) {
  const response = asJsonRecord(cache.response);
  const results = Array.isArray(response?.['results'])
    ? response['results'].map(result => {
        if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
        return {
          ...result,
          provider: cache.provider,
          source: cache.source,
          lastChecked: cache.updatedAt.toISOString(),
          expiresAt: cache.expiresAt.toISOString(),
          cacheStatus,
          stale,
        };
      })
    : [];
  return {
    provider: cache.provider,
    source: cache.source,
    status: 'planning_guidance',
    dataMode: 'planning_estimate',
    availabilitySource: 'estimated_not_live',
    isLive: false,
    notice: 'Hotel planning estimate only. Confirm live room availability and cash rates before transferring points.',
    cacheStatus,
    normalizedRequest: cache.normalizedRequest,
    results,
    lastChecked: cache.updatedAt.toISOString(),
    expiresAt: cache.expiresAt.toISOString(),
    stale,
    confidence: cache.confidence,
  };
}

export function normalizeAwardRequest(value: unknown): ParseResult<AwardRequest> {
  const body = asRecord(value);
  if (!body) return { error: 'Request body must be an object' };

  const origin = normalizeIata(body['originAirport'] ?? body['origin']);
  if (!origin) return { error: 'originAirport must be a three-letter IATA code' };

  const destination = normalizeIata(body['destinationAirport'] ?? body['destination']);
  if (!destination) return { error: 'destinationAirport must be a three-letter IATA code' };

  const cabin = typeof body['cabin'] === 'string' && CABIN_TYPES.has(body['cabin'])
    ? body['cabin']
    : 'economy';
  const passengers = normalizeInteger(body['passengers'], 1, 9, 1, 'passengers');
  if ('error' in passengers) return { error: passengers.error };
  const dateWindow = dateWindowFromLooseFields(body, {
    requireStartDate: true,
    defaultFlexibility: 'exact',
    rejectPastStartDate: true,
  });
  if ('error' in dateWindow) return { error: dateWindow.error };
  const programs = normalizeProgramIds(body['programs']);
  if ('error' in programs) return { error: programs.error };

  return {
    data: {
      originAirport: origin,
      destinationAirport: destination,
      cabin,
      passengers: passengers.data,
      dateWindow: dateWindow.data,
      programs: programs.data,
    },
  };
}

export function normalizeHotelRequest(value: unknown): ParseResult<JsonObject> {
  const body = asRecord(value);
  if (!body) return { error: 'Request body must be an object' };

  const destination = normalizeText(body['destination'], 120);
  if (!destination) return { error: 'destination is required' };

  const hotelCategory = normalizeText(body['hotelCategory'], 30) ?? 'mid';
  const travelers = normalizeInteger(body['travelers'], 1, 9, 1, 'travelers');
  if ('error' in travelers) return { error: travelers.error };
  const rooms = normalizeInteger(body['rooms'], 1, 4, 1, 'rooms');
  if ('error' in rooms) return { error: rooms.error };
  const nights = normalizeInteger(body['nights'], 1, 30, deriveNights(body) ?? 1, 'nights');
  if ('error' in nights) return { error: nights.error };
  const chains = normalizeStringList(body['chains'] ?? body['preferredChains'], 20);
  const rawDateWindow = asRecord(body['dateWindow']) ?? dateWindowFromHotelIntent(body);
  const dateWindow = rawDateWindow
    ? parseDateWindow(rawDateWindow, { defaultFlexibility: 'plus_minus_7', rejectPastStartDate: true })
    : { data: { startDate: '', endDate: '', flexibility: 'plus_minus_7' } as Prisma.InputJsonObject };
  if ('error' in dateWindow) return { error: dateWindow.error };

  return {
    data: {
      destination,
      hotelCategory,
      travelers: travelers.data,
      rooms: rooms.data,
      nights: nights.data,
      chains,
      dateWindow: dateWindow.data,
    },
  };
}

function buildHotelSignal(request: JsonObject): JsonObject {
  const destination = String(request['destination']);
  const category = String(request['hotelCategory']);
  const seed = numericSeed(request);
  const base = category === 'top' ? 95_000 : category === 'luxury' ? 65_000 : category === 'budget' ? 18_000 : 35_000;

  return {
    results: [
      {
        chain: 'Hyatt',
        dataMode: 'planning_estimate',
        availabilitySource: 'estimated_not_live',
        isLive: false,
        destination,
        estimatedPointsPerNight: base + (seed % 8_000),
        fit: 'best_points_value',
        note: 'Use as planning guidance until live hotel availability is connected.',
      },
      {
        chain: 'Hilton',
        dataMode: 'planning_estimate',
        availabilitySource: 'estimated_not_live',
        isLive: false,
        destination,
        estimatedPointsPerNight: base + 15_000 + (seed % 12_000),
        fit: 'cash_compare',
        note: 'Compare against cash rates and free-night certificates.',
      },
      {
        chain: 'Marriott',
        dataMode: 'planning_estimate',
        availabilitySource: 'estimated_not_live',
        isLive: false,
        destination,
        estimatedPointsPerNight: base + 10_000 + (seed % 10_000),
        fit: 'backup',
        note: 'Good fallback if chain preference or footprint matters more than cents per point.',
      },
    ],
  };
}

function dateWindowFromHotelIntent(body: Record<string, unknown>): Record<string, unknown> | null {
  if (!('checkInDate' in body) && !('checkOutDate' in body)) return null;
  return {
    startDate: body['checkInDate'] ?? '',
    endDate: body['checkOutDate'] ?? '',
    flexibility: body['dateFlexibility'] ?? 'plus_minus_7',
  };
}

function deriveNights(body: Record<string, unknown>): number | null {
  if (body['nights'] !== undefined && body['nights'] !== null) return null;
  const checkIn = typeof body['checkInDate'] === 'string' ? body['checkInDate'] : '';
  const checkOut = typeof body['checkOutDate'] === 'string' ? body['checkOutDate'] : '';
  if (!checkIn || !checkOut) return null;

  const start = Date.parse(`${checkIn}T00:00:00.000Z`);
  const end = Date.parse(`${checkOut}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.min(30, Math.max(1, Math.round((end - start) / 86_400_000)));
}

function confidenceFromRequest(request: JsonObject): number {
  const seed = numericSeed(request);
  return Number((0.62 + (seed % 25) / 100).toFixed(2));
}

function numericSeed(value: JsonObject): number {
  return parseInt(hashStableJson(value).slice(0, 8), 16);
}

function hashStableJson(value: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 32);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asJsonRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeIata(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return IATA_RE.test(normalized) ? normalized : null;
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function validDateOnly(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : null;
}

function validIsoString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeInteger(value: unknown, min: number, max: number, fallback: number, fieldName: string): ParseResult<number> {
  if (value === undefined || value === null) return { data: fallback };
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return { error: `${fieldName} must be an integer from ${min} to ${max}` };
  }
  return { data: value };
}

function normalizeStringList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const strings = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, maxItems);
  return [...new Set(strings)];
}

function normalizeProgramIds(value: unknown): ParseResult<string[]> {
  if (value === undefined || value === null) return { data: [] };
  return parseProgramIdArray(value);
}
