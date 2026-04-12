#!/usr/bin/env node
/**
 * generate-icons.mjs
 * Run once to produce all PWA icon sizes.
 * Requires: npm install canvas (or sharp)
 * Usage: node generate-icons.mjs
 *
 * If you don't want to run this script, use any online PWA icon generator
 * (e.g. https://progressier.com/pwa-icons-generator) with the tally-icon.svg below.
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT_DIR = './public/icons';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.18; // border radius

  // Background — Tally green
  ctx.fillStyle = '#1a7a4a';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Tally mark — 4 vertical lines + 1 diagonal
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.085;
  ctx.lineCap = 'round';

  const pad = size * 0.22;
  const top = size * 0.23;
  const bot = size * 0.77;
  const positions = [pad, size * 0.38, size * 0.62, size - pad];

  positions.forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bot);
    ctx.stroke();
  });

  // Diagonal cross stroke
  ctx.beginPath();
  ctx.moveTo(size * 0.12, bot - size * 0.06);
  ctx.lineTo(size * 0.88, top + size * 0.06);
  ctx.stroke();

  return canvas;
}

SIZES.forEach(size => {
  const canvas = drawIcon(size);
  const out = path.join(OUT_DIR, `icon-${size}x${size}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(out, buffer);
  console.log(`✓ ${out}`);
});

console.log('\nAll icons generated. Add canvas to devDependencies:');
console.log('npm install --save-dev canvas');
