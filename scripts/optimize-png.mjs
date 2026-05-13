#!/usr/bin/env node
/**
 * optimize-png.mjs — lossless PNG optimization via oxipng (if installed).
 * Falls back to a no-op (with warning) when oxipng is missing.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { statSync, existsSync } from 'node:fs';

const files = process.argv.slice(2).filter(f => f.endsWith('.png') && existsSync(f));
if (files.length === 0) process.exit(0);

const probe = spawnSync('oxipng', ['--version'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.warn('⚠ oxipng not found — PNGs left unoptimized.');
  console.warn('  Install: brew install oxipng  (macOS)');
  console.warn('           sudo apt install oxipng  (Ubuntu)');
  process.exit(0);
}

let namingErrors = 0;
for (const file of files) {
  const name = file.split('/').pop().replace('.png', '');
  if (/[A-Z_\s]/.test(name)) {
    console.error(`✗ Invalid image name: "${name}.png" — use kebab-case`);
    namingErrors++;
  }
}
if (namingErrors > 0) process.exit(1);

for (const file of files) {
  const size = statSync(file).size;
  if (size > 5 * 1024 * 1024) {
    console.error(`✗ ${file}: ${(size / 1024 / 1024).toFixed(1)}MB exceeds 5MB limit`);
    process.exit(1);
  }
}

for (const file of files) {
  const before = statSync(file).size;
  execFileSync('oxipng', [
    '--opt', 'max',
    '--strip', 'all',
    '--quiet',
    '--in-place',
    file,
  ]);
  const after = statSync(file).size;
  const pct = (((before - after) / before) * 100).toFixed(1);
  console.log(`✓ ${file.split('/').pop()}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB (−${pct}%)`);
  try {
    execFileSync('git', ['add', file]);
  } catch { /* not in a git repo or already staged */ }
}

console.log(`\n✓ ${files.length} PNG(s) optimized`);
