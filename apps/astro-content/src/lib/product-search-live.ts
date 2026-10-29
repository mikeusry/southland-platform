import {
  lookupProductsByHandles,
  type ProductsByHandlesLookup,
  type StorefrontClient,
} from '@southland/shopify-storefront'
import { productSearchHref } from './product-search-href'

/** Cap a search-page Storefront lookup so a slow shop cannot hang the page. */
export const SHOPIFY_PRODUCT_SEARCH_TIMEOUT_MS = 2000

export interface ProductSearchCard<T> {
  result: T
  href: string
}

/**
 * Shopify's answer for the handles on this page.
 * `byQueriedHandle` maps the handle taken from the worker URL to the handle Shopify returned.
 */
export type LiveProductHandleLookup =
  | { status: 'ok'; byQueriedHandle: ReadonlyMap<string, string> }
  | { status: 'error' }

const PRODUCT_PATH_PREFIX = '/products/'

function handleFromProductSearchUrl(url: string): string | null {
  const href = productSearchHref(url)
  if (!href?.startsWith(PRODUCT_PATH_PREFIX) || !href.endsWith('/')) return null
  const handle = href.slice(PRODUCT_PATH_PREFIX.length, -1)
  if (!handle || handle.includes('/')) return null
  return handle
}

/** Link to the live handle, using the same path rules as other search product cards. */
function hrefForLiveHandle(handle: string): string | null {
  const href = productSearchHref(`${PRODUCT_PATH_PREFIX}${handle}`)
  if (!href) return null
  if (handleFromProductSearchUrl(href) !== handle) return null
  return href
}

/**
 * Keep product hits Shopify still publishes, and point each card at the live handle.
 * A Storefront error or timeout drops every product card so the page cannot link to a dead handle.
 */
export function filterLiveProductSearchCards<T extends { url: string }>(
  products: readonly T[],
  shopify: LiveProductHandleLookup
): ProductSearchCard<T>[] {
  switch (shopify.status) {
    case 'error':
      return []
    case 'ok':
      return products.flatMap((result) => {
        const queried = handleFromProductSearchUrl(result.url)
        if (!queried) return []
        const liveHandle = shopify.byQueriedHandle.get(queried)
        if (!liveHandle) return []
        const href = hrefForLiveHandle(liveHandle)
        if (!href) return []
        return [{ result, href }]
      })
    default: {
      const unexpected: never = shopify
      throw new Error(`unexpected product handle lookup: ${JSON.stringify(unexpected)}`)
    }
  }
}

function uniqueQueriedHandles(products: readonly { url: string }[]): string[] {
  const handles: string[] = []
  const seen = new Set<string>()
  for (const product of products) {
    const handle = handleFromProductSearchUrl(product.url)
    if (!handle || seen.has(handle)) continue
    seen.add(handle)
    handles.push(handle)
  }
  return handles
}

function cardsFromLookup<T extends { url: string }>(
  products: readonly T[],
  lookup: ProductsByHandlesLookup
): ProductSearchCard<T>[] {
  switch (lookup.status) {
    case 'error':
      return filterLiveProductSearchCards(products, { status: 'error' })
    case 'ok': {
      const byQueriedHandle = new Map<string, string>()
      for (const [queriedHandle, liveHandle] of lookup.handles) {
        if (liveHandle) byQueriedHandle.set(queriedHandle, liveHandle)
      }
      return filterLiveProductSearchCards(products, { status: 'ok', byQueriedHandle })
    }
    default: {
      const unexpected: never = lookup
      throw new Error(`unexpected product handle lookup: ${JSON.stringify(unexpected)}`)
    }
  }
}

/**
 * Look up product handles with one Storefront query and return only live cards.
 * On error or timeout, returns no product cards.
 */
export async function resolveLiveProductSearchCards<T extends { url: string }>(
  products: readonly T[],
  client: StorefrontClient,
  timeoutMs = SHOPIFY_PRODUCT_SEARCH_TIMEOUT_MS
): Promise<ProductSearchCard<T>[]> {
  const queried = uniqueQueriedHandles(products)
  if (queried.length === 0) return []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const lookup = await lookupProductsByHandles(client, queried, controller.signal)
    return cardsFromLookup(products, lookup)
  } catch (err) {
    console.error('Search product handle lookup failed:', err)
    return filterLiveProductSearchCards(products, { status: 'error' })
  } finally {
    clearTimeout(timer)
  }
}
