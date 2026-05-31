#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const report = runAudit();
const counts = report.metadata?.vulnerabilities ?? {};
const critical = Number(counts.critical ?? 0);

if (critical > 0) {
  console.error(`Angular app production audit has ${critical} critical vulnerabilit${critical === 1 ? 'y' : 'ies'}.`);
  console.error('Run npm audit --omit=dev from tally/ and address the critical finding before release.');
  process.exit(1);
}

const high = Number(counts.high ?? 0);
const moderate = Number(counts.moderate ?? 0);
const low = Number(counts.low ?? 0);
const total = Number(counts.total ?? 0);

console.log(
  `Angular app production audit baseline accepted: ${total} known finding${total === 1 ? '' : 's'} ` +
    `(${critical} critical, ${high} high, ${moderate} moderate, ${low} low).`,
);
console.log('Critical findings remain release-blocking; existing Angular 18 findings remain a tracked public-beta gate.');

function runAudit() {
  try {
    const stdout = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(stdout);
  } catch (error) {
    if (!error.stdout) throw error;
    return JSON.parse(String(error.stdout));
  }
}
