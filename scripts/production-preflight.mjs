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
  { label: 'Runbook documents schema-aware health', run: checkRunbookHealthContract },
  { label: 'Service worker does not cache authenticated API reads', run: checkServiceWorkerApiCache },
  { label: 'Vercel app routing serves Angular shell at root', run: checkVercelAppConfig },
  { label: 'Vercel deploy upload excludes local build artifacts', run: checkVercelIgnore },
  { label: 'Landing page remains invite-only', run: checkLandingInviteOnly },
  { label: 'Vercel API function routing exists', run: checkVercelApiConfig },
  { label: 'Observability config is explicit', run: checkObservabilityConfig },
  { label: 'Unprovisioned API users get a typed response', run: checkUnprovisionedUserContract },
  { label: 'Angular API calls require provisioned auth', run: checkAngularProvisionedAuthGuard },
  { label: 'Program ID allowlists match app data', run: checkProgramIds },
  { label: 'Production readiness workflow enforces release gates', run: checkProductionReadinessWorkflow },
  { label: 'Release smoke fails partial auth configuration', run: checkReleaseSmokePartialAuthGuard },
  { label: 'Saved search cap is concurrency-safe', run: checkSavedSearchConcurrencyGuard },
  { label: 'Saved search hotel intent is bounded', run: checkSavedSearchHotelIntentGuard },
  { label: 'Provider search is labeled as planning data', run: checkProviderSearchPlanningLabel },
  { label: 'Provider search rejects invalid numerics', run: checkProviderSearchNumericValidation },
  { label: 'Preferences reject malformed enum fields', run: checkPreferenceEnumValidation },
  { label: 'Authenticated smoke covers provider validation', run: checkAuthenticatedSmokeProviderValidation },
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

function checkRunbookHealthContract() {
  const runbook = read('PRODUCTION_RUNBOOK.md');
  assert(runbook.includes('schema: "ok"'), 'runbook must document schema-aware health readiness');
  assert(runbook.includes('version'), 'runbook must document health version metadata');
  assert(
    !/health`?\s+(?:must\s+)?(?:return|returns)[^\n]*database: "ok"`?\./.test(runbook),
    'runbook must not describe health readiness as database-only',
  );

  const readme = read('tally/README.md');
  assert(readme.includes('schema: "ok"'), 'README production checks must mention schema-aware health readiness');
  assert(
    !readme.includes('provider endpoint disabled until configured'),
    'README must not claim telemetry provider endpoint is disabled',
  );
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
    rootConfig.routes?.some(route => route.handle === 'filesystem'),
    'repo-root vercel.json must serve filesystem assets before SPA fallback',
  );
  assert(
    rootConfig.routes?.some(route => route.dest === '/index.html'),
    'repo-root vercel.json must fall back to /index.html for the Angular app shell',
  );
  assertAppVercelHeaders(rootConfig, rootConfigPath);
}

function checkVercelIgnore() {
  const ignore = read('.vercelignore').split(/\r?\n/);
  for (const entry of ['api', 'tally/node_modules', 'tally/dist', 'tally/browser', '.git', '.vercel']) {
    assert(ignore.includes(entry), `.vercelignore must exclude ${entry}`);
  }
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

function checkLandingInviteOnly() {
  const publicLanding = read('tally/public/landing/index.html');
  const legacyLanding = read('tally/landing/index.html');
  assert(
    normalizeLineEndings(publicLanding) === normalizeLineEndings(legacyLanding),
    'public and legacy landing pages must remain in sync',
  );

  for (const [label, html] of [
    ['public landing', publicLanding],
    ['legacy landing', legacyLanding],
  ]) {
    const submitButtons = [...html.matchAll(/<button\b[^>]*class="submit-btn"[^>]*>/g)];

    assert(html.includes('Private alpha is invite-only right now'), `${label} must show invite-only copy`);
    assert(html.includes('mailto:hello@tallypoints.app'), `${label} must include manual access contact mailto`);
    assert(html.includes('onsubmit="handleClosedSubmit(event)"'), `${label} waitlist forms must use the closed-submit handler`);
    assert(html.includes('function handleClosedSubmit(e)'), `${label} must define the closed-submit handler`);
    assert(!html.includes('/api/waitlist'), `${label} must not post to /api/waitlist while private alpha is closed`);
    assert(!html.includes('tally-api-theta.vercel.app/api/waitlist'), `${label} must not call the production waitlist API while closed`);
    assert(!/fetch\s*\(/.test(html), `${label} must not make client-side network submissions while waitlist is closed`);
    assert(submitButtons.length === 2, `${label} must keep both invite-only submit buttons`);
    assert(submitButtons.every(match => /\bdisabled\b/.test(match[0])), `${label} waitlist submit buttons must be disabled`);
  }
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n');
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

function checkUnprovisionedUserContract() {
  const routeHelpers = read('api/src/lib/route-helpers.ts');
  const responseHelpers = read('api/src/lib/http-response.ts');
  const helperCheck = read('api/src/lib/route-helpers.check.ts');
  assert(routeHelpers.includes('user_not_provisioned'), 'requireUser must expose user_not_provisioned code');
  assert(routeHelpers.includes('err.status = 428'), 'requireUser must return 428 for provisioning races');
  assert(routeHelpers.includes('sendError(res, status, message, httpErr.code)'), 'asyncRoute must forward typed error codes');
  assert(responseHelpers.includes('code?: string'), 'sendError must accept optional stable error codes');
  assert(helperCheck.includes('err\\.status\\s*=\\s*428'), 'route helper check must guard unprovisioned status');
}

function checkAngularProvisionedAuthGuard() {
  const api = read('tally/src/app/core/services/api.service.ts');
  const spec = read('tally/src/app/core/services/api.service.spec.ts');
  assert(api.includes('private auth = inject(AuthService)'), 'ApiService must inject AuthService');
  assert(api.includes('withProvisionedAuth'), 'ApiService must define a provision-aware auth wrapper');
  assert(api.includes('if (!this.auth.isProvisioned())'), 'ApiService must reject calls before user provisioning');
  assert(!/getBalances\(\):[\s\S]*?return this\.withAuth/.test(api), 'protected API methods must not call withAuth directly');
  assert(spec.includes('does not request a token before user provisioning finishes'), 'ApiService spec must cover provisioning gate');
}

function checkProgramIds() {
  const dataServiceIds = extractProgramIds(read('tally/src/app/core/services/data.service.ts').split('readonly flightRecs:')[0]);
  const apiIds = extractStringArray(read('api/src/lib/program-ids.ts'), 'KNOWN_PROGRAM_IDS');
  const preferenceIds = extractNewSet(read('tally/src/app/core/services/preferences.service.ts'), 'KNOWN_PROGRAM_IDS');
  const apiServiceIds = extractNewSet(read('tally/src/app/core/services/api.service.ts'), 'KNOWN_PROGRAM_IDS');

  assertListsMatch('API known program ids', apiIds, dataServiceIds);
  assertListsMatch('Preferences known program ids', preferenceIds, dataServiceIds);
  assertListsMatch('ApiService cache validator program ids', apiServiceIds, dataServiceIds);
}

function checkProductionReadinessWorkflow() {
  const workflowPath = '.github/workflows/production-readiness.yml';
  assert(existsSync(join(root, workflowPath)), 'production readiness workflow is missing');
  const workflow = read(workflowPath);

  assert(workflow.includes('pull_request:'), 'workflow must run on pull requests');
  assert(/push:\s*[\s\S]*?branches:\s*[\s\S]*?-\s*main/.test(workflow), 'workflow must run on pushes to main');
  assert(workflow.includes('workflow_dispatch:'), 'workflow must allow manual production smoke runs');
  assert(/app:\s*[\s\S]*?working-directory:\s*tally[\s\S]*?npm run preflight:prod/.test(workflow), 'app job must run production preflight');
  assert(/api:\s*[\s\S]*?working-directory:\s*api[\s\S]*?npm run verify/.test(workflow), 'API job must run npm run verify');
  assert(/api:\s*[\s\S]*?working-directory:\s*api[\s\S]*?npm run preflight:prod/.test(workflow), 'API job must run production preflight');
  assert(workflow.includes('production-smoke:'), 'workflow must define a production smoke job');
  assert(workflow.includes("if: github.event_name == 'workflow_dispatch'"), 'production smoke must stay manual-only');
  assert(workflow.includes("TALLY_REQUIRE_AUTH_SMOKE: '1'"), 'production smoke must require authenticated coverage');
  assert(workflow.includes('secrets.TALLY_AUTH_TOKEN'), 'production smoke must source TALLY_AUTH_TOKEN from secrets');
  assert(workflow.includes('secrets.TALLY_AUTH_EMAIL'), 'production smoke must source TALLY_AUTH_EMAIL from secrets');
  assert(/production-smoke:\s*[\s\S]*?npm run smoke:release/.test(workflow), 'production smoke job must run release smoke');
}

function checkReleaseSmokePartialAuthGuard() {
  const smoke = read('scripts/release-smoke.mjs');
  assert(smoke.includes('hasPartialAuthSmokeEnv'), 'release smoke must detect partial auth smoke configuration');
  assert(
    smoke.includes('Set both TALLY_AUTH_TOKEN and TALLY_AUTH_EMAIL'),
    'release smoke must fail loudly when only one signed-in smoke env var is set',
  );
}

function checkSavedSearchConcurrencyGuard() {
  const route = read('api/src/routes/searches.ts');
  assert(route.includes('createSavedSearchWithinLimit'), 'saved-search creation must use the limit helper');
  assert(
    route.includes('Prisma.TransactionIsolationLevel.Serializable'),
    'saved-search limit helper must use serializable transactions',
  );
  assert(route.includes("error.code === 'P2034'"), 'saved-search limit helper must retry Prisma serialization conflicts');
  assert(
    !/const\s+savedSearchCount\s*=\s*await\s+prisma\.savedSearch\.count[\s\S]*?prisma\.savedSearch\.create/.test(route),
    'saved-search route must not use top-level count-then-create limit enforcement',
  );
}

function checkSavedSearchHotelIntentGuard() {
  const route = read('api/src/routes/searches.ts');
  const check = read('api/src/routes/searches.check.ts');
  assert(route.includes('function parseHotelIntent'), 'saved searches must parse hotelIntent through a bounded helper');
  assert(route.includes('HOTEL_CATEGORIES'), 'saved searches must validate hotel category values');
  assert(!route.includes('return { data: record as Prisma.InputJsonObject }'), 'saved searches must not persist arbitrary hotelIntent JSON');
  assert(check.includes('ignored: { nested: '), 'saved-search input check must prove hotelIntent drops unknown nested blobs');
  assert(check.includes('nights: 2.5'), 'saved-search input check must reject malformed hotelIntent numerics');
}

function checkProviderSearchNumericValidation() {
  const route = read('api/src/routes/search.ts');
  assert(
    /function\s+normalizeInteger\([^)]*fieldName:\s*string\):\s*ParseResult<number>/.test(route),
    'provider search normalizeInteger must return ParseResult<number> with a field name',
  );
  assert(route.includes('Number.isInteger(value)'), 'provider search must reject decimal numeric values');
  for (const field of ['passengers', 'travelers', 'rooms', 'nights']) {
    assert(route.includes(`'${field}'`), `provider search must validate ${field} explicitly`);
    assert(route.includes(`if ('error' in ${field}) return { error: ${field}.error }`), `provider search must reject invalid ${field}`);
  }
  assert(
    !/function\s+normalizeInteger[\s\S]*?return\s+fallback/.test(route),
    'provider search normalizeInteger must not silently return fallback for invalid provided values',
  );
}

function checkProviderSearchPlanningLabel() {
  const route = read('api/src/routes/search.ts');
  assert(!route.includes("const PROVIDER = 'tally_stub'"), 'provider search must not expose stub provider naming');
  assert(!route.includes('seatsAvailable'), 'provider search must not expose estimated seats as live availability');
  assert(route.includes("const DATA_MODE = 'planning_estimate'"), 'provider search must label planning estimate data mode');
  assert(route.includes("const AVAILABILITY_SOURCE = 'estimated_not_live'"), 'provider search must label non-live availability source');
  assert(route.includes('isLive: false'), 'provider search responses must explicitly say they are not live');

  const models = read('tally/src/app/core/models/index.ts');
  assert(models.includes("dataMode: 'planning_estimate'"), 'app provider models must expose planning data mode');
  assert(models.includes("availabilitySource: 'estimated_not_live'"), 'app provider models must expose non-live availability source');
  assert(!models.includes('seatsAvailable'), 'app provider models must not expose estimated seats as live availability');
}

function checkPreferenceEnumValidation() {
  const route = read('api/src/routes/preferences.ts');
  const check = read('api/src/routes/preferences.check.ts');
  assert(
    /function\s+nullableString\([^)]*fieldName:\s*string\):\s*ParseResult<string\s*\|\s*null>/.test(route),
    'preferences nullableString must return ParseResult<string | null>',
  );
  assert(
    route.includes('return { error: `${fieldName} must be a string or null` }'),
    'preferences must reject non-string nullable enum fields',
  );
  assert(check.includes('preferredCabin: 42'), 'preference input check must cover non-string preferredCabin');
  assert(check.includes('dateFlexibility: false'), 'preference input check must cover non-string dateFlexibility');
}

function checkAuthenticatedSmokeProviderValidation() {
  const smoke = read('scripts/personal-auth-smoke.mjs');
  assert(smoke.includes('/api/search/award-availability'), 'authenticated smoke must cover award provider search');
  assert(smoke.includes('/api/search/hotel-fit'), 'authenticated smoke must cover hotel provider search');
  assert(smoke.includes('passengers: 1.5'), 'authenticated smoke must reject decimal award passengers');
  assert(smoke.includes("nights: '5'"), 'authenticated smoke must reject string hotel nights');
  assert(
    /expectHttpError\('\/api\/search\/award-availability'[\s\S]*?passengers:\s*1\.5[\s\S]*?,\s*400\)/.test(smoke),
    'authenticated smoke must assert invalid award passengers return 400',
  );
  assert(
    /expectHttpError\('\/api\/search\/hotel-fit'[\s\S]*?nights:\s*'5'[\s\S]*?,\s*400\)/.test(smoke),
    'authenticated smoke must assert invalid hotel nights return 400',
  );
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
