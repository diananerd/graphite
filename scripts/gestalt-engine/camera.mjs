/**
 * Camera / ROI computation.
 *
 *   spec.view         — array of node ids to frame initially
 *   spec.viewPadding  — px around the focal bbox (default 48)
 *
 * Given the placed spec + the projection, compute the (z, tx, ty) transform
 * that frames the focal nodes inside the canvas viewBox. The JS controller
 * uses this as the initial pose AND as the "home" position returned by the
 * Reset button / `0` key.
 *
 * If `spec.view` is absent or empty, returns null — the diagram opens at its
 * natural fit-to-canvas pose (z=1, tx=0, ty=0).
 *
 * Returns `{ z, tx, ty, focalBBox }` or null.
 */

const DEFAULT_VIEW_PADDING = 48;

export function computeCamera(spec, projection) {
  if (!spec || !projection) return null;
  if (!Array.isArray(spec.view) || spec.view.length === 0) return null;

  const ids = new Set(spec.view);
  const focal = (spec.nodes ?? []).filter((n) => ids.has(n.id));
  if (focal.length === 0) return null;

  // Focal nodes' bbox in projected canvas coords. Nodes carry virtual (x,y);
  // the projection's tx/ty shifts them into canvas space.
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const n of focal) {
    const cx = n.x + projection.tx;
    const cy = n.y + projection.ty;
    x1 = Math.min(x1, cx - n.w / 2);
    y1 = Math.min(y1, cy - n.h / 2);
    x2 = Math.max(x2, cx + n.w / 2);
    y2 = Math.max(y2, cy + n.h / 2);
  }

  const padding = spec.viewPadding ?? DEFAULT_VIEW_PADDING;
  const padded = {
    x: x1 - padding,
    y: y1 - padding,
    w: (x2 - x1) + 2 * padding,
    h: (y2 - y1) + 2 * padding,
  };

  // Uniform scale to fit padded bbox into canvas. Clamp to a reasonable max.
  const rawZ = Math.min(projection.canvasW / padded.w, projection.canvasH / padded.h);
  const z = Math.max(0.25, Math.min(8, rawZ));

  // Translate so the focal centre lands at the canvas centre.
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const tx = projection.canvasW / 2 - cx * z;
  const ty = projection.canvasH / 2 - cy * z;

  return {
    z: roundHalf(z),
    tx: roundHalf(tx),
    ty: roundHalf(ty),
    focalBBox: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 },
    focalIds: spec.view.slice(),
  };
}

function roundHalf(n) { return Math.round(n * 100) / 100; }
