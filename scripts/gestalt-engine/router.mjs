/**
 * Edge routing. §6.4.
 *
 * For each edge:
 *   1. Pick a port on source/target by the relative angle of the connecting
 *      line, snapped to the closest bbox face (top/right/bottom/left).
 *   2. Pick an arrow geometry: straight, orthogonal, cubic. Author override
 *      wins; otherwise we infer from layout name.
 *   3. Return an SVG path `d` string and the label position.
 */

/**
 * Pick the port on a node's bbox closest to the direction toward (tx, ty).
 * Returns the canvas-space point and the face name.
 */
export function portFor(node, tx, ty) {
  const cx = node.x, cy = node.y;
  const w = node.w, h = node.h;
  const dx = tx - cx, dy = ty - cy;
  // Choose face by largest absolute component, taking aspect into account.
  const absDx = Math.abs(dx) / (w || 1);
  const absDy = Math.abs(dy) / (h || 1);
  if (absDx >= absDy) {
    // left or right face
    if (dx >= 0) return { x: cx + w / 2, y: cy, face: 'right' };
    return { x: cx - w / 2, y: cy, face: 'left' };
  } else {
    if (dy >= 0) return { x: cx, y: cy + h / 2, face: 'bottom' };
    return { x: cx, y: cy - h / 2, face: 'top' };
  }
}

/**
 * Default arrow style for a given layout.
 */
export function defaultStyleFor(layoutName) {
  if (!layoutName) return 'straight';
  if (layoutName.startsWith('sugiyama')) return 'orthogonal';
  if (layoutName.startsWith('linear')) return 'straight';
  if (layoutName === 'grid') return 'straight';
  return 'straight';
}

function routeStraight(a, b) {
  return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
}

function routeOrthogonal(a, b, faceA, faceB) {
  // Manhattan path. Single mid-segment that turns once or twice depending on
  // face orientations.
  let d, mid;
  const horizontal = (faceA === 'left' || faceA === 'right') && (faceB === 'left' || faceB === 'right');
  const vertical   = (faceA === 'top'  || faceA === 'bottom') && (faceB === 'top'  || faceB === 'bottom');
  if (horizontal) {
    const mx = (a.x + b.x) / 2;
    d = `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${b.y} L ${b.x} ${b.y}`;
    mid = { x: mx, y: (a.y + b.y) / 2 };
  } else if (vertical) {
    const my = (a.y + b.y) / 2;
    d = `M ${a.x} ${a.y} L ${a.x} ${my} L ${b.x} ${my} L ${b.x} ${b.y}`;
    mid = { x: (a.x + b.x) / 2, y: my };
  } else {
    // Mixed: L-shape via the corner that respects the faces.
    if (faceA === 'right' || faceA === 'left') {
      d = `M ${a.x} ${a.y} L ${b.x} ${a.y} L ${b.x} ${b.y}`;
      mid = { x: b.x, y: a.y };
    } else {
      d = `M ${a.x} ${a.y} L ${a.x} ${b.y} L ${b.x} ${b.y}`;
      mid = { x: a.x, y: b.y };
    }
  }
  return { d, mid };
}

function routeCubic(a, b, faceA, faceB) {
  // Bezier with control points offset toward each port's face normal.
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const k = Math.max(40, dist * 0.4);
  const normal = (face) => ({
    right:  [1,  0],
    left:   [-1, 0],
    top:    [0, -1],
    bottom: [0,  1],
  }[face]);
  const [nax, nay] = normal(faceA);
  const [nbx, nby] = normal(faceB);
  const c1 = { x: a.x + nax * k, y: a.y + nay * k };
  const c2 = { x: b.x + nbx * k, y: b.y + nby * k };
  return {
    d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`,
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}

/**
 * Route a single edge.
 * @returns {{ d: string, mid: {x,y}, faceA: string, faceB: string }}
 */
export function routeEdge(edge, fromNode, toNode, options = {}) {
  const portA = portFor(fromNode, toNode.x, toNode.y);
  const portB = portFor(toNode, fromNode.x, fromNode.y);
  const style = edge.style ?? options.defaultStyle ?? 'straight';
  let path;
  switch (style) {
    case 'orthogonal': path = routeOrthogonal(portA, portB, portA.face, portB.face); break;
    case 'cubic':      path = routeCubic(portA, portB, portA.face, portB.face);      break;
    case 'straight':
    default:           path = routeStraight(portA, portB);                            break;
  }
  return { ...path, faceA: portA.face, faceB: portB.face, style };
}
