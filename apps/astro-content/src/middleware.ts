/**
 * Astro Middleware — Shopify Proxy + HTMLRewriter
 *
 * Runs inside the Cloudflare Worker (via @astrojs/cloudflare adapter).
 * For Astro routes: calls next() to let Astro render.
 * For everything else: proxies to Shopify and rewrites header/footer.
 */
import { defineMiddleware } from 'astro:middleware'

// Shopify origin — read from Cloudflare env (wrangler.toml) at request time.
//
// DEV (pages.dev):  www.southlandorganics.com works because DNS still points to Shopify.
// PRODUCTION:       Needs a dedicated origin subdomain to avoid redirect loop:
//                   1. Create DNS: shopify-proxy.southlandorganics.com → CNAME shops.myshopify.com
//                   2. Add shopify-proxy.southlandorganics.com as domain in Shopify Admin (NOT primary)
//                   3. Set SHOPIFY_ORIGIN=https://shopify-proxy.southlandorganics.com in wrangler.toml [env.production]
//
// NOTE: *.myshopify.com always 301s to the primary domain — can't be used as proxy origin.
const SHOPIFY_ORIGIN_DEFAULT = 'https://shopify-proxy.southlandorganics.com'

// Phase 1 routes served by Astro
const ASTRO_ROUTES = [
  '/podcast',
  '/blog',
  '/team',
  '/about',
  '/contact',
  '/distribution',
  '/store-locator',
  '/admin',
  '/api',
  '/build-a-case',
]

function isAstroRoute(pathname: string): boolean {
  return ASTRO_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  )
}

// Permanent redirects — old Shopify pages → new Astro routes
const REDIRECTS: Record<string, string> = {
  '/pages/why-southland': '/about/',
}


// Module-level cache for partials (persists across requests in same isolate)
let cachedHeaderHtml: string | null = null
let cachedFooterHtml: string | null = null

async function getPartials(
  assets: { fetch: (input: RequestInfo) => Promise<Response> },
): Promise<{ headerHtml: string; footerHtml: string }> {
  if (!cachedHeaderHtml) {
    try {
      const res = await assets.fetch(
        new URL('https://fake-host/_partials/header.html'),
      )
      cachedHeaderHtml = res.ok ? await res.text() : ''
    } catch {
      cachedHeaderHtml = ''
    }
  }
  if (!cachedFooterHtml) {
    try {
      const res = await assets.fetch(
        new URL('https://fake-host/_partials/footer.html'),
      )
      cachedFooterHtml = res.ok ? await res.text() : ''
    } catch {
      cachedFooterHtml = ''
    }
  }
  return { headerHtml: cachedHeaderHtml!, footerHtml: cachedFooterHtml! }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // Permanent redirects (old Shopify pages → new Astro routes)
  const redirect = REDIRECTS[pathname]
  if (redirect) {
    return new Response(null, {
      status: 301,
      headers: { location: redirect },
    })
  }

  // Astro routes — let Astro handle them
  if (isAstroRoute(pathname)) {
    return next()
  }

  // Resolve Shopify origin from Cloudflare env (wrangler.toml) or fallback
  const runtime = (context.locals as any).runtime
  const SHOPIFY_ORIGIN = runtime?.env?.SHOPIFY_ORIGIN || SHOPIFY_ORIGIN_DEFAULT

  // Static assets that leaked past _routes.json — let Astro serve them
  if (
    pathname.startsWith('/_astro/') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/_partials/') ||
    pathname === '/favicon.svg' ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/robots.txt' ||
    pathname.startsWith('/sitemap')
  ) {
    return next()
  }

  // Everything else: proxy to Shopify
  const shopifyUrl = new URL(pathname + context.url.search, SHOPIFY_ORIGIN)

  const shopifyRequest = new Request(shopifyUrl.toString(), {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
    redirect: 'manual',
  })
  shopifyRequest.headers.delete('host')

  try {
    const response = await fetch(shopifyRequest)

    // Handle redirects — rewrite Shopify domain back to ours
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location) {
        const redirectUrl = new URL(location, SHOPIFY_ORIGIN)
        if (
          redirectUrl.hostname.includes('myshopify.com') ||
          redirectUrl.hostname.includes('southlandorganics.com')
        ) {
          redirectUrl.hostname = context.url.hostname
          redirectUrl.protocol = context.url.protocol
          const newHeaders = new Headers(response.headers)
          newHeaders.set('location', redirectUrl.toString())
          return new Response(response.body, {
            status: response.status,
            headers: newHeaders,
          })
        }
      }
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      })
    }

    // Non-HTML responses (CSS, JS, JSON, images) — pass through
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') || response.status >= 300) {
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      })
    }

    // HTML response — apply HTMLRewriter to replace Shopify header/footer
    const assets = runtime?.env?.ASSETS
    if (!assets) {
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      })
    }

    const partials = await getPartials(assets)
    if (!partials.headerHtml && !partials.footerHtml) {
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      })
    }

    // HTMLRewriter is a global in Cloudflare Workers runtime
    const rewriter = new HTMLRewriter()

    // Inject our CSS + tracking into <head>
    rewriter.on('head', {
      element(element) {
        element.append(
          '<link rel="stylesheet" href="/_partials/partials.css">' +
            '<link rel="preconnect" href="https://fonts.googleapis.com">' +
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
            '<style>.wrapper--bottom{flex:none!important}</style>' +
            // point.dog pixel — fires on Shopify-proxied pages (Astro pages load it via BaseLayout)
            '<script>window.pdPixelConfig={brandId:"southland",endpoint:"https://pixel.southlandorganics.com/collect"};</script>' +
            '<script src="https://cdn.point.dog/pixel/pd-pixel.min.js" async></script>',
          { html: true },
        )
      },
    })

    // Hide Shopify header and insert ours before it.
    // We hide instead of replacing inner content because setInnerContent()
    // destroys <style> blocks inside the section that affect page layout.
    // CSS rules inside display:none elements still apply globally.
    if (partials.headerHtml) {
      rewriter.on('#shopify-section-header--default', {
        element(element) {
          element.before(partials.headerHtml, { html: true })
          element.setAttribute(
            'style',
            'display:none!important',
          )
        },
      })
    }

    // Hide Shopify footer and insert ours after it
    if (partials.footerHtml) {
      rewriter.on('#shopify-section-footer', {
        element(element) {
          element.after(partials.footerHtml, { html: true })
          element.setAttribute(
            'style',
            'display:none!important',
          )
        },
      })
    }

    // Hide Shopify subfooter (our footer includes the bottom bar)
    rewriter.on('#shopify-section-subfooter', {
      element(element) {
        element.setAttribute('style', 'display:none!important')
      },
    })

    const rewritten = rewriter.transform(response)
    return new Response(rewritten.body, {
      status: rewritten.status,
      headers: rewritten.headers,
    })
  } catch (error) {
    console.error('Shopify proxy error:', error)
    return new Response('Error connecting to origin', { status: 502 })
  }
})
