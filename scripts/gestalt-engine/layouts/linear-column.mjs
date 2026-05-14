/**
 * linear-column — vertical analogue of linear-row. Picked automatically for
 * portrait ratios (9:16) or when `direction: 'column'` is set.
 */

import { LEGIBILITY } from '../legibility.mjs';

export function linearColumn(spec) {
  const gap = (spec.gap ?? LEGIBILITY.gap * 2);
  let cursorY = 0;
  const nodes = spec.nodes.map((n, i) => {
    if (i === 0) {
      cursorY = n.h / 2;
    } else {
      const prev = spec.nodes[i - 1];
      cursorY += prev.h / 2 + gap + n.h / 2;
    }
    return { ...n, x: 0, y: cursorY };
  });
  return { ...spec, nodes };
}
