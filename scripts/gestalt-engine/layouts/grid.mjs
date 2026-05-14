/**
 * grid layout — N nodes arranged on a deterministic R × C lattice.
 *
 * `cols` may be:
 *   - declared in spec (`grid: { cols: 4 }` or `layout: 'grid(N x M)'`)
 *   - derived as ceil(sqrt(N)) when omitted
 *
 * Gestalt principles enforced:
 *   • Uniform density — equal column and row pitch.
 *   • Alignment       — each row shares a y midline; each column shares an x.
 *   • Proximity       — gap = LEGIBILITY.gap × 2.
 *   • Closure         — completing the rectangle by padding incomplete rows
 *                       with empty cells (no half-rows).
 */

import { LEGIBILITY } from '../legibility.mjs';

export function grid(spec) {
  const gap = (spec.gap ?? LEGIBILITY.gap * 2);
  const declaredCols = spec.gridCols ?? spec.grid?.cols ?? null;
  const cols = Math.max(1, declaredCols ?? Math.ceil(Math.sqrt(spec.nodes.length)));
  const rows = Math.ceil(spec.nodes.length / cols);

  // Per-column widest width, per-row tallest height. Lets variable-size
  // shapes share a grid without overlapping.
  const colW = new Array(cols).fill(0);
  const rowH = new Array(rows).fill(0);
  for (let i = 0; i < spec.nodes.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const n = spec.nodes[i];
    if (n.w > colW[c]) colW[c] = n.w;
    if (n.h > rowH[r]) rowH[r] = n.h;
  }

  // Column / row centres in virtual coords.
  const colX = [];
  let x = 0;
  for (let c = 0; c < cols; c++) {
    x += colW[c] / 2;
    colX.push(x);
    x += colW[c] / 2 + gap;
  }
  const rowY = [];
  let y = 0;
  for (let r = 0; r < rows; r++) {
    y += rowH[r] / 2;
    rowY.push(y);
    y += rowH[r] / 2 + gap;
  }

  const nodes = spec.nodes.map((n, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return { ...n, x: colX[c], y: rowY[r] };
  });

  return { ...spec, nodes, _grid: { cols, rows } };
}
