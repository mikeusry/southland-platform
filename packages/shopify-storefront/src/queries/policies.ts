import type { StorefrontClient } from '../client'
import type { ShopPolicy, ShopPolicyField } from '../types'

const SHOP_POLICY_FIELDS: ShopPolicyField[] = [
  'privacyPolicy',
  'termsOfService',
  'shippingPolicy',
  'refundPolicy',
]

function isShopPolicyField(value: string): value is ShopPolicyField {
  return (SHOP_POLICY_FIELDS as string[]).includes(value)
}

function parseShopPolicy(node: Record<string, unknown> | null | undefined): ShopPolicy | null {
  if (!node || typeof node.title !== 'string' || typeof node.body !== 'string') {
    return null
  }
  return {
    id: typeof node.id === 'string' ? node.id : '',
    title: node.title,
    body: node.body,
    handle: typeof node.handle === 'string' ? node.handle : '',
    url: typeof node.url === 'string' ? node.url : '',
  }
}

/**
 * Fetch a single shop policy (privacy, terms, shipping, or refund) from the Storefront API.
 */
export async function getShopPolicy(
  client: StorefrontClient,
  field: ShopPolicyField
): Promise<ShopPolicy | null> {
  if (!isShopPolicyField(field)) {
    return null
  }

  const query = `
    query ShopPolicy {
      shop {
        ${field} {
          id
          title
          body
          handle
          url
        }
      }
    }
  `

  try {
    const { data, errors } = await client.request(query)

    if (errors) {
      console.error(`[shopify-storefront] getShopPolicy(${field}) errors:`, errors)
      return null
    }

    const shop = data?.shop as Record<string, unknown> | undefined
    if (!shop) return null

    return parseShopPolicy(shop[field] as Record<string, unknown>)
  } catch (error) {
    console.error(`[shopify-storefront] getShopPolicy(${field}) request failed:`, error)
    return null
  }
}

/**
 * Tokenless Storefront API access is a documented Shopify mode (no access token
 * header). Used when PUBLIC_SHOPIFY_STOREFRONT_TOKEN is unavailable or the
 * authenticated request fails.
 */
export async function getShopPolicyUnauthenticated(
  storeDomain: string,
  field: ShopPolicyField,
  apiVersion = '2026-01'
): Promise<ShopPolicy | null> {
  if (!isShopPolicyField(field)) {
    return null
  }

  const domain = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const query = `
    query ShopPolicy {
      shop {
        ${field} {
          id
          title
          body
          handle
          url
        }
      }
    }
  `

  try {
    const response = await fetch(`https://${domain}/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })

    if (!response.ok) {
      console.error(
        `[shopify-storefront] getShopPolicyUnauthenticated(${field}) HTTP ${response.status}`
      )
      return null
    }

    const json = (await response.json()) as {
      data?: { shop?: Record<string, unknown> }
      errors?: unknown
    }

    if (json.errors) {
      console.error(
        `[shopify-storefront] getShopPolicyUnauthenticated(${field}) errors:`,
        json.errors
      )
      return null
    }

    const shop = json.data?.shop
    if (!shop) return null

    return parseShopPolicy(shop[field] as Record<string, unknown>)
  } catch (error) {
    console.error(
      `[shopify-storefront] getShopPolicyUnauthenticated(${field}) request failed:`,
      error
    )
    return null
  }
}

/** URL slug on southlandorganics.com → Storefront API shop policy field */
export const POLICY_SLUG_TO_FIELD: Record<string, ShopPolicyField> = {
  'privacy-policy': 'privacyPolicy',
  'terms-of-service': 'termsOfService',
  'shipping-policy': 'shippingPolicy',
  'return-policy': 'refundPolicy',
  'refund-policy': 'refundPolicy',
}

export function policySlugToField(slug: string): ShopPolicyField | null {
  return POLICY_SLUG_TO_FIELD[slug] ?? null
}
