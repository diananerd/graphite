#!/usr/bin/env node
/**
 * validate-anim.mjs — extract ```anim blocks from .md and validate their schema.
 */
import { readFileSync } from 'node:fs';
import { parseAnimML } from './anim-compiler.mjs';

const files = process.argv.slice(2).filter(f => f.endsWith('.md'));
let totalErrors = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const blocks = [...content.matchAll(/^```anim\n([\s\S]*?)^```/gm)];

  for (const m of blocks) {
    const [fullMatch, source] = m;
    const lineNum = content.slice(0, content.indexOf(fullMatch)).split('\n').length;
    try {
      const spec = parseAnimML(source);
      const nodeCount = Object.keys(spec.nodes).length;
      const stateCount = Object.keys(spec.states).length;
      console.log(`  ✓ ${file}:L${lineNum} — "${spec.meta.title}" (${nodeCount} nodes, ${stateCount} states)`);
    } catch (err) {
      console.error(`  ✗ ${file}:L${lineNum} — AnimML error:`);
      console.error(`    ${String(err.message).replace(/\n/g, '\n    ')}`);
      totalErrors++;
    }
  }
}

if (totalErrors > 0) {
  console.error(`\n${totalErrors} AnimML block(s) failed.`);
  process.exit(1);
}
