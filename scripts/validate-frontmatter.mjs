#!/usr/bin/env node
/**
 * validate-frontmatter.mjs — validates frontmatter of staged/all post .md files.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const files = process.argv.slice(2).filter(f => f.includes('content/posts/'));
let errors = 0;
let warnings = 0;

const fail = (msg) => { console.error(`  ✗ ${msg}`); errors++; };
const warn = (msg) => { console.warn(`  ⚠ ${msg}`); warnings++; };

const POSTS_DIR = './content/posts';
const allPosts = existsSync(POSTS_DIR)
  ? readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'))
  : [];

const allTitles = {};
for (const pf of allPosts) {
  const raw = readFileSync(join(POSTS_DIR, pf), 'utf8');
  const fm = parseFrontmatter(raw);
  if (fm?.title) allTitles[pf] = fm.title.toLowerCase().trim();
}

const WEAK_OPENERS = [
  'this post', 'in this post', 'in this article', 'today we', 'today i',
  'this article', 'here we', 'in this tutorial', 'this tutorial',
  'welcome to', 'introduction to',
];

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  let currentKey = null;
  let arrayMode = false;
  let arrayItems = [];

  for (const line of match[1].split('\n')) {
    if (arrayMode && line.match(/^\s*-\s+(.+)/)) {
      arrayItems.push(line.match(/^\s*-\s+(.+)/)[1].trim().replace(/^["'](.*?)["']$/, '$1'));
      continue;
    }
    if (arrayMode) {
      fm[currentKey] = [...arrayItems];
      arrayMode = false;
      arrayItems = [];
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim();
    if (val === '') { currentKey = key; arrayMode = true; continue; }
    val = val.replace(/^["'](.*?)["']$/, '$1');
    if (val === 'true') fm[key] = true;
    else if (val === 'false') fm[key] = false;
    else if (val.match(/^\[.*\]$/)) {
      fm[key] = val.slice(1, -1).split(',')
        .map(t => t.trim().replace(/^["'](.*?)["']$/, '$1'))
        .filter(Boolean);
    } else {
      fm[key] = val;
    }
  }
  if (arrayMode) fm[currentKey] = [...arrayItems];
  return fm;
}

for (const file of files) {
  const filename = file.split('/').pop();
  console.log(`\n→ ${filename}`);

  const content = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(content);
  if (!fm) { fail('Frontmatter missing'); continue; }

  const KNOWN_FIELDS = ['title', 'date', 'description', 'image', 'tags', 'draft'];
  const unknown = Object.keys(fm).filter(k => !KNOWN_FIELDS.includes(k));
  if (unknown.length) warn(`Unknown fields: ${unknown.join(', ')}`);

  if (!fm.title) {
    fail('title required');
  } else {
    const t = fm.title;
    if (typeof t !== 'string') fail('title must be string');
    else {
      if (t !== t.trim()) fail('title has leading/trailing whitespace');
      if (t.length < 5) fail(`title too short (${t.length} chars, min 5)`);
      if (t.length > 60) fail(`title ${t.length} chars > 60 — Google truncates`);
      if (t === t.toUpperCase() && t.length > 3) fail('title in ALL CAPS — not allowed');
      if (/<[^>]+>/.test(t)) fail('title contains HTML');
      const dupeFile = Object.entries(allTitles)
        .find(([pf, pt]) => pf !== filename && pt === t.toLowerCase().trim());
      if (dupeFile) fail(`title duplicate with ${dupeFile[0]}: "${t}"`);
    }
  }

  if (!fm.date) {
    fail('date required — YYYY-MM-DD');
  } else {
    const d = new Date(String(fm.date));
    if (isNaN(d.getTime())) {
      fail(`date invalid: "${fm.date}"`);
    } else {
      if (d.getFullYear() < 2020) warn(`date very old (${fm.date}) — typo?`);
      const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (d > sevenDaysOut && !fm.draft) {
        fail(`date in future (${fm.date}) requires draft: true`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fm.date))) {
        fail(`date format wrong: "${fm.date}" — use YYYY-MM-DD`);
      }
    }
  }

  const isPublished = !fm.draft;
  if (isPublished && !fm.description) {
    fail('description required for published posts');
  } else if (fm.description) {
    const d = fm.description;
    if (typeof d !== 'string') {
      fail('description must be string');
    } else {
      if (d.length < 50) fail(`description ${d.length} chars < 50`);
      if (d.length > 160) warn(`description ${d.length} chars > 160 — Google truncates`);
      if (fm.title && d.toLowerCase().trim() === fm.title.toLowerCase().trim()) {
        fail('description identical to title');
      }
      const opener = d.toLowerCase().slice(0, 30);
      const weak = WEAK_OPENERS.find(w => opener.startsWith(w));
      if (weak) warn(`description opens weakly: "${weak}"`);
      if (d.endsWith('...')) warn('description ends in "..."');
    }
  }

  if (fm.image) {
    const img = fm.image;
    if (!img.startsWith('/images/')) {
      fail(`image must start with /images/ — got: "${img}"`);
    } else if (!img.endsWith('.png')) {
      fail(`image must be .png — got: "${img}"`);
    } else {
      const localPath = `./public${img}`;
      if (!existsSync(localPath)) {
        fail(`image not found locally: ${localPath}`);
      } else {
        const imgName = img.split('/').pop().replace('.png', '');
        if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(imgName) && !/^[a-z0-9]$/.test(imgName)) {
          fail(`image name invalid: "${imgName}.png" — use kebab-case lowercase`);
        }
      }
    }
  }

  if (fm.tags) {
    if (!Array.isArray(fm.tags)) {
      fail('tags must be array — [tag1, tag2] or YAML list with -');
    } else {
      if (fm.tags.length === 0) warn('tags empty — omit or add');
      if (fm.tags.length > 5) warn(`${fm.tags.length} tags — recommended max 5`);
      const seen = new Set();
      for (const tag of fm.tags) {
        if (seen.has(tag)) fail(`tag duplicate: "${tag}"`);
        seen.add(tag);
        if (/[A-Z]/.test(tag)) fail(`tag "${tag}" has uppercase — use lowercase`);
        if (/\s/.test(tag)) fail(`tag "${tag}" has spaces — use hyphens`);
        if (!/^[a-z0-9][a-z0-9-]*$/.test(tag)) fail(`tag "${tag}" invalid chars`);
      }
    }
  }

  if (fm.draft !== undefined && typeof fm.draft !== 'boolean') {
    fail(`draft must be boolean — got: "${fm.draft}" (${typeof fm.draft})`);
  }
}

console.log(`\n${files.length} file(s) processed. ${errors} error(s), ${warnings} warning(s).`);
if (errors > 0) process.exit(1);
