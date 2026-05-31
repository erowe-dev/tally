import assert from 'node:assert/strict';
import { buildAllowedOrigins, normalizeOrigin } from './origin-allowlist';

assert.equal(normalizeOrigin(' https://example.com/ '), 'https://example.com');
assert.equal(normalizeOrigin('https://example.com'), 'https://example.com');
assert.equal(normalizeOrigin('http://localhost:4200/'), 'http://localhost:4200');
assert.equal(normalizeOrigin('https://example.com/path'), null);
assert.equal(normalizeOrigin('https://example.com?token=secret'), null);
assert.equal(normalizeOrigin('javascript:alert(1)'), null);
assert.equal(normalizeOrigin('not a url'), null);
assert.equal(normalizeOrigin(null), null);

assert.deepEqual(
  buildAllowedOrigins(' https://custom.example/ , https://custom.example, https://bad.example/path, ftp://bad.example '),
  [
    'http://localhost:4200',
    'https://tally-theta-two.vercel.app',
    'https://tally.vercel.app',
    'https://tallypoints.app',
    'https://www.tallypoints.app',
    'https://custom.example',
  ],
);

console.log('Origin allowlist checks passed.');
