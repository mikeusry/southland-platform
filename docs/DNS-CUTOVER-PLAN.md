# DNS Cutover Plan — Shopify → Cloudflare Pages

**Created:** 2026-04-01
**Updated:** 2026-04-03 — Removed Shopify HTML proxy. Fully headless now.
**Status:** READY

---

## Architecture

Fully headless. Astro renders every page. Shopify is API-only (Storefront API for products, cart, checkout).

```
Customer → southlandorganics.com → Cloudflare Pages
             ├─ Astro renders ALL pages (content, products, collections, cart)
             ├─ Shopify Storefront API (products, cart, checkout URLs)
             ├─ Cloudinary CDN (images)
             └─ Checkout → Shopify-hosted (via cart.checkoutUrl from API)
```

No HTML proxying. No HTMLRewriter. No origin subdomain needed.

---

## Cutover Steps

### Step 1: Point DNS to Cloudflare Pages

In Cloudflare DNS, change:

```
southlandorganics.com      →  [Cloudflare Pages CNAME target]
www.southlandorganics.com  →  [Cloudflare Pages CNAME target]
```

### Step 2: Verify

| URL | Expected |
|-----|----------|
| `/` | Astro homepage |
| `/products/poultry-probiotic` | Astro PDP (Storefront API data) |
| `/cart` | Astro cart (Storefront API) |
| `/blog/` | Astro blog index |
| `/podcast/` | Astro podcast hub |
| `/collections/backyard-birds` | 301 → `/poultry/backyard/` |
| `/pages/about-us` | 301 → `/about/` |
| Checkout button click | Goes to Shopify checkout (via `cart.checkoutUrl`) |

### Step 3: Monitor

- Watch Cloudflare dashboard for 404s on routes we might have missed
- Check Google Search Console for crawl errors over next 48 hours
- Verify checkout completes end-to-end

---

## Rollback

If anything breaks: change DNS back to Shopify's IPs. Instant (TTL-dependent). The old Shopify theme is still there.

---

## What About Checkout?

Checkout is Shopify-hosted. The Storefront API returns a `checkoutUrl` that points directly to Shopify's checkout domain. Customers click "Proceed to Checkout" → browser goes to Shopify → payment → order confirmed. This flow never touches our server.

---

## Old Shopify URL Redirects

40+ permanent redirects in `middleware.ts` handle old Shopify URLs:
- `/collections/*` → persona landing pages
- `/pages/*` → new Astro routes
- `/blogs/[category]/[slug]` → `/blog/[slug]/`

---

## Cleanup Done (2026-04-03)

- Removed Shopify HTML proxy from middleware (was 346 lines → 75 lines)
- Removed HTMLRewriter, partials loading, hostname scrubbing
- Removed SHOPIFY_ORIGIN from wrangler.toml
- Removed shopify-proxy CNAME concept (Shopify can't serve content from secondary domains)
