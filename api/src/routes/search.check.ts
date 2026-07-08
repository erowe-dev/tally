process.env['AUTH0_DOMAIN'] = process.env['AUTH0_DOMAIN'] ?? 'dev-2iqdjh6lgnv6pnz5.us.auth0.com';
process.env['AUTH0_AUDIENCE'] = process.env['AUTH0_AUDIENCE'] ?? 'https://api.tally.app';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export {};

main().catch(error => {
  console.error(error);
  process.exit(1);
});

async function main(): Promise<void> {
  const { normalizeAwardRequest, normalizeHotelRequest } = await import('./search');

  const validAward = {
    originAirport: 'ORD',
    destinationAirport: 'CDG',
    startDate: futureDate(30),
  };

  assertData(
    normalizeAwardRequest(validAward),
    'award search should default passengers when absent',
    data => data.passengers === 1,
  );
  assertError(
    normalizeAwardRequest({ ...validAward, passengers: 1.5 }),
    'passengers must be an integer from 1 to 9',
    'award search should reject decimal passengers',
  );
  assertError(
    normalizeAwardRequest({ ...validAward, passengers: 10 }),
    'passengers must be an integer from 1 to 9',
    'award search should reject out-of-range passengers',
  );
  assertError(
    normalizeAwardRequest({ ...validAward, passengers: '2' }),
    'passengers must be an integer from 1 to 9',
    'award search should reject string passengers',
  );

  const searchSource = readFileSync(join(__dirname, 'search.ts'), 'utf8');
  assert(
    searchSource.includes("verificationStatus: 'verified_live'") &&
      searchSource.includes("isLive: true") &&
      !searchSource.includes('estimatedSeatCount') &&
      !searchSource.includes('buildAwardSignal') &&
      searchSource.includes('createConfiguredHttpProvider') &&
      searchSource.includes('/discover') &&
      searchSource.includes('/verify') &&
      searchSource.includes('createSeatsAeroProvider') &&
      searchSource.includes('Partner-Authorization') &&
      searchSource.includes('/search') &&
      searchSource.includes('/live'),
    'award search should only expose verified live results, never deterministic price estimates',
  );

  const validHotel = { destination: 'Paris' };
  assertData(
    normalizeHotelRequest(validHotel),
    'hotel search should default numeric fields when absent',
    data => data['travelers'] === 1 && data['rooms'] === 1 && data['nights'] === 1,
  );
  assertData(
    normalizeHotelRequest({ ...validHotel, travelers: null, rooms: null, nights: null }),
    'hotel search should default numeric fields when null',
    data => data['travelers'] === 1 && data['rooms'] === 1 && data['nights'] === 1,
  );
  assertData(
    normalizeHotelRequest({
      destination: 'Paris',
      checkInDate: futureDate(30),
      checkOutDate: futureDate(34),
      preferredChains: ['Hyatt', 'Hilton', 'Hyatt'],
    }),
    'hotel search should accept the app hotel intent shape',
    data =>
      data['nights'] === 4 &&
      JSON.stringify(data['chains']) === JSON.stringify(['Hyatt', 'Hilton']) &&
      (data['dateWindow'] as Record<string, unknown>)['startDate'] === futureDate(30),
  );
  assertError(
    normalizeHotelRequest({ ...validHotel, travelers: 0 }),
    'travelers must be an integer from 1 to 9',
    'hotel search should reject out-of-range travelers',
  );
  assertError(
    normalizeHotelRequest({ ...validHotel, rooms: 2.5 }),
    'rooms must be an integer from 1 to 4',
    'hotel search should reject decimal rooms',
  );
  assertError(
    normalizeHotelRequest({ ...validHotel, nights: '5' }),
    'nights must be an integer from 1 to 30',
    'hotel search should reject string nights',
  );

  console.log('Provider search input checks passed.');
}

type ParseResult<T> = { data: T } | { error: string };

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertData<T>(result: ParseResult<T>, message: string, predicate: (data: T) => boolean): void {
  if ('error' in result) throw new Error(`${message}: ${result.error}`);
  if (!predicate(result.data)) throw new Error(message);
}

function assertError(result: ParseResult<unknown>, expectedError: string, message: string): void {
  if (!('error' in result)) throw new Error(message);
  if (result.error !== expectedError) {
    throw new Error(`${message}: expected "${expectedError}", got "${result.error}"`);
  }
}

function futureDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}
