import assert from 'node:assert/strict';
import { sanitizeProps } from './telemetry';

const sanitized = sanitizeProps({
  tab: 'wallet',
  count: 3,
  active: true,
  empty: null,
  email: 'user@example.com',
  authCode: 'secret-code',
  access_token: 'secret-token',
  password: 'secret-password',
  long: 'x'.repeat(250),
  nested: { ignored: true },
  list: ['ignored'],
});

assert.deepEqual(sanitized, {
  tab: 'wallet',
  count: 3,
  active: true,
  empty: null,
  long: 'x'.repeat(200),
});

const manyProps = Object.fromEntries(
  Array.from({ length: 25 }, (_, index) => [`prop_${index}`, index]),
);

assert.equal(Object.keys(sanitizeProps(manyProps)).length, 20);

console.log('Telemetry input check passed.');
