#!/usr/bin/env node

const appUrl = normalizeUrl(process.env.TALLY_APP_URL ?? 'https://tally-theta-two.vercel.app');
const apiUrl = normalizeUrl(process.env.TALLY_API_URL ?? 'https://tally-api-theta.vercel.app');

const checks = [
  {
    name: 'API health returns ok',
    run: async () => {
      const res = await fetch(`${apiUrl}/health`);
      const body = await readBody(res);
      assert(res.ok, `expected 2xx, got ${res.status}: ${body}`);
      assert(res.headers.get('x-request-id'), 'missing X-Request-Id header');
      const json = JSON.parse(body);
      assert(json.status === 'ok', `expected status ok, got ${body}`);
      assert(json.service === 'tally-api', `expected service tally-api, got ${body}`);
      assert(json.database === 'ok', `expected database ok, got ${body}`);
    },
  },
  {
    name: 'Angular app shell is served',
    run: async () => {
      const res = await fetch(appUrl);
      const body = await readBody(res);
      assert(res.ok, `expected 2xx, got ${res.status}`);
      assert(
        body.includes('<app-root') && body.includes('Tally — Points Advisor'),
        'expected Angular app shell HTML, got a different page',
      );
    },
  },
  {
    name: 'Landing page remains available under /landing/',
    run: async () => {
      const res = await fetch(`${appUrl}/landing/`);
      const body = await readBody(res);
      assert(res.ok, `expected 2xx, got ${res.status}`);
      assert(
        body.includes('Know what to do with your points') && body.includes('Private alpha is invite-only right now'),
        'expected bundled invite-only landing page at /landing/',
      );
    },
  },
  {
    name: 'PWA manifest references generated icons',
    run: async () => {
      const res = await fetch(`${appUrl}/manifest.webmanifest`);
      const body = await readBody(res);
      assert(res.ok, `expected 2xx, got ${res.status}: ${body}`);
      const manifest = JSON.parse(body);
      const icons = (manifest.icons ?? []).map(icon => icon.src);
      assert(icons.includes('icons/icon-192x192.png'), 'missing 192x192 icon');
      assert(icons.includes('icons/icon-512x512.png'), 'missing 512x512 icon');
    },
  },
  {
    name: 'PWA icon asset is reachable',
    run: async () => {
      const res = await fetch(`${appUrl}/icons/icon-192x192.png`);
      assert(res.ok, `expected 2xx, got ${res.status}`);
      assert(
        (res.headers.get('content-type') ?? '').includes('image/png'),
        `expected image/png, got ${res.headers.get('content-type')}`,
      );
    },
  },
  {
    name: 'Protected API routes reject unauthenticated requests',
    run: async () => {
      const protectedRequests = [
        { path: '/api/users/me', init: { method: 'POST', body: JSON.stringify({ email: 'smoke@example.com' }) } },
        { path: '/api/balances' },
        { path: '/api/expiry' },
        { path: '/api/trips' },
        { path: '/api/preferences' },
        { path: '/api/preferences', init: { method: 'DELETE' } },
        { path: '/api/searches' },
        {
          path: '/api/search/award-availability',
          init: {
            method: 'POST',
            body: JSON.stringify({
              originAirport: 'ORD',
              destinationAirport: 'NRT',
              cabin: 'business',
              passengers: 1,
            }),
          },
        },
        {
          path: '/api/search/hotel-fit',
          init: {
            method: 'POST',
            body: JSON.stringify({
              destination: 'Tokyo',
              hotelCategory: 'mid',
              travelers: 1,
              rooms: 1,
              nights: 3,
            }),
          },
        },
      ];

      for (const { path, init } of protectedRequests) {
        const res = await fetch(`${apiUrl}${path}`, {
          ...init,
          headers: {
            ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init?.headers ?? {}),
          },
        });
        assert(
          res.status === 401 || res.status === 403,
          `${path} expected 401/403, got ${res.status}`,
        );
        assert(res.headers.get('x-request-id'), `${path} missing X-Request-Id header`);
      }
    },
  },
  {
    name: 'Waitlist API reports private alpha closed',
    run: async () => {
      const res = await fetch(`${apiUrl}/api/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://tallypoints.app',
        },
        body: JSON.stringify({ email: 'not-an-email' }),
      });
      const body = await readBody(res);
      assert(res.status === 410, `expected 410 for closed waitlist, got ${res.status}: ${body}`);
      assert(body.includes('contactEmail'), `expected contactEmail in closed response, got ${body}`);
      assert(
        res.headers.get('access-control-allow-origin') === 'https://tallypoints.app',
        'expected CORS allow-origin for tallypoints.app',
      );
    },
  },
  {
    name: 'API rejects disallowed browser origins without 500s',
    run: async () => {
      const res = await fetch(`${apiUrl}/health`, {
        headers: { Origin: 'https://not-tally.example' },
      });
      const body = await readBody(res);
      assert(res.status === 403, `expected 403 for disallowed origin, got ${res.status}: ${body}`);
      assert(res.headers.get('x-request-id'), 'disallowed CORS response missing X-Request-Id header');
    },
  },
  {
    name: 'Telemetry endpoints accept valid payloads and reject bad events',
    run: async () => {
      const timestamp = new Date().toISOString();
      const analyticsRes = await fetch(`${apiUrl}/api/telemetry/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: appUrl,
        },
        body: JSON.stringify({
          event: 'tab_viewed',
          properties: { tab: 'smoke', source: 'production_smoke' },
          timestamp,
        }),
      });
      assert(analyticsRes.status === 204, `analytics expected 204, got ${analyticsRes.status}`);
      assert(analyticsRes.headers.get('x-request-id'), 'analytics missing X-Request-Id header');

      const errorsRes = await fetch(`${apiUrl}/api/telemetry/errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: appUrl,
        },
        body: JSON.stringify({
          message: 'production smoke',
          context: 'smoke',
          url: appUrl,
          timestamp,
        }),
      });
      assert(errorsRes.status === 204, `errors expected 204, got ${errorsRes.status}`);
      assert(errorsRes.headers.get('x-request-id'), 'errors missing X-Request-Id header');

      const invalidRes = await fetch(`${apiUrl}/api/telemetry/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: appUrl,
        },
        body: JSON.stringify({ event: 'unknown_event', timestamp }),
      });
      const invalidBody = await readBody(invalidRes);
      assert(invalidRes.status === 400, `invalid analytics expected 400, got ${invalidRes.status}: ${invalidBody}`);

      const noOriginRes = await fetch(`${apiUrl}/api/telemetry/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'tab_viewed',
          properties: { tab: 'smoke' },
          timestamp,
        }),
      });
      const noOriginBody = await readBody(noOriginRes);
      assert(noOriginRes.status === 403, `no-origin analytics expected 403, got ${noOriginRes.status}: ${noOriginBody}`);
    },
  },
  {
    name: 'Service worker does not cache authenticated API reads',
    run: async () => {
      const res = await fetch(`${appUrl}/ngsw.json`);
      const body = await readBody(res);
      assert(res.ok, `expected 2xx, got ${res.status}: ${body}`);
      const ngsw = JSON.parse(body);
      const urls = JSON.stringify(ngsw.dataGroups ?? []);
      assert(
        !urls.includes(`${apiUrl}/api/`) && !(urls.includes('tally-api') && urls.includes('api\\\\/')),
        'service worker must not cache authenticated API endpoints',
      );
      assert(!urls.includes('/api/users'), 'must not cache user provisioning');
      assert(!urls.includes('/api/balances'), 'must not cache balances in service worker');
      assert(!urls.includes('/api/expiry'), 'must not cache expiry in service worker');
      assert(!urls.includes('/api/trips'), 'must not cache trips in service worker');
      assert(!urls.includes('/api/waitlist'), 'must not cache waitlist writes');
    },
  },
];

let failures = 0;

console.log(`Production smoke check`);
console.log(`App: ${appUrl}`);
console.log(`API: ${apiUrl}`);
console.log('');

for (const check of checks) {
  try {
    await check.run();
    console.log(`PASS ${check.name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${check.name}`);
    console.log(`     ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('');
if (failures > 0) {
  console.log(`${failures} production smoke check${failures === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

console.log('All production smoke checks passed.');

function normalizeUrl(value) {
  return value.replace(/\/+$/, '');
}

async function readBody(res) {
  return await res.text();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
