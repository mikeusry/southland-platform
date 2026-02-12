# Dealer Redirect + Headless Pre-Checkout Interception

**Created:** 2026-02-12
**Status:** Architecture — not yet implemented
**Depends on:** Platform Phase 3-4 (cart migration to Astro)

---

## Problem: Heavy Shipping Dead Zones

Southland sells heavy agricultural liquids where parcel shipping routinely hits **30-70% of cart value**, creating a "no-win" zone where customers retry checkout multiple times and then abandon.

### The Numbers

- Daily abandoned revenue: **$6,000+/day**
- Conversion rate (rate-request → paid order): **~6%**
- Repeat abandonment clusters from the same rural geographies ("dead zones")

### Real Abandoned Carts (Feb 2026)

| Cart Value | Shipping | Ship % | Destination | Product |
| ---------- | -------- | ------ | ----------- | ------- |
| $1,518 | $1,082 | 71% | Mount Hope, AL | Mixed heavy liquids |
| $588 | $274 | 47% | Piggott, AR | Mixed |
| $492 | $113 | 23% | Ozan, AR | Hen Helper (x2 retries) |
| $438 | $304 | 69% | Middletown, NY | Jump Start |
| $438 | $171 | 39% | Darby, MT | BSI PAA (x2 retries) |
| $392 | $183 | 47% | Dixon, KY | Big Ole Bird (x3 retries) |

Many of these SKUs are also sold through **local dealers** — paying $200-$300 parcel shipping when a farm store 20-50 miles away stocks the product is irrational for both the customer and Southland.

### Why Interception Must Happen Before Checkout

Southland is on a **non-Plus Shopify plan**. You cannot inject custom JS, HTML, modals, or dynamic components into the hosted Shopify checkout. Any smart interception has to happen **before** redirecting to Shopify's hosted checkout.

The headless platform (this repo) controls the storefront UI — product pages, cart, and everything before checkout. This is the interception point.

---

## Architecture: Astro + Nexus + Shopify

```
┌──────────────────────────────────────────────────────┐
│              ASTRO (southland-platform)               │
│           southlandorganics.com                       │
│                                                       │
│  /products/[handle]/  →  Product pages                │
│  /cart/               →  Cart + ShippingEstimator      │
│  /find-a-dealer/      →  Dealer locator + map          │
│                                                       │
│  React Islands:                                       │
│    ShippingEstimator, DealerInterceptModal,            │
│    DealerSearch, ThresholdNudge, LTLExplainer          │
└──────────────┬───────────────────────────────────────┘
               │  fetch (CORS)
               ▼
┌──────────────────────────────────────────────────────┐
│              NEXUS (southland-inventory)              │
│           nexus.southlandorganics.com                 │
│                                                       │
│  /api/public/dealers         →  Dealer search by ZIP   │
│  /api/public/dealers/[slug]  →  Dealer detail           │
│  /api/public/shipping-estimate → Rate + decision tree   │
│                                                       │
│  Existing:                                            │
│    carrier-service.ts  (buildPackagesFromCart, rates)   │
│    cache.ts            (Upstash Redis, cached())        │
│    rate-limit.ts       (IP rate limiting)               │
│    carrier_rate_requests table (conversion tracking)    │
└──────────────┬───────────────────────────────────────┘
               │  (only for "approved" carts)
               ▼
┌──────────────────────────────────────────────────────┐
│              SHOPIFY (checkout black box)             │
│           checkout.shopify.com                        │
│                                                       │
│  Non-Plus: no customization possible                  │
│  Carrier service callback still fires independently   │
│  Payment + order processing                           │
└──────────────────────────────────────────────────────┘
```

**Net:** Astro + Nexus make the **pre-checkout decision**. Shopify just processes "approved" carts.

---

## Dealer Data Model

Dealer data lives in **Nexus Supabase (southland)** because:

- Customer/address data is already there
- Admin UI exists for managing data
- Rate intelligence and conversion tracking live here
- Dealer records can link to existing wholesale customer records via FK

### Schema: `dealers` Table

```sql
CREATE TABLE dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  dealer_type TEXT DEFAULT 'retail',  -- retail, distributor, online_only, farm_store
  customer_id UUID REFERENCES customers(id),  -- link to Nexus customer if they also buy wholesale

  -- Location
  address1 TEXT NOT NULL,
  address2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  country TEXT DEFAULT 'US',
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),

  -- Contact
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  website_url TEXT,
  hours TEXT,  -- "Mon-Fri 8-5, Sat 9-1"

  -- What they carry
  product_categories TEXT[] DEFAULT '{}',  -- ['POULTRY', 'TORCHED_CONCENTRATE', 'DESECT', 'LAWN']
  brands TEXT[] DEFAULT '{}',             -- for future private-label (USA Sod pattern)

  -- Display
  description TEXT,
  logo_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  verified_at TIMESTAMPTZ,  -- last confirmed this dealer exists/is stocking

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dealers_state ON dealers(state) WHERE is_active = true;
CREATE INDEX idx_dealers_zip ON dealers(zip) WHERE is_active = true;
CREATE INDEX idx_dealers_location ON dealers(latitude, longitude)
  WHERE is_active = true AND latitude IS NOT NULL;
CREATE INDEX idx_dealers_categories ON dealers USING gin(product_categories)
  WHERE is_active = true;
CREATE INDEX idx_dealers_slug ON dealers(slug);

-- Timestamp trigger (reuse existing pattern)
CREATE TRIGGER update_dealers_timestamp
  BEFORE UPDATE ON dealers FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Geocoding: Static ZIP-to-Lat/Lng Table

Use a **static US ZIP code geocoding table** (~43,000 rows from census.gov). When a dealer is created or edited, look up their ZIP to assign lat/lng. No external geocoding API or billing required.

```sql
CREATE TABLE zip_geocodes (
  zip TEXT PRIMARY KEY,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  city TEXT,
  state TEXT
);
```

### Proximity Search: Haversine SQL

No PostGIS needed. At <500 dealers, a bounding-box pre-filter + haversine calculation is sufficient:

```sql
-- Find dealers within 50 miles of a given lat/lng
SELECT d.*,
  ( 3959 * acos(
      cos(radians($1)) * cos(radians(d.latitude))
      * cos(radians(d.longitude) - radians($2))
      + sin(radians($1)) * sin(radians(d.latitude))
  )) AS distance_miles
FROM dealers d
WHERE d.is_active = true
  AND d.latitude BETWEEN $1 - 0.72 AND $1 + 0.72  -- ~50mi bounding box
  AND d.longitude BETWEEN $2 - 0.92 AND $2 + 0.92
  AND ( 3959 * acos(
      cos(radians($1)) * cos(radians(d.latitude))
      * cos(radians(d.longitude) - radians($2))
      + sin(radians($1)) * sin(radians(d.latitude))
  )) <= $3  -- radius in miles
ORDER BY distance_miles
LIMIT 10;
```

### Seeding Strategy

1. **Phase A (manual):** Admin enters known dealers via `/admin/dealers` in Nexus
2. **Phase A (script):** `seed-dealers-from-customers.ts` surfaces existing wholesale/distributor customers as dealer candidates for admin review
3. **Future:** Pull dealer contacts from HubSpot business units

---

## Public API Surface (Nexus)

Three new public endpoints on `nexus.southlandorganics.com`. Unauthenticated (storefront data is public) but rate-limited via existing Upstash pattern.

### CORS

All `/api/public/*` routes must include CORS headers:

```typescript
const ALLOWED_ORIGINS = [
  'https://southlandorganics.com',
  'https://www.southlandorganics.com',
  'https://staging.southlandorganics.com',  // if applicable
]

// On every response + OPTIONS preflight
headers.set('Access-Control-Allow-Origin', origin)
headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
headers.set('Access-Control-Allow-Headers', 'Content-Type')
```

`POST /shipping-estimate` requires preflight (OPTIONS) handling since it sends a JSON body.

### 1. `GET /api/public/dealers`

Search for dealers near a ZIP, optionally filtered by product category.

```
GET /api/public/dealers?zip=35803&radius=50&categories=POULTRY,DESECT&limit=5
```

**Response:**

```json
{
  "dealers": [
    {
      "name": "Southern States Co-op",
      "slug": "southern-states-huntsville",
      "dealerType": "farm_store",
      "city": "Huntsville",
      "state": "AL",
      "zip": "35801",
      "distanceMiles": 4.2,
      "phone": "256-555-1234",
      "websiteUrl": "https://southernstates.com",
      "productCategories": ["POULTRY", "LAWN"],
      "hours": "Mon-Sat 7:30-6"
    }
  ],
  "searchZip": "35803",
  "radiusMiles": 50,
  "totalFound": 3
}
```

**Product filtering:** Only returns dealers whose `product_categories` intersect with the requested values. This matters for specialty lines like **Torched Concentrate** and **DESECT Poultry** — not all dealers carry all products.

**Implementation:** Look up input ZIP in `zip_geocodes` for lat/lng, then run haversine query against `dealers` table with optional `product_categories && ARRAY[...]` filter.

### 2. `GET /api/public/dealers/[slug]`

Single dealer detail page data.

```
GET /api/public/dealers/southern-states-huntsville
```

Returns full dealer info (all display fields) for the dealer detail/profile page.

### 3. `POST /api/public/shipping-estimate`

Pre-checkout rate estimate called from the Astro `/cart/` page. Reuses existing `buildPackagesFromCart()` and carrier rate internals from `carrier-service.ts`.

**Request:**

```json
{
  "items": [
    { "sku": "ML-5G-1", "quantity": 2 },
    { "sku": "CAT-800g-Bag", "quantity": 3 }
  ],
  "destinationZip": "35803",
  "cartSubtotal": 289.98
}
```

**Response:**

```json
{
  "estimate": {
    "lowestRate": 87.42,
    "carrier": "fedex",
    "transitDays": 4,
    "packages": 3,
    "totalWeightLb": 96
  },
  "analysis": {
    "shippingPctOfCart": 30.1,
    "isShockinglyExpensive": true,
    "isLTLCandidate": false,
    "nearbyDealerCount": 2,
    "recommendation": "dealer_suggest"
  },
  "nearbyDealers": [
    {
      "name": "Southern States Co-op",
      "city": "Huntsville",
      "state": "AL",
      "distanceMiles": 4.2,
      "phone": "256-555-1234"
    }
  ]
}
```

**Rate Caching:** Use the existing `cached()` utility from `src/lib/cache.ts` (Upstash Redis):

- **Cache key:** Hash of `{ destination_zip, sku_quantities_sorted }`
- **TTL:** 15 minutes
- **Why:** Prevents hammering UPS/FedEx APIs on every cart page load. Same cart + same ZIP = cached result.

**Decision tree logic (the `recommendation` field):**

```
shipping > 50% of cart AND dealer within 50mi  → "dealer_redirect"
shipping > 50% of cart AND no dealer nearby     → "ltl_suggest" or "threshold_nudge"
shipping > 25% of cart AND dealer within 50mi   → "dealer_suggest" (softer nudge)
rate > $225                                     → "ltl_suggest"
otherwise                                      → "proceed"
```

**Threshold caveat:** The 25%, 50%, and $225 numbers are **Phase B/C placeholders**. They are stored in `app_settings` (configurable without deploy). In Phase D, once BOM/COGS data is live in Nexus, thresholds become **margin-aware** — e.g., "redirect if shipping drives effective gross margin below X%" rather than "redirect if shipping > 50% of cart." The infrastructure is identical; only the math in the decision tree evolves.

---

## Pre-Checkout Flow

This is built as part of the **Phase 3-4 cart migration** in this repo. The `/cart/` page will be an Astro page using React islands for interactivity.

### UX Decision Tree

```
Customer adds items to cart
         │
         ▼
  /cart/ page loads (Astro)
  Cart displays items + subtotal
         │
         ▼
  Customer enters shipping ZIP
  (or detected via geolocation / saved address)
         │
         ▼
  ┌─────────────────────────────────────┐
  │  ShippingEstimator (React island)   │
  │  POST /api/public/shipping-estimate │
  └──────────────┬──────────────────────┘
                 │
     ┌───────────┼───────────┬────────────┐
     ▼           ▼           ▼            ▼
  "proceed"  "dealer_      "dealer_    "ltl_
              redirect"     suggest"    suggest"
     │           │           │            │
     ▼           ▼           ▼            ▼
  Continue    Dealer       Inline       LTL
  to Shopify  Intercept    dealer       Explainer
  checkout    Modal        banner       panel
              (full-screen)(below cart)
              + "Ship it   + "Continue
              anyway" CTA  to checkout"
```

### Component Architecture (React Islands)

All pre-checkout components are React islands mounted in the Astro cart page.

| Component | Mount | Purpose |
| --------- | ----- | ------- |
| `ShippingEstimator` | `client:load` | ZIP input + Nexus API call + orchestrates decision |
| `DealerInterceptModal` | `client:visible` | Full-screen modal: map card + dealer info + "Visit Dealer" CTA + "Ship it anyway ($X)" secondary |
| `DealerSuggestionBanner` | `client:visible` | Inline banner below cart totals: "Save on shipping — available at [Dealer] (4.2 mi)" |
| `DealerMapCard` | child component | Single dealer with distance + contact |
| `LTLExplainer` | `client:visible` | Freight shipping explainer + "Request freight quote" CTA |
| `ThresholdNudge` | `client:visible` | "Add $X more for free/reduced shipping" + product suggestions |

These live in `apps/astro-content/src/components/cart/` (new directory for Phase 3-4).

### ZIP Detection (Fallback Layers)

1. **Explicit entry:** ZIP input field on the cart page (most reliable)
2. **Saved address:** Logged-in Shopify customer → Storefront API default shipping address
3. **Geolocation API:** Browser geolocation → reverse geocode (opt-in, user approves)
4. **IP geolocation:** Cloudflare `request.cf.postalCode` (Workers-tier) or ip-api.com fallback
5. **Persona inference:** `commercial` (Bill) = likely rural, different messaging than `backyard` (Betty)

### Persona-Aware Messaging

The existing persona system (Decision Engine, Reality Tunnels) directly influences messaging. `ShippingEstimator` reads `getPersonaId()` from `src/lib/persona.ts`.

| Persona | Context | Message Tone |
| ------- | ------- | ------------ |
| `backyard` (Betty) | Small orders, residential | "Your local farm store carries these products" |
| `commercial` (Bill) | Large orders, rural | "Call for wholesale pricing + freight delivery" |
| `lawn` (Taylor) | Medium orders, suburban | "Available at garden centers near you" |
| `general` | Unknown | Generic "Find a dealer near you" |

### Timing: Before Shopify Checkout

The critical constraint: all interception happens on the Astro `/cart/` page, **before** creating a Shopify checkout URL. The flow:

```
/cart/ (Astro, our control) → ShippingEstimator → decision
                                    │
                          if "proceed" or "ship anyway"
                                    │
                                    ▼
                          Shopify Storefront API: createCheckout()
                          → redirect to checkout.shopify.com
```

The Shopify carrier service callback (`/api/shopify/carrier/rates`) continues to function independently for customers who bypass the Astro cart (direct Shopify theme, Buy Now buttons, etc.). The pre-checkout layer is additive, not a replacement.

---

## Dealer Locator Page

Standalone public page at `/find-a-dealer/` on the Astro site. Valuable independently of the pre-checkout flow — linked from product pages, navigation, and soft nudges.

### Page Architecture

```
/find-a-dealer/ (Astro page, server-rendered)
    │
    ├── [DealerSearch React Island] (client:load)
    │     ├── ZIP/address input
    │     ├── Category filter pills (Poultry | Lawn & Garden | DESECT | Torched)
    │     ├── Radius selector (25 mi | 50 mi | 100 mi)
    │     │
    │     └── GET /api/public/dealers?zip=...&categories=...&radius=...
    │           │
    │           ├── [DealerMap] — Leaflet + OpenStreetMap tiles
    │           └── [DealerResults] — list of DealerMapCards
    │
    ├── [SEO Content] (static, Keystatic-managed)
    │     ├── "Why Buy Local" section
    │     └── FAQ
    │
    └── [Become a Dealer CTA]
          ├── Form: name, business, location, products interested in
          └── Submits to Nexus or HubSpot for sales follow-up
```

### "Become a Dealer" CTA

The locator page doubles as a **dealer recruitment tool**:

- Bottom section: "Interested in carrying Southland products?"
- Form collects: business name, location (city/state/ZIP), contact info, product lines interested in
- Conversion agent dead-zone maps (high abandonment, no dealers, no conversions) inform outreach priorities — the CTA converts that geographic intelligence into inbound dealer leads from exactly the areas that need coverage

### Map Integration

Use **Leaflet + OpenStreetMap** (fully free, no API key, no billing) or **Mapbox GL JS** (50K map loads/month free tier). Avoid Google Maps to eliminate billing and lock-in.

Map pins placed using `latitude`/`longitude` from the dealers table. Clicking a pin shows the dealer card.

### SEO Value

- `/find-a-dealer/` with LocalBusiness structured data
- Future: state-level pages (`/find-a-dealer/alabama/`, `/find-a-dealer/georgia/`)
- Future: individual dealer pages (`/find-a-dealer/southern-states-huntsville/`)

---

## Conversion Tracking Extension

Extend the existing conversion funnel in Nexus to measure interception effectiveness.

### Current Funnel (carrier_rate_requests)

```
pending → converted    (order placed after rate shown)
       → abandoned     (2+ hours, no order)
```

### Extended Funnel

```
pending → converted
       → abandoned
       → redirected    (shown dealer redirect, clicked through to dealer)
```

**New columns on `carrier_rate_requests`:**

- `dealer_redirect_shown BOOLEAN DEFAULT false` — was the DealerInterceptModal or DealerSuggestionBanner displayed?
- `dealer_redirect_clicked BOOLEAN DEFAULT false` — did the customer click through to a dealer?
- `dealer_id UUID` — which dealer was shown (if any)

**New tracking events** (fired from ShippingEstimator to persona-worker):

| Event | Properties | Purpose |
| ----- | ---------- | ------- |
| `shipping_sticker_shock` | `shippingPctOfCart`, `cartTotal`, `zip` | Track friction moments |
| `dealer_redirect_shown` | `dealerSlug`, `distanceMiles`, `recommendation` | Track interception rate |
| `dealer_redirect_clicked` | `dealerSlug`, `distanceMiles` | Track dealer click-through |
| `dealer_redirect_bypassed` | `shippingRate`, `cartTotal` | Customer chose "Ship it anyway" |

This enables measuring:

- What % of high-shipping carts are shown dealer redirect?
- Of those, how many click through to dealer vs ship anyway vs abandon?
- Which geographies have high abandonment but no dealers? (→ dealer recruitment priorities)

---

## Phasing

### Phase A: Dealer Foundation (buildable NOW — no cart dependency)

| Task | Where | Notes |
| ---- | ----- | ----- |
| `dealers` table migration | Nexus | Schema above + `zip_geocodes` table |
| Admin CRUD: `/admin/dealers` | Nexus | List, create, edit, deactivate dealers |
| `GET /api/public/dealers` endpoint | Nexus | ZIP-based proximity search with product filter |
| `GET /api/public/dealers/[slug]` endpoint | Nexus | Single dealer detail |
| `/find-a-dealer/` page | Platform | Astro page with DealerSearch React island |
| "Become a Dealer" CTA | Platform | Form at bottom of locator page |
| Seed script | Nexus | Surface existing wholesale/distributor customers as candidates |
| ZIP geocode import | Nexus | Load ~43K US ZIP→lat/lng from census data |
| Add "Find a Dealer" to navigation | Shopify | Menu update (until nav migrates to Astro) |

**Estimated effort:** 3-4 days. Delivers standalone value immediately — dealer locator is useful even before the cart migrates to Astro.

### Phase B: Rate Intelligence API (buildable NOW — consumed by Phase C)

| Task | Where | Notes |
| ---- | ----- | ----- |
| `POST /api/public/shipping-estimate` | Nexus | Reuses `buildPackagesFromCart()` + carrier APIs |
| Decision tree logic | Nexus | Configurable thresholds in `app_settings` |
| Rate caching | Nexus | `cached()` with 15min TTL on zip+SKU combo |
| CORS configuration | Nexus | Allow `southlandorganics.com` on `/api/public/*` |
| Rate limiting | Nexus | Existing Upstash pattern, protect carrier API quotas |

**Estimated effort:** 2 days. API is ready and tested before the cart page needs it.

### Phase C: Pre-Checkout Interception (requires cart in Astro — Phase 3-4 of platform)

| Task | Where | Notes |
| ---- | ----- | ----- |
| `ShippingEstimator` React island | Platform | ZIP input → Nexus API → decision rendering |
| `DealerInterceptModal` | Platform | Full-screen modal with dealer card + "Ship anyway" |
| `DealerSuggestionBanner` | Platform | Inline nudge below cart totals |
| `LTLExplainer` | Platform | Freight option explainer |
| `ThresholdNudge` | Platform | "Add $X for free shipping" upsell |
| Persona integration | Platform | Read `sl_persona` cookie, adjust messaging |
| Conversion tracking events | Platform + Nexus | Fire persona-worker signals, extend `carrier_rate_requests` |

**Estimated effort:** 4-5 days. Depends on Astro cart page existing (Shopify Storefront API integration).

### Phase D: Optimization (after launch + BOM/COGS data)

| Task | Notes |
| ---- | ----- |
| Margin-aware thresholds | Replace 25%/50% with "redirect if margin < X%" using real COGS from BOMs |
| Dead zone mapping | Use conversion agent data to identify high-abandonment areas with no dealers |
| Dealer recruitment outreach | Auto-generate "your area has demand but no dealer" reports |
| A/B testing | Use existing `ABTest.astro` to test interception aggressiveness by persona |
| Dealer commission tracking | If dealers order through Nexus, track referrals from the locator |

---

## Key Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Dealer data location | Nexus Supabase (southland) | Customer data, admin UI, rate intelligence all here |
| Geocoding | Static US ZIP→lat/lng table (~43K rows) | Free, fast, no external API billing |
| Proximity search | Haversine SQL, no PostGIS | Sufficient for <500 dealers |
| Public API auth | Unauthenticated + rate limited (Upstash) | Storefront data is public |
| Map library | Leaflet + OpenStreetMap (free) or Mapbox GL JS (50K/mo free) | No Google Maps billing or lock-in |
| Pre-checkout timing | Astro `/cart/`, BEFORE Shopify redirect | Non-Plus Shopify = no checkout customization |
| Thresholds | `app_settings` table (configurable without deploy) | Placeholder now, margin-aware in Phase D |
| Rate caching | Existing `cached()` + Upstash Redis, 15min TTL | Protect carrier API quotas |
| CORS | Allow `southlandorganics.com` on `/api/public/*` | Cross-origin Astro→Nexus calls |
| Persona integration | Read `sl_persona` cookie in ShippingEstimator | Cross-subdomain cookie already works |

---

## File Inventory (New Files)

### Nexus (southland-inventory)

| File | Phase | Purpose |
| ---- | ----- | ------- |
| `supabase/migrations/YYYYMMDD_dealers.sql` | A | `dealers` + `zip_geocodes` tables |
| `src/app/api/public/dealers/route.ts` | A | Dealer search endpoint |
| `src/app/api/public/dealers/[slug]/route.ts` | A | Single dealer detail |
| `src/app/api/public/shipping-estimate/route.ts` | B | Pre-checkout rate estimate |
| `src/app/(app)/admin/dealers/page.tsx` | A | Dealer admin list + CRUD |
| `src/app/(app)/admin/dealers/[id]/page.tsx` | A | Dealer admin edit |
| `scripts/seed-dealers-from-customers.ts` | A | Identify distributor customers as dealer candidates |
| `scripts/import-zip-geocodes.ts` | A | Load US ZIP→lat/lng data |

### Platform (southland-platform)

| File | Phase | Purpose |
| ---- | ----- | ------- |
| `apps/astro-content/src/pages/find-a-dealer/index.astro` | A | Dealer locator page |
| `apps/astro-content/src/components/dealers/DealerSearch.tsx` | A | Search + results React island |
| `apps/astro-content/src/components/dealers/DealerMapCard.tsx` | A | Single dealer card |
| `apps/astro-content/src/components/dealers/DealerMap.tsx` | A | Map component (Leaflet/Mapbox) |
| `apps/astro-content/src/components/cart/ShippingEstimator.tsx` | C | Pre-checkout rate check |
| `apps/astro-content/src/components/cart/DealerInterceptModal.tsx` | C | Dealer redirect modal |
| `apps/astro-content/src/components/cart/DealerSuggestionBanner.tsx` | C | Inline dealer nudge |
| `apps/astro-content/src/components/cart/LTLExplainer.tsx` | C | Freight option explainer |
| `apps/astro-content/src/components/cart/ThresholdNudge.tsx` | C | Free shipping upsell |

### Nexus Files to Reuse (not new — existing code)

| File | What to Reuse |
| ---- | ------------- |
| `src/lib/carrier-service.ts` | `buildPackagesFromCart()`, `calculateShopifyRates()` for estimate API |
| `src/lib/cache.ts` | `cached()` for rate caching (15min TTL) |
| `src/lib/rate-limit.ts` | Rate limiting pattern for public endpoints |
| `src/lib/hash-email.ts` | Email hashing for conversion tracking linkage |

### Platform Files to Reuse (not new — existing code)

| File | What to Reuse |
| ---- | ------------- |
| `apps/astro-content/src/lib/persona.ts` | `getPersonaId()` for persona-aware messaging |
| `apps/astro-content/src/components/cdp/DecisionEngine.astro` | Pattern for React islands with persona tracking |
