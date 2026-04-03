// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import rehypeExternalLinks from 'rehype-external-links';
import { visit } from 'unist-util-visit';

/** Rehype plugin: add loading="lazy" to all images in markdown content */
function rehypeLazyImages() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'img' && node.properties) {
        node.properties.loading = 'lazy';
      }
    });
  };
}

// https://astro.build/config
// TinaCMS runs as separate dev server (npx tinacms dev) alongside Astro
export default defineConfig({
  site: 'https://southlandorganics.com',
  // base: '/podcast' - handled by Cloudflare Worker routing in production
  integrations: [
    react(),
    tailwind(),
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/admin/') &&
        !page.includes('/account') &&
        !page.includes('/survey/') &&
        !page.includes('/homepage-b'),
    }),
  ],
  output: 'server',
  adapter: cloudflare({
    routes: {
      extend: {
        include: [
          // Persona landing pages (not auto-detected by adapter)
          { pattern: '/poultry/*' },
          { pattern: '/lawn/*' },
          { pattern: '/agriculture/*' },
          { pattern: '/livestock/*' },
          { pattern: '/hydroseeders/*' },
          // Commerce pages
          { pattern: '/build-a-case/*' },
          { pattern: '/products/*' },
          { pattern: '/collections/*' },
          { pattern: '/cart' },
          { pattern: '/account' },
        ],
      },
    },
  }),
  markdown: {
    rehypePlugins: [
      [rehypeExternalLinks, {
        target: '_blank',
        rel: ['nofollow', 'noopener', 'noreferrer'],
      }],
      rehypeLazyImages,
    ],
  },
  build: {
    format: 'directory'
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_SITE_URL': JSON.stringify(process.env.PUBLIC_SITE_URL || 'https://southlandorganics.com')
    },
  }
});
