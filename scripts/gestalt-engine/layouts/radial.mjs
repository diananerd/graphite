/**
 * Radial layout (§9 #3, #6). Best for state machines and event loops where
 * states share a parent ring. Places nodes evenly around a circle, with the
 * radius derived from the largest node so bboxes never touch.
 *
 * Stable angle assignment:
 *   • Author-declared `order` field, or
 *   • Topological order via edge sequence, or
 *   • Stable order by node id (alphabetical) as final tie-break.
 *
 * Gestalt principles enforced:
 *   • Closure         — implicit circular boundary.
 *   • Common fate     — every node equidistant from centre.
 *   • Symmetry        — angular symmetry by construction.
 *   • Uniform density — equal angular pitch.
 */

import { LEGIBILITY } from '../legibility.mjs';

function radialOrder(spec) {
  // Use edges to build a sequential order: pick a starting node (the one with
  // smallest id), then follow outgoing edges. Fallback: alphabetical id.
  const edges = spec.edges ?? [];
  if (edges.length === 0) return [...spec.nodes].sort((a, b) => a.id.localeCompare(b.id));

  const succ = {};
  for (const e of edges) (succ[e.from] ??= []).push(e.to);
  for (const k of Object.keys(succ)) succ[k].sort();

  const visited = new Set();
  const order = [];
  function walk(start) {
    let cur = start;
    while (cur && !visited.has(cur)) {
      visited.add(cur);
      order.push(cur);
      const next = (succ[cur] ?? []).find((n) => !visited.has(n));
      cur = next;
    }
  }
  const start = [...spec.nodes].sort((a, b) => a.id.localeCompare(b.id))[0].id;
  walk(start);
  // Any disconnected nodes attach in alphabetical order.
  for (const n of [...spec.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!visited.has(n.id)) walk(n.id);
  }
  const byId = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
  return order.map((id) => byId[id]).filter(Boolean);
}

export function radial(spec) {
  const ordered = radialOrder(spec);
  const n = ordered.length;
  if (n === 0) return { ...spec, nodes: [] };
  if (n === 1) return { ...spec, nodes: [{ ...ordered[0], x: 0, y: 0 }] };

  // Aesthetic balance: every node in the loop gets the same (w, h), set to
  // the max across all members. Variable bbox sizes around the same circle
  // read as visually noisy; uniform sizes lock the loop into a regular
  // polygon and make the arrows on a shared arc feel intentional.
  const maxW = Math.max(...ordered.map((node) => node.w));
  const maxH = Math.max(...ordered.map((node) => node.h));
  const normalised = ordered.map((node) => ({ ...node, w: maxW, h: maxH }));

  // Required radius: chord between adjacent nodes ≥ bbox half-diagonal + gap.
  // Plus a healthy slack so the arc-routed arrows have visible length to
  // bend through (otherwise the trimmed arc collapses to just an arrowhead).
  const gap = LEGIBILITY.gap * 2;
  const diag = Math.hypot(maxW, maxH);
  const requiredChord = diag + gap;
  const radius = Math.max(
    requiredChord * 1.5 / (2 * Math.sin(Math.PI / n)),
    diag * 2,
  );

  const angle0 = -Math.PI / 2; // first node at top (12 o'clock)
  const angles = {};
  const nodes = normalised.map((node, i) => {
    const theta = angle0 + (2 * Math.PI * i) / n;
    angles[node.id] = theta;
    return {
      ...node,
      x: Math.round(radius * Math.cos(theta) * 10) / 10,
      y: Math.round(radius * Math.sin(theta) * 10) / 10,
    };
  });

  // Restore original spec order in the returned nodes array.
  const placedById = Object.fromEntries(nodes.map((p) => [p.id, p]));
  return {
    ...spec,
    nodes: spec.nodes.map((n) => placedById[n.id] ?? n),
    _radial: {
      radius,
      count: n,
      centroid: [0, 0],     // in virtual coords; render projects to canvas
      angles,               // node id → angle (radians)
    },
  };
}
