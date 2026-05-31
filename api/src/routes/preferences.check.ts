process.env['AUTH0_DOMAIN'] = process.env['AUTH0_DOMAIN'] ?? 'dev-2iqdjh6lgnv6pnz5.us.auth0.com';
process.env['AUTH0_AUDIENCE'] = process.env['AUTH0_AUDIENCE'] ?? 'https://api.tally.app';

export {};

main().catch(error => {
  console.error(error);
  process.exit(1);
});

async function main(): Promise<void> {
  const { parsePreferences } = await import('./preferences');

  assertData(
    parsePreferences({
      homeAirports: ['oma', 'CDG', 'OMA'],
      maxStops: 1,
      defaultTravelers: 2,
      heldProgramIds: ['hyatt', 'amex_mr', 'hyatt'],
      pointValuationCpp: 1.7,
    }),
    'preferences should normalize valid data',
    data =>
      JSON.stringify(data.homeAirports) === JSON.stringify(['OMA', 'CDG']) &&
      JSON.stringify(data.heldProgramIds) === JSON.stringify(['hyatt', 'amex_mr']),
  );
  assertData(
    parsePreferences({ maxStops: null, defaultTravelers: null }),
    'preferences should allow nullable numeric fields',
    data => data.maxStops === null && data.defaultTravelers === null,
  );
  assertData(
    parsePreferences({ preferredCabin: null, dateFlexibility: null }),
    'preferences should allow nullable enum fields',
    data => data.preferredCabin === null && data.dateFlexibility === null,
  );
  assertError(
    parsePreferences({ preferredCabin: 42 }),
    'preferredCabin must be a string or null',
    'preferences should reject non-string preferredCabin',
  );
  assertError(
    parsePreferences({ dateFlexibility: false }),
    'dateFlexibility must be a string or null',
    'preferences should reject non-string dateFlexibility',
  );
  assertError(
    parsePreferences({ maxStops: 1.5 }),
    'maxStops must be an integer from 0 to 2',
    'preferences should reject decimal maxStops',
  );
  assertError(
    parsePreferences({ defaultTravelers: 2.5 }),
    'defaultTravelers must be an integer from 1 to 9',
    'preferences should reject decimal defaultTravelers',
  );
  assertError(
    parsePreferences({ heldProgramIds: ['hyatt', 'not_a_program'] }),
    'Unknown held program id: not_a_program',
    'preferences should reject unknown held programs',
  );

  console.log('Preference input checks passed.');
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
