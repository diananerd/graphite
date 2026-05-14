/**
 * Shared types for the Gestalt engine pipeline.
 *
 *   Spec       — author input (DSL parsed or JSON fixture).
 *   Measured   — Spec with every node carrying a computed (w, h).
 *   Placed     — Measured with every node carrying virtual (x, y) and every
 *                edge carrying a routed path.
 *   Projected  — Placed mapped onto a canvas viewBox with margins honored.
 *
 * Each stage takes the previous one's output. No PRNG. No mutation across
 * stage boundaries — every stage returns a fresh object.
 *
 * @typedef {Object} Spec
 * @property {string} title
 * @property {string} [ratio]          e.g. "16:9", "4:3", "custom:1280x720"
 * @property {number} [margin]         px on every canvas edge; default 48
 * @property {SpecNode[]} nodes
 * @property {SpecEdge[]} [edges]
 * @property {SpecGroup[]} [groups]
 *
 * @typedef {Object} SpecNode
 * @property {string} id
 * @property {string} shape            rect | round | pill | circle | …  (§2.1)
 * @property {string} label
 * @property {string} [sublabel]
 * @property {string} [role]           primary | secondary | success | …
 * @property {Object} [style]          fill, border, corners, size, emphasis…
 * @property {number} [x]              optional manual placement (virtual units)
 * @property {number} [y]
 * @property {number} [w]              optional override (skips measure)
 * @property {number} [h]
 *
 * @typedef {Object} SpecEdge
 * @property {string} from
 * @property {string} to
 * @property {string} [label]
 * @property {string} [style]          straight | orthogonal | curved | …
 * @property {string} [role]
 *
 * @typedef {Object} SpecGroup
 * @property {string} id
 * @property {string[]} contains
 * @property {string} [label]
 * @property {string} [boundary]
 *
 * @typedef {Object} BBox
 * @property {number} x   left
 * @property {number} y   top
 * @property {number} w
 * @property {number} h
 *
 * @typedef {Object} Projection
 * @property {number} canvasW
 * @property {number} canvasH
 * @property {number} tx               translation x (canvas units)
 * @property {number} ty               translation y
 * @property {number} scale            uniform scale (virtual → canvas units)
 * @property {BBox} contentBBox        in virtual units, before projection
 * @property {BBox} marginBox          {x,y,w,h} of the inner box (canvas - margin)
 * @property {number} margin           effective margin used
 * @property {{ratioW: number, ratioH: number}} ratio
 */

export const RATIOS = {
  '16:9': [1600, 900],
  '4:3':  [1600, 1200],
  '1:1':  [1200, 1200],
  '9:16': [900,  1600],
  '3:2':  [1500, 1000],
};

export function parseRatio(ratio = '16:9') {
  if (ratio.startsWith('custom:')) {
    const m = ratio.match(/custom:(\d+)x(\d+)/);
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  }
  return RATIOS[ratio] ?? RATIOS['16:9'];
}
