#!/usr/bin/env node
/**
 * assert-build.mjs — verify build output meets quality thresholds.
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = './dist';
let failed = false;

const kb = (bytes) => (bytes / 1024).toFixed(1) + 'KB';
const size = (p) => statSync(p).size;

const assert = (cond, msg) => {
  if (!cond) { console.error('✗', msg); failed = true; } else console.log('✓', msg);
};
const note = (msg) => console.log('ℹ', msg);

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('✗ dist/index.html missing — build failed');
  process.exit(1);
}

const indexSize = size(join(DIST, 'index.html'));
assert(indexSize < 40 * 1024, `index.html ${kb(indexSize)} < 40KB`);

const astroDir = join(DIST, '_astro');
if (existsSync(astroDir)) {
  const cssFiles = readdirSync(astroDir).filter(f => f.endsWith('.css'));
  const cssTotal = cssFiles.reduce((s, f) => s + size(join(astroDir, f)), 0);
  if (cssTotal > 0) {
    assert(cssTotal < 25 * 1024, `_astro CSS total ${kb(cssTotal)} < 25KB`);
  }
  const jsFiles = readdirSync(astroDir).filter(f => f.endsWith('.js'));
  const jsTotal = jsFiles.reduce((s, f) => s + size(join(astroDir, f)), 0);
  if (jsTotal === 0) {
    console.log('✓ Zero JS runtime in _astro/');
  } else if (jsTotal < 10 * 1024) {
    note(`Minimal JS present: ${kb(jsTotal)} (acceptable)`);
  } else {
    assert(false, `JS runtime ${kb(jsTotal)} >= 10KB — check for hydration leaks`);
  }
}

// public/.assetsignore must end up in dist/ so wrangler skips uploading
// content images during deploy (originals live in R2, not the static bundle).
assert(
  existsSync(join(DIST, '.assetsignore')),
  'dist/.assetsignore present — wrangler will skip uploading content images'
);

assert(existsSync(join(DIST, 'og', 'home.png')), 'OG image generated: dist/og/home.png');
assert(existsSync(join(DIST, 'rss.xml')), 'RSS feed generated: dist/rss.xml');

const sitemapIndex = join(DIST, 'sitemap-index.xml');
const sitemap = join(DIST, 'sitemap-0.xml');
assert(existsSync(sitemapIndex) || existsSync(sitemap), 'Sitemap generated');

// Image dimensions in all HTML files
const htmlFiles = [];
function findHtml(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) findHtml(p);
    else if (f.name.endsWith('.html')) htmlFiles.push(p);
  }
}
findHtml(DIST);

let imgsWithoutDims = 0;
for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  // Strip <svg>...</svg> blocks so we don't flag inline SVG inner content
  const stripped = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  const imgs = [...stripped.matchAll(/<img([^>]*)>/g)];
  for (const m of imgs) {
    const attrs = m[1];
    const hasW = /\bwidth=/i.test(attrs);
    const hasH = /\bheight=/i.test(attrs);
    if (!hasW || !hasH) {
      const src = attrs.match(/src="([^"]+)"/)?.[1] ?? '?';
      console.warn(`  ⚠ <img> without dimensions: ${src} in ${htmlFile.replace(DIST, '')}`);
      imgsWithoutDims++;
    }
  }
}
if (imgsWithoutDims > 0) {
  console.warn(`⚠ ${imgsWithoutDims} image(s) without width/height — CLS risk`);
} else {
  console.log('✓ All images have explicit dimensions');
}

if (failed) {
  console.error('\n✗ Build assertions failed — deploy blocked.');
  process.exit(1);
}
console.log('\n✓ All build assertions passed.');
