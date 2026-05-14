/**
 * Step-based motion FSM.
 *
 * Each step is a labelled state of the diagram. Authors declare:
 *
 *   spec.steps: [
 *     { id: 'intro',   show: ['client'],            camera: ['client'] },
 *     { id: 'request', show: ['api', 'edge1'],      camera: ['client', 'api'],
 *                      flow: ['edge1'] },
 *     { id: 'persist', show: ['db'],  activate: ['db'], camera: ['api','db'] },
 *     { id: 'done',    emphasize: ['db'],           camera: '*' },
 *   ]
 *
 * Mutations are cumulative (steps describe deltas from the previous state).
 * The compiler walks the chain once and produces a normalised plan where each
 * step carries the FULL state (visible set, classes, camera, label).
 *
 * Per-step verbs:
 *   • show / hide         — fade in/out (250ms)
 *   • activate / deactivate — emphasis glow
 *   • dim / undim         — opacity ~ 0.3 for "muted"
 *   • highlight           — momentary pulse (not sticky)
 *   • emphasize           — bump stroke / colour tier
 *   • flow                — animate a packet along an edge for this step
 *   • camera: [ids] or '*' — reframe; null = stay
 *   • caption: "string"   — optional human-readable label
 *   • duration: N         — override default transition duration
 */

import { computeCamera } from './camera.mjs';

const DEFAULT_TRANSITION_MS = 600;

function arr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function setUnion(set, items) {
  for (const x of items) set.add(x);
}
function setSubtract(set, items) {
  for (const x of items) set.delete(x);
}

/**
 * Build the normalised step plan. Returns { plan, initialCamera }.
 *
 * @param {object} placed   placed spec
 * @param {object} projection  the engine's projection (used for camera maths)
 */
export function computeSteps(placed, projection) {
  const steps = placed.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    return { plan: null, initialCamera: null };
  }

  const allNodeIds = (placed.nodes ?? []).map((n) => n.id);
  const allEdgeIds = (placed.edges ?? [])
    .filter((e) => e.from && e.to)
    .map((e) => `${e.from}-${e.to}`);
  const allIds = [...allNodeIds, ...allEdgeIds];

  // Running state across steps.
  const visible    = new Set();
  const activated  = new Set();
  const dimmed     = new Set();
  const emphasised = new Set();

  const plan = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];

    // Resolve `*` shorthand to "all nodes".
    const expand = (v) => v === '*' ? allIds.slice() : arr(v);

    // Apply mutations.
    setUnion(visible,    expand(s.show));
    setSubtract(visible, expand(s.hide));
    setUnion(activated,  expand(s.activate));
    setSubtract(activated, expand(s.deactivate));
    setUnion(dimmed,     expand(s.dim));
    setSubtract(dimmed,  expand(s.undim));
    setUnion(emphasised, expand(s.emphasize));

    // Camera framing for this step.
    const camIds = s.camera === '*' ? allNodeIds : arr(s.camera);
    let cam = null;
    if (camIds.length > 0) {
      const camSpec = { ...placed, view: camIds, viewPadding: s.viewPadding ?? placed.viewPadding };
      cam = computeCamera(camSpec, projection);
    }

    plan.push({
      id: s.id ?? `step-${i}`,
      caption: s.caption ?? null,
      duration: s.duration ?? DEFAULT_TRANSITION_MS,
      visible: [...visible],
      activated: [...activated],
      dimmed: [...dimmed],
      emphasised: [...emphasised],
      pulse: expand(s.highlight),   // sticky reset per step
      flow: expand(s.flow),
      camera: cam,                  // null → stay
    });
  }

  // The initial pose: step 0's camera if set, else null.
  const initialCamera = plan[0].camera ?? null;
  return { plan, initialCamera };
}
