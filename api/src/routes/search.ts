import crypto from 'node:crypto';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncRoute, requireUser } from '../lib/route-helpers';
import { dateWindowFromLooseFields, parseDateWindow } from '../lib/date-window';
import { createFixedWindowRateLimiter } from '../lib/fixed-window-rate-limit';
import { parseProgramIdArray } from '../lib/program-ids';
import { sendError } from '../lib/http-response';

const router = Router();

const CACHE_TTL_MS = 60 * 60 * 1000;
const PROVIDER = 'tally_stub';
const SOURCE = 'deterministic_provider_cache_stub';
const CABIN_TYPES = new Set(['economy', 'premium', 'business', 'first']);
const IATA_RE = /^[A-Z]{3}$/;
const SEARCH_RATE_LIMIT_WINDOW_MS = 60_000;
const SEARCH_RATE_LIMIT_MAX_REQUESTS = 30;
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
    await requireUser(getAuth0Id(req));
    const normalized = normalizeAwardRequest(req.body);
    if ('error' in normalized) {
      sendError(res, 400, normalized.error);
      return;
    }

    const result = await getOrCreateProviderCache('award_availability', normalized.data, buildAwardSignal);
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

type CacheStatus = 'fresh' | 'miss' | 'stale';
type JsonObject = Record<string, Prisma.InputJsonValue>;
type ParseResult<T> = { data: T } | { error: string };
type SignalBuilder = (request: JsonObject) => JsonObject;

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

async function getOrCreateProviderCache(
  searchType: 'award_availability' | 'hotel_fit',
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
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  const cache = await prisma.providerCache.upsert({
    where: { cacheKey },
    update: {
      normalizedRequest,
      response,
      source: SOURCE,
      confidence: confidenceFromRequest(normalizedRequest),
      expiresAt,
    },
    create: {
      cacheKey,
      provider: PROVIDER,
      searchType,
      normalizedRequest,
      response,
      source: SOURCE,
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
    cacheStatus,
    normalizedRequest: cache.normalizedRequest,
    results,
    lastChecked: cache.updatedAt.toISOString(),
    expiresAt: cache.expiresAt.toISOString(),
    stale,
    confidence: cache.confidence,
  };
}

function normalizeAwardRequest(value: unknown): ParseResult<JsonObject> {
  const body = asRecord(value);
  if (!body) return { error: 'Request body must be an object' };

  const origin = normalizeIata(body['originAirport'] ?? body['origin']);
  if (!origin) return { error: 'originAirport must be a three-letter IATA code' };

  const destination = normalizeIata(body['destinationAirport'] ?? body['destination']);
  if (!destination) return { error: 'destinationAirport must be a three-letter IATA code' };

  const cabin = typeof body['cabin'] === 'string' && CABIN_TYPES.has(body['cabin'])
    ? body['cabin']
    : 'economy';
  const passengers = normalizeInteger(body['passengers'], 1, 9, 1);
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
      passengers,
      dateWindow: dateWindow.data,
      programs: programs.data,
    },
  };
}

function normalizeHotelRequest(value: unknown): ParseResult<JsonObject> {
  const body = asRecord(value);
  if (!body) return { error: 'Request body must be an object' };

  const destination = normalizeText(body['destination'], 120);
  if (!destination) return { error: 'destination is required' };

  const hotelCategory = normalizeText(body['hotelCategory'], 30) ?? 'mid';
  const travelers = normalizeInteger(body['travelers'], 1, 9, 1);
  const rooms = normalizeInteger(body['rooms'], 1, 4, 1);
  const nights = normalizeInteger(body['nights'], 1, 30, 1);
  const chains = normalizeStringList(body['chains'], 20);
  const rawDateWindow = asRecord(body['dateWindow']);
  const dateWindow = rawDateWindow
    ? parseDateWindow(rawDateWindow, { defaultFlexibility: 'plus_minus_7', rejectPastStartDate: true })
    : { data: { startDate: '', endDate: '', flexibility: 'plus_minus_7' } as Prisma.InputJsonObject };
  if ('error' in dateWindow) return { error: dateWindow.error };

  return {
    data: {
      destination,
      hotelCategory,
      travelers,
      rooms,
      nights,
      chains,
      dateWindow: dateWindow.data,
    },
  };
}

function buildAwardSignal(request: JsonObject): JsonObject {
  const origin = String(request['originAirport']);
  const destination = String(request['destinationAirport']);
  const cabin = String(request['cabin']);
  const dateWindow = asRecord(request['dateWindow']) ?? {};
  const departureDate = typeof dateWindow['startDate'] === 'string' ? dateWindow['startDate'] : '';
  const returnDate = typeof dateWindow['endDate'] === 'string' ? dateWindow['endDate'] : undefined;
  const seed = numericSeed(request);
  const base = cabin === 'first' ? 110_000 : cabin === 'business' ? 70_000 : cabin === 'premium' ? 42_500 : 25_000;
  const programs = [
    'Air Canada Aeroplan',
    'Avianca LifeMiles',
    'Virgin Atlantic Flying Club',
  ];

  return {
    results: programs.map((program, index) => ({
      id: `${origin}-${destination}-${cabin}-${index}`,
      provider: PROVIDER,
      source: SOURCE,
      originAirport: origin,
      destinationAirport: destination,
      departureDate,
      returnDate,
      cabin,
      program,
      points: base + ((seed + index * 7_500) % 20_000),
      seatsAvailable: 1 + ((seed + index) % 4),
      confidence: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
      lastChecked: new Date().toISOString(),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      cacheStatus: 'miss',
      stale: false,
    })),
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
        destination,
        estimatedPointsPerNight: base + (seed % 8_000),
        fit: 'best_points_value',
        note: 'Use as planning guidance until live hotel availability is connected.',
      },
      {
        chain: 'Hilton',
        destination,
        estimatedPointsPerNight: base + 15_000 + (seed % 12_000),
        fit: 'cash_compare',
        note: 'Compare against cash rates and free-night certificates.',
      },
      {
        chain: 'Marriott',
        destination,
        estimatedPointsPerNight: base + 10_000 + (seed % 10_000),
        fit: 'backup',
        note: 'Good fallback if chain preference or footprint matters more than cents per point.',
      },
    ],
  };
}

function confidenceFromRequest(request: JsonObject): number {
  const seed = numericSeed(request);
  return Number((0.62 + (seed % 25) / 100).toFixed(2));
}

function numericSeed(value: JsonObject): number {
  return parseInt(hashStableJson(value).slice(0, 8), 16);
}

function hashStableJson(value: JsonObject): string {
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

function normalizeInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
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
