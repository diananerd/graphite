#!/usr/bin/env node
/**
 * generate-og.mjs — render the home OG card as 1200×630 PNG.
 *
 * Uses Satori + resvg. Reads brand from blog.config.ts.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Satori needs an unpacked OTF/TTF (it cannot parse woff2). The fetch-font
// script extracts a static OTF alongside the woff2 we ship to the browser.
const FONT_PATH = './.cache/satori-font.otf';
const OUT_DIR = './public/og';
const OUT_PATH = `${OUT_DIR}/home.png`;

// Load brand config (TS → import via tsx-like compile would fail; parse the literal).
async function loadBlogConfig() {
  try {
    // Try dynamic import — works when Node supports TS (24+ via --experimental-strip-types)
    // or when a JS twin exists.
    const url = pathToFileURL('./blog.config.ts').toString();
    const mod = await import(url);
    return mod.default ?? mod.blogConfig;
  } catch {
    // Fallback: parse the file with a tiny regex extractor for the literals we need.
    const src = readFileSync('./blog.config.ts', 'utf8');
    const grab = (key) => src.match(new RegExp(`${key}:\\s*['"\`]([^'"\`]+)['"\`]`))?.[1] ?? '';
    return {
      site: {
        name: grab('name'),
        domain: grab('domain'),
      },
      og: {
        tagline: grab('tagline'),
      },
      terminal: {
        prompt: grab('prompt'),
      },
    };
  }
}

const config = await loadBlogConfig();

if (!existsSync(FONT_PATH)) {
  console.warn(`⚠ Font missing: ${FONT_PATH} — generating placeholder OG image`);
  // Tiny 1×1 PNG placeholder so build doesn't crash.
  const tinyPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x04, 0xB0, 0x00, 0x00, 0x02, 0x76,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54,
    0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05,
    0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00,
    0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
  ]);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, tinyPng);
  process.exit(0);
}

let satori, Resvg;
try {
  ({ default: satori } = await import('satori'));
  ({ Resvg } = await import('@resvg/resvg-js'));
} catch (err) {
  console.warn(`⚠ satori/resvg not installed — writing 1×1 placeholder OG. ${err.message}`);
  mkdirSync(OUT_DIR, { recursive: true });
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  writeFileSync(OUT_PATH, tinyPng);
  process.exit(0);
}

const fontRegular = readFileSync(FONT_PATH);
const siteName = config.site.name;
const tagline = config.og?.tagline ?? config.site.description ?? '';
const domain = config.site.domain;
const prompt = config.terminal?.prompt ?? '';

const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: '1200px',
        height: '630px',
        background: '#181818',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        fontFamily: 'Monaspace Neon',
        position: 'relative',
        boxSizing: 'border-box',
        border: '1px solid #2d2d2b',
      },
      children: [
        prompt && {
          type: 'div',
          props: {
            style: { color: '#6a6a68', fontSize: '20px', marginBottom: '32px' },
            children: prompt,
          },
        },
        {
          type: 'div',
          props: {
            style: { color: '#e0ddd6', fontSize: '76px', fontWeight: 600, lineHeight: 1.1 },
            children: siteName,
          },
        },
        tagline && {
          type: 'div',
          props: {
            style: { color: '#8faacc', fontSize: '26px', marginTop: '24px' },
            children: tagline,
          },
        },
        domain && {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: '80px',
              right: '80px',
              color: '#6a6a68',
              fontSize: '18px',
            },
            children: domain,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: 0,
              top: 0,
              width: '4px',
              height: '100%',
              background: '#8faacc',
            },
          },
        },
      ].filter(Boolean),
    },
  },
  {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Monaspace Neon', data: fontRegular, weight: 400, style: 'normal' },
    ],
  },
);

const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
const png = resvg.render().asPng();

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, png);
console.log(`✓ OG image generated: ${OUT_PATH} (${(png.length / 1024).toFixed(0)}KB)`);
