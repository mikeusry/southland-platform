/**
 * Astro Middleware — Route handling + legacy redirects
 *
 * Runs inside the Cloudflare Worker (via @astrojs/cloudflare adapter).
 * All routes are Astro-owned. Commerce uses Shopify Storefront API (headless).
 * No HTML proxying — Shopify is API-only backend.
 */
import { defineMiddleware } from 'astro:middleware'

// Permanent redirects — old Shopify URLs → new Astro routes
// Mapped from GSC BigQuery inventory (last 90 days) of /pages/* and /collections/* URLs.
const REDIRECTS: Record<string, string> = {
  // Old collection URLs → persona landing pages
  '/collections/backyard-birds': '/poultry/backyard/',
  '/collections/poultry-broilers': '/poultry/commercial/',
  '/collections/turkey': '/poultry/turkey/',
  '/collections/game-birds': '/poultry/game-birds/',
  '/collections/poultry-breeders': '/poultry/breeders/',
  '/collections/poultry': '/poultry/',
  '/collections/hydroseeders': '/hydroseeders/',
  '/collections/golf-courses': '/lawn/golf-courses/',
  '/collections/homeowners': '/lawn/homeowners/',
  '/collections/landscapers': '/lawn/landscapers/',
  '/collections/turf': '/lawn/turf-pros/',
  '/collections/crops': '/agriculture/crops/',
  '/collections/produce': '/agriculture/produce/',
  '/collections/pig-and-swine-supplements': '/livestock/swine/',
  '/collections/sanitizers': '/products/sanitizers/',
  '/collections/waste': '/products/waste-treatment/',
  '/collections/all': '/',
  '/collections/other': '/',
  '/collections': '/',
  // Old /pages/ URLs — brand/about/contact
  '/pages/why-southland': '/about/',
  '/pages/about-us': '/about/',
  '/pages/why-organic': '/about/',
  '/pages/community': '/about/',
  '/pages/contact-us': '/contact/',
  '/pages/contact': '/contact/',
  '/pages/distribution': '/distribution/',
  '/pages/store-locator': '/store-locator/',
  '/pages/build-a-case': '/build-a-case/',
  '/pages/faqs': '/contact/',
  '/pages/shipping-policy': '/contact/',
  '/pages/return-policy': '/contact/',
  '/pages/credit-application': '/contact/',
  '/pages/vented-caps': '/contact/',
  '/pages/order-tracking': '/account/',
  '/pages/southland-organics-rewards': '/',
  '/pages/sale': '/',
  '/pages/hydroseeding': '/hydroseeders/',
  // Team bios — redirect to existing /team/* pages or /about/ fallback
  '/pages/mike-usry': '/team/mike-usry/',
  '/pages/karin-usry': '/team/karin-usry/',
  '/pages/brad-broxton': '/team/brad-broxton/',
  '/pages/allen-reynolds': '/team/allen-reynolds/',
  '/pages/brad-usry': '/about/',
  '/pages/thomas-abercrombie': '/about/',
  // Product landing pages (one-offs) — redirect to product or category
  '/pages/holding-tank-treatment': '/products/holding-tank-treatment',
  '/pages/big-ole-bird-instructions': '/products/big-ole-bird',
  '/pages/desecticide-order-information': '/products/desecticide',
  '/pages/zeropoint-hocl-poultry-disinfectant-safe-for-live-birds':
    '/products/zeropoint-industrial',
  // Humate/humic content — preserve rank via existing blog post
  '/pages/our-humate-deposit': '/blog/why-humate-soil-conditioner/',
  '/pages/humate-soil-conditioner': '/blog/why-humate-soil-conditioner/',
  '/pages/humic-acid-soil-conditioner': '/blog/why-humate-soil-conditioner/',
  // Lawn/poultry programs → persona hubs
  '/pages/natural-lawn-bundles': '/lawn/homeowners/',
  '/pages/organic-lawn-care-program': '/lawn/homeowners/',
  '/pages/natural-lawn-care-instructions': '/lawn/homeowners/',
  '/pages/professional-turf-care-with-genesis': '/lawn/turf-pros/',
  '/pages/backyard-poultry-dosing-chart': '/poultry/backyard/',
  '/pages/probiotics-for-chickens': '/blog/how-to-run-big-ole-bird-poultry-probiotic/',
  // Topical content — existing blog equivalents
  '/pages/the-best-septic-tank-treatment-port': '/blog/septic-tank-system-restoration-with-port/',
  '/pages/how-to-get-rid-of-drain-flies': '/blog/how-to-get-rid-of-drain-flies/',
  // Careers — no dedicated careers page yet, send to /about/
  '/pages/operations-coordinator': '/about/',
  '/pages/athens-ga-job-operations-technician': '/about/',
  // Author / archive pages
  '/pages/author/erin-flowers': '/blog/',
  '/pages/poultry-biosecurity-archives': '/blog/',
  // Wrong product slugs that GSC still has indexed
  '/products/natural-lawn-care-products': '/products/natural-lawn-care-subscription',
  '/products/darkling-beetle-insecticide': '/products/desecticide',
  // Bare-path legacy
  '/why-organic': '/about/',
  // Blog slugs that were never migrated — intercept before /blogs/*/slug regex
  // so they don't fall through to a 404 at /blog/[slug]/
  '/blogs/news/built-to-move-smarter-migration-fencing-for-modern-poultry-houses': '/blog/',
  '/blogs/news/choosing-the-right-line-cleaner': '/blog/',
  // Legacy paths
  '/lawn/hydroseeders': '/hydroseeders/',
  '/turf': '/lawn/',
}

// Also match with trailing slashes
const REDIRECTS_WITH_SLASHES: Record<string, string> = {}
for (const [from, to] of Object.entries(REDIRECTS)) {
  REDIRECTS_WITH_SLASHES[from] = to
  if (!from.endsWith('/')) {
    REDIRECTS_WITH_SLASHES[from + '/'] = to
  }
}

// Simple in-memory rate limiter for API endpoints (per-IP, 60 req/min)
const apiHits = new Map<string, { count: number; reset: number }>()
const API_RATE_LIMIT = 60
const API_RATE_WINDOW = 60_000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = apiHits.get(ip)
  if (!entry || now > entry.reset) {
    apiHits.set(ip, { count: 1, reset: now + API_RATE_WINDOW })
    return false
  }
  entry.count++
  return entry.count > API_RATE_LIMIT
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // Conventional sitemap path → @astrojs/sitemap output
  if (pathname === '/sitemap.xml') {
    return new Response(null, {
      status: 301,
      headers: { location: '/sitemap-index.xml' },
    })
  }

  // Rate-limit /api/ endpoints
  if (pathname.startsWith('/api/')) {
    const ip = context.request.headers.get('cf-connecting-ip') || 'unknown'
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      })
    }
  }

  // Permanent redirects (old Shopify URLs → new Astro routes)
  const redirect = REDIRECTS_WITH_SLASHES[pathname]
  if (redirect) {
    return new Response(null, {
      status: 301,
      headers: { location: redirect },
    })
  }

  // Bulk pattern: /pages/faqs/* → /contact/ (85 legacy FAQ pages, low individual value)
  if (pathname.startsWith('/pages/faqs/')) {
    return new Response(null, {
      status: 301,
      headers: { location: `/contact/` },
    })
  }

  // Bulk pattern: /collections/[col]/products/[handle] → /products/[handle]
  const legacyCollectionProduct = pathname.match(/^\/collections\/[^/]+\/products\/([^/]+)\/?$/)
  if (legacyCollectionProduct) {
    return new Response(null, {
      status: 301,
      headers: { location: `/products/${legacyCollectionProduct[1]}` },
    })
  }

  // /blogs/[category]/[slug] → /blog/[slug]/ (old Shopify blog article URLs)
  // Skip archive pages (tagged/, author/) and pagination — send those to /blog/
  const blogArticleMatch = pathname.match(/^\/blogs\/[^/]+\/(.+?)\/?\s*$/)
  if (blogArticleMatch) {
    const slug = blogArticleMatch[1]
    if (slug.startsWith('tagged/') || slug.startsWith('author/') || slug.includes('/')) {
      return new Response(null, {
        status: 301,
        headers: { location: `/blog/` },
      })
    }
    return new Response(null, {
      status: 301,
      headers: { location: `/blog/${slug}/` },
    })
  }

  // Bare /blogs or /blogs/[category] index → /blog/
  if (pathname === '/blogs' || pathname === '/blogs/' || /^\/blogs\/[^/]+\/?$/.test(pathname)) {
    return new Response(null, {
      status: 301,
      headers: { location: `/blog/` },
    })
  }

  // Shopify cart recovery URLs (/cart/c/...) → redirect to Shopify
  if (pathname.startsWith('/cart/c/')) {
    const shopifyUrl = `https://shop.southlandorganics.com${pathname}${context.url.search}`
    return new Response(null, {
      status: 302,
      headers: { location: shopifyUrl },
    })
  }

  // Shopify checkout URLs (/checkouts/...) → redirect to Shopify
  if (pathname.startsWith('/checkouts/')) {
    const shopifyUrl = `https://shop.southlandorganics.com${pathname}${context.url.search}`
    return new Response(null, {
      status: 302,
      headers: { location: shopifyUrl },
    })
  }

  // Bare /checkout → redirect to Shopify checkout
  if (pathname === '/checkout' || pathname === '/checkout/') {
    return new Response(null, {
      status: 302,
      headers: { location: `https://shop.southlandorganics.com/checkout${context.url.search}` },
    })
  }

  // Everything is Astro-owned — let Astro handle it
  return next()
})
