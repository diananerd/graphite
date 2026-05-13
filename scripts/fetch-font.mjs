#!/usr/bin/env node
/**
 * fetch-font.mjs — download Monaspace Neon from GitHub releases.
 *
 *   public/fonts/MonaspaceNeonVarVF.woff2  → served to browsers (variable woff2)
 *   .cache/satori-font.otf                 → used by satori at build time
 *                                            (satori cannot parse woff2)
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TARGET_WEB = './public/fonts/MonaspaceNeonVarVF.woff2';
const TARGET_OTF = './.cache/satori-font.otf';
const RELEASE_URL = 'https://api.github.com/repos/githubnext/monaspace/releases/latest';

if (existsSync(TARGET_WEB) && existsSync(TARGET_OTF)) {
  console.log(`✓ Fonts already present`);
  process.exit(0);
}

mkdirSync(dirname(TARGET_WEB), { recursive: true });
mkdirSync(dirname(TARGET_OTF), { recursive: true });

console.log(`→ Finding latest Monaspace release…`);
const releaseRes = await fetch(RELEASE_URL, {
  headers: { 'User-Agent': 'graphite-blog-fetch-font' },
});
if (!releaseRes.ok) {
  console.error(`✗ Could not fetch release metadata (HTTP ${releaseRes.status})`);
  process.exit(1);
}
const release = await releaseRes.json();
const webAsset = release.assets.find(a => /monaspace-webfont-variable.*\.zip$/i.test(a.name));
const staticAsset = release.assets.find(a => /monaspace-static.*\.zip$/i.test(a.name));
if (!webAsset || !staticAsset) {
  console.error('✗ Required zip assets missing from latest release');
  process.exit(1);
}

const { readdirSync, statSync, readFileSync } = await import('node:fs');

function walk(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

async function downloadAndExtract(asset, pattern, target) {
  console.log(`→ ${asset.name}`);
  const res = await fetch(asset.browser_download_url);
  if (!res.ok) { console.error(`✗ HTTP ${res.status}`); process.exit(1); }
  const buf = Buffer.from(await res.arrayBuffer());
  const zipPath = join(tmpdir(), `mono-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`);
  const extractDir = join(tmpdir(), `mono-extract-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  writeFileSync(zipPath, buf);
  mkdirSync(extractDir);
  execFileSync('unzip', ['-q', zipPath, '-d', extractDir]);
  const candidate = walk(extractDir).find(p => pattern.test(p));
  if (!candidate) {
    console.error(`✗ No file matching ${pattern} in ${asset.name}`);
    process.exit(1);
  }
  writeFileSync(target, readFileSync(candidate));
  console.log(`  ✓ ${target} (${(statSync(target).size / 1024).toFixed(0)}KB)`);
}

console.log(`  release: ${release.tag_name}`);
await downloadAndExtract(webAsset, /Monaspace Neon Var\.woff2$/i, TARGET_WEB);
await downloadAndExtract(staticAsset, /MonaspaceNeon-Regular\.otf$/i, TARGET_OTF);
