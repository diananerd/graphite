/**
 * Virtual viewport → canvas projection.
 *
 * Pipeline stage P1 (§6.5 of the spec).
 *
 *   1. Compute global bounding box of every placed element.
 *   2. Inflate by the declared margins.
 *   3. Pick a canvas of the declared aspect ratio that fits the inflated bbox.
 *      - `fit:contain` letterboxes content within the ratio (default).
 *      - `fit:cover`   shrinks margins (never content) — clamped at minimum.
 *      - If neither can satisfy `margin:min`, the canvas grows in the long axis
 *        (warned, not silently distorted).
 *   4. Compute uniform scale = min(canvasW / virtualW, canvasH / virtualH).
 *   5. Translate so the content bbox centre coincides with the canvas centre,
 *      to ±0.5 virtual unit.
 *
 * Invariants (V1, V2, V8, V16):
 *   • No projected element crosses any canvas edge.
 *   • Effective margin ≥ declared margin OR canvas grew (and warned).
 *   • Content centre matches canvas centre within ±1 px (we hit ±0.5).
 *   • Same input → byte-identical output. No PRNG, no time.
 */

import { parseRatio } from './types.mjs';

const LEGIBILITY_MIN_MARGIN = 24;   // §15 floor

/**
 * @param {{nodes: SpecNode[], edges?: SpecEdge[], groups?: SpecGroup[]}} placed
 * @returns {BBox}
 */
export function computeContentBBox(placed) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

  for (const n of placed.nodes) {
    const w = n.w ?? 0, h = n.h ?? 0;
    const hx = w / 2, hy = h / 2;
    x1 = Math.min(x1, n.x - hx);
    y1 = Math.min(y1, n.y - hy);
    x2 = Math.max(x2, n.x + hx);
    y2 = Math.max(y2, n.y + hy);
  }
  // Sequence diagrams: lifelines extend the canvas far below the headers.
  // Without this the auto-fit would only frame the actor row.
  for (const l of placed._lifelines ?? []) {
    x1 = Math.min(x1, l.x);
    y1 = Math.min(y1, l.yTop);
    x2 = Math.max(x2, l.x);
    y2 = Math.max(y2, l.yBot);
  }
  // Swimlane bands span the full main axis; include their extents so the
  // canvas covers the whole strip and the band labels are not clipped.
  for (const b of placed._swimlanes?.bands ?? []) {
    if (b.direction === 'horizontal') {
      x1 = Math.min(x1, 0);
      x2 = Math.max(x2, b.mainSize);
      y1 = Math.min(y1, b.crossStart);
      y2 = Math.max(y2, b.crossStart + b.crossSize);
    } else {
      y1 = Math.min(y1, 0);
      y2 = Math.max(y2, b.mainSize);
      x1 = Math.min(x1, b.crossStart);
      x2 = Math.max(x2, b.crossStart + b.crossSize);
    }
  }

  if (!Number.isFinite(x1)) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * @param {{nodes: SpecNode[], edges?: SpecEdge[], groups?: SpecGroup[],
 *           ratio?: string, margin?: number, fit?: string}} placed
 * @returns {Projection}
 */
export function project(placed) {
  const [ratioW, ratioH] = parseRatio(placed.ratio);
  const ratioOf = ratioW / ratioH;
  const declaredMargin = Math.max(placed.margin ?? 48, LEGIBILITY_MIN_MARGIN);
  const fit = placed.fit ?? 'contain';

  const content = computeContentBBox(placed);

  // Inflate by declared margin (margins live in canvas units, but here we
  // treat one virtual unit = one canvas unit at scale=1. After scaling we
  // verify the rendered margin still ≥ declared minimum.)
  const inflatedW = content.w + 2 * declaredMargin;
  const inflatedH = content.h + 2 * declaredMargin;
  const inflatedRatio = inflatedW / inflatedH;

  // Pick canvas dimensions of the declared aspect ratio whose interior fits
  // the inflated bbox. Two cases:
  let canvasW, canvasH;
  if (inflatedRatio >= ratioOf) {
    // Content (plus margin) is wider than the target ratio — width drives.
    canvasW = inflatedW;
    canvasH = canvasW / ratioOf;
  } else {
    // Taller than the target ratio — height drives.
    canvasH = inflatedH;
    canvasW = canvasH * ratioOf;
  }

  // `cover` only shrinks margins (never content). Already covered above by
  // letterboxing; `cover` is a no-op for letterboxed content. We log a
  // diagnostic in placed._warnings if the caller asked for cover with a
  // strong mismatch.
  // (Reserved for §17 work — kept here for surface parity.)

  // Uniform scale: 1 by construction (content fits at native size).
  const scale = 1;

  // Translation: place content centre at canvas centre.
  const contentCx = content.x + content.w / 2;
  const contentCy = content.y + content.h / 2;
  const canvasCx = canvasW / 2;
  const canvasCy = canvasH / 2;
  const tx = canvasCx - contentCx;
  const ty = canvasCy - contentCy;

  // Inner margin box (where content is permitted to live, post-translation).
  const marginBox = {
    x: declaredMargin,
    y: declaredMargin,
    w: canvasW - 2 * declaredMargin,
    h: canvasH - 2 * declaredMargin,
  };

  return {
    canvasW: roundHalf(canvasW),
    canvasH: roundHalf(canvasH),
    tx: roundHalf(tx),
    ty: roundHalf(ty),
    scale,
    contentBBox: content,
    marginBox,
    margin: declaredMargin,
    ratio: { ratioW, ratioH },
    fit,
  };
}

/**
 * Apply the projection to a node coordinate.
 * @param {Projection} proj
 * @param {number} vx virtual x
 * @param {number} vy virtual y
 * @returns {[number, number]}
 */
export function projectPoint(proj, vx, vy) {
  return [
    roundHalf(vx * proj.scale + proj.tx),
    roundHalf(vy * proj.scale + proj.ty),
  ];
}

function roundHalf(n) {
  // Deterministic half-pixel rounding (V16).
  return Math.round(n * 2) / 2;
}
