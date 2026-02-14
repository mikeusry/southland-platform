# @southland/shopify-storefront

Shared Shopify Storefront API client for the Southland Platform monorepo.

## Status: Scaffold Only (Phase 3)

This package is scaffolded but **not yet in use**. Do not wire it into any app until Phase 3 (Collections) begins.

## Purpose

Centralize Storefront API access so both consuming apps use the same client, queries, and types instead of duplicating raw `fetch()` calls.

## Expected Consumers

| App | When | What For |
|-----|------|----------|
| `apps/astro-content` | Phase 3 | Collection pages, product pages, cart |
| `apps/shopify-app` | Phase 3+ | Replace raw fetch in `api.layout.ts` with shared client |

## What's Here

- `src/client.ts` — `createClient()` factory wrapping `@shopify/storefront-api-client`
- `src/index.ts` — Barrel export with TODO placeholders for query modules

## What's NOT Here Yet

- Product queries (`queries/products.ts`)
- Collection queries (`queries/collections.ts`)
- Cart mutations (`queries/cart.ts`)
- Generated TypeScript types from Storefront API schema

These get built when Phase 3 work starts.

## Environment Variables (for future consumers)

```bash
PUBLIC_SHOPIFY_STORE_DOMAIN=southland-organics.myshopify.com
PUBLIC_SHOPIFY_STOREFRONT_TOKEN=<from Shopify Headless channel>
```
