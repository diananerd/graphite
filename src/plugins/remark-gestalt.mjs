/**
 * remark plugin: compiles ```gestalt fenced code blocks via the Gestalt engine.
 *
 * Runs at the remark stage (before Shiki) so the original `lang: 'gestalt'`
 * info string is intact. Emits a single HTML node containing the compiled SVG.
 */
import { visit } from 'unist-util-visit';
import { parseSpec } from '../../scripts/gestalt-engine/parser.mjs';
import { compile } from '../../scripts/gestalt-engine/index.mjs';

const RATIO_MAP = {
  '16:9': '16/9', '4:3': '4/3', '1:1': '1/1', '9:16': '9/16', '3:2': '3/2',
};

function ratioCss(spec) {
  return RATIO_MAP[spec.ratio] ?? '16/9';
}

export function remarkGestalt({ dev = false } = {}) {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'gestalt' || !node.value?.trim()) return;
      let svg, spec;
      try {
        spec = parseSpec(node.value);
        const out = compile(spec);
        svg = out.svg;
      } catch (err) {
        if (!dev) throw new Error(`[Gestalt] compile error:\n${err.message}`);
        svg = `<pre style="color:#ff5555">[Gestalt] ${err.message}</pre>`;
      }
      parent.children[index] = {
        type: 'html',
        value: `<div class="gestalt-diagram" style="aspect-ratio: ${ratioCss(spec)}">${svg}</div>`,
      };
    });
  };
}

export default remarkGestalt;
