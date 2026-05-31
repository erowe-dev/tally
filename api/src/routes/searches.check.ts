process.env['AUTH0_DOMAIN'] = process.env['AUTH0_DOMAIN'] ?? 'dev-2iqdjh6lgnv6pnz5.us.auth0.com';
process.env['AUTH0_AUDIENCE'] = process.env['AUTH0_AUDIENCE'] ?? 'https://api.tally.app';

export {};

main().catch(error => {
  console.error(error);
  process.exit(1);
});

async function main(): Promise<void> {
  const { parseSavedSearch } = await import('./searches');

  const validSearch = {
    searchType: 'flight',
    destinationText: 'Paris',
    dateWindow: { startDate: futureDate(30), flexibility: 'plus_minus_3' },
  };

  assertData(
    parseSavedSearch(validSearch, true),
    'saved search should default passengers when absent',
    data => data.passengers === 1,
  );
  assertData(
    parseSavedSearch({ ...validSearch, passengers: 3 }, true),
    'saved search should accept integer passengers',
    data => data.passengers === 3,
  );
  assertError(
    parseSavedSearch({ ...validSearch, passengers: 1.5 }, true),
    'passengers must be an integer from 1 to 9',
    'saved search should reject decimal passengers',
  );
  assertError(
    parseSavedSearch({ ...validSearch, passengers: '2' }, true),
    'passengers must be an integer from 1 to 9',
    'saved search should reject string passengers',
  );
  assertData(
    parseSavedSearch({
      searchType: 'hotel',
      destinationText: 'Tokyo',
      dateWindow: { startDate: futureDate(30), endDate: futureDate(34), flexibility: 'plus_minus_7' },
      hotelIntent: {
        destination: 'Tokyo',
        checkInDate: futureDate(30),
        checkOutDate: futureDate(34),
        nights: 4,
        hotelCategory: 'luxury',
        travelers: 2,
        rooms: 1,
        preferredChains: ['Hyatt', 'Hilton', 'Hyatt'],
        ignored: { nested: 'blob' },
      },
    }, true),
    'saved hotel search should bound and dedupe hotel intent data',
    data => {
      const intent = data.hotelIntent as Record<string, unknown>;
      return intent['destination'] === 'Tokyo' &&
        JSON.stringify(intent['preferredChains']) === JSON.stringify(['Hyatt', 'Hilton']) &&
        !('ignored' in intent);
    },
  );
  assertError(
    parseSavedSearch({
      searchType: 'hotel',
      destinationText: 'Tokyo',
      dateWindow: { startDate: futureDate(30), flexibility: 'plus_minus_7' },
      hotelIntent: { destination: 'Tokyo', nights: 2.5 },
    }, true),
    'hotelIntent must be a plain object or null',
    'saved hotel search should reject malformed hotel intent data',
  );

  console.log('Saved search input checks passed.');
}

type ParseResult<T> = { data: T } | { error: string };

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
