// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { remarkResponsiveImages } from './src/plugins/responsive-images.mjs';
import { remarkAnim } from './src/plugins/remark-anim.mjs';
import { remarkMermaid } from './src/plugins/remark-mermaid.mjs';
import blogConfig from './blog.config.ts';

const isDev = process.env.NODE_ENV !== 'production';
const enableMermaid = process.env.SKIP_MERMAID !== '1';

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
        'gherkin',
      ],
    },
    remarkPlugins: [
      [remarkAnim, { dev: isDev }],
      ...(enableMermaid ? [remarkMermaid] : []),
      [remarkResponsiveImages, { dev: isDev }],
    ],
  },
});
