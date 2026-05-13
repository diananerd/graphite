#!/usr/bin/env node
/**
 * generate-font-fallback.mjs — generate a calibrated CSS fallback for Monaspace Neon
 * using @capsizecss/unpack metrics, written to public/styles/font-fallback.css.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

const FONT_PATH = './public/fonts/MonaspaceNeonVarVF.woff2';
const OUT_PATH = './public/styles/font-fallback.css';

if (!existsSync(FONT_PATH)) {
  console.warn(`⚠ Font missing: ${FONT_PATH}`);
  console.warn('  Run: npm run fetch:font');
  // Write a minimal stack so the build still succeeds.
  writeFileSync(
    OUT_PATH,
    `/* Placeholder — run \`npm run fetch:font\` + \`npm run gen:font-fallback\` */\n:root { --font-stack: 'Monaspace Neon', ui-monospace, 'Courier New', monospace; }\n`,
  );
  process.exit(0);
}

let unpackMetrics, createFontStack, courierMetrics;
try {
  ({ fromFile: unpackMetrics } = await import('@capsizecss/unpack'));
} catch {
  ({ default: unpackMetricsDefault } = await import('@capsizecss/unpack').catch(() => ({})));
  unpackMetrics = unpackMetricsDefault?.fromFile;
}
try {
  ({ createFontStack } = await import('@capsizecss/core'));
  courierMetrics = (await import('@capsizecss/metrics/courierNew')).default;
} catch (err) {
  console.warn('⚠ @capsizecss packages not installed — writing minimal fallback');
  console.warn(`  ${err.message}`);
  writeFileSync(
    OUT_PATH,
    `/* Minimal fallback — install @capsizecss/* and re-run */\n:root { --font-stack: 'Monaspace Neon', ui-monospace, 'Courier New', monospace; }\n`,
  );
  process.exit(0);
}

const monaspaceMetrics = await unpackMetrics(FONT_PATH);
monaspaceMetrics.familyName = 'Monaspace Neon';

const { fontFaces } = createFontStack([monaspaceMetrics, courierMetrics]);

const css = `/* ════════════════════════════════════════════════════════════
   FONT FALLBACK — calibrated metrics. Auto-generated.
   Do not edit. Regenerate with: npm run gen:font-fallback
   ════════════════════════════════════════════════════════════ */

${fontFaces}

:root {
  --font-stack: 'Monaspace Neon',
                'Monaspace Neon Fallback: Courier New',
                ui-monospace, 'Courier New', monospace;
}
`;

mkdirSync('./public/styles', { recursive: true });
writeFileSync(OUT_PATH, css);
console.log(`✓ Font fallback CSS generated: ${OUT_PATH}`);
console.log(`  capHeight: ${monaspaceMetrics.capHeight}, ascent: ${monaspaceMetrics.ascent}, descent: ${monaspaceMetrics.descent}`);
