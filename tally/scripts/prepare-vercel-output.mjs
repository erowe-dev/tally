#!/usr/bin/env node

import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const browserOutput = join(root, 'dist', 'tally', 'browser');
const flatOutput = join(root, 'dist', 'tally');
const target = join(root, 'browser');

const source = existsSync(join(browserOutput, 'index.html')) ? browserOutput : flatOutput;

if (!existsSync(join(source, 'index.html'))) {
  throw new Error(`Angular build output is missing index.html in ${browserOutput} or ${flatOutput}`);
}

rmSync(target, { force: true, recursive: true });
cpSync(source, target, { recursive: true });

console.log(`Prepared Vercel output: ${target}`);
