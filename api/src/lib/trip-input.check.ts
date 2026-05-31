import assert from 'node:assert/strict';
import { normalizeTripNotes, parseTripCreatePayload } from './trip-input';

const validFlight = parseTripCreatePayload({
  tripType: 'flight',
  origin: 'ord',
  destination: 'nrt',
  cabin: 'business',
  passengers: 1,
  programName: '  Air Canada Aeroplan  ',
  ptsRequired: 75_000.4,
  notes: '  window seat  ',
});

assert.equal(validFlight.ok, true);
if (validFlight.ok) {
  assert.equal(validFlight.data.origin, 'ORD');
  assert.equal(validFlight.data.destination, 'NRT');
  assert.equal(validFlight.data.programName, 'Air Canada Aeroplan');
  assert.equal(validFlight.data.ptsRequired, 75_000);
  assert.equal(validFlight.data.notes, 'window seat');
}

const validHotel = parseTripCreatePayload({
  tripType: 'hotel',
  destination: '  New York  ',
  nights: 3,
  hotelCat: 'luxury',
  programName: 'World of Hyatt',
  ptsRequired: 90_000,
});

assert.equal(validHotel.ok, true);
if (validHotel.ok) {
  assert.equal(validHotel.data.destination, 'New York');
  assert.equal(validHotel.data.nights, 3);
}

const invalidCases: Array<[string, unknown]> = [
  ['non-object payload', null],
  ['bad trip type', { tripType: 'cruise', programName: 'Test', ptsRequired: 1 }],
  ['blank program', { tripType: 'flight', programName: ' ', ptsRequired: 1 }],
  ['invalid flight origin', { tripType: 'flight', origin: 'Chicago', programName: 'Test', ptsRequired: 1 }],
  ['invalid flight destination', { tripType: 'flight', destination: 'Tokyo', programName: 'Test', ptsRequired: 1 }],
  ['too many passengers', { tripType: 'flight', passengers: 10, programName: 'Test', ptsRequired: 1 }],
  ['too many nights', { tripType: 'hotel', nights: 61, programName: 'Test', ptsRequired: 1 }],
  ['too many points', { tripType: 'hotel', programName: 'Test', ptsRequired: 5_000_001 }],
  ['bad cabin', { tripType: 'flight', cabin: 'lie-flat', programName: 'Test', ptsRequired: 1 }],
  ['bad hotel category', { tripType: 'hotel', hotelCat: 'palace', programName: 'Test', ptsRequired: 1 }],
];

for (const [label, payload] of invalidCases) {
  const result = parseTripCreatePayload(payload);
  assert.equal(result.ok, false, `${label} should be rejected`);
}

const blankNotes = normalizeTripNotes('   ');
assert.equal(blankNotes.error, undefined);
assert.equal(blankNotes.value, '');

const longNotes = normalizeTripNotes('x'.repeat(501));
assert.equal(longNotes.error, 'notes must be 500 characters or fewer');

console.log('trip input checks passed');
