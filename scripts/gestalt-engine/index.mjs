/**
 * Gestalt engine entry point.
 *
 *   compile(spec) → { svg, projection, log, violations }
 *
 * Pipeline today (P1 + P2):
 *   measure → adapt(cascade(project)) → render
 *
 * Phases ahead: classify (P3), place (layout, P3–P7), route (edge geometry).
 */

import { measure } from './measure.mjs';
import { place } from './classify.mjs';
import { adapt } from './cascade.mjs';
import { computeCamera } from './camera.mjs';
import { computeSteps } from './steps.mjs';
import { renderSVG } from './render.mjs';

export function compile(spec, options = {}) {
  const measured = measure(spec);
  const placed   = place(measured);
  const { spec: adapted, projection, log, violations } = adapt(placed, options);

  // Step-based motion FSM (optional). The first step's camera (if any)
  // wins over a static `view:` directive.
  const { plan: stepPlan, initialCamera: stepCamera } = computeSteps(adapted, projection);

  // Static camera framing — used when steps don't define one.
  const camera = stepCamera ?? computeCamera(adapted, projection);

  // Controls are auto-enabled when there's a camera OR when there are steps
  // (next/prev navigation needs the JS controller).
  if ((camera || stepPlan) && !adapted.controls) {
    adapted.controls = ['zoom', 'pan', 'auto-fit'];
    adapted.zoomRange = adapted.zoomRange ?? [0.25, 8];
    adapted._controlsAutoEnabled = true;
    log.push({ strategy: 'auto-enable-controls', reason: stepPlan ? 'steps' : 'camera-view' });
  }

  const svg = renderSVG(adapted, projection, { camera, stepPlan });
  return { svg, projection, log, violations, spec: adapted, layout: placed._layout, camera, steps: stepPlan };
}

export { measure } from './measure.mjs';
export { project } from './project.mjs';
export { place, classify } from './classify.mjs';
export { adapt } from './cascade.mjs';
export { renderSVG } from './render.mjs';
export { LEGIBILITY, evaluateBudget } from './legibility.mjs';
