/**
 * Cloudflare Pages Middleware
 *
 * Routes requests to either:
 * - Astro (for Phase 1 routes + static assets)
 * - Shopify origin (for everything else)
 *
 * For Shopify-proxied HTML responses, applies HTMLRewriter to replace
 * Shopify's native header/footer with our unified React-rendered partials.
 */

interface Env {
  SHOPIFY_ORIGIN?: string;
  ASSETS: Fetcher;
}

// Routes that should be served by Astro (this deployment)
const ASTRO_ROUTES = [
  // Phase 1 content routes
  '/podcast',
  '/blog',
  '/team',
  '/about',
  '/contact',
  '/distribution',
  '/store-locator',
  // Admin & API
  '/admin',
  '/api',
  // Commerce (Astro-powered)
  '/build-a-case',
  // Static assets & partials
  '/keystatic',
  '/_astro',
  '/_partials',
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

// Module-level cache for partials (persists across requests in same isolate)
let headerHtml: string | null = null;
let footerHtml: string | null = null;

async function getPartials(env: Env): Promise<{ headerHtml: string; footerHtml: string }> {
  if (!headerHtml) {
    try {
      const res = await env.ASSETS.fetch(new URL('https://fake/_partials/header.html'));
      headerHtml = await res.text();
    } catch {
      headerHtml = '';
    }
  }
  if (!footerHtml) {
    try {
      const res = await env.ASSETS.fetch(new URL('https://fake/_partials/footer.html'));
      footerHtml = await res.text();
    } catch {
      footerHtml = '';
    }
  }
  return { headerHtml: headerHtml!, footerHtml: footerHtml! };
}

// Check if the response is HTML
function isHtmlResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/html');
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

    // Only rewrite HTML responses (skip CSS, JS, images, JSON, etc.)
    if (!isHtmlResponse(response) || response.status >= 300) {
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    }

    // Apply HTMLRewriter to inject our header/footer
    const partials = await getPartials(context.env);

    // If partials aren't available, pass through unchanged
    if (!partials.headerHtml && !partials.footerHtml) {
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    }

    const rewriter = new HTMLRewriter();

    // Inject our CSS into <head>
    rewriter.on('head', {
      element(element) {
        element.append(
          `<link rel="stylesheet" href="/_partials/partials.css">` +
          `<link rel="preconnect" href="https://fonts.googleapis.com">` +
          `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
          { html: true },
        );
      },
    });

    // Replace Shopify header with ours
    if (partials.headerHtml) {
      rewriter.on('#shopify-section-header--default', {
        element(element) {
          element.setInnerContent(partials.headerHtml, { html: true });
        },
      });
    }

    // Replace Shopify footer with ours
    if (partials.footerHtml) {
      rewriter.on('#shopify-section-footer', {
        element(element) {
          element.setInnerContent(partials.footerHtml, { html: true });
        },
      });
    }

    // Remove Shopify subfooter (our footer includes the bottom bar)
    rewriter.on('#shopify-section-subfooter', {
      element(element) {
        element.remove();
      },
    });

    // Return rewritten response
    const rewritten = rewriter.transform(response);
    return new Response(rewritten.body, {
      status: rewritten.status,
      headers: rewritten.headers,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Error connecting to origin', { status: 502 });
  }
};
