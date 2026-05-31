#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const teamId = process.env.TALLY_VERCEL_TEAM_ID ?? 'team_jdcUPNYX4V3zsoeFSLSCkLtx';
const toleranceMs = Number(process.env.TALLY_DEPLOY_FRESHNESS_TOLERANCE_MS ?? 120_000);

const targets = [
  {
    label: 'App',
    url: process.env.TALLY_APP_URL ?? 'https://tally-theta-two.vercel.app',
    projectId: process.env.TALLY_APP_PROJECT_ID ?? 'prj_SvxfAHWhMTnJxHwhJcfkzwbN9yzn',
    expectedRootDirectory: 'tally',
    paths: [
      '.vercelignore',
      'tally/angular.json',
      'tally/ngsw-config.json',
      'tally/package.json',
      'tally/src',
      'tally/vercel.json',
      'vercel.json',
    ],
  },
  {
    label: 'API',
    url: process.env.TALLY_API_URL ?? 'https://tally-api-theta.vercel.app',
    projectId: process.env.TALLY_API_PROJECT_ID ?? 'prj_YDaGg8AXfjdWi6KlN0qj6GP6lyp0',
    paths: [
      'api/package.json',
      'api/prisma',
      'api/src',
      'api/vercel.json',
    ],
  },
];

let failures = 0;

console.log('Deployment freshness check');
console.log('');

for (const target of targets) {
  try {
    assertProjectSettings(target);
    const latestCommit = latestCommitFor(target.paths);
    const deployment = inspectDeployment(target.url);
    const deployedAt = new Date(deployment.createdAt);
    const commitAt = new Date(latestCommit.epochSeconds * 1000);
    const staleByMs = latestCommit.epochSeconds * 1000 - deployment.createdAt;

    if (staleByMs > toleranceMs) {
      failures += 1;
      console.log(`FAIL ${target.label} deployment is stale`);
      console.log(`     alias: ${target.url}`);
      console.log(`     deployment: ${deployment.url} (${deployedAt.toISOString()})`);
      console.log(`     latest commit: ${latestCommit.hash} (${commitAt.toISOString()})`);
      console.log(`     stale by: ${formatDuration(staleByMs)}`);
    } else {
      console.log(`PASS ${target.label} deployment is fresh`);
      console.log(`     alias: ${target.url}`);
      console.log(`     deployment: ${deployment.url} (${deployedAt.toISOString()})`);
      console.log(`     latest commit: ${latestCommit.hash} (${commitAt.toISOString()})`);
    }
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${target.label} deployment freshness could not be checked`);
    console.log(`     ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log('');
}

if (failures > 0) {
  console.log(`${failures} deployment freshness check${failures === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

console.log('All deployment freshness checks passed.');

function assertProjectSettings(target) {
  if (!target.expectedRootDirectory) return;

  const result = run('npx', [
    'vercel',
    'api',
    `/v9/projects/${target.projectId}?teamId=${teamId}`,
    '--raw',
  ]);
  const project = JSON.parse(extractFirstJsonObject(result));
  if (project.rootDirectory !== target.expectedRootDirectory) {
    throw new Error(
      `Expected Vercel project rootDirectory ${JSON.stringify(target.expectedRootDirectory)}, got ${JSON.stringify(project.rootDirectory)}`,
    );
  }
}

function latestCommitFor(paths) {
  const result = run('git', ['log', '-1', '--format=%H%x09%ct', '--', ...paths]);
  const [hash, epochText] = result.trim().split('\t');
  const epochSeconds = Number(epochText);
  if (!hash || !Number.isFinite(epochSeconds)) {
    throw new Error(`Could not determine latest commit for ${paths.join(', ')}`);
  }
  return { hash: hash.slice(0, 12), epochSeconds };
}

function inspectDeployment(url) {
  const result = run('npx', ['vercel', 'inspect', url, '--format=json']);
  const json = JSON.parse(extractFirstJsonObject(result));
  if (typeof json.createdAt !== 'number' || typeof json.url !== 'string') {
    throw new Error(`Unexpected Vercel inspect response for ${url}`);
  }
  return json;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result.stdout;
}

function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('No JSON object found in command output');

  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error('Unterminated JSON object in command output');
}

function formatDuration(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
