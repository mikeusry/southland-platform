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
