#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

const hasAuthSmokeEnv = Boolean(process.env.TALLY_AUTH_TOKEN && process.env.TALLY_AUTH_EMAIL);
const requireAuthSmoke = process.env.TALLY_REQUIRE_AUTH_SMOKE === '1';

await run('Public production smoke', 'node', [join(scriptDir, 'production-smoke.mjs')]);

if (hasAuthSmokeEnv) {
  await run('Authenticated production smoke', 'node', [join(scriptDir, 'personal-auth-smoke.mjs')]);
} else if (requireAuthSmoke) {
  console.error('');
  console.error('FAIL Authenticated production smoke');
  console.error('     Missing TALLY_AUTH_TOKEN and TALLY_AUTH_EMAIL while TALLY_REQUIRE_AUTH_SMOKE=1.');
  process.exit(1);
} else {
  console.log('');
  console.log('SKIP Authenticated production smoke');
  console.log('     Set TALLY_AUTH_TOKEN and TALLY_AUTH_EMAIL to exercise signed-in sync flows.');
}

console.log('');
console.log('Release smoke checks completed.');

function run(label, command, args) {
  console.log('');
  console.log(`Running ${label}...`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code ?? 'unknown'}`));
      }
    });
  }).catch(error => {
    console.error('');
    console.error(`FAIL ${label}`);
    console.error(`     ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
