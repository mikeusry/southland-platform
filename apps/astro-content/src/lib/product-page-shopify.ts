import {
  lookupProductByHandle,
  type ProductDetail,
  type ProductLookupResult,
  type StorefrontClient,
} from '@southland/shopify-storefront'

export const PRODUCT_PAGE_RETRY_AFTER_SECONDS = 60

export type ProductPageLoadResult =
  | { outcome: 'product'; product: ProductDetail; attempts: number }
  | { outcome: 'not_found'; attempts: number }
  | { outcome: 'unavailable'; attempts: number }

export type ProductLookupFn = (
  client: StorefrontClient,
  handle: string
) => Promise<ProductLookupResult>

/**
 * Load the primary Shopify product for a PDP, retrying once on transient API errors.
 */
export async function loadProductForProductPage(
  client: StorefrontClient,
  handle: string,
  lookup: ProductLookupFn = lookupProductByHandle
): Promise<ProductPageLoadResult> {
  let result = await lookup(client, handle)
  let attempts = 1

  if (result.status === 'error') {
    result = await lookup(client, handle)
    attempts = 2
    if (result.status === 'error') {
      return { outcome: 'unavailable', attempts }
    }
  }

  if (result.status === 'not_found') {
    return { outcome: 'not_found', attempts }
  }

  return { outcome: 'product', product: result.product, attempts }
}

/** Minimal HTML 503 when Storefront is down (early return from PDP; not the full layout). */
export function productShopifyUnavailableResponse(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Product temporarily unavailable | Southland Organics</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; color: #191D21; background: #f8faf8; }
    main { max-width: 32rem; margin: 0 auto; text-align: center; }
    h1 { font-size: 1.5rem; color: #2C5234; }
    p { line-height: 1.5; }
    a { color: #44883E; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <h1>Product temporarily unavailable</h1>
    <p>We could not load this product from our store right now. Please try again in a moment.</p>
    <p><a href="/products/">Browse products</a> · <a href="/">Home</a></p>
  </main>
</body>
</html>`

  return new Response(html, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Retry-After': String(PRODUCT_PAGE_RETRY_AFTER_SECONDS),
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export function httpStatusForProductPageLoad(load: ProductPageLoadResult): 200 | 404 | 503 {
  switch (load.outcome) {
    case 'product':
      return 200
    case 'not_found':
      return 404
    case 'unavailable':
      return 503
    default: {
      const unreachable: never = load
      return unreachable
    }
  }
}
