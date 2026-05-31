import { Router } from 'express';
import type { Prisma, UserPreference } from '@prisma/client';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncRoute, requireUser } from '../lib/route-helpers';
import { KNOWN_PROGRAM_IDS, knownProgramIdsFromJson, parseProgramIdArray } from '../lib/program-ids';
import { sendError } from '../lib/http-response';

const router = Router();

const CABIN_TYPES = new Set(['economy', 'premium', 'business', 'first']);
const FLEXIBILITY_TYPES = new Set(['exact', 'plus_minus_3', 'plus_minus_7', 'month', 'next_60_days']);
const IATA_RE = /^[A-Z]{3}$/;
const MAX_HELD_PROGRAMS = KNOWN_PROGRAM_IDS.length;

router.get(
  '/',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const preferences = await prisma.userPreference.findUnique({
      where: { userId: user.id },
    });
    res.json(preferences ? toPreferenceDto(preferences) : null);
  }),
);

router.put(
  '/',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const body = asRecord(req.body);
    if (!body) {
      sendError(res, 400, 'Request body must be an object');
      return;
    }

    const parsed = parsePreferences(body);
    if ('error' in parsed) {
      sendError(res, 400, parsed.error);
      return;
    }

    const preferences = await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: parsed.data,
      create: { userId: user.id, ...parsed.data },
    });

    res.json(toPreferenceDto(preferences));
  }),
);

router.delete(
  '/',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    await prisma.userPreference.deleteMany({
      where: { userId: user.id },
    });
    res.status(204).send();
  }),
);

export default router;

type ParseResult<T> = { data: T } | { error: string };

function parsePreferences(body: Record<string, unknown>): ParseResult<{
  homeAirports?: Prisma.InputJsonValue;
  preferredCabin?: string | null;
  maxStops?: number | null;
  preferredPrograms?: Prisma.InputJsonValue;
  heldProgramIds?: Prisma.InputJsonValue;
  hotelChains?: Prisma.InputJsonValue;
  defaultTravelers?: number | null;
  dateFlexibility?: string | null;
  pointValuationCpp?: number | null;
}> {
  const data: {
    homeAirports?: Prisma.InputJsonValue;
    preferredCabin?: string | null;
    maxStops?: number | null;
    preferredPrograms?: Prisma.InputJsonValue;
    heldProgramIds?: Prisma.InputJsonValue;
    hotelChains?: Prisma.InputJsonValue;
    defaultTravelers?: number | null;
    dateFlexibility?: string | null;
    pointValuationCpp?: number | null;
  } = {};

  if ('homeAirports' in body) {
    const airports = parseStringArray(body['homeAirports'], 10, true);
    if ('error' in airports) return airports;
    data.homeAirports = airports.data;
  }

  if ('preferredCabin' in body) {
    const cabin = nullableString(body['preferredCabin'], 20);
    if (cabin !== null && !CABIN_TYPES.has(cabin)) {
      return { error: "preferredCabin must be 'economy', 'premium', 'business', or 'first'" };
    }
    data.preferredCabin = cabin;
  }

  if ('maxStops' in body) {
    const stops = nullableInteger(body['maxStops'], 0, 2);
    if ('error' in stops) return { error: 'maxStops must be an integer from 0 to 2' };
    data.maxStops = stops.data;
  }

  if ('preferredPrograms' in body) {
    const programs = parseProgramIdArray(body['preferredPrograms'], MAX_HELD_PROGRAMS);
    if ('error' in programs) return programs;
    data.preferredPrograms = programs.data;
  }

  if ('heldProgramIds' in body) {
    const heldPrograms = parseKnownProgramIds(body['heldProgramIds']);
    if ('error' in heldPrograms) return heldPrograms;
    data.heldProgramIds = heldPrograms.data;
  }

  if ('hotelChains' in body) {
    const chains = parseStringArray(body['hotelChains'], 30, false);
    if ('error' in chains) return chains;
    data.hotelChains = chains.data;
  }

  if ('defaultTravelers' in body) {
    const travelers = nullableInteger(body['defaultTravelers'], 1, 9);
    if ('error' in travelers) return { error: 'defaultTravelers must be an integer from 1 to 9' };
    data.defaultTravelers = travelers.data;
  }

  if ('dateFlexibility' in body) {
    const flexibility = nullableString(body['dateFlexibility'], 30);
    if (flexibility !== null && !FLEXIBILITY_TYPES.has(flexibility)) {
      return { error: 'dateFlexibility is not supported' };
    }
    data.dateFlexibility = flexibility;
  }

  if ('pointValuationCpp' in body) {
    const pointValuationCpp = nullableNumber(body['pointValuationCpp'], 0.1, 10);
    if ('error' in pointValuationCpp) return { error: 'pointValuationCpp must be a number from 0.1 to 10' };
    data.pointValuationCpp = pointValuationCpp.data;
  }

  return { data };
}

function toPreferenceDto(preferences: UserPreference) {
  return {
    homeAirports: asStringArray(preferences.homeAirports),
    preferredCabin: preferences.preferredCabin ?? 'business',
    maxStops: preferences.maxStops ?? 1,
    preferredPrograms: knownProgramIdsFromJson(preferences.preferredPrograms),
    heldProgramIds: knownProgramIdsFromJson(preferences.heldProgramIds),
    hotelChains: asStringArray(preferences.hotelChains),
    defaultTravelers: preferences.defaultTravelers ?? 1,
    dateFlexibility: preferences.dateFlexibility ?? 'plus_minus_3',
    pointValuationCpp: preferences.pointValuationCpp ?? 1.6,
    updatedAt: preferences.updatedAt.toISOString(),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nullableString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  return value.trim().slice(0, maxLength);
}

function nullableInteger(value: unknown, min: number, max: number): ParseResult<number | null> {
  if (value === null || value === undefined) return { data: null };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { error: 'invalid number' };
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return { error: 'out of range' };
  return { data: rounded };
}

function nullableNumber(value: unknown, min: number, max: number): ParseResult<number | null> {
  if (value === null || value === undefined) return { data: null };
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return { error: 'out of range' };
  }
  return { data: value };
}

function parseStringArray(value: unknown, maxItems: number, iataOnly: boolean): ParseResult<string[]> {
  if (!Array.isArray(value)) return { error: 'Expected an array of strings' };
  if (value.length > maxItems) return { error: `Array must contain ${maxItems} or fewer items` };

  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return { error: 'Array values must be strings' };
    const trimmed = item.trim().slice(0, 80);
    const normalized = iataOnly ? trimmed.toUpperCase() : trimmed;
    if (!normalized) continue;
    if (iataOnly && !IATA_RE.test(normalized)) return { error: 'Airport codes must be three-letter IATA codes' };
    result.push(normalized);
  }

  return { data: [...new Set(result)] };
}

function parseKnownProgramIds(value: unknown): ParseResult<string[]> {
  const parsed = parseProgramIdArray(value, MAX_HELD_PROGRAMS);
  return 'error' in parsed
    ? { error: parsed.error.replace('Unknown program id:', 'Unknown held program id:') }
    : parsed;
}

function asStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
