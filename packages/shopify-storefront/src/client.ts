import { createStorefrontApiClient } from '@shopify/storefront-api-client'

/**
 * Shared Shopify Storefront API client for the Southland Platform.
 *
 * Used by:
 *   - apps/astro-content (Phase 3: collection pages, product pages, cart)
 *   - apps/shopify-app (currently uses raw fetch in api.layout.ts — migrate here)
 *
 * Environment variables (consumer must provide):
 *   PUBLIC_SHOPIFY_STORE_DOMAIN  — e.g. "southland-organics.myshopify.com"
 *   PUBLIC_SHOPIFY_STOREFRONT_TOKEN — public access token from Headless channel
 *
 * Reference: https://shopify.dev/docs/storefronts/headless/bring-your-own-stack
 */

// TODO [Phase 3]: Each consuming app should call createClient() at startup
//   and pass the result to query helpers. Do not import a singleton — Astro
//   builds are static and env vars resolve at build time.

export function createClient(options?: {
  storeDomain?: string
  publicAccessToken?: string
  apiVersion?: string
}) {
  const storeDomain =
    options?.storeDomain ??
    process.env.PUBLIC_SHOPIFY_STORE_DOMAIN ??
    ''
  const publicAccessToken =
    options?.publicAccessToken ??
    process.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN ??
    ''
  const apiVersion = options?.apiVersion ?? '2026-01'

  if (!storeDomain || !publicAccessToken) {
    throw new Error(
      '@southland/shopify-storefront: missing PUBLIC_SHOPIFY_STORE_DOMAIN or PUBLIC_SHOPIFY_STOREFRONT_TOKEN'
    )
  }

  return createStorefrontApiClient({
    storeDomain: `https://${storeDomain}`,
    apiVersion,
    publicAccessToken,
  })
}

export type StorefrontClient = ReturnType<typeof createClient>
