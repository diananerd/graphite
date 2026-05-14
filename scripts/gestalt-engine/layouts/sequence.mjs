/**
 * Sequence diagram (§9 #5).
 *
 *   • Each node becomes a "lifeline" header at the top + a dashed vertical
 *     line extending down through the diagram.
 *   • Each edge becomes a horizontal message at a y-position derived from
 *     the edge's order in the spec.
 *
 * Layout output:
 *   • Nodes placed in a single horizontal row near the top.
 *   • Lifelines (dashed vertical lines) are emitted as `_lifelines` metadata
 *     for the renderer to draw underneath the nodes.
 *   • Edges keep their from/to refs; the renderer uses lifeline x-coords for
 *     horizontal positioning, and `_seqOrder` for vertical positioning.
 */

import { LEGIBILITY } from '../legibility.mjs';

export function sequence(spec) {
  const gap = LEGIBILITY.gap * 4;          // between lifelines
  const msgGap = LEGIBILITY.gap * 3;       // between messages
  const headerY = 0;                        // top of canvas
  const firstMsgY = 0;                      // distance from header to first message

  // Lay out lifelines in a row at the top.
  const nodes = [];
  let cursorX = 0;
  for (let i = 0; i < spec.nodes.length; i++) {
    const n = spec.nodes[i];
    if (i === 0) cursorX = n.w / 2;
    else cursorX += spec.nodes[i - 1].w / 2 + gap + n.w / 2;
    nodes.push({ ...n, x: cursorX, y: headerY });
  }

  // Compute lifeline length: enough to host every message with vertical
  // spacing. Total height = headerH + first-msg-offset + (N-1) × msgGap + tail.
  const edges = spec.edges ?? [];
  const headerH = Math.max(...spec.nodes.map((n) => n.h), 56);
  const firstMsgOffset = headerH / 2 + 40;
  const totalH = firstMsgOffset + Math.max(1, edges.length) * msgGap + 40;
  const lifelineBottom = headerY + totalH;

  // Annotate each edge with a sequential index → maps to y-coord.
  const annotatedEdges = edges.map((e, i) => ({
    ...e,
    _seqOrder: i,
    _seqY: headerY + firstMsgOffset + (i + 0.5) * msgGap,
  }));

  // Lifeline metadata for the renderer.
  const lifelines = nodes.map((n) => ({
    id: n.id,
    x: n.x,
    yTop: headerY + n.h / 2,
    yBot: lifelineBottom,
    color: n.color ?? n.role,
  }));

  return {
    ...spec,
    nodes,
    edges: annotatedEdges,
    _lifelines: lifelines,
  };
}
