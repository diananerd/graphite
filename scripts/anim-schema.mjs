/**
 * anim-schema.mjs — validation rules and constants for AnimML specs.
 */

export const VALID_SYMBOLS = new Set([
  'browser', 'server', 'hexagon', 'cylinder', 'cloud',
  'diamond', 'queue', 'cache', 'user', 'box', 'pill',
]);

export const VALID_COLORS = new Set([
  'cyan', 'green', 'purple', 'pink', 'yellow',
  'orange', 'red', 'accent', 'white', 'dim',
]);

export const VALID_RATIOS = new Set([
  '16:9', '4:3', '1:1', '9:16', '3:2',
]);

export const VALID_THEMES = new Set([
  'graphite-neon', 'graphite-pastel', 'glass', 'transparent',
]);

export const VALID_EFFECTS = new Set([
  'show', 'hide', 'flow', 'active', 'deactivate',
  'pulse', 'highlight', 'dim', 'focus', 'unfocus',
]);

export const VALID_EASINGS = new Set([
  'ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear',
]);

export function validateSpec(spec) {
  const errors = [];
  const warnings = [];
  const fail = (msg) => errors.push(msg);
  const warn = (msg) => warnings.push(msg);

  const nodeIds = new Set(Object.keys(spec.nodes ?? {}));
  const edgeIds = new Set(Object.keys(spec.edges ?? {}));
  const stateIds = new Set(Object.keys(spec.states ?? {}));
  const containerIds = new Set(Object.keys(spec.containers ?? {}));
  const allTargetIds = new Set([...nodeIds, ...edgeIds, ...containerIds]);

  const meta = spec.meta ?? {};
  if (!meta.ratio) {
    fail('meta: ratio required (e.g. 16:9)');
  } else if (!VALID_RATIOS.has(meta.ratio) && !meta.ratio.startsWith('custom:')) {
    fail(`meta.ratio "${meta.ratio}" invalid — valid: ${[...VALID_RATIOS].join(', ')}, custom:WxH`);
  }
  if (!meta.theme) {
    fail('meta: theme required');
  } else if (!VALID_THEMES.has(meta.theme)) {
    fail(`meta.theme "${meta.theme}" invalid`);
  }
  if (!meta.title || meta.title.trim().length < 3) {
    fail('meta: title required (min 3 chars)');
  }

  if (nodeIds.size === 0) {
    fail('At least one node required (use <symbol> as <id>)');
  }
  for (const [id, node] of Object.entries(spec.nodes ?? {})) {
    if (!VALID_SYMBOLS.has(node.symbol)) {
      fail(`node "${id}": symbol "${node.symbol}" unknown`);
    }
    if (!VALID_COLORS.has(node.color)) {
      fail(`node "${id}": color "${node.color}" invalid`);
    }
    if (!node.label || node.label.trim() === '') {
      fail(`node "${id}": label required`);
    }
    if (node.x === undefined || node.y === undefined) {
      fail(`node "${id}": at(x,y) required`);
    } else {
      if (node.x < 0 || node.x > 100) fail(`node "${id}": x=${node.x} out of 0-100`);
      if (node.y < 0 || node.y > 100) fail(`node "${id}": y=${node.y} out of 0-100`);
    }
  }

  for (const [id, container] of Object.entries(spec.containers ?? {})) {
    if (!container.contains || container.contains.length === 0) {
      fail(`container "${id}": contains() with at least one node required`);
    }
    for (const ref of container.contains ?? []) {
      if (!nodeIds.has(ref)) {
        fail(`container "${id}": references unknown node "${ref}"`);
      }
    }
    if (container.color && !VALID_COLORS.has(container.color)) {
      fail(`container "${id}": color "${container.color}" invalid`);
    }
  }

  for (const [id, edge] of Object.entries(spec.edges ?? {})) {
    if (!nodeIds.has(edge.from)) fail(`edge "${id}": from "${edge.from}" not a defined node`);
    if (!nodeIds.has(edge.to)) fail(`edge "${id}": to "${edge.to}" not a defined node`);
    if (edge.from === edge.to) warn(`edge "${id}": self-loop (from === to) — not renderable`);
    if (!VALID_COLORS.has(edge.color)) fail(`edge "${id}": color "${edge.color}" invalid`);
  }

  if (stateIds.size === 0) {
    fail('At least one state required (state <id>:)');
  }
  for (const [stateName, actions] of Object.entries(spec.states ?? {})) {
    for (const action of actions) {
      if (!VALID_EFFECTS.has(action.type)) {
        fail(`state "${stateName}": effect "${action.type}" invalid`);
      }
      if (action.targets !== '*') {
        for (const target of action.targets ?? []) {
          const validTarget = action.type === 'flow'
            ? edgeIds.has(target)
            : allTargetIds.has(target);
          if (!validTarget) {
            const hint = action.type === 'flow'
              ? `edges: ${[...edgeIds].join(', ')}`
              : `ids: ${[...allTargetIds].join(', ')}`;
            fail(`state "${stateName}" ${action.type}: target "${target}" not found — ${hint}`);
          }
        }
      }
      if (action.color && !VALID_COLORS.has(action.color)) {
        fail(`state "${stateName}": color "${action.color}" invalid`);
      }
    }
  }

  if (!spec.transitions || spec.transitions.length === 0) {
    fail('At least one transition required (from --[Nms]--> to)');
  }
  for (const tr of spec.transitions ?? []) {
    if (!stateIds.has(tr.from)) fail(`transition: from state "${tr.from}" not defined`);
    if (!stateIds.has(tr.to)) fail(`transition: to state "${tr.to}" not defined`);
    if (typeof tr.duration !== 'number' || tr.duration < 0) {
      fail(`transition ${tr.from}→${tr.to}: duration must be number >= 0`);
    }
    if (tr.easing && !VALID_EASINGS.has(tr.easing)) {
      fail(`transition ${tr.from}→${tr.to}: easing "${tr.easing}" invalid`);
    }
  }

  return { errors, warnings };
}
