import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src/lib/route-helpers.ts'), 'utf8');

assert.match(source, /err\.status\s*=\s*428/, 'unprovisioned users must return HTTP 428');
assert.match(source, /err\.code\s*=\s*'user_not_provisioned'/, 'unprovisioned users need a stable error code');
assert.match(source, /sendError\(res,\s*status,\s*message,\s*httpErr\.code\)/, 'asyncRoute must forward typed error codes');
assert.doesNotMatch(source, /err\.status\s*=\s*404/, 'requireUser must not report provisioning races as 404');

console.log('Route helper provisioning checks passed');
