/**
 * remark plugin: compiles ```gestalt fenced code blocks via the Gestalt engine.
 *
 * Runs at the remark stage (before Shiki) so the original `lang: 'gestalt'`
 * info string is intact. Emits a single HTML node containing the compiled SVG.
 */
import { visit } from 'unist-util-visit';
import { parseSpec } from '../../scripts/gestalt-engine/parser.mjs';
import { compile } from '../../scripts/gestalt-engine/index.mjs';

function aspectFromSvg(svg) {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return m ? `${m[1]} / ${m[2]}` : '16 / 9';
}

export function remarkGestalt({ dev = false } = {}) {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'gestalt' || !node.value?.trim()) return;
      let svg;
      try {
        const spec = parseSpec(node.value);
        const out = compile(spec);
        svg = out.svg;
      } catch (err) {
        if (!dev) throw new Error(`[Gestalt] compile error:\n${err.message}`);
        svg = `<pre style="color:#ff5555">[Gestalt] ${err.message}</pre>`;
      }
      // Aspect comes from the actual compiled viewBox so the wrapper always
      // matches the diagram even when the cascade grew the canvas past the
      // author-declared ratio.
      parent.children[index] = {
        type: 'html',
        value: `<div class="gestalt-diagram" style="aspect-ratio: ${aspectFromSvg(svg)}">${svg}</div>`,
      };
    });
  };
}

export default remarkGestalt;
