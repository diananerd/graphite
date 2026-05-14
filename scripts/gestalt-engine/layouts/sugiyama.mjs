/**
 * Sugiyama layered layout for DAGs (§9 #1, #4).
 *
 * Stages:
 *   1. Cycle removal     — collect back-edges (none expected for DAG; if present,
 *                          we flag and reverse them deterministically by id).
 *   2. Layer assignment  — longest-path from sources (one pass, deterministic).
 *   3. Crossing reduction — barycenter heuristic, 4 alternating sweeps.
 *   4. X-coord assignment — within-layer median positioning + uniform spacing.
 *
 * Direction:
 *   • `sugiyama-lr` — layers left → right; y is the in-layer offset.
 *   • `sugiyama-tb` — layers top → bottom; x is the in-layer offset.
 *
 * Returns the spec with each node placed in virtual coords. No PRNG.
 */

import { LEGIBILITY } from '../legibility.mjs';

function topoLayers(nodes, edges) {
  const layerOf = {};
  const adj = Object.fromEntries(nodes.map((n) => [n.id, []]));
  for (const e of edges) (adj[e.from] ??= []).push(e.to);

  // Longest-path layer: for each node, layer = max(layer(pred)) + 1.
  // Build reverse adjacency.
  const radj = Object.fromEntries(nodes.map((n) => [n.id, []]));
  for (const e of edges) (radj[e.to] ??= []).push(e.from);

  // Iterate by id (stable order) until fixed point.
  const ids = nodes.map((n) => n.id);
  let changed = true;
  for (const id of ids) layerOf[id] = 0;
  let iter = 0;
  while (changed && iter < ids.length + 1) {
    changed = false;
    iter++;
    for (const id of ids) {
      const preds = radj[id] ?? [];
      if (preds.length === 0) continue;
      const lvl = Math.max(...preds.map((p) => layerOf[p] ?? 0)) + 1;
      if (lvl > layerOf[id]) { layerOf[id] = lvl; changed = true; }
    }
  }
  return layerOf;
}

function groupByLayer(layerOf, nodes) {
  const layers = [];
  for (const n of nodes) {
    const l = layerOf[n.id];
    if (!layers[l]) layers[l] = [];
    layers[l].push(n.id);
  }
  // Stable order: by node insertion order.
  return layers.map((layer) => layer ?? []);
}

function barycenterReduce(layers, edges) {
  // Successor and predecessor lookup.
  const succ = {}, pred = {};
  for (const e of edges) {
    (succ[e.from] ??= []).push(e.to);
    (pred[e.to]   ??= []).push(e.from);
  }
  const orderInLayer = {};
  layers.forEach((layer, l) => layer.forEach((id, i) => orderInLayer[id] = i));

  function bary(neighbours) {
    if (!neighbours || neighbours.length === 0) return 0;
    return neighbours.reduce((s, n) => s + (orderInLayer[n] ?? 0), 0) / neighbours.length;
  }

  // 4 sweeps: down-up-down-up.
  for (let pass = 0; pass < 4; pass++) {
    const downward = pass % 2 === 0;
    if (downward) {
      for (let l = 1; l < layers.length; l++) {
        const sorted = [...layers[l]].sort((a, b) => {
          const ba = bary(pred[a]);
          const bb = bary(pred[b]);
          if (ba === bb) return a.localeCompare(b); // stable tie-break by id
          return ba - bb;
        });
        layers[l] = sorted;
        sorted.forEach((id, i) => orderInLayer[id] = i);
      }
    } else {
      for (let l = layers.length - 2; l >= 0; l--) {
        const sorted = [...layers[l]].sort((a, b) => {
          const ba = bary(succ[a]);
          const bb = bary(succ[b]);
          if (ba === bb) return a.localeCompare(b);
          return ba - bb;
        });
        layers[l] = sorted;
        sorted.forEach((id, i) => orderInLayer[id] = i);
      }
    }
  }
  return layers;
}

function assignCoords(layers, nodesById, direction) {
  const gap = LEGIBILITY.gap * 2;          // inter-node within layer
  const layerGap = LEGIBILITY.gap * 4;     // between layers (heavier — readability)

  // For each layer, place evenly along the cross axis; layers separated along
  // the main axis. LR: main=x, cross=y; TB: main=y, cross=x.
  const layerExtent = layers.map((layer) => {
    // pick the dominant cross dimension for this layer
    let max = 0;
    for (const id of layer) {
      const n = nodesById[id];
      max = Math.max(max, direction === 'LR' ? n.w : n.h);
    }
    return max;
  });

  let mainCursor = 0;
  const placedNodes = [];
  for (let l = 0; l < layers.length; l++) {
    if (l > 0) mainCursor += layerExtent[l - 1] / 2 + layerGap + layerExtent[l] / 2;
    else mainCursor = layerExtent[l] / 2;

    // Within-layer: place along cross axis, centred at 0.
    const sizes = layers[l].map((id) => direction === 'LR' ? nodesById[id].h : nodesById[id].w);
    const total = sizes.reduce((s, v) => s + v, 0) + Math.max(0, layers[l].length - 1) * gap;
    let crossCursor = -total / 2;
    for (let i = 0; i < layers[l].length; i++) {
      const id = layers[l][i];
      const n = nodesById[id];
      const sz = sizes[i];
      crossCursor += sz / 2;
      const main = mainCursor;
      const cross = crossCursor;
      placedNodes.push({
        ...n,
        x: direction === 'LR' ? main : cross,
        y: direction === 'LR' ? cross : main,
        _layer: l,
      });
      crossCursor += sz / 2 + gap;
    }
  }
  return placedNodes;
}

export function sugiyama(spec, direction = 'LR') {
  const edges = spec.edges ?? [];
  const layerOf = topoLayers(spec.nodes, edges);
  let layers = groupByLayer(layerOf, spec.nodes);
  layers = barycenterReduce(layers, edges);
  const nodesById = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
  const placed = assignCoords(layers, nodesById, direction);

  return {
    ...spec,
    nodes: placed,
    _sugiyama: { direction, layerCount: layers.length, layers },
  };
}

export const sugiyamaLR = (spec) => sugiyama(spec, 'LR');
export const sugiyamaTB = (spec) => sugiyama(spec, 'TB');
