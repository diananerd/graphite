/**
 * anim-compiler.mjs — AnimML DSL → animated SVG string.
 *
 * Pipeline: parseAnimML(source) → validate → buildTimeline → emit SVG.
 */
import { validateSpec } from './anim-schema.mjs';
import { SYM_SIZE, SYMBOL_DEFS, ANIM_STYLEKIT } from './anim-symbols.mjs';

/* ─────────────────────────────────────────────────────────────────────
   PARSER
   ───────────────────────────────────────────────────────────────────── */

const RATIO_MAP = {
  '16:9': [1600, 900],
  '4:3':  [1600, 1200],
  '1:1':  [1200, 1200],
  '9:16': [900,  1600],
  '3:2':  [1500, 1000],
};

function unquote(s) {
  const m = s.match(/^"(.*)"$/) || s.match(/^'(.*)'$/);
  return m ? m[1] : s;
}

function parseKeyValuePairs(rest) {
  // Parses tokens like `label:"foo bar" color:cyan .dashed bend:-10`
  // Returns { props: {label, color, ...}, flags: Set, raw }
  const props = {};
  const flags = new Set();
  // Tokenize while respecting quoted strings
  const tokens = [];
  let cur = '';
  let inQuote = null;
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (inQuote) {
      cur += c;
      if (c === inQuote && rest[i-1] !== '\\') inQuote = null;
    } else if (c === '"' || c === "'") {
      inQuote = c;
      cur += c;
    } else if (/\s/.test(c)) {
      if (cur) tokens.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur) tokens.push(cur);

  for (const tok of tokens) {
    if (tok.startsWith('.')) {
      flags.add(tok.slice(1));
    } else {
      const m = tok.match(/^([a-z-]+):(.+)$/i);
      if (m) {
        props[m[1]] = unquote(m[2]);
      }
    }
  }
  return { props, flags };
}

export function parseAnimML(source) {
  const lines = source.split('\n');
  const spec = {
    meta: {},
    nodes: {},
    containers: {},
    edges: {},
    states: {},
    transitions: [],
  };

  let currentState = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line || line.startsWith('#')) continue;

    // Normalize unicode arrow to ASCII
    const norm = line.replace(/→/g, '->');

    // ── Header ──────────────────────────────────────────────────
    const header = norm.match(/^\[\s*(\S+)\s+(\S+)\s+(.+)\s*\]$/);
    if (header) {
      spec.meta.ratio = header[1];
      spec.meta.theme = header[2];
      spec.meta.title = unquote(header[3].trim());
      currentState = null;
      continue;
    }

    // ── Meta ────────────────────────────────────────────────────
    const metaMatch = norm.match(/^(duration|loop|loop-delay|snapshot):\s*(.+)$/);
    if (metaMatch && currentState === null) {
      const [, key, val] = metaMatch;
      if (val === 'true') spec.meta[key] = true;
      else if (val === 'false') spec.meta[key] = false;
      else if (val === 'auto' || val === 'peak' || val === 'end') spec.meta[key] = val;
      else if (/^\d+$/.test(val)) spec.meta[key] = parseInt(val, 10);
      else spec.meta[key] = unquote(val);
      continue;
    }

    // ── Node: `use SYMBOL as ID at(x,y) ...` ────────────────────
    const nodeM = norm.match(/^use\s+(\w+)\s+as\s+([a-z][a-z0-9-]*)\s+at\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*(.*)$/);
    if (nodeM) {
      const [, symbol, id, x, y, rest] = nodeM;
      const { props } = parseKeyValuePairs(rest);
      spec.nodes[id] = {
        id,
        symbol,
        x: parseFloat(x),
        y: parseFloat(y),
        color: props.color ?? 'accent',
        label: props.label ?? id,
        sublabel: props.sublabel,
        size: props.size,
      };
      currentState = null;
      continue;
    }

    // ── Group: `group ID contains(a, b, c) ...` ─────────────────
    const groupM = norm.match(/^group\s+([a-z][a-z0-9-]*)\s+contains\(([^)]+)\)\s*(.*)$/);
    if (groupM) {
      const [, id, contents, rest] = groupM;
      const { props } = parseKeyValuePairs(rest);
      spec.containers[id] = {
        id,
        contains: contents.split(',').map(s => s.trim()),
        label: props.label,
        color: props.color ?? 'dim',
        padding: props.padding ? parseInt(props.padding, 10) : 20,
      };
      currentState = null;
      continue;
    }

    // ── Edge: `-> FROM -> TO as ID ...` ─────────────────────────
    const edgeM = norm.match(/^->\s+([a-z][a-z0-9-]*)\s+->\s+([a-z][a-z0-9-]*)\s+as\s+([a-z][a-z0-9-]*)\s*(.*)$/);
    if (edgeM) {
      const [, from, to, id, rest] = edgeM;
      const { props, flags } = parseKeyValuePairs(rest);
      spec.edges[id] = {
        id,
        from,
        to,
        color: props.color ?? 'accent',
        label: props.label,
        dashed: flags.has('dashed'),
        thick: flags.has('thick'),
        return: flags.has('return'),
        bend: props.bend !== undefined
          ? parseFloat(props.bend)
          : (flags.has('return') ? -10 : 0),
      };
      currentState = null;
      continue;
    }

    // ── State header: `state ID:` ──────────────────────────────
    const stateM = norm.match(/^state\s+([a-z][a-z0-9-]*)\s*:\s*$/);
    if (stateM) {
      currentState = stateM[1];
      spec.states[currentState] = [];
      continue;
    }

    // ── Transition: `FROM --[Nms easing]--> TO` ────────────────
    const transM = norm.match(/^([a-z][a-z0-9-]*)\s+--\[\s*(\d+)ms(?:\s+([a-z-]+))?\s*\]-->\s+([a-z][a-z0-9-]*)\s*$/);
    if (transM) {
      const [, from, dur, easing, to] = transM;
      spec.transitions.push({
        from,
        to,
        duration: parseInt(dur, 10),
        easing: easing ?? 'ease-in-out',
      });
      currentState = null;
      continue;
    }

    // ── State action (inside `state X:` block) ─────────────────
    if (currentState) {
      // `ACTION TARGET [TARGET...] [color:X] [dur:Nms]`
      const actionM = norm.match(/^([a-z]+)\s+(.+)$/);
      if (actionM) {
        const [, type, rest] = actionM;
        const tokens = rest.split(/\s+/);
        const targets = [];
        const props = {};
        for (const t of tokens) {
          if (t === '*') { targets.push('*'); continue; }
          const kv = t.match(/^([a-z]+):(.+)$/);
          if (kv) {
            const v = kv[2];
            if (kv[1] === 'dur' && /^\d+ms$/.test(v)) {
              props.dur = parseInt(v, 10);
            } else {
              props[kv[1]] = v;
            }
          } else if (/^[a-z][a-z0-9-]*$/.test(t)) {
            targets.push(t);
          }
        }
        spec.states[currentState].push({
          type,
          targets: targets.length === 1 && targets[0] === '*' ? '*' : targets,
          color: props.color,
          dur: props.dur,
        });
        continue;
      }
    }

    // Unrecognized line — warn (but don't fail parse) by ignoring.
  }

  // Defaults
  if (spec.meta.loop === undefined) spec.meta.loop = true;
  if (spec.meta['loop-delay'] === undefined) spec.meta['loop-delay'] = 1000;

  // Validate
  const { errors, warnings } = validateSpec(spec);
  if (warnings.length) {
    for (const w of warnings) console.warn(`[AnimML] ⚠ ${w}`);
  }
  if (errors.length) {
    const msg = errors.map((e, idx) => `  ${idx + 1}. ${e}`).join('\n');
    throw new Error(`AnimML validation failed (${errors.length} error(s)):\n${msg}`);
  }

  return spec;
}

/* ─────────────────────────────────────────────────────────────────────
   ROUTING & GEOMETRY
   ───────────────────────────────────────────────────────────────────── */

function bboxPort(cx, cy, hw, hh, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const t = Math.min(
    cos !== 0 ? hw / Math.abs(cos) : Infinity,
    sin !== 0 ? hh / Math.abs(sin) : Infinity,
  );
  return { x: cx + cos * t, y: cy + sin * t };
}

function routeEdge(spec, edgeId, vw, vh) {
  const edge = spec.edges[edgeId];
  const fn = spec.nodes[edge.from];
  const tn = spec.nodes[edge.to];

  const fcx = fn.x / 100 * vw;
  const fcy = fn.y / 100 * vh;
  const tcx = tn.x / 100 * vw;
  const tcy = tn.y / 100 * vh;
  const [fw, fh] = SYM_SIZE[fn.symbol];
  const [tw, th] = SYM_SIZE[tn.symbol];
  const fhw = fw / 2, fhh = fh / 2;
  const thw = tw / 2, thh = th / 2;

  const angle = Math.atan2(tcy - fcy, tcx - fcx);
  const fromP = bboxPort(fcx, fcy, fhw, fhh, angle);
  const toP = bboxPort(tcx, tcy, thw, thh, angle + Math.PI);

  const bend = edge.bend ?? 0;
  if (bend === 0) {
    return {
      d: `M ${fromP.x.toFixed(1)},${fromP.y.toFixed(1)} L ${toP.x.toFixed(1)},${toP.y.toFixed(1)}`,
      labelPos: { x: (fromP.x + toP.x) / 2, y: (fromP.y + toP.y) / 2 - 8 },
    };
  }

  const mid = { x: (fromP.x + toP.x) / 2, y: (fromP.y + toP.y) / 2 };
  const dx = toP.x - fromP.x;
  const dy = toP.y - fromP.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const cpx = mid.x + (-dy / len) * bend;
  const cpy = mid.y + (dx / len) * bend;

  return {
    d: `M ${fromP.x.toFixed(1)},${fromP.y.toFixed(1)} Q ${cpx.toFixed(1)},${cpy.toFixed(1)} ${toP.x.toFixed(1)},${toP.y.toFixed(1)}`,
    labelPos: { x: cpx, y: cpy + (bend > 0 ? 14 : -8) },
  };
}

/* ─────────────────────────────────────────────────────────────────────
   FSM / TIMELINE
   ───────────────────────────────────────────────────────────────────── */

function buildTimeline(spec) {
  // BFS from the first transition's source to compute absolute time of each state.
  const firstState = spec.transitions[0]?.from ?? Object.keys(spec.states)[0];
  const tState = new Map([[firstState, 0]]);
  const queue = [firstState];
  while (queue.length) {
    const cur = queue.shift();
    for (const tr of spec.transitions.filter(t => t.from === cur)) {
      if (!tState.has(tr.to)) {
        tState.set(tr.to, tState.get(cur) + tr.duration);
        queue.push(tr.to);
      }
    }
  }

  // Detect loop: if the last transition returns to firstState, loop duration
  // is the time of the source plus its duration.
  let loopDur = Math.max(...tState.values()) || 1000;
  const loopBack = spec.transitions.find(t => t.to === firstState && t.from !== firstState);
  if (loopBack) {
    loopDur = (tState.get(loopBack.from) ?? 0) + loopBack.duration;
  }
  return { tState, loopDur, firstState };
}

/* ─────────────────────────────────────────────────────────────────────
   SVG EMISSION
   ───────────────────────────────────────────────────────────────────── */

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[c]);
}

function getViewBox(spec) {
  if (spec.meta.ratio?.startsWith('custom:')) {
    const m = spec.meta.ratio.match(/custom:(\d+)x(\d+)/);
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  }
  return RATIO_MAP[spec.meta.ratio] ?? RATIO_MAP['16:9'];
}

function colorTokensUsed(spec) {
  const used = new Set();
  for (const n of Object.values(spec.nodes)) used.add(n.color);
  for (const e of Object.values(spec.edges)) used.add(e.color);
  for (const c of Object.values(spec.containers)) used.add(c.color);
  for (const actions of Object.values(spec.states)) {
    for (const a of actions) if (a.color) used.add(a.color);
  }
  return used;
}

function emitMarkers(colors) {
  return [...colors].map(c => `
    <marker id="arrow-${c}" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--${c})"/>
    </marker>`).join('');
}

function emitFilters(colors) {
  return [...colors].map(c => `
    <filter id="glow-${c}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="glow-${c}-intense" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`).join('');
}

function emitContainers(spec, vw, vh, hiddenInitially) {
  let out = '';
  for (const [id, c] of Object.entries(spec.containers)) {
    const nodes = c.contains.map(n => spec.nodes[n]).filter(Boolean);
    if (!nodes.length) continue;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const n of nodes) {
      const cx = n.x / 100 * vw;
      const cy = n.y / 100 * vh;
      const [w, h] = SYM_SIZE[n.symbol];
      x1 = Math.min(x1, cx - w / 2 - 8);
      y1 = Math.min(y1, cy - h / 2 - 8);
      x2 = Math.max(x2, cx + w / 2 + 8);
      y2 = Math.max(y2, cy + h / 2 + 8);
    }
    const p = c.padding;
    const initOpacity = hiddenInitially.has(id) ? '0' : '1';
    out += `
  <g id="g-${id}" opacity="${initOpacity}">
    <rect x="${(x1 - p).toFixed(1)}" y="${(y1 - p).toFixed(1)}"
          width="${(x2 - x1 + p * 2).toFixed(1)}" height="${(y2 - y1 + p * 2).toFixed(1)}"
          rx="4" fill="var(--bg-container)"
          stroke="var(--${c.color})" stroke-width="1" stroke-dasharray="4 3"/>
    ${c.label ? `<text x="${(x1 - p + 8).toFixed(1)}" y="${(y1 - p + 14).toFixed(1)}"
          font-family="var(--font)" font-size="10" fill="var(--${c.color})"
          letter-spacing="0.08em">${escapeXml(c.label.toUpperCase())}</text>` : ''}
  </g>`;
  }
  return out;
}

function emitEdges(spec, vw, vh, smilByEdge) {
  let out = '';
  for (const [id, edge] of Object.entries(spec.edges)) {
    const { d, labelPos } = routeEdge(spec, id, vw, vh);
    const dashAttr = edge.dashed ? ' stroke-dasharray="5 4"' : '';
    const sw = edge.thick ? 'var(--sw-active)' : 'var(--sw-edge)';
    out += `
  <g id="e-${id}">
    <path d="${d}" stroke="var(--${edge.color})" stroke-width="${sw}"
          marker-end="url(#arrow-${edge.color})" fill="none" opacity="0.6"${dashAttr}/>
    ${edge.label ? `<text x="${labelPos.x.toFixed(1)}" y="${labelPos.y.toFixed(1)}"
          text-anchor="middle" font-family="var(--font)" font-size="11"
          fill="var(--${edge.color})" opacity="0.75">${escapeXml(edge.label)}</text>` : ''}`;
    // Packet animation
    const packets = smilByEdge[id] ?? [];
    for (const p of packets) {
      const begins = `${p.begin}ms`;
      out += `
    <circle r="5" fill="var(--${edge.color})" filter="url(#glow-${edge.color})" opacity="0">
      <animate attributeName="opacity"
               values="0;1;1;0" keyTimes="0;0.15;0.85;1"
               dur="${p.dur}ms" begin="${begins};${begins}+${p.loopDur}ms"
               repeatCount="indefinite"/>
      <animateMotion dur="${p.dur}ms" begin="${begins};${begins}+${p.loopDur}ms"
                     path="${d}" rotate="auto" repeatCount="indefinite"/>
    </circle>`;
    }
    out += `\n  </g>`;
  }
  return out;
}

function emitNodes(spec, vw, vh, hiddenInitially) {
  let out = '';
  for (const [id, n] of Object.entries(spec.nodes)) {
    const cx = n.x / 100 * vw;
    const cy = n.y / 100 * vh;
    const [w, h] = SYM_SIZE[n.symbol];
    const initOpacity = hiddenInitially.has(id) ? '0' : '1';
    out += `
  <g id="n-${id}" transform="translate(${cx.toFixed(1)},${cy.toFixed(1)})" opacity="${initOpacity}">
    <use href="#sym-${n.symbol}" x="${(-w / 2).toFixed(1)}" y="${(-h / 2).toFixed(1)}"
         width="${w}" height="${h}"
         style="color:var(--${n.color}); --_fill:var(--${n.color}-dim)"/>
    <text y="${(h / 2 + 18).toFixed(1)}" text-anchor="middle"
          font-family="var(--font)" font-size="13"
          fill="var(--${n.color})">${escapeXml(n.label)}</text>
    ${n.sublabel ? `<text y="${(h / 2 + 33).toFixed(1)}" text-anchor="middle"
          font-family="var(--font)" font-size="10"
          fill="var(--${n.color})" opacity="0.6">${escapeXml(n.sublabel)}</text>` : ''}
  </g>`;
  }
  return out;
}

function emitAnimationsCSS(spec, timeline) {
  const { tState, loopDur } = timeline;
  const lines = [];

  // Pulse keyframes per color
  const colorsUsed = colorTokensUsed(spec);
  lines.push('@keyframes reveal { from{opacity:0; transform:scale(0.95)} to{opacity:1; transform:scale(1)} }');
  lines.push('@keyframes fade-hide { to { opacity: 0 } }');
  lines.push('@keyframes fade-dim { to { opacity: 0.28 } }');
  lines.push('@keyframes fade-bright { to { opacity: 1 } }');
  for (const c of colorsUsed) {
    lines.push(`@keyframes pulse-${c} {
      0% { filter: none; }
      35% { filter: url(#glow-${c}-intense); }
      65% { filter: url(#glow-${c}-intense); }
      100% { filter: url(#glow-${c}); }
    }`);
    lines.push(`@keyframes active-${c} {
      from { filter: none; }
      to { filter: url(#glow-${c}-intense); }
    }`);
  }

  // Per-element timelines
  for (const [stateName, actions] of Object.entries(spec.states)) {
    const t0 = tState.get(stateName);
    if (t0 === undefined) continue;
    for (const action of actions) {
      const targets = action.targets === '*'
        ? [...Object.keys(spec.nodes), ...Object.keys(spec.containers)]
        : action.targets;
      if (action.type === 'show') {
        let stagger = 0;
        for (const tid of targets) {
          const sel = spec.nodes[tid] ? `#n-${tid}` : `#g-${tid}`;
          lines.push(`${sel} { animation: reveal 400ms var(--ease-reveal) ${t0 + stagger}ms forwards; }`);
          stagger += 50;
        }
      } else if (action.type === 'hide') {
        for (const tid of targets) {
          const sel = spec.nodes[tid] ? `#n-${tid}` : `#g-${tid}`;
          lines.push(`${sel} { animation: fade-hide 200ms linear ${t0}ms forwards; }`);
        }
      } else if (action.type === 'pulse') {
        for (const tid of targets) {
          const color = action.color ?? spec.nodes[tid]?.color ?? 'accent';
          lines.push(`#n-${tid} { animation: fade-bright 200ms ease-out ${t0}ms forwards; }`);
          lines.push(`#n-${tid} use { animation: pulse-${color} 600ms var(--ease-pulse) ${t0}ms; }`);
        }
      } else if (action.type === 'active') {
        for (const tid of targets) {
          const color = action.color ?? spec.nodes[tid]?.color ?? 'accent';
          lines.push(`#n-${tid} { animation: fade-bright 250ms ease-out ${t0}ms forwards; }`);
          lines.push(`#n-${tid} use { animation: active-${color} 300ms ease-out ${t0}ms forwards; }`);
        }
      } else if (action.type === 'deactivate') {
        // Reset filter (animations on same property with later time win — leave to CSS cascade order)
        for (const tid of targets) {
          lines.push(`#n-${tid} use { animation: none; filter: none; }`);
        }
      } else if (action.type === 'dim' || action.type === 'unfocus') {
        for (const tid of targets) {
          const sel = spec.nodes[tid] ? `#n-${tid}` : `#g-${tid}`;
          lines.push(`${sel} { animation: fade-dim 250ms ease-out ${t0}ms forwards; }`);
        }
      } else if (action.type === 'highlight' || action.type === 'focus') {
        for (const tid of targets) {
          const color = action.color ?? spec.nodes[tid]?.color ?? 'accent';
          const sel = spec.nodes[tid] ? `#n-${tid}` : `#g-${tid}`;
          lines.push(`${sel} { animation: fade-bright 250ms ease-out ${t0}ms forwards; }`);
          if (spec.nodes[tid]) {
            lines.push(`#n-${tid} use { animation: active-${color} 400ms ease-out ${t0}ms forwards; }`);
          }
        }
      }
    }
  }

  // Loop reset: if loop=true, restart animation on the root SVG
  if (spec.meta.loop) {
    const total = loopDur + (spec.meta['loop-delay'] ?? 1000);
    lines.push(`svg.anim-root { animation: anim-loop ${total}ms infinite; }`);
    lines.push(`@keyframes anim-loop { 0%, 100% { } }`);
  }

  lines.push(`@media (prefers-reduced-motion: reduce) {
    [id^="n-"], [id^="g-"] { animation: none !important; opacity: 1 !important; filter: none !important; }
    circle[fill^="var(--"] { display: none; }
  }`);

  return lines.join('\n');
}

function buildSmilMap(spec, timeline) {
  const { tState, loopDur } = timeline;
  const smil = {};
  for (const [stateName, actions] of Object.entries(spec.states)) {
    const t0 = tState.get(stateName) ?? 0;
    for (const action of actions) {
      if (action.type !== 'flow') continue;
      const targets = Array.isArray(action.targets) ? action.targets : [action.targets];
      for (const edgeId of targets) {
        const outgoingTr = spec.transitions.find(t => t.from === stateName);
        const dur = action.dur ?? outgoingTr?.duration ?? 600;
        if (!smil[edgeId]) smil[edgeId] = [];
        smil[edgeId].push({ begin: t0, dur, loopDur: loopDur + (spec.meta['loop-delay'] ?? 1000) });
      }
    }
  }
  return smil;
}

/* ─────────────────────────────────────────────────────────────────────
   COMPILE
   ───────────────────────────────────────────────────────────────────── */

export function compileAnim(source, { optimize = false } = {}) {
  const spec = parseAnimML(source);
  const [vw, vh] = getViewBox(spec);
  const timeline = buildTimeline(spec);
  const colors = colorTokensUsed(spec);
  const smilMap = buildSmilMap(spec, timeline);

  // Nodes/containers start hidden ONLY if some state explicitly `show`s them.
  // Otherwise they start visible (opacity:1). This makes `dim *` workflows
  // meaningful and avoids the gotcha of nodes never appearing.
  const hiddenInitially = new Set();
  for (const actions of Object.values(spec.states)) {
    for (const action of actions) {
      if (action.type !== 'show') continue;
      const targets = action.targets === '*'
        ? [...Object.keys(spec.nodes), ...Object.keys(spec.containers)]
        : action.targets;
      for (const t of targets) hiddenInitially.add(t);
    }
  }

  const svg = `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg"
     role="img" class="anim-root" aria-label="${escapeXml(spec.meta.title)}">
  <title>${escapeXml(spec.meta.title)}</title>
  <desc>${escapeXml(spec.meta.title)} — animated diagram</desc>
  <defs>
    <style>${ANIM_STYLEKIT}
${emitAnimationsCSS(spec, timeline)}
    </style>
    ${SYMBOL_DEFS}
    ${emitMarkers(colors)}
    ${emitFilters(colors)}
  </defs>
  <rect width="${vw}" height="${vh}" fill="var(--bg)"/>
  ${emitContainers(spec, vw, vh, hiddenInitially)}
  ${emitEdges(spec, vw, vh, smilMap)}
  ${emitNodes(spec, vw, vh, hiddenInitially)}
</svg>`;

  return optimize ? optimizeSvg(svg) : svg;
}

function optimizeSvg(svg) {
  // Defer to svgo when available; otherwise return as-is.
  // We do this lazily so that the parser can run without svgo installed.
  try {
    // Dynamic require via eval to keep this file ESM-clean for parsers
    // that don't support top-level await in some environments.
    return svg.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><');
  } catch {
    return svg;
  }
}

export default { parseAnimML, compileAnim };
