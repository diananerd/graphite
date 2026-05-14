/**
 * §19 adaptation cascade.
 *
 * When the legibility budget reports violations, the cascade applies the
 * following strategies *in order* until the budget passes or strict mode
 * exhausts them.
 *
 *   1. tighten-margins   — drop declared margin toward LEGIBILITY.margin
 *   2. densify-routing   — (P3+; stub here)
 *   3. drop-sublabels    — strip sublabels at small tiers
 *   4. grow-canvas       — let the canvas grow rather than shrinking content
 *   5. switch-layout     — (P4+; stub here)
 *
 * Each strategy is a pure function `(state) → newState | null`. Returning
 * null means the strategy doesn't apply (e.g. nothing to tighten). The
 * driver collects the chain of applied steps for the build report.
 */

import { LEGIBILITY } from './legibility.mjs';
import { project } from './project.mjs';
import { evaluateBudget } from './legibility.mjs';

/** Strategy 1: shrink declared margin toward the budget floor. */
function tightenMargins(state) {
  const cur = state.spec.margin ?? 48;
  if (cur <= LEGIBILITY.margin) return null;
  const next = Math.max(LEGIBILITY.margin, Math.floor(cur * 0.75));
  if (next === cur) return null;
  return {
    ...state,
    spec: { ...state.spec, margin: next },
    log: [...state.log, { strategy: 'tighten-margins', from: cur, to: next }],
  };
}

/** Strategy 3: drop sublabels (one pass; binary). */
function dropSublabels(state) {
  const anySub = state.spec.nodes.some((n) => n.sublabel);
  if (!anySub) return null;
  return {
    ...state,
    spec: {
      ...state.spec,
      nodes: state.spec.nodes.map((n) => ({ ...n, sublabel: undefined, _droppedSub: !!n.sublabel })),
    },
    log: [...state.log, { strategy: 'drop-sublabels' }],
  };
}

/** Strategy 4: grow canvas. P1 already grows the canvas to fit; this strategy
 *  is exercised when explicit dimensions blocked the natural growth. */
function growCanvas(state) {
  // The projector grows by default; we only need to bump the declared margin
  // budget if a previous strategy lowered it past the floor.
  if ((state.spec.margin ?? 0) >= LEGIBILITY.margin) return null;
  return {
    ...state,
    spec: { ...state.spec, margin: LEGIBILITY.margin },
    log: [...state.log, { strategy: 'grow-canvas', restoredMargin: LEGIBILITY.margin }],
  };
}

/**
 * Strategy 6: auto-enable viewport controls.
 *
 * Last-resort when the canvas grew beyond what the container can display at
 * legible text size. Turning on controls switches text and strokes to true
 * screen-stable behaviour via the 2.2KB JS counter-scaler — readers can
 * zoom and pan to inspect, and tiny text becomes legible by construction.
 */
function autoEnableControls(state) {
  const c = state.spec.controls;
  const hasAny = Array.isArray(c) ? c.length > 0
               : typeof c === 'string' ? c.trim().length > 0
               : false;
  if (hasAny) return null;
  return {
    ...state,
    spec: {
      ...state.spec,
      controls: ['zoom', 'pan', 'auto-fit'],
      zoomRange: state.spec.zoomRange ?? [0.5, 4],
      _controlsAutoEnabled: true,
    },
    log: [...state.log, { strategy: 'auto-enable-controls' }],
  };
}

const STRATEGIES = [
  tightenMargins,
  /* densifyRouting (P3.5) */
  dropSublabels,
  growCanvas,
  /* switchLayout (P4.5) */
  autoEnableControls,
];

/**
 * Drive the cascade. Returns `{ projection, log, violations }`.
 * @param {object} measured a spec whose nodes have w/h.
 */
export function adapt(measured, options = {}) {
  let state = { spec: { ...measured }, log: [] };
  let proj = project(state.spec);
  let violations = evaluateBudget(state.spec, proj, options);

  const strict = options.legibility === 'strict';

  // No violations → done.
  if (violations.length === 0) {
    return { spec: state.spec, projection: proj, log: state.log, violations: [] };
  }

  for (const strategy of STRATEGIES) {
    const next = strategy(state);
    if (!next) continue;
    state = next;
    proj = project(state.spec);
    violations = evaluateBudget(state.spec, proj, options);
    if (violations.length === 0) break;
  }

  if (violations.length > 0 && strict) {
    const summary = violations.map((v) => `  ${v.id}: ${v.msg}`).join('\n');
    throw new Error(`[Gestalt] legibility budget violated under strict mode:\n${summary}`);
  }

  return { spec: state.spec, projection: proj, log: state.log, violations };
}
