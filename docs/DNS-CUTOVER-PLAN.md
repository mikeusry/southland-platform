# DNS Cutover Plan — Shopify → Cloudflare Pages

**Created:** 2026-04-01
**Status:** BLOCKED — awaiting CNAME creation
**Blocking:** Production launch of Astro site

---

## The Problem

When DNS for `southlandorganics.com` points to Shopify, our Cloudflare Pages middleware proxies unhandled routes to `www.southlandorganics.com`. This works because that domain resolves to Shopify.

When we flip DNS to Cloudflare Pages, `www.southlandorganics.com` will resolve to... Cloudflare Pages. The proxy loops back to itself. Infinite redirect.

## The Fix: Origin CNAME

Create a subdomain that always points to Shopify, regardless of where the main domain's DNS goes.

### Step 1: Create CNAME in Cloudflare DNS

```
shopify-proxy.southlandorganics.com  →  shops.myshopify.com  (DNS Only, NOT proxied)
```

**IMPORTANT:** This must be "DNS Only" (gray cloud), NOT "Proxied" (orange cloud). Cloudflare proxy would add its own TLS termination and break Shopify's certificate.

### Step 2: Update Middleware Proxy Target

In `apps/astro-content/src/middleware.ts`, change the proxy target:

```typescript
// Before (works while DNS → Shopify)
const SHOPIFY_ORIGIN = 'https://www.southlandorganics.com'

// After (works after DNS → Cloudflare Pages)
const SHOPIFY_ORIGIN = 'https://shopify-proxy.southlandorganics.com'
```

Also update `wrangler.toml` if it has an env-specific override:

```toml
[vars]
SHOPIFY_PROXY_ORIGIN = "https://shopify-proxy.southlandorganics.com"
```

### Step 3: Verify CNAME Works

```bash
# Should resolve to Shopify's IPs
dig shopify-proxy.southlandorganics.com

# Should return the Shopify storefront
curl -I https://shopify-proxy.southlandorganics.com
```

### Step 4: Add Custom Domain in Shopify

Shopify needs to know about this subdomain so it serves the store (not a 404):

1. Shopify Admin → Settings → Domains
2. Add `shopify-proxy.southlandorganics.com` as a connected domain
3. Do NOT set it as primary — it's an origin-only subdomain

### Step 5: Flip DNS

Change the main domain records in Cloudflare:

```
southlandorganics.com      →  [Cloudflare Pages CNAME target]
www.southlandorganics.com  →  [Cloudflare Pages CNAME target]
```

Cloudflare Pages will handle routing:
- Astro routes → rendered by Workers
- Everything else → proxied to `shopify-proxy.southlandorganics.com`

### Step 6: Verify

Test critical paths immediately after DNS propagation:

| URL | Expected | Source |
|-----|----------|--------|
| `/` | Homepage (Shopify proxied) | Middleware → Shopify |
| `/podcast/` | Podcast hub | Astro |
| `/blog/` | Blog index | Astro |
| `/products/poultry-probiotic` | PDP (Shopify proxied with Astro header/footer) | Middleware → Shopify |
| `/cart/` | Cart (Shopify proxied) | Middleware → Shopify |
| `/collections/all` | Products (Shopify proxied) | Middleware → Shopify |
| `/admin/` | Admin dashboard | Astro |

---

## Rollback Plan

If anything breaks after DNS flip:

1. Change DNS back to Shopify's IPs (instant, TTL-dependent)
2. The CNAME subdomain stays — it doesn't affect anything when DNS points to Shopify
3. Debug and retry

---

## Timeline

| Step | Owner | ETA |
|------|-------|-----|
| Create CNAME | Mike (Cloudflare DNS) | 5 min |
| Add domain in Shopify | Mike (Shopify Admin) | 5 min |
| Update middleware target | Dev | 5 min |
| Deploy updated middleware | Auto (git push) | 3 min |
| Verify CNAME works | Dev | 10 min |
| Flip DNS | Mike (Cloudflare DNS) | 5 min |
| Verify all routes | Dev + Mike | 30 min |

**Total estimated downtime:** Zero if CNAME is verified before DNS flip.
