/**
 * linear-row layout — N nodes evenly spaced on a single horizontal axis.
 *
 * Gestalt principles enforced:
 *   • Continuity      — all nodes share y axis.
 *   • Proximity       — inter-node gap = LEGIBILITY.gap × 2 (32px).
 *   • Common fate     — uniform alignment supports parallel animation.
 *   • Uniform density — equal gap between every pair.
 *
 * The output coord system is virtual; the projector centres + scales later.
 */

import { LEGIBILITY } from '../legibility.mjs';

export function linearRow(spec) {
  const gap = (spec.gap ?? LEGIBILITY.gap * 2);
  let cursorX = 0;
  const nodes = spec.nodes.map((n, i) => {
    if (i === 0) {
      cursorX = n.w / 2;
    } else {
      const prev = spec.nodes[i - 1];
      cursorX += prev.w / 2 + gap + n.w / 2;
    }
    return { ...n, x: cursorX, y: 0 };
  });
  return { ...spec, nodes };
}
