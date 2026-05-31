#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const appSecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
};

const checks = [
  { label: 'No legacy Render production references', run: checkNoLegacyRenderRefs },
  { label: 'Production environment targets Vercel API', run: checkProductionApiUrl },
  { label: 'Service worker does not cache authenticated API reads', run: checkServiceWorkerApiCache },
  { label: 'Vercel app routing serves Angular shell at root', run: checkVercelAppConfig },
  { label: 'Vercel API function routing exists', run: checkVercelApiConfig },
  { label: 'Observability config is explicit', run: checkObservabilityConfig },
  { label: 'Program ID allowlists match app data', run: checkProgramIds },
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

  assert(
    !allUrls.some(url => /tally-api-theta\.vercel\.app\/api\//.test(url)),
    'service worker must not cache authenticated API endpoints; services use localStorage read-through caches',
  );
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
  assertAppVercelHeaders(config, configPath);
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
  assertAppVercelHeaders(rootConfig, rootConfigPath);
}

function assertAppVercelHeaders(config, configPath) {
  const securityHeader = config.headers?.find(header => header.source === '/(.*)');
  assert(securityHeader, `${configPath} must define app-wide security headers`);

  for (const [key, value] of Object.entries(appSecurityHeaders)) {
    assert(
      securityHeader.headers?.some(header => header.key === key && header.value === value),
      `${configPath} must set ${key}: ${value} on all app shell responses`,
    );
  }

  assert(
    config.headers?.some(
      header =>
        header.source === '/ngsw.json' &&
        header.headers?.some(item => item.key === 'Cache-Control' && item.value === 'no-cache'),
    ),
    `${configPath} must prevent stale service worker manifests with Cache-Control: no-cache`,
  );
  assert(
    config.headers?.some(
      header =>
        header.source === '/index.html' &&
        header.headers?.some(item => item.key === 'Cache-Control' && item.value === 'no-cache'),
    ),
    `${configPath} must prevent stale app shell HTML with Cache-Control: no-cache`,
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

function checkProgramIds() {
  const dataServiceIds = extractProgramIds(read('tally/src/app/core/services/data.service.ts').split('readonly flightRecs:')[0]);
  const apiIds = extractStringArray(read('api/src/lib/program-ids.ts'), 'KNOWN_PROGRAM_IDS');
  const preferenceIds = extractNewSet(read('tally/src/app/core/services/preferences.service.ts'), 'KNOWN_PROGRAM_IDS');

  assertListsMatch('API known program ids', apiIds, dataServiceIds);
  assertListsMatch('Preferences known program ids', preferenceIds, dataServiceIds);
}

function extractProgramIds(source) {
  return [...source.matchAll(/\bid:\s*'([^']+)'/g)].map(match => match[1]);
}

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  assert(match, `could not find ${name} array`);
  return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
}

function extractNewSet(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*new\\s+Set\\s*\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`));
  assert(match, `could not find ${name} set`);
  return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
}

function assertListsMatch(label, actual, expected) {
  const duplicates = actual.filter((id, index) => actual.indexOf(id) !== index);
  assert(duplicates.length === 0, `${label} contains duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
  assert(actual.join(',') === expected.join(','), `${label} drifted from DataService cards`);
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
