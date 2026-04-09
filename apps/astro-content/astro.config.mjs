// @ts-check
import { defineConfig } from 'astro/config';
import sentry from '@sentry/astro';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import rehypeExternalLinks from 'rehype-external-links';
import { visit } from 'unist-util-visit';

/** Rehype plugin: add loading="lazy" to all images in markdown content */
function rehypeLazyImages() {
  return (/** @type {any} */ tree) => {
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
    sentry({
      dsn: 'https://2cd735876d8ac86479ca9b7ea11b6960@o4510754307178496.ingest.us.sentry.io/4511174165856256',
      environment: process.env.NODE_ENV || 'production',
      sourceMapsUploadOptions: {
        enabled: false, // Cloudflare Pages — upload via CLI if needed later
      },
      tracesSampleRate: 0.3,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
    }),
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
    // routes: adapter auto-generates include: ["/*"] which covers all SSR routes.
    // Do NOT add routes.extend.include — overlapping splat rules cause wrangler deploy to fail.
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
