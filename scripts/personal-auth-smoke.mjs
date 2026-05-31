#!/usr/bin/env node

const apiUrl = normalizeUrl(process.env.TALLY_API_URL ?? 'https://tally-api-theta.vercel.app');
const token = process.env.TALLY_AUTH_TOKEN;
const email = process.env.TALLY_AUTH_EMAIL;
const smokeCardId = 'codex_smoke_points';

if (!token || !email) {
  console.error('Missing required env vars: TALLY_AUTH_TOKEN and TALLY_AUTH_EMAIL');
  console.error('Use an Auth0 access token for audience https://api.tally.app.');
  process.exit(1);
}

const authHeaders = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

const checks = [
  {
    name: 'Provision current Auth0 user',
    run: async () => {
      const json = await request('/api/users/me', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      assert(json.email === email, `expected ${email}, got ${JSON.stringify(json)}`);
    },
  },
  {
    name: 'Balance write survives authenticated read',
    run: async () => {
      try {
        await request(`/api/balances/${smokeCardId}`, { method: 'DELETE' });
        await request(`/api/balances/${smokeCardId}`, {
          method: 'PUT',
          body: JSON.stringify({ amount: 12345 }),
        });
        const balances = await request('/api/balances');
        assert(balances[smokeCardId] === 12345, `expected smoke balance, got ${JSON.stringify(balances)}`);
      } finally {
        await request(`/api/balances/${smokeCardId}`, { method: 'DELETE' });
      }
      const afterDelete = await request('/api/balances');
      assert(!(smokeCardId in afterDelete), `expected smoke balance to be deleted, got ${JSON.stringify(afterDelete)}`);
    },
  },
  {
    name: 'Preferences save/read covers held programs',
    run: async () => {
      const existing = await request('/api/preferences');
      try {
        const updated = await request('/api/preferences', {
          method: 'PUT',
          body: JSON.stringify({
            ...(existing ?? {}),
            homeAirports: ['ORD'],
            preferredCabin: 'business',
            maxStops: 1,
            preferredPrograms: ['amex_mr'],
            heldProgramIds: ['amex_mr', 'hyatt', 'hyatt'],
            hotelChains: ['hyatt'],
            defaultTravelers: 2,
            dateFlexibility: 'plus_minus_3',
            pointValuationCpp: 1.7,
          }),
        });
        assert(
          JSON.stringify(updated.heldProgramIds) === JSON.stringify(['amex_mr', 'hyatt']),
          `expected deduped held programs, got ${JSON.stringify(updated)}`,
        );

        const reread = await request('/api/preferences');
        assert(reread?.preferredCabin === 'business', `expected saved preferences, got ${JSON.stringify(reread)}`);
      } finally {
        await request('/api/preferences', {
          method: 'PUT',
          body: JSON.stringify(existing ?? {}),
        });
      }
    },
  },
  {
    name: 'Saved searches create/edit/delete survives authenticated reads',
    run: async () => {
      let createdId = '';
      try {
        const created = await request('/api/searches', {
          method: 'POST',
          body: JSON.stringify({
            searchType: 'flight',
            originAirport: 'ORD',
            destinationAirport: 'NRT',
            destinationText: 'Tokyo',
            dateWindow: {
              startDate: localDateString(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
              endDate: localDateString(new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)),
              flexibility: 'plus_minus_3',
            },
            cabin: 'business',
            passengers: 1,
            notes: 'created by personal-auth-smoke',
          }),
        });
        assert(typeof created.id === 'string', `expected saved search id, got ${JSON.stringify(created)}`);
        createdId = created.id;

        const updatedNotes = `updated ${Date.now()}`;
        await request(`/api/searches/${createdId}`, {
          method: 'PUT',
          body: JSON.stringify({ notes: updatedNotes, lastRunAt: new Date().toISOString() }),
        });
        const searchesAfterPatch = await request('/api/searches');
        const patched = searchesAfterPatch.find(search => search.id === createdId);
        assert(patched?.notes === updatedNotes, `expected patched saved search, got ${JSON.stringify(searchesAfterPatch)}`);
      } finally {
        if (createdId) await request(`/api/searches/${createdId}`, { method: 'DELETE' });
      }
      const searchesAfterDelete = await request('/api/searches');
      assert(!searchesAfterDelete.some(search => search.id === createdId), 'expected smoke saved search to be deleted');
    },
  },
  {
    name: 'Provider-backed award availability returns cached planning signal',
    run: async () => {
      const response = await request('/api/search/award-availability', {
        method: 'POST',
        body: JSON.stringify({
          originAirport: 'ORD',
          destinationAirport: 'NRT',
          cabin: 'business',
          passengers: 1,
          dateWindow: {
            startDate: localDateString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            endDate: localDateString(new Date(Date.now() + 37 * 24 * 60 * 60 * 1000)),
            flexibility: 'plus_minus_7',
          },
          programs: ['amex_mr', 'chase_ur'],
        }),
      });
      assert(response.provider === 'tally_stub', `expected stub provider, got ${JSON.stringify(response)}`);
      assert(Array.isArray(response.results) && response.results.length > 0, `expected provider results, got ${JSON.stringify(response)}`);
    },
  },
  {
    name: 'Expiry write/delete survives authenticated reads',
    run: async () => {
      const today = localDateString();
      try {
        await request(`/api/expiry/${smokeCardId}`, {
          method: 'PUT',
          body: JSON.stringify({ lastActivityDate: today }),
        });
        const records = await request('/api/expiry');
        assert(records[smokeCardId]?.lastActivityDate === today, `expected smoke expiry, got ${JSON.stringify(records)}`);
      } finally {
        await request(`/api/expiry/${smokeCardId}`, { method: 'DELETE' });
      }
      const afterDelete = await request('/api/expiry');
      assert(!afterDelete[smokeCardId], `expected smoke expiry to be deleted, got ${JSON.stringify(afterDelete)}`);
    },
  },
  {
    name: 'Trip create/edit/delete survives authenticated reads',
    run: async () => {
      let createdId = '';
      try {
        const created = await request('/api/trips', {
          method: 'POST',
          body: JSON.stringify({
            tripType: 'flight',
            origin: 'ORD',
            destination: 'NRT',
            cabin: 'business',
            passengers: 1,
            programName: 'Codex Smoke Trip',
            ptsRequired: 75000,
            notes: 'created by personal-auth-smoke',
          }),
        });
        assert(typeof created.id === 'string', `expected created trip id, got ${JSON.stringify(created)}`);
        createdId = created.id;

        const updatedNotes = `updated ${Date.now()}`;
        await request(`/api/trips/${createdId}`, {
          method: 'PATCH',
          body: JSON.stringify({ notes: updatedNotes }),
        });
        const tripsAfterPatch = await request('/api/trips');
        const patched = tripsAfterPatch.find(trip => trip.id === createdId);
        assert(patched?.notes === updatedNotes, `expected patched trip, got ${JSON.stringify(tripsAfterPatch)}`);
      } finally {
        if (createdId) await request(`/api/trips/${createdId}`, { method: 'DELETE' });
      }
      const tripsAfterDelete = await request('/api/trips');
      assert(!tripsAfterDelete.some(trip => trip.id === createdId), 'expected smoke trip to be deleted');
    },
  },
];

let failures = 0;

console.log('Personal authenticated smoke check');
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
  console.log(`${failures} authenticated smoke check${failures === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

console.log('All authenticated smoke checks passed.');

async function request(path, init = {}) {
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init.headers ?? {}),
    },
  });
  const requestId = res.headers.get('x-request-id');
  const body = await res.text();

  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}; requestId=${requestId ?? 'missing'}; body=${body}`);
  }

  if (!body) return null;
  return JSON.parse(body);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeUrl(value) {
  return value.replace(/\/+$/, '');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
