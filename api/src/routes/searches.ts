import { Router } from 'express';
import { Prisma, type SavedSearch } from '@prisma/client';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncRoute, requireUser } from '../lib/route-helpers';
import { parseDateWindow } from '../lib/date-window';
import { sendError } from '../lib/http-response';

const router = Router();

const SEARCH_TYPES = new Set(['flight', 'hotel']);
const CABIN_TYPES = new Set(['economy', 'premium', 'business', 'first']);
const HOTEL_CATEGORIES = new Set(['budget', 'mid', 'luxury', 'top']);
const IATA_RE = /^[A-Z]{3}$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SAVED_SEARCHES = 5;

router.get(
  '/',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const searches = await prisma.savedSearch.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(searches.map(toSavedSearchDto));
  }),
);

router.post(
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

    const parsed = parseSavedSearch(body, true);
    if ('error' in parsed) {
      sendError(res, 400, parsed.error);
      return;
    }
    const createData = toCreateData(parsed.data);
    if ('error' in createData) {
      sendError(res, 400, createData.error);
      return;
    }

    const search = await createSavedSearchWithinLimit(user.id, createData.data);
    if (!search) {
      sendError(res, 409, `Saved search limit is ${MAX_SAVED_SEARCHES}`);
      return;
    }

    res.status(201).json(toSavedSearchDto(search));
  }),
);

router.put(
  '/:id',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const id = validateId(req.params['id']);
    if (!id) {
      sendError(res, 400, 'Invalid search id');
      return;
    }

    const body = asRecord(req.body);
    if (!body) {
      sendError(res, 400, 'Request body must be an object');
      return;
    }

    const parsed = parseSavedSearch(body, false);
    if ('error' in parsed) {
      sendError(res, 400, parsed.error);
      return;
    }

    const result = await prisma.savedSearch.updateMany({
      where: { id, userId: user.id },
      data: toUpdateData(parsed.data),
    });

    if (result.count === 0) {
      sendError(res, 404, 'Saved search not found');
      return;
    }

    const updated = await prisma.savedSearch.findFirstOrThrow({
      where: { id, userId: user.id },
    });
    res.json(toSavedSearchDto(updated));
  }),
);

router.delete(
  '/:id',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const id = validateId(req.params['id']);
    if (!id) {
      sendError(res, 400, 'Invalid search id');
      return;
    }

    const result = await prisma.savedSearch.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      sendError(res, 404, 'Saved search not found');
      return;
    }

    res.status(204).send();
  }),
);

export default router;

type ParseResult<T> = { data: T } | { error: string };
type SavedSearchCreateFields = {
  searchType: string;
  originAirport?: string | null;
  destinationAirport?: string | null;
  destinationText: string;
  dateWindow: Prisma.InputJsonValue;
  cabin?: string | null;
  passengers?: number;
  hotelIntent?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  notes?: string | null;
  lastRunAt?: Date | null;
};
type ParsedSavedSearch = {
  searchType?: string;
  originAirport?: string | null;
  destinationAirport?: string | null;
  destinationText?: string;
  dateWindow?: Prisma.InputJsonValue;
  cabin?: string | null;
  passengers?: number;
  hotelIntent?: Prisma.InputJsonValue | null;
  notes?: string | null;
  lastRunAt?: Date | null;
};

export function parseSavedSearch(body: Record<string, unknown>, requireType: boolean): ParseResult<ParsedSavedSearch> {
  const data: ParsedSavedSearch = {};

  if ('searchType' in body) {
    const searchType = body['searchType'];
    if (typeof searchType !== 'string' || !SEARCH_TYPES.has(searchType)) {
      return { error: "searchType must be 'flight' or 'hotel'" };
    }
    data.searchType = searchType;
  } else if (requireType) {
    return { error: "searchType must be 'flight' or 'hotel'" };
  }

  if ('originAirport' in body) {
    const origin = nullableIata(body['originAirport']);
    if ('error' in origin) return { error: 'originAirport must be a three-letter IATA code' };
    data.originAirport = origin.data;
  }

  if ('destinationAirport' in body) {
    const destination = nullableIata(body['destinationAirport']);
    if ('error' in destination) return { error: 'destinationAirport must be a three-letter IATA code' };
    data.destinationAirport = destination.data;
  }

  if ('destinationText' in body) {
    const destinationText = nullableString(body['destinationText'], 160);
    if (destinationText !== null) data.destinationText = destinationText;
  } else if (requireType) {
    return { error: 'destinationText is required' };
  }

  if ('dateWindow' in body) {
    const dateWindow = parseDateWindow(body['dateWindow'], { defaultFlexibility: 'plus_minus_3' });
    if ('error' in dateWindow) return { error: dateWindow.error };
    data.dateWindow = dateWindow.data;
  } else if (requireType) {
    return { error: 'dateWindow is required' };
  }

  if ('cabin' in body) {
    const cabin = nullableString(body['cabin'], 20);
    if (cabin !== null && !CABIN_TYPES.has(cabin)) {
      return { error: "cabin must be 'economy', 'premium', 'business', or 'first'" };
    }
    data.cabin = cabin;
  }

  if ('passengers' in body) {
    const passengers = nullableInteger(body['passengers'], 1, 9);
    if ('error' in passengers || passengers.data === null) return { error: 'passengers must be an integer from 1 to 9' };
    data.passengers = passengers.data;
  } else if (requireType) {
    data.passengers = 1;
  }

  if ('hotelIntent' in body) {
    const hotelIntent = body['hotelIntent'] === null ? { data: null } : parseHotelIntent(body['hotelIntent']);
    if ('error' in hotelIntent) return { error: 'hotelIntent must be a plain object or null' };
    data.hotelIntent = hotelIntent.data;
  }

  if ('notes' in body) data.notes = nullableString(body['notes'], 1000);

  if ('lastRunAt' in body) {
    const parsed = parseDateTime(body['lastRunAt']);
    if ('error' in parsed) return { error: 'lastRunAt must be an ISO date string or null' };
    data.lastRunAt = parsed.data;
  }

  return { data };
}

function toSavedSearchDto(search: SavedSearch) {
  return {
    id: search.id,
    searchType: search.searchType,
    originAirport: search.originAirport ?? undefined,
    destinationAirport: search.destinationAirport ?? undefined,
    destinationText: search.destinationText,
    dateWindow: search.dateWindow,
    cabin: search.cabin ?? undefined,
    passengers: search.passengers,
    hotelIntent: search.hotelIntent ?? undefined,
    notes: search.notes ?? undefined,
    lastRunAt: search.lastRunAt?.toISOString(),
    createdAt: search.createdAt.toISOString(),
    updatedAt: search.updatedAt.toISOString(),
  };
}

async function createSavedSearchWithinLimit(userId: string, data: SavedSearchCreateFields): Promise<SavedSearch | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async tx => {
          const savedSearchCount = await tx.savedSearch.count({ where: { userId } });
          if (savedSearchCount >= MAX_SAVED_SEARCHES) return null;
          return tx.savedSearch.create({ data: { userId, ...data } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isSerializableWriteConflict(error) || attempt === 2) throw error;
    }
  }

  return null;
}

function isSerializableWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function toCreateData(data: ParsedSavedSearch): ParseResult<SavedSearchCreateFields> {
  if (!data.searchType) return { error: "searchType must be 'flight' or 'hotel'" };
  if (!data.destinationText) return { error: 'destinationText is required' };
  if (!data.dateWindow) return { error: 'dateWindow is required' };
  const updateData = toUpdateData(data);
  return {
    data: {
      originAirport: data.originAirport,
      destinationAirport: data.destinationAirport,
      cabin: data.cabin,
      passengers: data.passengers,
      hotelIntent: updateData.hotelIntent,
      notes: data.notes,
      lastRunAt: data.lastRunAt,
      searchType: data.searchType,
      destinationText: data.destinationText,
      dateWindow: data.dateWindow,
    },
  };
}

function toUpdateData(data: ParsedSavedSearch): Prisma.SavedSearchUpdateManyMutationInput {
  const update: Prisma.SavedSearchUpdateManyMutationInput = {};
  if ('searchType' in data) update.searchType = data.searchType;
  if ('originAirport' in data) update.originAirport = data.originAirport;
  if ('destinationAirport' in data) update.destinationAirport = data.destinationAirport;
  if ('destinationText' in data) update.destinationText = data.destinationText;
  if ('dateWindow' in data) update.dateWindow = data.dateWindow;
  if ('cabin' in data) update.cabin = data.cabin;
  if ('passengers' in data) update.passengers = data.passengers;
  if ('hotelIntent' in data) update.hotelIntent = data.hotelIntent === null ? Prisma.JsonNull : data.hotelIntent;
  if ('notes' in data) update.notes = data.notes;
  if ('lastRunAt' in data) update.lastRunAt = data.lastRunAt;
  return update;
}

function parseHotelIntent(value: unknown): ParseResult<Prisma.InputJsonValue> {
  const record = asRecord(value);
  if (!record) return { error: 'Expected a plain object' };

  const destination = requiredString(record['destination'], 160);
  if ('error' in destination) return destination;

  const checkInDate = optionalDateOnly(record['checkInDate'], 'checkInDate');
  if ('error' in checkInDate) return checkInDate;

  const checkOutDate = optionalDateOnly(record['checkOutDate'], 'checkOutDate');
  if ('error' in checkOutDate) return checkOutDate;

  const nights = optionalInteger(record['nights'], 'nights', 1, 30);
  if ('error' in nights) return nights;

  const hotelCategory = optionalString(record['hotelCategory'], 30);
  if ('error' in hotelCategory) return hotelCategory;
  if (hotelCategory.data && !HOTEL_CATEGORIES.has(hotelCategory.data)) return { error: 'hotelCategory is invalid' };

  const travelers = optionalInteger(record['travelers'], 'travelers', 1, 9);
  if ('error' in travelers) return travelers;

  const rooms = optionalInteger(record['rooms'], 'rooms', 1, 4);
  if ('error' in rooms) return rooms;

  const preferredChains = optionalStringArray(record['preferredChains'], 'preferredChains', 20);
  if ('error' in preferredChains) return preferredChains;

  const normalized: Record<string, Prisma.InputJsonValue> = { destination: destination.data };
  if (checkInDate.data) normalized['checkInDate'] = checkInDate.data;
  if (checkOutDate.data) normalized['checkOutDate'] = checkOutDate.data;
  if (nights.data != null) normalized['nights'] = nights.data;
  if (hotelCategory.data) normalized['hotelCategory'] = hotelCategory.data;
  if (travelers.data != null) normalized['travelers'] = travelers.data;
  if (rooms.data != null) normalized['rooms'] = rooms.data;
  if (preferredChains.data) normalized['preferredChains'] = preferredChains.data;
  return { data: normalized as Prisma.InputJsonObject };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nullableString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function requiredString(value: unknown, maxLength: number): ParseResult<string> {
  if (typeof value !== 'string') return { error: 'required string is missing' };
  const normalized = value.trim().slice(0, maxLength);
  return normalized ? { data: normalized } : { error: 'required string is missing' };
}

function optionalString(value: unknown, maxLength: number): ParseResult<string | null> {
  if (value === null || value === undefined) return { data: null };
  if (typeof value !== 'string') return { error: 'invalid string' };
  const normalized = value.trim().slice(0, maxLength);
  return { data: normalized || null };
}

function optionalInteger(value: unknown, label: string, min: number, max: number): ParseResult<number | null> {
  if (value === null || value === undefined) return { data: null };
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    return { error: `${label} must be an integer from ${min} to ${max}` };
  }
  return { data: value };
}

function optionalStringArray(value: unknown, label: string, maxItems: number): ParseResult<string[] | null> {
  if (value === null || value === undefined) return { data: null };
  if (!Array.isArray(value)) return { error: `${label} must be an array of strings` };
  if (value.length > maxItems) return { error: `${label} must contain ${maxItems} or fewer items` };
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return { error: `${label} values must be strings` };
    const normalized = item.trim().slice(0, 80);
    if (normalized) result.push(normalized);
  }
  return { data: [...new Set(result)] };
}

function optionalDateOnly(value: unknown, label: string): ParseResult<string | null> {
  if (value === null || value === undefined || value === '') return { data: null };
  if (typeof value !== 'string') return { error: `${label} must be a YYYY-MM-DD string` };
  const normalized = value.trim();
  if (!DATE_ONLY_RE.test(normalized) || !isRealDate(normalized)) {
    return { error: `${label} must be a valid YYYY-MM-DD date` };
  }
  return { data: normalized };
}

function nullableIata(value: unknown): ParseResult<string | null> {
  if (value === null || value === undefined) return { data: null };
  if (typeof value !== 'string') return { error: 'invalid code' };
  const normalized = value.trim().toUpperCase();
  return IATA_RE.test(normalized) ? { data: normalized } : { error: 'invalid code' };
}

function nullableInteger(value: unknown, min: number, max: number): ParseResult<number | null> {
  if (value === null || value === undefined) return { data: null };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { error: 'invalid number' };
  if (!Number.isInteger(value) || value < min || value > max) return { error: 'out of range' };
  return { data: value };
}

function parseDateTime(value: unknown): ParseResult<Date | null> {
  if (value === null || value === undefined) return { data: null };
  if (typeof value !== 'string') return { error: 'invalid date' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: 'invalid date' };
  return { data: date };
}

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateId(id: string | undefined): string | null {
  if (!id || id.length > 100) return null;
  return id;
}
