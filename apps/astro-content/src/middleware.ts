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
}

// Also match with trailing slashes
const REDIRECTS_WITH_SLASHES: Record<string, string> = {}
for (const [from, to] of Object.entries(REDIRECTS)) {
  REDIRECTS_WITH_SLASHES[from] = to
  if (!from.endsWith('/')) {
    REDIRECTS_WITH_SLASHES[from + '/'] = to
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // Permanent redirects (old Shopify URLs → new Astro routes)
  const redirect = REDIRECTS_WITH_SLASHES[pathname]
  if (redirect) {
    return new Response(null, {
      status: 301,
      headers: { location: redirect },
    })
  }

  // /blogs/[category]/[slug] → /blog/[slug]/ (old Shopify blog article URLs)
  const blogArticleMatch = pathname.match(/^\/blogs\/[^/]+\/(.+?)\/?\s*$/)
  if (blogArticleMatch) {
    return new Response(null, {
      status: 301,
      headers: { location: `/blog/${blogArticleMatch[1]}/` },
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
