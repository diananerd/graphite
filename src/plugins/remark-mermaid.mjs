/**
 * remark plugin: compiles ```mermaid fenced code blocks to inline SVG via
 * mermaid-isomorphic (Playwright Chromium).
 *
 * Runs at the remark stage so it sees the original `lang: 'mermaid'` info
 * string before Shiki rewrites the block.
 */
import { visit } from 'unist-util-visit';
import { createMermaidRenderer } from 'mermaid-isomorphic';

let renderer = null;
function getRenderer() {
  return renderer ?? (renderer = createMermaidRenderer());
}

const MERMAID_CONFIG = {
  theme: 'dark',
  themeVariables: {
    background: '#181818',
    primaryColor: '#212121',
    primaryTextColor: '#e0ddd6',
    primaryBorderColor: '#bf7fff',
    lineColor: '#bf7fff',
    edgeLabelBackground: '#181818',
    tertiaryColor: '#202020',
    fontFamily: 'Monaspace Neon, ui-monospace, monospace',
  },
};

export function remarkMermaid() {
  return async (tree) => {
    const targets = [];
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang === 'mermaid' && node.value?.trim()) {
        targets.push({ node, index, parent });
      }
    });
    if (targets.length === 0) return;

    const results = await getRenderer()(
      targets.map((t) => t.node.value),
      { mermaidConfig: MERMAID_CONFIG },
    );

    for (let i = 0; i < targets.length; i++) {
      const { node, index, parent } = targets[i];
      const result = results[i];
      let svg;
      if (result.status === 'fulfilled') {
        svg = result.value.svg;
      } else {
        const msg = String(result.reason?.message ?? result.reason ?? 'unknown error');
        throw new Error(`[Mermaid] compile error in block:\n${node.value}\n\n${msg}`);
      }
      parent.children[index] = {
        type: 'html',
        value: `<div class="mermaid-diagram">${svg}</div>`,
      };
    }
  };
}

export default remarkMermaid;
