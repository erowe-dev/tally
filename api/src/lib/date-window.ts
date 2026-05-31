import type { Prisma } from '@prisma/client';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const FLEX_VALUES = new Set(['exact', 'plus_minus_3', 'plus_minus_7', 'month', 'next_60_days']);

export type DateWindowParseResult = { data: Prisma.InputJsonObject } | { error: string };

export interface DateWindowOptions {
  requireStartDate?: boolean;
  defaultFlexibility?: string;
}

export function parseDateWindow(value: unknown, options: DateWindowOptions = {}): DateWindowParseResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'dateWindow must be a plain object' };
  }

  const input = value as Record<string, unknown>;
  const startDate = parseDateOnly(input['startDate'], 'dateWindow.startDate', options.requireStartDate ?? false);
  if ('error' in startDate) return startDate;

  const endDate = parseDateOnly(input['endDate'], 'dateWindow.endDate', false);
  if ('error' in endDate) return endDate;

  if (startDate.data && endDate.data && toDateOrdinal(endDate.data) < toDateOrdinal(startDate.data)) {
    return { error: 'dateWindow.endDate must be on or after dateWindow.startDate' };
  }

  const flexibility = parseFlexibility(input['flexibility'], options.defaultFlexibility ?? 'exact');
  if ('error' in flexibility) return flexibility;

  const tripLengthMin = parseOptionalInteger(input['tripLengthMin'], 'dateWindow.tripLengthMin', 1, 60);
  if ('error' in tripLengthMin) return tripLengthMin;

  const tripLengthMax = parseOptionalInteger(input['tripLengthMax'], 'dateWindow.tripLengthMax', 1, 60);
  if ('error' in tripLengthMax) return tripLengthMax;

  if (tripLengthMin.data != null && tripLengthMax.data != null && tripLengthMax.data < tripLengthMin.data) {
    return { error: 'dateWindow.tripLengthMax must be greater than or equal to tripLengthMin' };
  }

  const normalized: Record<string, Prisma.InputJsonValue> = {
    startDate: startDate.data ?? '',
    endDate: endDate.data ?? '',
    flexibility: flexibility.data,
  };
  if (tripLengthMin.data != null) normalized['tripLengthMin'] = tripLengthMin.data;
  if (tripLengthMax.data != null) normalized['tripLengthMax'] = tripLengthMax.data;

  return { data: normalized as Prisma.InputJsonObject };
}

export function dateWindowFromLooseFields(
  body: Record<string, unknown>,
  options: DateWindowOptions = {},
): DateWindowParseResult {
  const fromBody = body['dateWindow'];
  const source = fromBody && typeof fromBody === 'object' && !Array.isArray(fromBody)
    ? { ...(fromBody as Record<string, unknown>) }
    : {};

  if ('startDate' in body) source['startDate'] = body['startDate'];
  if ('endDate' in body) source['endDate'] = body['endDate'];
  if (!('flexibility' in source)) source['flexibility'] = options.defaultFlexibility ?? 'exact';

  return parseDateWindow(source, options);
}

function parseDateOnly(value: unknown, label: string, required: boolean): { data: string | null } | { error: string } {
  if (value === null || value === undefined || value === '') {
    return required ? { error: `${label} is required` } : { data: null };
  }
  if (typeof value !== 'string') return { error: `${label} must be a YYYY-MM-DD string` };

  const normalized = value.trim();
  if (!DATE_ONLY_RE.test(normalized) || !isRealDate(normalized)) {
    return { error: `${label} must be a valid YYYY-MM-DD date` };
  }

  const year = Number(normalized.slice(0, 4));
  if (year < 2020 || year > 2100) return { error: `${label} must be between 2020 and 2100` };
  return { data: normalized };
}

function parseFlexibility(value: unknown, fallback: string): { data: string } | { error: string } {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return FLEX_VALUES.has(candidate)
    ? { data: candidate }
    : { error: 'dateWindow.flexibility is invalid' };
}

function parseOptionalInteger(
  value: unknown,
  label: string,
  min: number,
  max: number,
): { data: number | null } | { error: string } {
  if (value === null || value === undefined || value === '') return { data: null };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { error: `${label} must be a number` };
  const rounded = Math.round(value);
  if (rounded !== value || rounded < min || rounded > max) {
    return { error: `${label} must be an integer from ${min} to ${max}` };
  }
  return { data: rounded };
}

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function toDateOrdinal(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}
