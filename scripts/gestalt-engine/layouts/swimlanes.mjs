/**
 * Swimlanes (§2.3) — horizontal or vertical bands that pin members to a track.
 *
 *   spec.lanes:           ordered array of { id, label, contains: [nodeId,…] }
 *   spec.laneDirection:   'horizontal' (default) — lanes stack vertically,
 *                          time flows horizontally along each row.
 *                         'vertical' — lanes stack horizontally, time flows
 *                          vertically (used for sequence diagrams).
 *
 * Members within a lane line up along the lane's main (time) axis in author
 * order, evenly spaced. Each lane band gets a label header at the start.
 *
 * Gestalt principles enforced:
 *   • Closure       — every lane closes (top/bottom border + label).
 *   • Common fate   — same-lane members share the cross-axis coord.
 *   • Continuity    — uniform left-to-right (or top-to-bottom) flow.
 *   • Proximity     — gap within lane = LEGIBILITY.gap × 2; between lanes
 *                     = LEGIBILITY.gap × 4.
 */

import { LEGIBILITY } from '../legibility.mjs';

const LANE_HEADER_PX = 88;

export function swimlanes(spec, direction = 'horizontal') {
  const lanes = spec.lanes ?? [];
  if (lanes.length === 0) return spec;

  const nodesById = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
  const gap = LEGIBILITY.gap * 2;
  const laneGap = LEGIBILITY.gap * 4;

  // Determine each lane's extent on the cross axis (perpendicular to time).
  // Horizontal lanes: cross is height. Vertical lanes: cross is width.
  const laneCross = lanes.map((lane) => {
    let maxCross = direction === 'horizontal' ? 56 : 96;
    for (const id of lane.contains) {
      const n = nodesById[id];
      if (!n) continue;
      maxCross = Math.max(maxCross, direction === 'horizontal' ? n.h : n.w);
    }
    return maxCross + 24; // breathing room within the band
  });

  // Per-lane main-axis extent (time): sum of member sizes + gaps.
  const laneMain = lanes.map((lane) => {
    let total = LANE_HEADER_PX;
    const members = lane.contains.map((id) => nodesById[id]).filter(Boolean);
    for (let i = 0; i < members.length; i++) {
      total += (direction === 'horizontal' ? members[i].w : members[i].h);
      if (i < members.length - 1) total += gap;
    }
    total += 40; // trailing padding
    return total;
  });

  // The overall diagram extends to the max lane main extent (so all lanes
  // are the same length) and the sum of cross extents.
  const totalMain = Math.max(...laneMain);
  // Cross cursor places lanes one after another with laneGap between.
  const placedNodes = [];
  const laneBands = [];

  let crossCursor = 0;
  for (let li = 0; li < lanes.length; li++) {
    const lane = lanes[li];
    const cross = laneCross[li];
    const laneMidCross = crossCursor + cross / 2;
    laneBands.push({
      id: lane.id,
      label: lane.label ?? lane.id,
      direction,
      crossStart: crossCursor,
      crossSize: cross,
      mainSize: totalMain,
      headerSize: LANE_HEADER_PX,
    });

    const members = lane.contains.map((id) => nodesById[id]).filter(Boolean);
    let mainCursor = LANE_HEADER_PX;
    for (const n of members) {
      const ms = direction === 'horizontal' ? n.w : n.h;
      mainCursor += ms / 2;
      placedNodes.push({
        ...n,
        x: direction === 'horizontal' ? mainCursor : laneMidCross,
        y: direction === 'horizontal' ? laneMidCross : mainCursor,
        _lane: lane.id,
      });
      mainCursor += ms / 2 + gap;
    }
    crossCursor += cross + laneGap;
  }

  // Any nodes not in a lane are appended below (acts as a fallback row).
  const inLane = new Set(placedNodes.map((p) => p.id));
  for (const n of spec.nodes) {
    if (inLane.has(n.id)) continue;
    placedNodes.push({ ...n, x: 0, y: 0 });
  }

  return {
    ...spec,
    nodes: placedNodes,
    _swimlanes: { direction, bands: laneBands },
  };
}

export const swimlanesH = (spec) => swimlanes(spec, 'horizontal');
export const swimlanesV = (spec) => swimlanes(spec, 'vertical');
