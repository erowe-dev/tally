#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const checks = [
  { label: 'No legacy Render production references', run: checkNoLegacyRenderRefs },
  { label: 'Production environment targets Vercel API', run: checkProductionApiUrl },
  { label: 'Service worker caches only approved API reads', run: checkServiceWorkerApiCache },
  { label: 'Vercel app routing serves Angular shell at root', run: checkVercelAppConfig },
  { label: 'Vercel API function routing exists', run: checkVercelApiConfig },
  { label: 'Observability config is explicit', run: checkObservabilityConfig },
  { label: 'No unused Angular starter shell files', run: checkNoStarterShellFiles },
  { label: 'No HostListener/HostBinding decorators in shell/shared components', run: checkNoHostListenerDecorator },
  { label: 'Initial bundle stays under 800 kB when stats are available', run: checkBundleBudget },
];

let failures = 0;

console.log('Production preflight');
console.log(`Workspace: ${root}`);
console.log('');

for (const check of checks) {
  try {
    check.run();
    console.log(`PASS ${check.label}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${check.label}`);
    console.log(`     ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('');
if (failures > 0) {
  console.log(`${failures} preflight check${failures === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

console.log('All production preflight checks passed.');

function checkNoLegacyRenderRefs() {
  const files = [
    'AGENTS.md',
    'PRODUCTION_RUNBOOK.md',
    'tally/src/environments/environment.production.ts',
    'tally/ngsw-config.json',
    'scripts/production-smoke.mjs',
  ];

  const offenders = files.flatMap(file => {
    const text = read(file);
    return /TODO_YOUR_RENDER_API_URL|onrender|Render API|Render Web Service/.test(text) ? [file] : [];
  });

  assert(offenders.length === 0, `legacy Render references found in ${offenders.join(', ')}`);
}

function checkProductionApiUrl() {
  const text = read('tally/src/environments/environment.production.ts');
  assert(text.includes("apiUrl: 'https://tally-api-theta.vercel.app'"), 'production apiUrl must point to Vercel API');
  assert(!text.includes('TODO_'), 'production environment still contains TODO placeholder');
}

function checkServiceWorkerApiCache() {
  const config = JSON.parse(read('tally/ngsw-config.json'));
  const groups = config.dataGroups ?? [];
  const allUrls = groups.flatMap(group => group.urls ?? []);

  assert(allUrls.includes('https://tally-api-theta.vercel.app/api/balances'), 'missing balances API dataGroup URL');
  assert(allUrls.includes('https://tally-api-theta.vercel.app/api/expiry'), 'missing expiry API dataGroup URL');
  assert(!allUrls.some(url => /\/api\/trips|\/api\/users|\/api\/waitlist/.test(url)), 'service worker must not cache write/provisioning/waitlist endpoints');
}

function checkVercelAppConfig() {
  const configPath = 'tally/vercel.json';
  assert(existsSync(join(root, configPath)), 'tally/vercel.json is missing');
  const config = JSON.parse(read(configPath));
  assert(
    config.buildCommand === 'npm run build && node scripts/prepare-vercel-output.mjs',
    'tally/vercel.json must build and prepare the Vercel browser output',
  );
  assert(config.outputDirectory === 'browser', 'tally/vercel.json must serve the prepared browser output');
  assert(
    config.routes?.some(route => route.handle === 'filesystem'),
    'tally/vercel.json must serve filesystem assets before SPA fallback',
  );
  assert(
    config.routes?.some(route => route.dest === '/index.html'),
    'tally/vercel.json must fall back to /index.html for the Angular app shell',
  );
  assert(existsSync(join(root, 'tally/public/landing/index.html')), 'landing page must remain available from public/landing');
  assert(
    existsSync(join(root, 'tally/landing/scripts/prepare-vercel-output.mjs')),
    'landing-root Vercel output prep script is missing',
  );

  const rootConfigPath = 'vercel.json';
  assert(existsSync(join(root, rootConfigPath)), 'repo-root vercel.json is missing');
  const rootConfig = JSON.parse(read(rootConfigPath));
  assert(rootConfig.installCommand === 'npm ci', 'repo-root vercel.json must install dependencies from the Vercel project root');
  assert(
    rootConfig.buildCommand === 'npm run build && node scripts/prepare-vercel-output.mjs',
    'repo-root vercel.json must build and prepare the Vercel browser output',
  );
  assert(rootConfig.outputDirectory === 'browser', 'repo-root vercel.json must serve the prepared browser output');
  assert(
    rootConfig.routes?.some(route => route.dest === '/index.html'),
    'repo-root vercel.json must fall back to /index.html for the Angular app shell',
  );
}

function checkVercelApiConfig() {
  const configPath = 'api/vercel.json';
  assert(existsSync(join(root, configPath)), 'api/vercel.json is missing');
  const config = JSON.parse(read(configPath));
  assert(config.routes?.some(route => route.dest === 'src/index.ts'), 'api/vercel.json must route requests to src/index.ts');
}

function checkObservabilityConfig() {
  const devEnv = read('tally/src/environments/environment.ts');
  assert(devEnv.includes('analytics:'), 'dev environment missing analytics config');
  assert(devEnv.includes('errorReporting:'), 'dev environment missing errorReporting config');

  const prodEnv = read('tally/src/environments/environment.production.ts');
  assert(prodEnv.includes('analytics:'), 'production environment missing analytics config');
  assert(prodEnv.includes('errorReporting:'), 'production environment missing errorReporting config');
  assert(/analytics:\s*{[\s\S]*?enabled:\s*true/.test(prodEnv), 'production analytics must be enabled');
  assert(/errorReporting:\s*{[\s\S]*?enabled:\s*true/.test(prodEnv), 'production error reporting must be enabled');
  assert(
    prodEnv.includes("endpoint: 'https://tally-api-theta.vercel.app/api/telemetry/analytics'"),
    'production analytics endpoint must target the telemetry API',
  );
  assert(
    prodEnv.includes("endpoint: 'https://tally-api-theta.vercel.app/api/telemetry/errors'"),
    'production error reporting endpoint must target the telemetry API',
  );

  const apiText = read('api/src/index.ts');
  assert(apiText.includes('X-Request-Id'), 'API must emit X-Request-Id');
  assert(apiText.includes('service: \'tally-api\''), 'API health must identify service name');
  assert(apiText.includes("app.use('/api/telemetry'"), 'API must mount telemetry routes');
  assert(existsSync(join(root, 'api/src/routes/telemetry.ts')), 'telemetry route file is missing');
}

function checkNoHostListenerDecorator() {
  const files = [
    'tally/src/app/app.component.ts',
    'tally/src/app/shared/components/bottom-nav/bottom-nav.component.ts',
    'tally/src/app/shared/components/toast/toast.component.ts',
    'tally/src/app/shared/components/onboarding/onboarding.component.ts',
  ];
  const offenders = files.filter(file => existsSync(join(root, file)) && /@HostListener|@HostBinding/.test(read(file)));
  assert(offenders.length === 0, `host decorators found in ${offenders.join(', ')}`);
}

function checkNoStarterShellFiles() {
  const files = [
    'tally/src/app/app.component.html',
    'tally/src/app/app.component.scss',
  ];
  const offenders = files.filter(file => existsSync(join(root, file)));
  assert(offenders.length === 0, `unused starter shell files found: ${offenders.join(', ')}`);
}

function checkBundleBudget() {
  const browserDir = 'tally/dist/tally/browser';
  const indexPath = `${browserDir}/index.html`;
  if (!existsSync(join(root, indexPath))) {
    console.log('SKIP Initial bundle budget needs a production build; run `npm run build:pwa` first.');
    return;
  }

  const html = read(indexPath);
  const assetNames = new Set(
    [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => match[1]),
  );
  const initialBytes = [...assetNames].reduce((total, asset) => {
    const file = join(root, browserDir, asset);
    return total + (existsSync(file) ? statSync(file).size : 0);
  }, 0);

  assert(initialBytes <= 800_000, `initial bundle exceeds 800 kB: ${initialBytes} bytes`);
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
