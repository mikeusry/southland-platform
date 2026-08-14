// @ts-check
import { defineConfig } from 'astro/config'
import { readdirSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sentry from '@sentry/astro'
import tailwind from '@astrojs/tailwind'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import cloudflare from '@astrojs/cloudflare'
import rehypeExternalLinks from 'rehype-external-links'
import { visit } from 'unist-util-visit'

const SITE_URL = 'https://southlandorganics.com'

// SSR product pages aren't discovered by @astrojs/sitemap (it only sees prerendered routes).
// Read shopifyHandle values from the MDX content collection and inject them as customPages.
function getProductSitemapUrls() {
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'src/content/products')
  const handles = new Set()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.mdx')) continue
    const match = readFileSync(join(dir, file), 'utf8').match(
      /^shopifyHandle:\s*["']?([^"'\n]+)["']?/m
    )
    if (match) handles.add(match[1].trim())
  }
  return [...handles].map((h) => `${SITE_URL}/products/${h}/`)
}

/** Rehype plugin: add loading="lazy" to all images in markdown content */
function rehypeLazyImages() {
  return (/** @type {any} */ tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'img' && node.properties) {
        node.properties.loading = 'lazy'
      }
    })
  }
}

// FlashSpeed on the shop theme rewrites /blogs/{handle}/{slug} → /blog/{handle}/{slug}.
// Prerendered /blog/[slug] pages exclude /blog/* from the Worker, so Astro
// middleware and SSR pages never see those URLs. Append splat rules to the
// Pages _redirects file (edge, before _routes.json) after the adapter writes it.
const FLASHSPEED_BLOG_REDIRECTS = [
  '/blog/news/* /blog/:splat 301',
  '/blog/case-studies/* /blog/:splat 301',
  '/blog/humate-hub/* /blog/:splat 301',
  '/blog/poultry-biosecurity/* /blog/:splat 301',
]

function appendFlashspeedBlogRedirects() {
  return {
    name: 'append-flashspeed-blog-redirects',
    hooks: {
      'astro:build:done': async (/** @type {{ dir: URL }} */ { dir }) => {
        const file = join(fileURLToPath(dir), '_redirects')
        let existing = ''
        try {
          existing = await readFile(file, 'utf8')
        } catch {
          /* adapter may not have written one */
        }
        if (existing.includes('/blog/news/*')) return
        const next =
          existing.trimEnd() + (existing ? '\n' : '') + FLASHSPEED_BLOG_REDIRECTS.join('\n') + '\n'
        await writeFile(file, next)
      },
    },
  }
}

// https://astro.build/config
// TinaCMS runs as separate dev server (npx tinacms dev) alongside Astro
export default defineConfig({
  site: SITE_URL,
  // base: '/podcast' - handled by Cloudflare Worker routing in production
  integrations: [
    sentry({
      dsn: 'https://2cd735876d8ac86479ca9b7ea11b6960@o4510754307178496.ingest.us.sentry.io/4511174165856256',
      environment: process.env.NODE_ENV || 'production',
      // Source maps upload — requires SENTRY_AUTH_TOKEN at build time (GitHub
      // Actions secret). Without it, the plugin no-ops gracefully. With it,
      // minified errors like `Yd` deminify to real class names in Sentry.
      org: 'inventorysouthland',
      project: 'southland-website',
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
      },
      tracesSampleRate: 0.3,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
    }),
    react(),
    tailwind(),
    mdx(),
    sitemap({
      customPages: getProductSitemapUrls(),
      filter: (page) =>
        !page.includes('/admin/') &&
        !page.includes('/account') &&
        !page.includes('/survey/') &&
        !page.includes('/homepage-b'),
    }),
    appendFlashspeedBlogRedirects(),
  ],
  output: 'server',
  // Legacy Shopify handles that still resolve via [handle].astro's shopifyHandle
  // matcher, leaving one page indexed at two URLs. Redirect the legacy path so the
  // canonical slug owns the ranking. See T-1138 GSC data (2026-07-20): the legacy
  // handle held MORE impressions at pos 10.2 than /products/desecticide/ at pos 2.0.
  redirects: {
    '/products/natural-mite-control-livestock-poultry': '/products/desecticide',
  },
  adapter: cloudflare({
    // routes: adapter auto-generates include: ["/*"] which covers all SSR routes.
    // Do NOT add routes.extend.include — overlapping splat rules cause wrangler deploy to fail.
  }),
  markdown: {
    rehypePlugins: [
      [
        rehypeExternalLinks,
        {
          target: '_blank',
          rel: ['nofollow', 'noopener', 'noreferrer'],
        },
      ],
      rehypeLazyImages,
    ],
  },
  build: {
    format: 'directory',
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_SITE_URL': JSON.stringify(
        process.env.PUBLIC_SITE_URL || 'https://southlandorganics.com'
      ),
    },
  },
})
