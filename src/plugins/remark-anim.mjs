/**
 * remark plugin: replaces ```anim fenced code blocks with compiled SVG.
 *
 * Runs at the remark stage so it sees the original `lang: 'anim'` info string
 * before Shiki rewrites the block into a generic plaintext <pre>.
 */
import { visit } from 'unist-util-visit';
import { compileAnim } from '../../scripts/anim-compiler.mjs';

const RATIO_MAP = {
  '16:9': '16/9', '4:3': '4/3', '1:1': '1/1', '9:16': '9/16', '3:2': '3/2',
};

function ratioCss(source) {
  const m = source.match(/^\[(\S+)/m);
  return RATIO_MAP[m?.[1]] ?? '16/9';
}

function buildErrorSVG(message) {
  const lines = String(message).split('\n').slice(0, 10);
  const escape = (s) => String(s).replace(/[<>&"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;',
  })[c]);
  const lineEls = lines.map((line, i) =>
    `<text x="20" y="${55 + i * 18}" font-family="monospace" font-size="12" fill="#f8f8f2" xml:space="preserve">${escape(line)}</text>`
  ).join('');
  const height = Math.max(120, 70 + lines.length * 18 + 20);
  return `<svg viewBox="0 0 800 ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="${height}" fill="#181818" rx="4"/>
  <rect x="1.5" y="1.5" width="797" height="${height - 3}" rx="3"
        fill="none" stroke="#ff5555" stroke-width="1.5" stroke-dasharray="5 3"/>
  <text x="20" y="30" font-family="monospace" font-size="13" font-weight="600" fill="#ff5555">AnimML error</text>
  <line x1="20" y1="40" x2="780" y2="40" stroke="#ff5555" stroke-width="1" opacity="0.4"/>
  ${lineEls}
</svg>`;
}

export function remarkAnim({ dev = false } = {}) {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'anim' || !node.value?.trim()) return;

      let svg;
      try {
        svg = compileAnim(node.value, { optimize: !dev });
      } catch (err) {
        if (!dev) throw new Error(`[AnimML] compile error:\n${err.message}`);
        svg = buildErrorSVG(err.message);
      }

      parent.children[index] = {
        type: 'html',
        value: `<div class="anim-diagram" style="aspect-ratio: ${ratioCss(node.value)}">${svg}</div>`,
      };
    });
  };
}

export default remarkAnim;
