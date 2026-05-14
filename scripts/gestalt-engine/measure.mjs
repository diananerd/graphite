/**
 * §6.2 — auto-fit measurement.
 *
 * For each node:
 *   1. Lay out label + sublabel at declared font size.
 *   2. Compute text bbox via the Monaspace Neon advance table (approximate
 *      until the @capsizecss-derived table replaces it in P3).
 *   3. Pad by shape inset.
 *   4. Snap to a 4-px grid (gestalt: alignment / similarity).
 *   5. Apply size hint multiplier.
 *
 * If a node already declares `w` and `h`, the measurer respects them; the
 * legibility engine still verifies the label fits.
 */

// Monaspace Neon at 13px has measured advance ≈ 8.4px. Wider than typical
// monospace because of the variable-axis used for crispness on screens.
// Constants slightly overestimate so shapes never grow too small.
const ADVANCE_PER_SIZE = {
  9:  5.8, 10: 6.4, 11: 7.0, 12: 7.7,
  13: 8.4, 14: 9.0, 15: 9.6, 16: 10.3, 18: 11.6, 20: 12.9,
};
const LINE_HEIGHT = 1.3;

// §2.1 minimums.
const SHAPE_MIN = {
  rect:           [96, 56],
  round:          [96, 56],
  pill:           [80, 32],
  circle:         [56, 56],
  ellipse:        [96, 48],
  diamond:        [96, 64],
  hexagon:        [96, 80],
  parallelogram:  [104, 56],
  trapezoid:      [104, 56],
  cylinder:       [80, 96],
  cloud:          [112, 72],
  note:           [112, 60],
  triangle:       [80, 70],
  document:       [104, 64],
  chevron:        [120, 56],
  subroutine:     [104, 56],
  actor:          [56, 96],   // figure + label-below clearance
  junction:       [12, 12],
  port:           [12, 12],
};

// Per-shape padding {h, v}. Diamond/hexagon need extra slack because the
// inscribed text rectangle is smaller than the bbox.
const SHAPE_PAD = {
  rect:           { h: 12, v: 8  },
  round:          { h: 12, v: 8  },
  pill:           { h: 16, v: 4  },
  circle:         { h: 8,  v: 8  },
  ellipse:        { h: 14, v: 8  },
  diamond:        { h: 18, v: 12 },
  hexagon:        { h: 16, v: 14 },
  parallelogram:  { h: 22, v: 8  },   // extra h for the slant
  trapezoid:      { h: 20, v: 8  },   // extra h for the slant
  cylinder:       { h: 12, v: 18 },
  cloud:          { h: 20, v: 14 },
  note:           { h: 14, v: 12 },   // room for folded corner
  triangle:       { h: 12, v: 14 },   // text fits in lower portion
  document:       { h: 14, v: 14 },   // bottom wave reserve
  chevron:        { h: 24, v: 8  },   // right arrow point reserve
  subroutine:     { h: 18, v: 8  },   // double left/right bars
  actor:          { h: 4,  v: 22 },   // bottom v reserves label-below room
  junction:       { h: 0,  v: 0  },
  port:           { h: 0,  v: 0  },
};

const SIZE_HINT_MULT = {
  xs: 0.75, sm: 0.85, md: 1.0, lg: 1.20, xl: 1.45,
};

function snap4(n) {
  // Always round up so the shape never shrinks below its label budget.
  return Math.ceil(n / 4) * 4;
}

function advance(fontSize) {
  return ADVANCE_PER_SIZE[fontSize] ?? fontSize * 0.6;
}

/**
 * Shape-specific bbox required to host a centred horizontal text rectangle
 * of size (textW, textH). The text must fit *inside the visible region*,
 * not just within the bbox — for circles, diamonds and hexagons the visible
 * region is smaller than the bbox.
 *
 * Returns the required bbox {w, h} in virtual units.
 */
function bboxForText(shape, textW, textH, pad) {
  // padW / padH are the *minimum* clear space between text and shape edge.
  const padW = pad.h;
  const padH = pad.v;

  switch (shape) {
    case 'circle': {
      // Circle of radius R fits a centred (W,H) rect iff R² ≥ (W/2)² + (H/2)².
      const safeW = textW + 2 * padW;
      const safeH = textH + 2 * padH;
      const diam = Math.sqrt(safeW * safeW + safeH * safeH);
      return { w: diam, h: diam };
    }
    case 'ellipse': {
      // Inscribed rect (W,H) in ellipse semi-axes (a,b) iff
      //   (W/2a)² + (H/2b)² ≤ 1. Choose a = √2 · (W/2 + padW),
      //   b = √2 · (H/2 + padH) so the inequality binds.
      const safeW = textW + 2 * padW;
      const safeH = textH + 2 * padH;
      return { w: safeW * Math.SQRT2, h: safeH * Math.SQRT2 };
    }
    case 'diamond': {
      // Diamond with bbox (w,h). At centre (y=cy), full bbox width is
      // available; but the text *vertical extent* H requires the slanted
      // edges accommodate it. Constraint: W/w + H/h ≤ 1 (text rect fits in
      // tilted square). So w ≥ W + (H · w/h)  →  pick w = W + H · (w/h).
      // Simpler: enforce w = 2·(W/2 + H/2) = W + H plus pad.
      const safeW = textW + 2 * padW;
      const safeH = textH + 2 * padH;
      return { w: safeW + safeH, h: safeW + safeH };
    }
    case 'hexagon': {
      // Flat-top hex with bbox (w,h) where dx = w/4 is the slanted-edge
      // horizontal projection. The widest inscribed rect (at centre) has
      // width = w - 2·dx · (H/h) for text of height H. Solving for w with
      // dx = w/4:  w(1 - H/(2h)) ≥ W. Choose h tied to bbox aspect 96:80,
      // i.e. h ≈ 0.83·w, and the formula simplifies to w ≥ W · 1.25.
      const safeW = (textW + 2 * padW) * 1.25;
      const safeH = (textH + 2 * padH) * 1.2;
      return { w: safeW, h: safeH };
    }
    case 'pill': {
      // Stadium: same as rect plus extra horizontal pad equal to h/2 each side.
      const safeH = textH + 2 * padH;
      const safeW = textW + 2 * padW + safeH;   // cap radii on both sides
      return { w: safeW, h: safeH };
    }
    case 'actor': {
      // Figure on top, label below (inside bbox). Width drives shoulder; the
      // label sits in the bottom band so width must accommodate the longer
      // of figure width or label width.
      return {
        w: Math.max(56, textW + 2 * padW),
        h: 80 + textH + 2 * padH,
      };
    }
    case 'cylinder': {
      // Body of cylinder is a rect of height (h - 2·ry) where ry = min(h·0.18, 12).
      // Text fits inside body. Solving for h: h - 2·12 ≥ textH + 2·padH gives
      // h ≥ textH + 24 + 2·padH for tall cylinders.
      const safeW = textW + 2 * padW;
      const safeH = textH + 24 + 2 * padH;
      return { w: safeW, h: safeH };
    }
    case 'cloud': {
      // Cloud silhouette has dome lobes on top; usable interior is the lower
      // ~70% of the bbox. Bump both dims accordingly.
      const safeW = (textW + 2 * padW) * 1.15;
      const safeH = (textH + 2 * padH) * 1.4;
      return { w: safeW, h: safeH };
    }
    case 'parallelogram': {
      // Skew at top-left/bottom-right cuts ~16px off each side.
      return { w: textW + 2 * padW, h: textH + 2 * padH };
    }
    case 'trapezoid': {
      // Slanted top corners eat into the upper text rect.
      return { w: textW + 2 * padW, h: textH + 2 * padH };
    }
    case 'note': {
      // Folded corner ~16px on top-right; label sits in main body.
      return { w: textW + 2 * padW, h: textH + 2 * padH };
    }
    case 'triangle': {
      // Text fits in lower half; required bbox grows quadratically:
      // at the centre line of the lower half, half-width = (W/2 + padW),
      // the triangle's half-width there is (w/2 * 0.5) so w ≥ 2 * (W + 2 padW).
      const safeW = (textW + 2 * padW) * 2;
      const safeH = (textH + 2 * padH) * 1.8;
      return { w: safeW, h: safeH };
    }
    case 'document': {
      // Wavy bottom reserves an extra ~12% of height.
      return { w: textW + 2 * padW, h: (textH + 2 * padH) * 1.15 };
    }
    case 'chevron': {
      // Arrow tip on right + arrow notch on left both eat ~20px each.
      return { w: textW + 2 * padW + 24, h: textH + 2 * padH };
    }
    case 'subroutine': {
      // Two vertical bars (8px each) reduce usable width.
      return { w: textW + 2 * padW + 16, h: textH + 2 * padH };
    }
    case 'rect':
    case 'round':
    default: {
      return { w: textW + 2 * padW, h: textH + 2 * padH };
    }
  }
}

/**
 * Measure a single node. Returns a new node with `w`, `h`, and `_measured`
 * metadata. Idempotent.
 */
export function measureNode(node) {
  if (node._measured) return node;

  const shape = node.shape ?? 'rect';
  const [minW, minH] = SHAPE_MIN[shape] ?? SHAPE_MIN.rect;
  const pad = SHAPE_PAD[shape] ?? SHAPE_PAD.rect;
  const mult = SIZE_HINT_MULT[node.size] ?? 1.0;

  const bodyFs = node.bodyFontSize ?? 13;
  const subFs  = node.sublabelFontSize ?? 10;

  const labelW = (node.label?.length ?? 0) * advance(bodyFs);
  const subW   = (node.sublabel?.length ?? 0) * advance(subFs);
  const textW  = Math.max(labelW, subW);

  const labelH = bodyFs * LINE_HEIGHT;
  const subH   = node.sublabel ? subFs * LINE_HEIGHT : 0;
  const textH  = labelH + subH;

  const userW = node.w ?? null;
  const userH = node.h ?? null;

  // Shape-aware required bbox so the visible region accommodates the text.
  const need = bboxForText(shape, textW, textH, pad);

  let w = userW ?? Math.max(minW, need.w);
  let h = userH ?? Math.max(minH, need.h);

  // Apply size hint, then snap.
  w = snap4(w * mult);
  h = snap4(h * mult);

  return {
    ...node,
    w, h,
    _measured: { labelW, textW, textH, pad, minW, minH, mult, need },
  };
}

/**
 * Measure every node in a spec; returns a new spec.
 */
export function measure(spec) {
  const nodes = (spec.nodes ?? []).map(measureNode);
  return { ...spec, nodes };
}

export const _internals = { SHAPE_MIN, SHAPE_PAD, SIZE_HINT_MULT, snap4, advance };
