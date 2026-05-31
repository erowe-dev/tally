import assert from 'node:assert/strict';
import {
  KNOWN_PROGRAM_IDS,
  KNOWN_PROGRAM_ID_SET,
  knownProgramIdsFromJson,
  parseProgramIdArray,
} from './program-ids';
import { isKnownCardId } from './route-helpers';

assert.equal(KNOWN_PROGRAM_IDS.length, 14);
assert.equal(KNOWN_PROGRAM_IDS.length, new Set(KNOWN_PROGRAM_IDS).size, 'program ids must be unique');

for (const id of KNOWN_PROGRAM_IDS) {
  assert.match(id, /^[a-z0-9_]{1,50}$/);
  assert.equal(KNOWN_PROGRAM_ID_SET.has(id), true);
}

assert.equal(KNOWN_PROGRAM_ID_SET.has('codex_smoke_points'), false);
assert.equal(KNOWN_PROGRAM_ID_SET.has('chase-ur'), false);
assert.equal(isKnownCardId('chase_ur'), true);
assert.equal(isKnownCardId('codex_smoke_points'), false);
assert.equal(isKnownCardId('chase-ur'), false);
assert.equal(isKnownCardId(undefined), false);

assert.deepEqual(parseProgramIdArray(['amex_mr', 'hyatt', 'hyatt']), {
  data: ['amex_mr', 'hyatt'],
});
assert.deepEqual(parseProgramIdArray(['amex_mr', 'unknown_program']), {
  error: 'Unknown program id: unknown_program',
});
assert.deepEqual(parseProgramIdArray(['amex_mr', 42]), {
  error: 'Program IDs must be strings',
});
assert.deepEqual(parseProgramIdArray(['amex_mr', 'hyatt'], 1), {
  error: 'Array must contain 1 or fewer items',
});
assert.deepEqual(knownProgramIdsFromJson(['hyatt', 'unknown_program', 'hyatt', 42]), ['hyatt']);

console.log('program id allowlist checks passed');
