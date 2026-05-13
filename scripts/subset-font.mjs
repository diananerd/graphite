#!/usr/bin/env node
/**
 * subset-font.mjs — optional: subset Monaspace Neon VF using pyftsubset.
 * Reduces ~400KB to ~95KB. Requires Python + fonttools.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const FONT = './public/fonts/MonaspaceNeonVarVF.woff2';
const OUT = './public/fonts/MonaspaceNeonVarVF-subset.woff2';

if (!existsSync(FONT)) {
  console.error(`✗ Font missing: ${FONT}`);
  console.error('  Run: npm run fetch:font');
  process.exit(1);
}

const probe = spawnSync('pyftsubset', ['--help'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error('✗ pyftsubset not found.');
  console.error('  Install: pip install fonttools brotli');
  process.exit(1);
}

const UNICODES = [
  'U+0020-007E',
  'U+00A0-00FF',
  'U+0100-017F',
  'U+2018-201F',
  'U+2022',
  'U+2026',
  'U+2192',
  'U+2190',
  'U+2191',
  'U+2193',
  'U+00B7',
  'U+22EF',
  'U+2550',
  'U+2551',
  'U+2502',
  'U+2500',
].join(',');

execFileSync('pyftsubset', [
  FONT,
  `--output-file=${OUT}`,
  '--flavor=woff2',
  `--unicodes=${UNICODES}`,
  '--layout-features=calt,kern,liga,ss01,ss02,ss03,ss04,ss05,ss06',
  '--no-hinting',
  '--desubroutinize',
], { stdio: 'inherit' });

console.log(`✓ Subset font: ${OUT}`);
