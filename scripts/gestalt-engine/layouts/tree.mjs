/**
 * Tidy tree layout (§9 #2). Reingold–Tilford-style: compact subtree packing
 * where every leaf gets a slot of its measured width, internal nodes are
 * centred above their children's combined extent.
 *
 * Direction:
 *   • `tree-tb` — root on top, leaves on bottom (default).
 *   • `tree-lr` — root on left, leaves on right (used for sideways trees).
 *
 * Inputs:
 *   • spec.edges describes parent→child relationships.
 *   • Exactly one node has in-degree 0 (the root); engine asserts this.
 *
 * Gestalt principles enforced:
 *   • Continuity     — every level shares the main-axis coord.
 *   • Common fate    — siblings align on the cross axis.
 *   • Symmetry       — each parent centred above its children.
 *   • Proximity      — gap between sibling sub-trees = LEGIBILITY.gap × 2.
 */

import { LEGIBILITY } from '../legibility.mjs';

function rootOf(nodes, edges) {
  const inDeg = Object.fromEntries(nodes.map((n) => [n.id, 0]));
  for (const e of edges) inDeg[e.to] = (inDeg[e.to] ?? 0) + 1;
  const roots = nodes.filter((n) => inDeg[n.id] === 0);
  if (roots.length !== 1) {
    throw new Error(`[tree] expected 1 root, found ${roots.length}: ${roots.map((r) => r.id).join(', ')}`);
  }
  return roots[0];
}

function childrenMap(nodes, edges) {
  const map = Object.fromEntries(nodes.map((n) => [n.id, []]));
  for (const e of edges) (map[e.from] ??= []).push(e.to);
  return map;
}

/**
 * Recursive subtree extent. Returns { width, depth } and the (cx, level) of
 * the subtree root once its descendants are placed.
 */
function layoutSubtree(id, nodes, children, nodesById, gap, level, placements, direction) {
  const node = nodesById[id];
  const kids = children[id] ?? [];
  // Leaf: occupies its own width.
  if (kids.length === 0) {
    placements.push({ id, level });
    return { width: direction === 'TB' ? node.w : node.h };
  }
  let total = 0;
  const kidExtents = [];
  for (let i = 0; i < kids.length; i++) {
    const ext = layoutSubtree(kids[i], nodes, children, nodesById, gap, level + 1, placements, direction);
    kidExtents.push(ext);
    total += ext.width;
    if (i < kids.length - 1) total += gap;
  }
  // Internal extent: at least the children total, but also ≥ self.
  const selfW = direction === 'TB' ? node.w : node.h;
  const width = Math.max(total, selfW);
  placements.push({ id, level });
  return { width };
}

/**
 * Walk again with concrete positions. We do a second pass once we know each
 * subtree's width.
 */
function placeSubtree(id, children, nodesById, gap, direction, mainAxisCursor, crossLeft) {
  // mainAxisCursor: the main-axis coordinate (y for TB, x for LR) of this
  // node's centre. crossLeft: the cross-axis offset where this subtree begins.
  const node = nodesById[id];
  const kids = children[id] ?? [];
  const selfW = direction === 'TB' ? node.w : node.h;

  if (kids.length === 0) {
    const cross = crossLeft + selfW / 2;
    return {
      placement: {
        id,
        x: direction === 'TB' ? cross : mainAxisCursor,
        y: direction === 'TB' ? mainAxisCursor : cross,
      },
      width: selfW,
      sub: [],
    };
  }

  // Compute children's combined width first (recursive measure).
  const measure = (cid) => {
    const cnode = nodesById[cid];
    const cw = direction === 'TB' ? cnode.w : cnode.h;
    const cKids = children[cid] ?? [];
    if (cKids.length === 0) return cw;
    let total = 0;
    for (let i = 0; i < cKids.length; i++) {
      total += measure(cKids[i]);
      if (i < cKids.length - 1) total += gap;
    }
    return Math.max(total, cw);
  };
  const kidWidths = kids.map(measure);
  const kidsTotal = kidWidths.reduce((s, w) => s + w, 0) + Math.max(0, kids.length - 1) * gap;
  const width = Math.max(kidsTotal, selfW);

  // Place children left-to-right within crossLeft .. crossLeft+width.
  let cursor = crossLeft + (width - kidsTotal) / 2;
  const subPlacements = [];
  const layerGap = LEGIBILITY.gap * 4;
  for (let i = 0; i < kids.length; i++) {
    const childResult = placeSubtree(kids[i], children, nodesById, gap, direction, mainAxisCursor + layerGap, cursor);
    subPlacements.push(childResult);
    cursor += kidWidths[i] + gap;
  }

  // Place this node centred over children's combined extent.
  const cross = crossLeft + width / 2;
  return {
    placement: {
      id,
      x: direction === 'TB' ? cross : mainAxisCursor,
      y: direction === 'TB' ? mainAxisCursor : cross,
    },
    width,
    sub: subPlacements,
  };
}

function collect(result, acc = []) {
  acc.push(result.placement);
  for (const s of result.sub) collect(s, acc);
  return acc;
}

/**
 * Compute the depth (layer index) of each node and the maximum node main-axis
 * size per layer. Tree layers are then spaced by `layerSize[i]/2 +
 * LEGIBILITY.gap * 4 + layerSize[i+1]/2`, which respects tall nodes like
 * cylinder / actor without overlap.
 */
function computeLayerSizes(rootId, children, nodesById, direction) {
  const depth = {};
  function walk(id, d) {
    depth[id] = d;
    for (const c of children[id] ?? []) walk(c, d + 1);
  }
  walk(rootId, 0);
  const layerSize = [];
  for (const [id, d] of Object.entries(depth)) {
    const n = nodesById[id];
    const s = direction === 'TB' ? n.h : n.w;
    if (!layerSize[d] || s > layerSize[d]) layerSize[d] = s;
  }
  return { depth, layerSize };
}

export function tree(spec, direction = 'TB') {
  const edges = spec.edges ?? [];
  if (spec.nodes.length === 0) return { ...spec, nodes: [] };
  const root = rootOf(spec.nodes, edges);
  const children = childrenMap(spec.nodes, edges);
  const nodesById = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
  const gap = LEGIBILITY.gap * 2;
  const layerGap = LEGIBILITY.gap * 4;

  const { depth, layerSize } = computeLayerSizes(root.id, children, nodesById, direction);

  // Per-layer main-axis centre coordinate.
  const layerCentre = [];
  for (let i = 0; i < layerSize.length; i++) {
    if (i === 0) layerCentre[i] = layerSize[0] / 2;
    else layerCentre[i] = layerCentre[i - 1] + layerSize[i - 1] / 2 + layerGap + layerSize[i] / 2;
  }

  // Recursive cross-axis placement uses the per-layer centres for the main coord.
  function recur(id, crossLeft) {
    const node = nodesById[id];
    const kids = children[id] ?? [];
    const selfW = direction === 'TB' ? node.w : node.h;
    if (kids.length === 0) {
      const cross = crossLeft + selfW / 2;
      return { id, x: direction === 'TB' ? cross : layerCentre[depth[id]], y: direction === 'TB' ? layerCentre[depth[id]] : cross, width: selfW, sub: [] };
    }
    // Children widths.
    const measureKid = (cid) => {
      const cn = nodesById[cid];
      const cw = direction === 'TB' ? cn.w : cn.h;
      const cKids = children[cid] ?? [];
      if (cKids.length === 0) return cw;
      let total = 0;
      for (let i = 0; i < cKids.length; i++) {
        total += measureKid(cKids[i]);
        if (i < cKids.length - 1) total += gap;
      }
      return Math.max(total, cw);
    };
    const kidWidths = kids.map(measureKid);
    const kidsTotal = kidWidths.reduce((s, w) => s + w, 0) + Math.max(0, kids.length - 1) * gap;
    const width = Math.max(kidsTotal, selfW);
    let cursor = crossLeft + (width - kidsTotal) / 2;
    const sub = [];
    for (let i = 0; i < kids.length; i++) {
      sub.push(recur(kids[i], cursor));
      cursor += kidWidths[i] + gap;
    }
    const cross = crossLeft + width / 2;
    return { id, x: direction === 'TB' ? cross : layerCentre[depth[id]], y: direction === 'TB' ? layerCentre[depth[id]] : cross, width, sub };
  }

  function flatten(node, acc = []) {
    acc.push({ id: node.id, x: node.x, y: node.y });
    for (const s of node.sub) flatten(s, acc);
    return acc;
  }
  const placed = recur(root.id, 0);
  const positions = Object.fromEntries(flatten(placed).map((p) => [p.id, { x: p.x, y: p.y }]));

  const nodes = spec.nodes.map((n) => ({
    ...n,
    x: positions[n.id]?.x ?? 0,
    y: positions[n.id]?.y ?? 0,
  }));
  return { ...spec, nodes };
}

export const treeTB = (spec) => tree(spec, 'TB');
export const treeLR = (spec) => tree(spec, 'LR');
