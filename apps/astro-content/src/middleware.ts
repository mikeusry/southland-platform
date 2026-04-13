/**
 * Astro Middleware — Route handling + legacy redirects
 *
 * Runs inside the Cloudflare Worker (via @astrojs/cloudflare adapter).
 * All routes are Astro-owned. Commerce uses Shopify Storefront API (headless).
 * No HTML proxying — Shopify is API-only backend.
 */
import { defineMiddleware } from 'astro:middleware'

// Permanent redirects — old Shopify URLs → new Astro routes
const REDIRECTS: Record<string, string> = {
  // Old collection URLs → persona landing pages
  '/collections/backyard-birds': '/poultry/backyard/',
  '/collections/poultry-broilers': '/poultry/commercial/',
  '/collections/turkey': '/poultry/turkey/',
  '/collections/game-birds': '/poultry/game-birds/',
  '/collections/poultry-breeders': '/poultry/breeders/',
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
  '/collections/other': '/',
  // Old /pages/ URLs
  '/pages/why-southland': '/about/',
  '/pages/about-us': '/about/',
  '/pages/contact-us': '/contact/',
  '/pages/distribution': '/distribution/',
  '/pages/store-locator': '/store-locator/',
  '/pages/build-a-case': '/build-a-case/',
  '/pages/faqs': '/contact/',
  '/pages/shipping-policy': '/contact/',
  '/pages/southland-organics-rewards': '/',
  '/pages/hydroseeding': '/hydroseeders/',
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
