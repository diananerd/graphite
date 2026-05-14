/**
 * §2.2 — shape variant resolution.
 *
 * A variant tuple is `{ fill, border, corners, emphasis, shadow }` plus the
 * implicit `size` hint. This module resolves a node's declared variants into
 * a concrete style descriptor used by render.mjs.
 *
 * Returns:
 *   {
 *     fillMode:     'transparent' | 'filled' | 'tinted' | 'glass',
 *     borderDash:   string | null,        // SVG stroke-dasharray
 *     borderWidth:  number,
 *     borderLayer:  'single' | 'double',
 *     cornerRadius: number,
 *     shadowFilter: string | null,        // SVG filter id ref
 *   }
 */

import { LEGIBILITY } from './legibility.mjs';

const DEFAULTS = {
  fill:     'outlined',     // matches old behaviour
  border:   'solid',
  corners:  'round',        // applies only to rect family
  emphasis: 'none',
  shadow:   'none',
};

const BORDER_WIDTH = {
  solid:  LEGIBILITY.stroke.border,
  double: LEGIBILITY.stroke.border,
  dashed: LEGIBILITY.stroke.border,
  dotted: LEGIBILITY.stroke.border,
  thick:  LEGIBILITY.stroke.emphasis,
};

const BORDER_DASH = {
  solid:  null,
  double: null,
  dashed: '6 4',
  dotted: '1.5 3',
  thick:  null,
};

const CORNER_RADIUS = {
  square:    0,
  'round-sm': 4,
  round:     8,
  'round-lg':16,
};

const EMPHASIS_STROKE_BUMP = {
  none:     0,
  accent:   0.5,
  critical: 1.0,
};

export function resolveVariants(node) {
  const s = node.style ?? {};
  const fill     = s.fill     ?? DEFAULTS.fill;
  const border   = s.border   ?? DEFAULTS.border;
  const corners  = s.corners  ?? DEFAULTS.corners;
  const emphasis = s.emphasis ?? DEFAULTS.emphasis;
  const shadow   = s.shadow   ?? DEFAULTS.shadow;

  return {
    fillMode:    fill,
    borderDash:  BORDER_DASH[border] ?? null,
    borderWidth: (BORDER_WIDTH[border] ?? LEGIBILITY.stroke.border) +
                 (EMPHASIS_STROKE_BUMP[emphasis] ?? 0),
    borderLayer: border === 'double' ? 'double' : 'single',
    cornerRadius: CORNER_RADIUS[corners] ?? 8,
    shadowFilter: shadow === 'subtle' ? 'shadow-subtle'
                : shadow === 'lifted' ? 'shadow-lifted'
                : null,
    emphasis,
  };
}

/**
 * Translate the fill-mode + color token into SVG paint values.
 */
export function fillFor(mode, colorToken) {
  switch (mode) {
    case 'filled':       return `var(--${colorToken})`;
    case 'tinted':       return `var(--${colorToken}-dim, color-mix(in srgb, var(--${colorToken}) 12%, transparent))`;
    case 'glass':        return `color-mix(in srgb, var(--${colorToken}) 8%, transparent)`;
    case 'transparent':
    case 'outlined':
    default:             return 'var(--bg-surface, #202020)';
  }
}

/**
 * The shared `<defs>` block: shadow filters used when any node opts in.
 */
export const SHADOW_DEFS = `
  <filter id="shadow-subtle" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
  </filter>
  <filter id="shadow-lifted" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="4" stdDeviation="5" flood-opacity="0.5"/>
  </filter>
`;

/* ─────────────────────────────────────────────────────────────────────
   Edge variants (§2.4)
   ───────────────────────────────────────────────────────────────────── */

const EDGE_LINE_DEFAULTS = {
  line:     'solid',     // solid · dashed · dotted · double · thick
  head:     'arrow',     // arrow · arrow-open · dot · diamond · square · none
  tail:     'none',      // same set as head
  emphasis: 'none',      // none · accent · critical
  shadow:   'none',
};

const EDGE_DASH = {
  solid:  null,
  dashed: '6 4',
  dotted: '1.5 3',
  double: null,           // rendered as channel overlay (see render.mjs)
  thick:  null,
};

const EDGE_WIDTH = {
  solid:  LEGIBILITY.stroke.edge,        // 1.25
  dashed: LEGIBILITY.stroke.edge,
  dotted: LEGIBILITY.stroke.edge,
  double: LEGIBILITY.stroke.edge,
  thick:  LEGIBILITY.stroke.emphasis,    // 2.0
};

const EDGE_EMPHASIS_BUMP = {
  none:     0,
  accent:   0.5,
  critical: 1.0,
};

/** Head/tail marker shapes — paths drawn inside a 10×10 viewBox. */
export const MARKER_SHAPES = {
  'arrow':      { path: 'M 0 0 L 10 5 L 0 10 z',           refX: 9,  refY: 5, filled: true  },
  'arrow-open': { path: 'M 1 1 L 9 5 L 1 9',               refX: 9,  refY: 5, filled: false },
  'dot':        { path: 'M 5 1 a 4 4 0 1 0 0 8 a 4 4 0 1 0 0 -8', refX: 5, refY: 5, filled: true },
  'diamond':    { path: 'M 5 0 L 10 5 L 5 10 L 0 5 z',     refX: 9,  refY: 5, filled: true  },
  'square':     { path: 'M 1 1 L 9 1 L 9 9 L 1 9 z',       refX: 9,  refY: 5, filled: true  },
  'none':       null,
};

export function resolveEdgeVariants(edge) {
  const s = edge.style ?? {};
  // Author can use `edge.dashed: true` as shorthand for `style.line: dashed`.
  const line = s.line ?? (edge.dashed ? 'dashed' : EDGE_LINE_DEFAULTS.line);
  const head = s.head ?? edge.head ?? EDGE_LINE_DEFAULTS.head;
  const tail = s.tail ?? edge.tail ?? EDGE_LINE_DEFAULTS.tail;
  const emphasis = s.emphasis ?? edge.emphasis ?? EDGE_LINE_DEFAULTS.emphasis;
  const shadow = s.shadow ?? edge.shadow ?? EDGE_LINE_DEFAULTS.shadow;

  const baseW = EDGE_WIDTH[line] ?? LEGIBILITY.stroke.edge;
  const width = baseW + (EDGE_EMPHASIS_BUMP[emphasis] ?? 0);

  return {
    line,
    dashArray:   EDGE_DASH[line] ?? null,
    width,
    double:      line === 'double',
    headShape:   head,
    tailShape:   tail,
    emphasis,
    shadowFilter: shadow === 'subtle' ? 'shadow-subtle'
                : shadow === 'lifted' ? 'shadow-lifted'
                : null,
  };
}
