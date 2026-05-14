#!/usr/bin/env node
/**
 * validate-content.mjs — validates post body: images, headings, links, code, content quality.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const files = process.argv.slice(2).filter(f => f.includes('content/posts/'));
let errors = 0;
let warnings = 0;

const fail = (file, line, msg) => { console.error(`  ✗ ${file}:L${line}: ${msg}`); errors++; };
const warn = (file, line, msg) => { console.warn(`  ⚠ ${file}:L${line}: ${msg}`); warnings++; };

const POSTS_DIR = './content/posts';
const existingSlugs = existsSync(POSTS_DIR)
  ? readdirSync(POSTS_DIR).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))
  : [];

const IMG_NAME_RE = /^\/images\/[a-z0-9][a-z0-9-]*[a-z0-9]\.png$/;
const SUPPORTED_LANGS = new Set([
  'typescript', 'ts', 'tsx', 'javascript', 'js', 'jsx',
  'toml', 'rust', 'rs', 'c', 'cpp', 'python', 'py',
  'bash', 'sh', 'shell', 'yaml', 'yml', 'mermaid', 'anim',
  'json', 'text', 'txt', 'css', 'html', 'markdown', 'md',
  'diff', 'gherkin',
]);

for (const file of files) {
  const filename = file.split('/').pop();
  const raw = readFileSync(file, 'utf8');
  const bodyMatch = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!bodyMatch) continue;
  const body = bodyMatch[1];
  const lines = body.split('\n');
  const isDraft = /^---\n[\s\S]*?draft:\s*true[\s\S]*?---/.test(raw);

  console.log(`\n→ ${filename}`);

  // Strip fenced code blocks (preserving line offsets) then inline code spans,
  // so that markdown syntax shown inside `code` is not mis-detected as a real link/image.
  // The fence regex anchors to start-of-line (multiline mode) so that backtick
  // sequences shown inside prose don't accidentally swallow surrounding text.
  const bodyNoCode = body
    .replace(/^```[\s\S]*?^```/gm, (m) => '\n'.repeat(m.split('\n').length - 1))
    .replace(/`[^`\n]+`/g, (m) => ' '.repeat(m.length));

  // Images
  const imgRefs = [...bodyNoCode.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  for (const m of imgRefs) {
    const [, alt, src] = m;
    const lineNum = body.slice(0, m.index).split('\n').length;
    const srcClean = src.split('?')[0].split(' ')[0];
    if (!alt || alt.trim() === '') {
      fail(filename, lineNum, `Image without alt text: ${srcClean}`);
    } else if (['image', 'img'].includes(alt.trim().toLowerCase())) {
      warn(filename, lineNum, `Generic alt text: "${alt}"`);
    }
    if (srcClean.startsWith('/') && !srcClean.startsWith('/images/')) {
      fail(filename, lineNum, `Image outside /images/: ${srcClean}`);
    }
    if (srcClean.startsWith('/images/')) {
      if (!srcClean.endsWith('.png')) fail(filename, lineNum, `Image must be .png: ${srcClean}`);
      if (!IMG_NAME_RE.test(srcClean)) fail(filename, lineNum, `Invalid image name: "${srcClean.split('/').pop()}"`);
      const localPath = `./public${srcClean}`;
      if (!existsSync(localPath)) fail(filename, lineNum, `Image not found: ${localPath}`);
    }
    if (srcClean.startsWith('http')) {
      warn(filename, lineNum, `External image: ${srcClean}`);
    }
  }

  // Identify which lines are inside code blocks
  const inCodeBlock = new Set();
  let inside = false;
  lines.forEach((l, i) => {
    if (/^```/.test(l)) { inside = !inside; }
    if (inside) inCodeBlock.add(i + 1);
  });

  // Headings hierarchy
  let lastLevel = 1;
  const headingLines = lines
    .map((l, i) => ({ line: l, num: i + 1 }))
    .filter(({ line, num }) => /^#{1,6}\s/.test(line) && !inCodeBlock.has(num));
  for (const { line, num } of headingLines) {
    const level = line.match(/^(#+)/)[1].length;
    const text = line.replace(/^#+\s+/, '').trim();
    if (level > lastLevel + 1) fail(filename, num, `Heading skips level: H${lastLevel} → H${level}`);
    if (!text) fail(filename, num, `Empty heading H${level}`);
    if (/[.,;:]$/.test(text)) warn(filename, num, `Heading ends in punctuation: "${text}"`);
    if (text.length > 80) warn(filename, num, `Long heading (${text.length} chars)`);
    lastLevel = level;
  }

  // Code blocks: language check
  const codeBlocks = [...body.matchAll(/^```(\w*)/gm)];
  for (const m of codeBlocks) {
    const lang = m[1];
    const lineNum = body.slice(0, m.index).split('\n').length;
    // Only check opening fences (skip every other match: open, close, open, close...)
    // The regex matches every ``` so we check whether lang is empty (closing fence has no lang)
    if (!lang) {
      // Could be a closing fence — check whether the next opening fence is missing a lang.
      // Heuristic: if there's text after ``` it's an opening fence with empty lang.
      const lineText = body.split('\n')[lineNum - 1] ?? '';
      if (lineText.trim() === '```') {
        // Closing fence or fence-only block — flag empty opening only if it's odd-indexed.
        continue;
      }
      fail(filename, lineNum, 'Code block without language');
    } else if (!SUPPORTED_LANGS.has(lang.toLowerCase())) {
      warn(filename, lineNum, `Language "${lang}" not in Shiki set`);
    }
  }

  // Links
  const links = [...bodyNoCode.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
  for (const m of links) {
    if (bodyNoCode[m.index - 1] === '!') continue;
    const [, linkText, href] = m;
    const lineNum = body.slice(0, m.index).split('\n').length;
    const hrefClean = href.split(' ')[0];
    if (!linkText.trim()) warn(filename, lineNum, 'Link without text');
    if (hrefClean.startsWith('http://')) warn(filename, lineNum, `Insecure HTTP link: ${hrefClean}`);
    if (hrefClean.startsWith('/') && !hrefClean.startsWith('/images/')) {
      const slug = hrefClean.replace(/^\//, '').replace(/\/$/, '');
      if (slug && !existingSlugs.includes(slug)) {
        warn(filename, lineNum, `Possibly broken internal link: "${hrefClean}"`);
      }
    }
    const GENERIC = ['click here', 'aquí', 'here', 'link', 'ver más', 'leer más'];
    if (GENERIC.includes(linkText.toLowerCase().trim())) {
      warn(filename, lineNum, `Generic link text: "${linkText}"`);
    }
  }

  // Word count
  const textOnly = bodyNoCode
    .replace(/`[^`]+`/g, '')
    .replace(/^#{1,6}\s.+$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '')
    .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ]/g, ' ');
  const wordCount = textOnly.split(/\s+/).filter(w => w.length > 1).length;
  if (!isDraft && wordCount < 150) {
    warn(filename, 0, `Short post: ${wordCount} words`);
  }

  // Placeholders
  if (!isDraft) {
    const PLACEHOLDERS = ['todo:', 'fixme:', 'lorem ipsum', 'placeholder', '[tbd]', '[wip]'];
    for (const [i, line] of lines.entries()) {
      if (inCodeBlock.has(i + 1)) continue;
      const lower = line.toLowerCase();
      for (const p of PLACEHOLDERS) {
        if (lower.includes(p)) fail(filename, i + 1, `Placeholder: "${p}"`);
      }
    }
  }

  // Blank line runs
  let blankCount = 0;
  for (const [i, line] of lines.entries()) {
    if (line.trim() === '') blankCount++;
    else blankCount = 0;
    if (blankCount > 2) { warn(filename, i + 1, 'More than 2 blank lines'); break; }
  }
}

console.log(`\n${files.length} file(s) processed. ${errors} error(s), ${warnings} warning(s).`);
if (errors > 0) process.exit(1);
