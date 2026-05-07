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

  // JockShock vanity + attribution routes
  // /jockshock        → product PDP (short brand URL)
  // /jockshock/team-quote → team quote page (lives in /Users/mikeusry/CODING/JockShock for now;
  //                        proxied/redirected here once that page moves into this repo)
  // /go/<slug>        → attribution-stamped redirect for athlete vanity URLs (NIL endorsers,
  //                        printed-bottle QR codes, gym tour partners). Slug becomes
  //                        utm_campaign so Klaviyo + Nexus can attribute orders.
  if (pathname === '/jockshock' || pathname === '/jockshock/') {
    return new Response(null, {
      status: 302,
      headers: { location: '/products/jockshock/' },
    })
  }

  const goMatch = pathname.match(/^\/go\/([a-z0-9-]+)\/?$/i)
  if (goMatch) {
    const slug = goMatch[1].toLowerCase()
    const incoming = new URL(context.request.url)
    const target = new URL('/products/jockshock/', incoming.origin)
    // Preserve any incoming query params (e.g. existing UTMs override the default)
    incoming.searchParams.forEach((v, k) => target.searchParams.set(k, v))
    if (!target.searchParams.has('utm_source')) target.searchParams.set('utm_source', 'jockshock-vanity')
    if (!target.searchParams.has('utm_medium')) target.searchParams.set('utm_medium', 'redirect')
    if (!target.searchParams.has('utm_campaign')) target.searchParams.set('utm_campaign', slug)
    return new Response(null, {
      status: 302,
      headers: { location: target.pathname + target.search },
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

  // Real /blogs/* hub pages live at src/pages/blogs/*.astro — never redirect
  // these. The legacy-Shopify cleanup below handles everything else.
  const BLOGS_HUBS = new Set(['case-studies', 'humate-hub', 'poultry-biosecurity'])
  const blogsHubMatch = pathname.match(/^\/blogs\/([^/]+)\/?$/)
  const isRealHub = blogsHubMatch && BLOGS_HUBS.has(blogsHubMatch[1])

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

  // Bare /blogs or /blogs/[category] index → /blog/, but ONLY when the
  // category isn't one of our real hub pages.
  if (pathname === '/blogs' || pathname === '/blogs/') {
    return new Response(null, {
      status: 301,
      headers: { location: `/blog/` },
    })
  }
  if (/^\/blogs\/[^/]+\/?$/.test(pathname) && !isRealHub) {
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
