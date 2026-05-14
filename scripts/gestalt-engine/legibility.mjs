/**
 * §15 legibility budget — hard floors in CSS pixels (post-projection).
 *
 * The engine evaluates these at the smallest expected rendered scale. Today
 * scale = 1 (P1 always letterboxes; canvas grows before content shrinks), so
 * every screen-stable element passes by construction. Container tiers in P6
 * will re-evaluate at `sm` / `md` / `lg` breakpoints.
 *
 * Violating any value below is a hard error unless the spec opts into the
 * adaptation cascade (§19).
 */

export const LEGIBILITY = Object.freeze({
  body:      11,   // min rendered px for body labels
  sublabel:   9,   // ditto for sublabels
  edgeLabel: 10,
  badge:     10,
  stroke: {
    border:    1.0,    // shape borders
    edge:      1.25,   // edge lines
    emphasis:  2.0,    // accent / critical
    dashGap:   2.0,
  },
  shape: {
    innerW: 40,
    innerH: 24,
  },
  gap:     16,         // min inter-node gap (proximity floor)
  margin:  24,         // hard min, regardless of declared
  groupPad: 12,
});

/**
 * Default container width assumed for legibility checks. Matches the blog's
 * 65ch body width (~520px). The minimum responsive tier (§17.3 `sm`) is 480.
 */
export const DEFAULT_CONTAINER_WIDTH    = 520;
export const DEFAULT_MIN_CONTAINER_WIDTH = 480;

function hasControls(placed) {
  const c = placed.controls;
  if (Array.isArray(c)) return c.length > 0;
  if (typeof c === 'string') return c.trim().length > 0;
  return false;
}

/**
 * Walk a placed spec + projection and return every violation.
 *
 * Key semantics:
 *   • text is "screen-stable" only when controls are enabled (the JS
 *     controller counter-scales each wrapper). Without controls, text scales
 *     with the SVG: effective px = declared × (containerW / canvasW).
 *   • the engine evaluates against the SMALLEST expected container width so
 *     the diagram remains legible everywhere it might ship.
 */
export function evaluateBudget(placed, proj, options = {}) {
  const violations = [];
  const bodyFs   = options.bodyFontSize ?? 13;
  const subFs    = options.sublabelFontSize ?? 10;
  const containerW = options.containerMinWidth ?? DEFAULT_MIN_CONTAINER_WIDTH;

  // SVG renders at `containerW / canvasW`. When the user's canvas is bigger
  // than the container, this is < 1 — text and strokes appear smaller.
  const renderScale = Math.min(1, containerW / proj.canvasW);
  const controls = hasControls(placed);

  for (const n of placed.nodes ?? []) {
    const screenStable = (n.sizing ?? 'screen') !== 'vector';
    // Without controls, the screen-stable promise can't be enforced at
    // runtime (no JS to update inverse scale) — text falls back to vector
    // scaling.
    const effFactor = (screenStable && controls) ? 1 : renderScale;

    if (n.label) {
      const eff = bodyFs * effFactor;
      if (eff < LEGIBILITY.body - 0.05) {
        violations.push({
          id: 'V17', kind: 'label-too-small', target: n.id,
          expected: LEGIBILITY.body, actual: +eff.toFixed(2),
          msg: `node "${n.id}" body label renders at ${eff.toFixed(1)}px ` +
               `< ${LEGIBILITY.body}px (canvas ${proj.canvasW}px @ container ${containerW}px, ` +
               `scale ${renderScale.toFixed(2)})`,
        });
      }
    }
    if (n.sublabel) {
      const eff = subFs * effFactor;
      if (eff < LEGIBILITY.sublabel - 0.05) {
        violations.push({
          id: 'V17', kind: 'sublabel-too-small', target: n.id,
          expected: LEGIBILITY.sublabel, actual: +eff.toFixed(2),
          msg: `node "${n.id}" sublabel renders at ${eff.toFixed(1)}px ` +
               `< ${LEGIBILITY.sublabel}px (scale ${renderScale.toFixed(2)})`,
        });
      }
    }
  }
  return violations;
}
