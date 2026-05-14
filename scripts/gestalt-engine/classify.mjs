/**
 * §6.1 — classifier picks a layout algorithm from the graph topology.
 *
 * Order of decision:
 *   1. Author override (`layout: <name>`) wins.
 *   2. Pass-through if every node has explicit (x, y) — legacy compatibility.
 *   3. Declared grid (`gridCols` or `grid: …`).
 *   4. Linear chain (graph is a single path) → linear-row / linear-column based
 *      on ratio. Portrait → column, landscape → row.
 *   5. Otherwise → grid (P3 fallback). Tree / Sugiyama / radial land in later
 *      phases and will outrank this default.
 */

import { linearRow } from './layouts/linear-row.mjs';
import { linearColumn } from './layouts/linear-column.mjs';
import { grid } from './layouts/grid.mjs';
import { sugiyamaLR, sugiyamaTB } from './layouts/sugiyama.mjs';
import { treeTB, treeLR } from './layouts/tree.mjs';
import { radial } from './layouts/radial.mjs';
import { swimlanesH, swimlanesV } from './layouts/swimlanes.mjs';
import { sequence } from './layouts/sequence.mjs';

const LAYOUTS = {
  'linear-row':    linearRow,
  'linear-column': linearColumn,
  'row':           linearRow,
  'column':        linearColumn,
  'grid':          grid,
  'sugiyama-lr':   sugiyamaLR,
  'sugiyama-tb':   sugiyamaTB,
  'sugiyama':      sugiyamaLR,
  'tree-tb':       treeTB,
  'tree-lr':       treeLR,
  'tree':          treeTB,
  'radial':        radial,
  'swimlanes':     swimlanesH,
  'swimlanes-h':   swimlanesH,
  'swimlanes-v':   swimlanesV,
  'sequence':      sequence,
  'pass-through':  (s) => s,
};

function isPassThrough(spec) {
  return spec.nodes.length > 0 &&
         spec.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y));
}

function degrees(spec) {
  const inDeg = {}, outDeg = {};
  for (const n of spec.nodes) { inDeg[n.id] = 0; outDeg[n.id] = 0; }
  for (const e of (spec.edges ?? [])) {
    outDeg[e.from] = (outDeg[e.from] ?? 0) + 1;
    inDeg[e.to]    = (inDeg[e.to]   ?? 0) + 1;
  }
  return { inDeg, outDeg };
}

function isLinearChain(spec) {
  const edges = spec.edges ?? [];
  if (edges.length === 0) return spec.nodes.length > 0 && spec.nodes.length <= 6;
  const { inDeg, outDeg } = degrees(spec);
  let roots = 0, sinks = 0;
  for (const id of Object.keys(inDeg)) {
    if (inDeg[id] === 0 && outDeg[id] === 1) roots++;
    else if (inDeg[id] === 1 && outDeg[id] === 0) sinks++;
    else if (!(inDeg[id] === 1 && outDeg[id] === 1)) return false;
  }
  return roots === 1 && sinks === 1;
}

/** Strict tree: single root, every other node has in-degree exactly 1, no cycles. */
function isTree(spec) {
  const edges = spec.edges ?? [];
  if (edges.length === 0 || edges.length !== spec.nodes.length - 1) return false;
  const { inDeg } = degrees(spec);
  let roots = 0;
  for (const id of Object.keys(inDeg)) {
    if (inDeg[id] === 0) roots++;
    else if (inDeg[id] !== 1) return false;
  }
  return roots === 1;
}

/** Detect a cycle in the directed graph. */
function isCycleDriven(spec) {
  const edges = spec.edges ?? [];
  if (edges.length === 0) return false;
  const adj = Object.fromEntries(spec.nodes.map((n) => [n.id, []]));
  for (const e of edges) (adj[e.from] ??= []).push(e.to);
  const colour = {};
  for (const n of spec.nodes) colour[n.id] = 0;
  let found = false;
  function dfs(u) {
    if (colour[u] === 1) { found = true; return; }
    if (colour[u] === 2) return;
    colour[u] = 1;
    for (const v of adj[u] ?? []) { if (!found) dfs(v); }
    colour[u] = 2;
  }
  for (const n of spec.nodes) if (!found) dfs(n.id);
  return found;
}

/** A DAG worth Sugiyama: has branching (some in>1 or out>1), no cycles. */
function isDAG(spec) {
  const edges = spec.edges ?? [];
  if (edges.length < 2) return false;
  // Cycle check via DFS.
  const adj = Object.fromEntries(spec.nodes.map((n) => [n.id, []]));
  for (const e of edges) (adj[e.from] ??= []).push(e.to);
  const colour = {}; // 0 white, 1 grey, 2 black
  for (const n of spec.nodes) colour[n.id] = 0;
  function dfs(u) {
    if (colour[u] === 1) return false;       // back-edge → cycle
    if (colour[u] === 2) return true;
    colour[u] = 1;
    for (const v of adj[u] ?? []) if (!dfs(v)) return false;
    colour[u] = 2;
    return true;
  }
  for (const n of spec.nodes) if (!dfs(n.id)) return false;

  // Branching present?
  const { inDeg, outDeg } = degrees(spec);
  return Object.values(inDeg).some((d) => d > 1) || Object.values(outDeg).some((d) => d > 1);
}

function portraitRatio(ratio) {
  if (!ratio) return false;
  if (ratio === '9:16' || ratio === '2:3') return true;
  return false;
}

export function classify(spec) {
  // 1. Author override wins.
  if (spec.layout && LAYOUTS[spec.layout]) {
    return { name: spec.layout, fn: LAYOUTS[spec.layout] };
  }
  // 2. Pass-through if coords already present.
  if (isPassThrough(spec)) {
    return { name: 'pass-through', fn: LAYOUTS['pass-through'] };
  }
  // 2.5. Declared lanes → swimlanes.
  if (Array.isArray(spec.lanes) && spec.lanes.length > 0) {
    const name = spec.laneDirection === 'vertical' ? 'swimlanes-v' : 'swimlanes-h';
    return { name, fn: LAYOUTS[name] };
  }
  // 3. Declared grid.
  if (spec.gridCols || spec.grid) {
    return { name: 'grid', fn: LAYOUTS.grid };
  }
  // 4. Linear chain auto-detect.
  if (isLinearChain(spec)) {
    const name = portraitRatio(spec.ratio) ? 'linear-column' : 'linear-row';
    return { name, fn: LAYOUTS[name] };
  }
  // 5. Tree (each node has ≤1 parent, single root, no merges).
  if (isTree(spec)) {
    const name = portraitRatio(spec.ratio) ? 'tree-tb' : 'tree-tb';
    return { name, fn: LAYOUTS[name] };
  }
  // 6. Cycle present → radial (FSM / event-loop).
  if (isCycleDriven(spec)) {
    return { name: 'radial', fn: LAYOUTS.radial };
  }
  // 7. DAG with branching → Sugiyama. Direction follows ratio.
  if (isDAG(spec)) {
    const name = portraitRatio(spec.ratio) ? 'sugiyama-tb' : 'sugiyama-lr';
    return { name, fn: LAYOUTS[name] };
  }
  // 8. Default fallback.
  return { name: 'grid', fn: LAYOUTS.grid };
}

export function place(spec) {
  const { name, fn } = classify(spec);
  const placed = fn(spec);
  return { ...placed, _layout: name };
}
