export type TripType = 'flight' | 'hotel';
export type CabinType = 'economy' | 'premium' | 'business' | 'first';
export type HotelCategory = 'budget' | 'mid' | 'luxury' | 'top';

export interface TripCreateInput {
  tripType: TripType;
  programName: string;
  ptsRequired: number;
  origin?: string;
  destination?: string;
  cabin?: CabinType;
  passengers?: number;
  nights?: number;
  hotelCat?: HotelCategory;
  notes?: string;
}

type ParseResult = { ok: true; data: TripCreateInput } | { ok: false; error: string };

const TRIP_TYPES = new Set<TripType>(['flight', 'hotel']);
const CABIN_TYPES = new Set<CabinType>(['economy', 'premium', 'business', 'first']);
const HOTEL_CATS = new Set<HotelCategory>(['budget', 'mid', 'luxury', 'top']);

const IATA_RE = /^[A-Z]{3}$/;
const MAX_DESTINATION_LENGTH = 160;
const MAX_PROGRAM_NAME_LENGTH = 160;
const MAX_NOTES_LENGTH = 500;
const MAX_POINTS_REQUIRED = 5_000_000;
const MAX_PASSENGERS = 9;
const MAX_NIGHTS = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimString(value: unknown, field: string, maxLength: number): { value?: string; error?: string } {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'string') {
    return { error: `${field} must be a string` };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {};
  }
  if (trimmed.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or fewer` };
  }
  return { value: trimmed };
}

function parseAirportCode(value: unknown, field: string): { value?: string; error?: string } {
  const parsed = trimString(value, field, 8);
  if (parsed.error || !parsed.value) {
    return parsed;
  }

  const airportCode = parsed.value.toUpperCase();
  if (!IATA_RE.test(airportCode)) {
    return { error: `${field} must be a 3-letter airport code` };
  }
  return { value: airportCode };
}

function parseEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: Set<T>,
): { value?: T; error?: string } {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    return { error: `${field} is invalid` };
  }
  return { value: value as T };
}

function parseIntegerRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
): { value?: number; error?: string } {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { error: `${field} must be a number` };
  }

  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    return { error: `${field} must be between ${min} and ${max}` };
  }
  return { value: rounded };
}

export function normalizeTripNotes(value: unknown): { value?: string; error?: string } {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'string') {
    return { error: 'notes must be a string' };
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_NOTES_LENGTH) {
    return { error: `notes must be ${MAX_NOTES_LENGTH} characters or fewer` };
  }
  return { value: trimmed };
}

export function parseTripCreatePayload(payload: unknown): ParseResult {
  if (!isRecord(payload)) {
    return { ok: false, error: 'Request body must be an object' };
  }

  const tripType = payload['tripType'];
  if (typeof tripType !== 'string' || !TRIP_TYPES.has(tripType as TripType)) {
    return { ok: false, error: "tripType must be 'flight' or 'hotel'" };
  }

  const programName = trimString(payload['programName'], 'programName', MAX_PROGRAM_NAME_LENGTH);
  if (programName.error) {
    return { ok: false, error: programName.error };
  }
  if (!programName.value) {
    return { ok: false, error: 'programName is required' };
  }

  const ptsRequired = payload['ptsRequired'];
  if (
    typeof ptsRequired !== 'number'
    || ptsRequired < 0
    || ptsRequired > MAX_POINTS_REQUIRED
    || !Number.isFinite(ptsRequired)
  ) {
    return {
      ok: false,
      error: `ptsRequired must be a non-negative number up to ${MAX_POINTS_REQUIRED}`,
    };
  }

  const origin = parseAirportCode(payload['origin'], 'origin');
  if (origin.error) {
    return { ok: false, error: origin.error };
  }

  const destination = tripType === 'flight'
    ? parseAirportCode(payload['destination'], 'destination')
    : trimString(payload['destination'], 'destination', MAX_DESTINATION_LENGTH);
  if (destination.error) {
    return { ok: false, error: destination.error };
  }

  const cabin = parseEnum(payload['cabin'], 'cabin', CABIN_TYPES);
  if (cabin.error) {
    return { ok: false, error: cabin.error };
  }

  const passengers = parseIntegerRange(payload['passengers'], 'passengers', 1, MAX_PASSENGERS);
  if (passengers.error) {
    return { ok: false, error: passengers.error };
  }

  const nights = parseIntegerRange(payload['nights'], 'nights', 1, MAX_NIGHTS);
  if (nights.error) {
    return { ok: false, error: nights.error };
  }

  const hotelCat = parseEnum(payload['hotelCat'], 'hotelCat', HOTEL_CATS);
  if (hotelCat.error) {
    return { ok: false, error: hotelCat.error };
  }

  const notes = normalizeTripNotes(payload['notes']);
  if (notes.error) {
    return { ok: false, error: notes.error };
  }

  return {
    ok: true,
    data: {
      tripType: tripType as TripType,
      programName: programName.value,
      ptsRequired: Math.round(ptsRequired),
      origin: origin.value,
      destination: destination.value,
      cabin: cabin.value,
      passengers: passengers.value,
      nights: nights.value,
      hotelCat: hotelCat.value,
      notes: notes.value,
    },
  };
}
