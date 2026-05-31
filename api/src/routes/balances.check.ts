process.env['AUTH0_DOMAIN'] = process.env['AUTH0_DOMAIN'] ?? 'dev-2iqdjh6lgnv6pnz5.us.auth0.com';
process.env['AUTH0_AUDIENCE'] = process.env['AUTH0_AUDIENCE'] ?? 'https://api.tally.app';

export {};

main().catch(error => {
  console.error(error);
  process.exit(1);
});

async function main(): Promise<void> {
  const { parseBalanceAmount } = await import('./balances');

  assertData(parseBalanceAmount(0), 'balance should allow zero', amount => amount === 0);
  assertData(parseBalanceAmount(50_000_000), 'balance should allow max balance', amount => amount === 50_000_000);
  assertError(
    parseBalanceAmount(1.5),
    'amount must be a non-negative integer ≤ 50000000',
    'balance should reject decimals',
  );
  assertError(
    parseBalanceAmount('1000'),
    'amount must be a non-negative integer ≤ 50000000',
    'balance should reject string amounts',
  );
  assertError(
    parseBalanceAmount(-1),
    'amount must be a non-negative integer ≤ 50000000',
    'balance should reject negative amounts',
  );

  console.log('Balance input checks passed.');
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
