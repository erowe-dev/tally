#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

const hasAuthToken = Boolean(process.env.TALLY_AUTH_TOKEN);
const hasAuthEmail = Boolean(process.env.TALLY_AUTH_EMAIL);
const hasAuthSmokeEnv = hasAuthToken && hasAuthEmail;
const hasPartialAuthSmokeEnv = hasAuthToken !== hasAuthEmail;
const requireAuthSmoke = process.env.TALLY_REQUIRE_AUTH_SMOKE === '1';
const skipDeployFreshness = process.env.TALLY_SKIP_DEPLOY_FRESHNESS === '1';
const appUrl = process.env.TALLY_APP_URL ?? 'https://tally-theta-two.vercel.app';
const apiUrl = process.env.TALLY_API_URL ?? 'https://tally-api-theta.vercel.app';
const usingCanonicalProductionAliases =
  appUrl === 'https://tally-theta-two.vercel.app' &&
  apiUrl === 'https://tally-api-theta.vercel.app';

if (skipDeployFreshness) {
  if (usingCanonicalProductionAliases) {
    console.error('');
    console.error('FAIL Deployment freshness check');
    console.error('     TALLY_SKIP_DEPLOY_FRESHNESS=1 cannot be used with the canonical production aliases.');
    process.exit(1);
  }
  console.log('');
  console.log('SKIP Deployment freshness check');
  console.log('     TALLY_SKIP_DEPLOY_FRESHNESS=1 is set; only use this for preview/custom-domain smoke.');
} else {
  await run('Deployment freshness check', 'node', [join(scriptDir, 'check-deployment-freshness.mjs')]);
}
await run('Public production smoke', 'node', [join(scriptDir, 'production-smoke.mjs')]);

if (hasPartialAuthSmokeEnv) {
  console.error('');
  console.error('FAIL Authenticated production smoke');
  console.error('     Set both TALLY_AUTH_TOKEN and TALLY_AUTH_EMAIL, or unset both to skip local signed-in smoke.');
  process.exit(1);
} else if (hasAuthSmokeEnv) {
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
