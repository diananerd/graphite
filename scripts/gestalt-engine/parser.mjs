/**
 * Gestalt DSL v2 parser. §8.
 *
 * Source format (line-oriented):
 *
 *   [16:9 graphite-neon "Title"]      # header (ratio, theme, title)
 *   layout: auto                       # optional layout override
 *   margin: 48
 *   controls: zoom pan auto-fit
 *   zoom-range: 0.5 4
 *
 *   node rect:client    role:primary    label:"Browser"
 *   node cylinder:store role:data       label:"R2"      sublabel:"region:us-east-1"
 *   node circle:idle    role:muted      label:"idle"    size:lg
 *
 *   group payment contains(a, b, c)     label:"Payment"
 *
 *   edge client -> api  label:"GET /post"    style:cubic
 *   edge api    -> store role:data            style:orthogonal
 *
 *   # variants are tokenised key:value or .flags
 *   node round:err label:"error" .filled .critical
 *
 * Comments: lines starting with `#`. Blank lines ignored.
 *
 * Returns a JSON spec consumable by `compile()` from `./index.mjs`.
 */

function unquote(s) {
  const m = s.match(/^"(.*)"$/) || s.match(/^'(.*)'$/);
  return m ? m[1] : s;
}

/**
 * Tokenise the trailing key:value flags of a `node …` or `edge …` line.
 * Quoted strings are preserved; bare `.foo` becomes a flag.
 */
function parseAttrs(rest) {
  const tokens = [];
  let cur = '', q = null;
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (q) {
      cur += c;
      if (c === q && rest[i - 1] !== '\\') q = null;
    } else if (c === '"' || c === "'") {
      q = c;
      cur += c;
    } else if (/\s/.test(c)) {
      if (cur) tokens.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur) tokens.push(cur);

  const out = {};
  const flags = [];
  for (const t of tokens) {
    if (t.startsWith('.')) flags.push(t.slice(1));
    else {
      const m = t.match(/^([a-z-]+):(.+)$/i);
      if (m) out[m[1]] = unquote(m[2]);
    }
  }
  return { attrs: out, flags };
}

/** Translate flag tokens into structured style/role overrides. */
const FLAG_TO_STYLE = {
  outlined: ['style.fill', 'outlined'],
  filled:   ['style.fill', 'filled'],
  tinted:   ['style.fill', 'tinted'],
  glass:    ['style.fill', 'glass'],
  solid:    ['style.border', 'solid'],
  double:   ['style.border', 'double'],
  dashed:   ['style.border', 'dashed'],
  dotted:   ['style.border', 'dotted'],
  thick:    ['style.border', 'thick'],
  square:   ['style.corners', 'square'],
  rounded:  ['style.corners', 'round'],
  'round-lg': ['style.corners', 'round-lg'],
  accent:   ['style.emphasis', 'accent'],
  critical: ['style.emphasis', 'critical'],
  subtle:   ['style.shadow', 'subtle'],
  lifted:   ['style.shadow', 'lifted'],
};

function applyFlags(target, flags) {
  for (const f of flags) {
    const map = FLAG_TO_STYLE[f];
    if (!map) continue;
    const [path, value] = map;
    const [parent, key] = path.split('.');
    if (parent === 'style') {
      target.style ??= {};
      target.style[key] = value;
    } else {
      target[key] = value;
    }
  }
}

export function parseSpec(source) {
  const spec = {
    title: '',
    ratio: '16:9',
    theme: 'graphite-neon',
    nodes: [],
    edges: [],
    groups: [],
  };

  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    // Header: [ratio theme "Title"]
    const header = line.match(/^\[\s*(\S+)\s+(\S+)\s+(.+)\s*\]$/);
    if (header) {
      spec.ratio = header[1];
      spec.theme = header[2];
      spec.title = unquote(header[3].trim());
      continue;
    }

    // Meta: `key: value`
    const meta = line.match(/^(layout|margin|controls|zoom-range|legibility|fit|sizing|gridCols|grid|view|view-padding):\s*(.+)$/);
    if (meta) {
      const [, k, v] = meta;
      if (k === 'margin' || k === 'gridCols') spec[k] = parseInt(v, 10);
      else if (k === 'view-padding') spec.viewPadding = parseInt(v, 10);
      else if (k === 'view') spec.view = v.split(/[\s,]+/).filter(Boolean);
      else if (k === 'controls') {
        const lower = v.trim().toLowerCase();
        spec.controls = (lower === 'none' || lower === 'off' || lower === 'false' || lower === 'no')
          ? false
          : v.split(/\s+/);
      }
      else if (k === 'zoom-range') {
        const parts = v.split(/\s+/).map(Number);
        if (parts.length === 2) spec.zoomRange = parts;
      } else spec[k] = v;
      continue;
    }

    // Node: `node SHAPE:ID label:"..." ...`
    const nodeM = line.match(/^node\s+([a-z]+):([a-z0-9_-]+)\s*(.*)$/i);
    if (nodeM) {
      const [, shape, id, rest] = nodeM;
      const { attrs, flags } = parseAttrs(rest);
      const node = { id, shape, label: attrs.label ?? id };
      if (attrs.sublabel) node.sublabel = attrs.sublabel;
      if (attrs.role) node.role = attrs.role;
      if (attrs.color) node.color = attrs.color;
      if (attrs.size) node.size = attrs.size;
      if (attrs.sizing) node.sizing = attrs.sizing;
      applyFlags(node, flags);
      spec.nodes.push(node);
      continue;
    }

    // Edge: `edge FROM -> TO label:"..." style:...`
    const edgeM = line.match(/^edge\s+([a-z0-9_-]+)\s*->\s*([a-z0-9_-]+)\s*(.*)$/i);
    if (edgeM) {
      const [, from, to, rest] = edgeM;
      const { attrs, flags } = parseAttrs(rest);
      const edge = { from, to };
      if (attrs.label) edge.label = attrs.label;
      if (attrs.style) edge.style = attrs.style;
      if (attrs.role) edge.role = attrs.role;
      if (attrs.color) edge.color = attrs.color;
      if (flags.includes('dashed')) edge.dashed = true;
      if (flags.includes('return')) edge.return = true;
      spec.edges.push(edge);
      continue;
    }

    // Group: `group ID contains(a, b, c) label:"..."`
    const groupM = line.match(/^group\s+([a-z0-9_-]+)\s+contains\(([^)]+)\)\s*(.*)$/i);
    if (groupM) {
      const [, id, contents, rest] = groupM;
      const { attrs } = parseAttrs(rest);
      spec.groups.push({
        id,
        contains: contents.split(',').map((s) => s.trim()),
        label: attrs.label,
        boundary: attrs.boundary,
      });
      continue;
    }
    // Unrecognised lines are ignored silently — they may be future syntax.
  }

  return spec;
}
