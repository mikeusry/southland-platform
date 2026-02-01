/**
 * Cloudflare Pages Middleware
 *
 * Routes requests to either:
 * - Astro static site (for /podcast/*, /admin/*, and static assets)
 * - Shopify origin (for everything else)
 *
 * This enables the "fake headless" architecture where Astro content
 * appears to be part of the main Shopify site.
 */

interface Env {
  SHOPIFY_ORIGIN?: string;
}

// Routes that should be served by Astro (this deployment)
const ASTRO_ROUTES = [
  '/podcast',
  '/admin',
  '/_astro',
  '/fonts',
  '/images',
  '/favicon',
  '/manifest.json',
  '/sw.js',
  '/robots.txt',
  '/sitemap',
];

// Check if a path should be served by Astro
function isAstroRoute(pathname: string): boolean {
  return ASTRO_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // If this is an Astro route, let Pages serve the static files
  if (isAstroRoute(pathname)) {
    return context.next();
  }

  // For all other routes, proxy to Shopify
  const shopifyOrigin = context.env.SHOPIFY_ORIGIN || 'https://southland-organics.myshopify.com';
  const shopifyUrl = new URL(pathname + url.search, shopifyOrigin);

  // Clone the request with the new URL
  const shopifyRequest = new Request(shopifyUrl.toString(), {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
    redirect: 'manual', // Handle redirects ourselves
  });

  // Remove headers that might cause issues
  shopifyRequest.headers.delete('host');

  try {
    const response = await fetch(shopifyRequest);

    // Handle redirects - rewrite Shopify domain back to our domain
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const redirectUrl = new URL(location, shopifyOrigin);
        // If redirecting to Shopify, rewrite to our domain
        if (redirectUrl.hostname.includes('myshopify.com') ||
            redirectUrl.hostname === 'southlandorganics.com') {
          redirectUrl.hostname = url.hostname;
          redirectUrl.protocol = url.protocol;
          const newHeaders = new Headers(response.headers);
          newHeaders.set('location', redirectUrl.toString());
          return new Response(response.body, {
            status: response.status,
            headers: newHeaders,
          });
        }
      }
    }

    // Clone response and return
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Error connecting to origin', { status: 502 });
  }
};
