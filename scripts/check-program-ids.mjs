#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const dataServiceIds = extractProgramIds(
  read('tally/src/app/core/services/data.service.ts').split('readonly flightRecs:')[0],
);
const apiIds = extractStringArray(read('api/src/lib/program-ids.ts'), 'KNOWN_PROGRAM_IDS');
const preferenceIds = extractNewSet(read('tally/src/app/core/services/preferences.service.ts'), 'KNOWN_PROGRAM_IDS');

assertSame('API known program ids', apiIds, dataServiceIds);
assertSame('Preferences known program ids', preferenceIds, dataServiceIds);

console.log(`Program ID check passed (${dataServiceIds.length} programs).`);

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function extractProgramIds(source) {
  return [...source.matchAll(/\bid:\s*'([^']+)'/g)].map(match => match[1]);
}

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) throw new Error(`Could not find ${name} array`);
  return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
}

function extractNewSet(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*new\\s+Set\\s*\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`));
  if (!match) throw new Error(`Could not find ${name} set`);
  return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
}

function assertSame(label, actual, expected) {
  const actualList = actual.join(',');
  const expectedList = expected.join(',');
  if (actualList !== expectedList) {
    throw new Error(`${label} drifted from DataService cards.\nExpected: ${expectedList}\nActual:   ${actualList}`);
  }

  const duplicates = actual.filter((id, index) => actual.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`${label} contains duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
  }
}
