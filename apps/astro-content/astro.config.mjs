// @ts-check
import { defineConfig } from 'astro/config'
import { readdirSync, readFileSync } from 'node:fs'
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

// SSR product pages aren't discovered by @astrojs/sitemap (it only sees prerendered routes),
// so product URLs are injected as customPages.
//
// 🛑 Emit the FILENAME slug, not `shopifyHandle`. [handle].astro resolves a URL by matching
// EITHER the file id OR shopifyHandle, then asks Shopify for that handle — so the filename
// URL always renders, while the shopifyHandle URL only renders if Shopify still publishes
// that handle to the storefront. Submitting the shopifyHandle form put three dead URLs in
// the sitemap (2026-07-21): chicken-manure-fertilizer, c-fix-biochar-soil-amendment, and
// natural-mite-control-livestock-poultry — the last of which is really /products/desecticide/.
// Google reported all three as "Product page unavailable" in Merchant Center.
//
// Products whose Shopify handle is no longer published to the storefront sales channel
// render a 404 even though the MDX file exists — the route asks Shopify for the handle and
// gets null. Keep them out of the sitemap until they are re-published in Shopify; a dead URL
// in the sitemap is a crawl-quality signal and Google flags it in Merchant Center too.
// Verified 404 on 2026-07-21. Delete an entry here once its Shopify page is live again.
const UNPUBLISHED_PRODUCT_SLUGS = new Set([
  'chicken-manure-fertilizer',
  'c-fix-biochar-soil-amendment',
])

function getProductSitemapUrls() {
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'src/content/products')
  const slugs = new Set()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.mdx')) continue
    const slug = file.replace(/\.mdx?$/, '')
    if (UNPUBLISHED_PRODUCT_SLUGS.has(slug)) continue
    slugs.add(slug)
  }
  return [...slugs].map((s) => `${SITE_URL}/products/${s}/`)
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
  ],
  output: 'server',
  // Legacy Shopify handles that still resolve via [handle].astro's shopifyHandle
  // matcher, leaving one page indexed at two URLs. Redirect the legacy path so the
  // canonical slug owns the ranking. See T-1138 GSC data (2026-07-20): the legacy
  // handle held MORE impressions at pos 10.2 than /products/desecticide/ at pos 2.0.
  // 🛑 Declare BOTH the bare and trailing-slash form. Astro matches these literally, and
  // the site canonicalises to a trailing slash — so the slashed variant is the one Google
  // actually holds. Before 2026-07-21 only the bare path was listed, and
  // /products/natural-mite-control-livestock-poultry/ (with slash) 404'd while the bare
  // path redirected correctly.
  redirects: {
    '/products/natural-mite-control-livestock-poultry': '/products/desecticide',
    '/products/natural-mite-control-livestock-poultry/': '/products/desecticide/',
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
