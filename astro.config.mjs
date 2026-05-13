// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { remarkResponsiveImages } from './src/plugins/responsive-images.mjs';
import { rehypeAnim } from './src/plugins/rehype-anim.mjs';
import blogConfig from './blog.config.ts';

const isDev = process.env.NODE_ENV !== 'production';
const enableMermaid = process.env.SKIP_MERMAID !== '1';

// rehype-mermaid is dynamically imported so that builds without Playwright
// installed don't crash at import time. Enable explicitly when needed.
let rehypeMermaidPlugin = null;
if (enableMermaid) {
  try {
    const mod = await import('rehype-mermaid');
    rehypeMermaidPlugin = mod.default;
  } catch {
    console.warn('[astro.config] rehype-mermaid not installed — Mermaid blocks will render as plain code.');
  }
}

const mermaidConfig = [
  rehypeMermaidPlugin,
  {
    strategy: 'inline-svg',
    mermaidConfig: {
      theme: 'dark',
      themeVariables: {
        background: '#181818',
        primaryColor: '#212121',
        primaryTextColor: '#e0ddd6',
        lineColor: '#8faacc',
        edgeLabelBackground: '#181818',
      },
    },
  },
];

export default defineConfig({
  site: blogConfig.site.url,
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: false,
      langs: [
        'typescript',
        'tsx',
        'javascript',
        'jsx',
        'toml',
        'rust',
        'c',
        'cpp',
        'python',
        'bash',
        'yaml',
        'json',
        'css',
        'html',
        'markdown',
      ],
    },
    remarkPlugins: [[remarkResponsiveImages, { dev: isDev }]],
    rehypePlugins: [
      ...(rehypeMermaidPlugin ? [mermaidConfig] : []),
      [rehypeAnim, { dev: isDev }],
    ],
  },
});
