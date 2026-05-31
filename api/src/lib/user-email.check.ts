import assert from 'node:assert/strict';
import { fallbackEmailForAuth0Id, isFallbackEmail, normalizeUserEmail } from './user-email';

assert.equal(normalizeUserEmail(' USER@Example.COM '), 'user@example.com');
assert.equal(normalizeUserEmail(null), null);
assert.equal(normalizeUserEmail('not-an-email'), null);
assert.equal(normalizeUserEmail(`${'a'.repeat(245)}@example.com`), null);

const fallback = fallbackEmailForAuth0Id('auth0|abc123');
assert.equal(isFallbackEmail(fallback), true);
assert.equal(fallback, fallbackEmailForAuth0Id('auth0|abc123'));
assert.notEqual(fallback, fallbackEmailForAuth0Id('auth0|other'));

console.log('User email normalization check passed.');
