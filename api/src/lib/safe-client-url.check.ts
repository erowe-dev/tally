import assert from 'node:assert/strict';
import { sanitizeClientUrl } from './safe-client-url';

assert.equal(
  sanitizeClientUrl('https://tally-theta-two.vercel.app/wallet?token=secret#frag'),
  'https://tally-theta-two.vercel.app/wallet',
);
assert.equal(sanitizeClientUrl('/optimizer?code=secret#frag'), '/optimizer');
assert.equal(sanitizeClientUrl('not a url'), undefined);
assert.equal(sanitizeClientUrl(null), undefined);

console.log('Safe client URL check passed.');
