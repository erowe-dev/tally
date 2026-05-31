import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/routes/waitlist.ts', 'utf8');

assert.match(source, /status:\s*410|sendError\(res,\s*410/, 'waitlist route must return HTTP 410 while private alpha is closed');
assert.match(source, /waitlist_closed/, 'waitlist route must include a stable waitlist_closed error code');
assert.match(source, /Cache-Control['"],\s*['"]no-store/, 'closed waitlist response must be non-cacheable');
assert.doesNotMatch(source, /WAITLIST_WEBHOOK_URL|fetch\(|axios|request\(/, 'closed waitlist route must not call external webhooks');

console.log('Waitlist closed-route checks passed.');
