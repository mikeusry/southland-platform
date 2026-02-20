# Wire CDP Analytics Dashboard to Real Data

**Status:** NEXT PRIORITY
**Created:** 2026-02-19
**Sprint scope:** Deploy persona-worker, wire real events into Supabase, replace all mock data in dashboard

---

## 1. Problem Statement

The CDP Analytics dashboard at `/admin/cdp/` is fully built (Tremor.so UI, 3 API endpoints, KPI cards, charts, event stream, persona distribution, journey funnel) but **every number is fabricated**:

- `/api/cdp/metrics` returns `generateMockMetrics()` with hardcoded base numbers multiplied by time range
- `/api/cdp/events` returns `generateMockEvents()` with `Math.random()` data
- `/api/cdp/searches` returns a hardcoded array of fake search queries
- `CDPDashboard.tsx` generates fake chart data client-side via `generateChartData()`
- Delta badges (`+12.3%`, `+8.1%`, `+15.2%`) are hardcoded strings

Meanwhile, the persona-worker (Cloudflare Worker) is fully coded with production-ready scoring, signal extraction, and journey stage detection — but has **never been deployed** (placeholder KV IDs, no data store connected). The point.dog pixel IS firing real events from 20+ components on the live site, but those events only go to point.dog infrastructure — not to the persona-worker.

**Goal:** Deploy the persona-worker, get real pixel events flowing through it, store enriched events in a database, and wire the dashboard API endpoints to query real data instead of returning mocks.

---

## 2. Current State Inventory

### What EXISTS and is ACTIVE

| Component | Status | Details |
| --- | --- | --- |
| **point.dog pixel** | Firing on live site | `https://pixel.southlandorganics.com/collect`, ~15 event types across 20+ components |
| **Mothership Supabase** | Connected | `MOTHERSHIP_SUPABASE_URL` / `MOTHERSHIP_SUPABASE_SERVICE_KEY` in astro-content `.env` |
| **Shopify Storefront API** | Connected | Products only, no orders |
| **Dashboard UI** | Fully built | Tremor.so React island at `/admin/cdp/`, 3 API endpoints |
| **CDP components** | Live on site | DecisionEngine, PersonaBanner, ABTest, OutcomeSurvey, RealityTunnels |

### What is BUILT but NOT DEPLOYED

| Component | Status | Details |
| --- | --- | --- |
| **persona-worker** | Code complete, never deployed | `apps/persona-worker/` — scoring, signals, stages, KV caching, BigQuery forwarding |
| **Golden Profile schema** | Typed, not persisted | `VisitorData` interface in `apps/persona-worker/src/types.ts` |
| **BigQuery schema** | SQL written | `docs/schemas/bigquery-outcomes.sql` — outcome tables and views |

### What is FULLY MOCK

| Component | Mock Pattern |
| --- | --- |
| `/api/cdp/metrics` | `generateMockMetrics()` — hardcoded numbers scaled by time range |
| `/api/cdp/events` | `generateMockEvents()` — random events with `Math.random()` |
| `/api/cdp/searches` | Hardcoded array of 15 fake search queries |
| `CDPDashboard.tsx` chart data | `generateChartData()` — random time-series |
| Delta badges | Hardcoded strings (`+12.3%`, `+8.1%`, etc.) |

---

## 3. Architecture Decision: Mothership Supabase as Data Store

**Decision:** Use the Mothership Supabase (`zpjvhvyersytloyykylf.supabase.co`) that's already connected. Create CDP-specific tables with `brand_id = 'southland'` for isolation.

**Why not BigQuery?** Querying BigQuery from Cloudflare Pages requires GCP service account auth + a proxy layer. Mothership Supabase is already connected, has a JS client, and supports the SQL aggregations the dashboard needs. BigQuery can be added later as a warehouse sync.

**Security stance:** RLS disabled on CDP tables for now. Access is server-only (Workers + Astro API routes). Service key never touches client bundles. Documented as "server-only tables."

### Data Flow Architecture

```
Live Site (Astro)
    |
    | window.pdPixel.track('event_type', { ... })
    |
    +---> point.dog pixel (existing, untouched)
    |         pixel.southlandorganics.com/collect
    |
    +---> persona-worker (Cloudflare Worker) [NEW - dual-fire]
              |
              | 1. Extract behavioral signals
              | 2. Compute persona scores (weighted + recency decay)
              | 3. Detect journey stage (10 stages)
              |
              +---> Cloudflare KV (golden profile, 30-day TTL)
              |         visitor:{anonymous_id} -> VisitorData
              |
              +---> Mothership Supabase (enriched events)
              |         cdp_events table
              |         cdp_profiles table (future identity stitching)
              |
              +---> BigQuery (optional future warehouse sync)

Dashboard reads:
    /api/cdp/metrics   <--- Supabase aggregation queries
    /api/cdp/events    <--- Supabase event stream
    /api/cdp/searches  <--- Supabase search aggregation
         |
         v
    CDPDashboard.tsx (Tremor.so)
```

---

## 4. Golden Profiles: What We Already Have

The `VisitorData` interface in `apps/persona-worker/src/types.ts` IS a golden profile:

```typescript
interface VisitorData {
  // Identity
  anonymous_id: string
  customer_id?: string
  email?: string

  // Behavioral signals (last 100)
  signals: Signal[]

  // Computed persona (probability distribution)
  persona_scores: PersonaScores  // { backyard, commercial, lawn, general }
  predicted_persona: PersonaId
  persona_confidence: number
  explicit_persona?: PersonaId   // Decision Engine choice

  // Journey stage (10 stages: unaware -> evangelist)
  current_stage: JourneyStage
  stage_confidence: number
  stage_history: Array<{ stage, entered_at }>

  // Engagement metadata
  first_seen: string
  last_updated: string
  session_count: number
  total_signals: number
}
```

This accumulates in KV over 30 days per visitor. The persona-worker enriches it with every event using:

- **Signal weights:** decision_engine (10), purchase (8), phone_call (7), add_to_cart (6), search (5), product_view (4), page_view (1)
- **Recency decay:** last hour (1.5x), 24h (1.0x), 72h (0.7x), older (0.3x)
- **Stage detection:** Rule-based priority system matching signal patterns to 10 journey stages

**The profiles are designed and coded. This sprint turns them on.**

---

## 5. CDP Maturity Ladder

| Level | Name | What It Means | Status |
| --- | --- | --- | --- |
| **1** | Own behavioral data | First-party event stream + persona/funnel dashboard with real data | **This sprint** |
| **2** | Identity resolution | Stitch anonymous -> email -> customer_id into long-lived profiles | Schema ready, needs checkout/login hooks |
| **3** | Commerce integration | Orders, LTV, AOV attributed to personas | Needs Shopify Admin API |
| **4** | Activation loops | CDP drives Klaviyo segments, ad audiences, on-site personalization | Reality Tunnels already do on-site; Klaviyo/HubSpot sync is next |

### Level 2: Identity Stitching (Post-Sprint Roadmap)

**The honest gap:** Shopify owns checkout. Architecture is "fake headless" — Astro serves content, but `/cart`, `/checkout`, `/account` are proxied to Shopify. No natural hook to say "anonymous_id X is now customer Y."

**Near-term stitching paths:**
1. **Email capture** (easiest) — `EmailCapture.astro` already fires `email_signup` events. If that event includes email + anonymous_id, the worker can update the KV profile and upsert `cdp_profiles`. Gets identity for everyone who signs up.
2. **Shopify order status page** — Inject a script via Shopify admin that reads `pd_anonymous_id` cookie and fires an identity event. Gets identity at checkout.
3. **Shopify webhook** (`orders/create`) — Server-side, has email + order data but NO awareness of anonymous_id cookie. Useful for commerce data, not for stitching alone.

**Full checkout stitching gets easier when we own product pages (Phase 3 of headless migration).**

### Level 3: Commerce Integration (Future)

- Shopify Admin API token already exists in `~/CODING/mothership/.env` as `SHOPIFY_ACCESS_TOKEN`
- `shopify_orders` table may already exist in Mothership Supabase
- Revenue attribution: map products to personas via collection membership
- Add to `/api/cdp/metrics` once identity + orders are linked

### Level 4: Activation Loops (Future)

- Klaviyo credentials already in `.env` (`PUBLIC_KLAVIYO_COMPANY_ID`, `PUBLIC_KLAVIYO_LIST_ID`)
- Define strategic segments in `cdp_profiles` (e.g., "high-intent low-AOV", "repeat buyer turf interest", "at-risk Broiler Bill")
- Sync segments to Klaviyo lists via API -> persona-specific email flows
- Feed performance metrics back into dashboard

---

## 6. Event Contract

Controlled vocabulary for `event_type` values. To be formalized in `docs/cdp-event-contract.md`.

| Event Type | Source Component | Persona Signal? | Key Properties |
| --- | --- | --- | --- |
| `persona_path_selected` | DecisionEngine | Yes (explicit) | `persona`, `source` |
| `persona_changed` | PersonaBanner | Yes (explicit) | `from_persona`, `to_persona` |
| `tunnel_viewed` | RealityTunnel | Yes | `tunnel`, `page_url` |
| `ab_test_exposure` | ABTest | No | `test_id`, `variant` |
| `ab_test_conversion` | ABTest | No | `test_id`, `variant` |
| `search_performed` | search.astro, podcast/search | Weak | `query`, `results_count` |
| `product_clicked` | ProductCard, tunnel products | Yes | `product_id`, `product_handle` |
| `hero_cta_clicked` | tunnel heroes | Yes | `tunnel`, `cta_text`, `destination` |
| `email_signup` | EmailCapture | Weak | `source`, `email` (for identity stitch) |
| `podcast_play` | VideoEmbed, AudioPlayer | No | `episode_slug`, `duration` |
| `podcast_complete` | VideoEmbed, AudioPlayer | No | `episode_slug` |
| `homepage_view` | index.astro | No | `persona_detected` |
| `sales_outcome_logged` | sales-log.astro | Yes | `outcome_type`, `products` |
| `outcome_survey_completed` | OutcomeSurvey | Yes | `survey_id`, `persona`, `nps_score` |

**Required fields (all events):** `event`, `anonymous_id`, `session_id`, `timestamp`, `page_url`

**Optional fields:** `customer_id`, `page_title`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `properties` (event-specific payload)

---

## 7. Implementation Plan

### Phase 1: Database Schema

Create migration SQL file at `docs/schemas/cdp-events.sql` (reproducible, diffable). User runs in Mothership Supabase SQL Editor.

**Tables:**

**`cdp_events`** — Enriched pixel events from persona-worker
- PK: `id uuid DEFAULT gen_random_uuid()`
- `brand_id text NOT NULL DEFAULT 'southland'`
- `event_id text` — client-generated UUID for idempotency
- `event_type text NOT NULL`
- `anonymous_id text NOT NULL`, `customer_id text`, `session_id text`
- `timestamp timestamptz NOT NULL`
- `page_url text`, `page_title text`, `referrer text`
- `utm_source text`, `utm_medium text`, `utm_campaign text`
- `properties jsonb DEFAULT '{}'` — event-specific payload only
- `predicted_persona text` — first-class column, indexable
- `persona_confidence real`, `explicit_persona text`
- `current_stage text` — first-class column, indexable
- `stage_confidence real`, `persona_scores jsonb`
- `processed_at timestamptz DEFAULT now()`
- Unique constraint: `(brand_id, event_id)` — dedup safety
- Composite index: `(brand_id, timestamp DESC)` — primary query pattern
- Indexes: `event_type`, `predicted_persona`, `anonymous_id`, `current_stage`

**`cdp_searches`** — Search query tracking
- PK: `id uuid DEFAULT gen_random_uuid()`
- `brand_id text NOT NULL DEFAULT 'southland'`
- `query text NOT NULL`, `anonymous_id text`, `results_count integer DEFAULT 0`
- `page_url text`, `searched_at timestamptz DEFAULT now()`
- Indexes: `(brand_id, searched_at DESC)`, `query`

**`cdp_profiles`** — Durable golden profiles (forward-looking, Level 2)
- PK: `id uuid DEFAULT gen_random_uuid()`
- `brand_id text NOT NULL DEFAULT 'southland'`
- `anonymous_id text NOT NULL`
- `customer_id text`, `email text`
- `predicted_persona text`, `persona_confidence real`, `explicit_persona text`
- `persona_scores jsonb`
- `current_stage text`, `stage_confidence real`
- `first_seen timestamptz`, `last_seen timestamptz`
- `session_count integer DEFAULT 0`, `total_signals integer DEFAULT 0`
- `identity_stitched boolean DEFAULT false`
- Unique constraint: `(brand_id, anonymous_id)`
- Indexes: `customer_id`, `email`, `predicted_persona`

### Phase 2: Deploy Persona Worker

**Step 2A: Update `wrangler.toml`**
- File: `apps/persona-worker/wrangler.toml`
- Replace placeholder KV IDs with real ones from Cloudflare dashboard

**Step 2B: Add Supabase forwarding**
- File: `apps/persona-worker/src/index.ts`
- Replace `forwardToBigQuery()` with `forwardToSupabase()`
- Use raw REST API (`fetch` to `/rest/v1/cdp_events`), NOT the JS client SDK — keeps worker lean, minimizes cold starts
- Worker responsibilities: set `brand_id`, normalize `timestamp` to ISO/UTC, attach persona + stage fields, generate `event_id` if not supplied
- Use `Prefer: resolution=ignore-duplicates` header for dedup
- File: `apps/persona-worker/src/types.ts` — add `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` to `Env`

**Step 2C: Basic observability**
- Log Supabase failures with event type + HTTP status
- Sample 1-in-100 event payloads (strip PII) for schema mismatch debugging
- Add `last_event_at` timestamp in KV for liveness checks

**Step 2D: Deploy + set secrets**
```bash
cd apps/persona-worker
pnpm deploy:production
wrangler secret put SUPABASE_URL --env production
wrangler secret put SUPABASE_SERVICE_KEY --env production
```

**Step 2E: Dual-fire pixel events**
- File: `apps/astro-content/src/layouts/BaseLayout.astro`
- New env var: `PUBLIC_PERSONA_WORKER_URL`
- Call order: point.dog first (untouched), then worker. Worker failures NEVER break existing analytics.
- Transport: Prefer `navigator.sendBeacon()`, fall back to `fetch` with `keepalive: true`
- Generate client-side `event_id` (uuid) for idempotency

### Phase 3: Wire Dashboard API Endpoints

**Step 3A: CDP database utility**
- New file: `apps/astro-content/src/lib/cdp-db.ts`
- Reuse singleton pattern from `src/lib/services/mothership.ts`
- Export `getCDPClient()` and `getTimeRange()` helper

**Step 3B: Rewrite `/api/cdp/metrics`**
- File: `apps/astro-content/src/pages/api/cdp/metrics.ts`
- Real Supabase queries for tunnels, persona distribution, journey funnel, A/B tests
- Trend deltas: compare current window vs previous window
- Revenue: expose with `status: 'unavailable'`
- Include `chartData` array (time-series by day, per persona) in response
- Distinguish "Supabase offline" vs "no data" in error responses

**Step 3C: Rewrite `/api/cdp/events`**
- File: `apps/astro-content/src/pages/api/cdp/events.ts`
- Cap limit to 100, project only needed fields

**Step 3D: Rewrite `/api/cdp/searches`**
- File: `apps/astro-content/src/pages/api/cdp/searches.ts`
- Aggregate from `cdp_events` where `event_type = 'search_performed'`

### Phase 4: Update Dashboard Component

**Step 4A: Remove all mock generators**
- File: `apps/astro-content/src/components/dashboard/CDPDashboard.tsx`
- Remove `generateChartData()`, hardcoded delta badges
- Chart data from `chartData` in API response

**Step 4B: Three-state UI**
- **Loading:** Skeleton/spinner (existing pattern)
- **Empty:** "No events recorded yet" with setup checklist
- **Partial:** Gray out unavailable sections (revenue), show status labels

**Step 4C: Data freshness**
- "Last updated X ago" label
- Manual "Refresh" button
- Keep existing 2-minute poll

---

## 8. Files Modified

| File | Change |
| --- | --- |
| `docs/cdp-event-contract.md` | **New** — event type taxonomy, fields, example payloads |
| `docs/schemas/cdp-events.sql` | **New** — migration SQL for cdp_events, cdp_searches, cdp_profiles |
| `apps/persona-worker/wrangler.toml` | Real KV IDs |
| `apps/persona-worker/src/index.ts` | `forwardToSupabase()` via REST API, error sampling |
| `apps/persona-worker/src/types.ts` | Add `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` to `Env` |
| `apps/astro-content/src/layouts/BaseLayout.astro` | Dual-fire script (sendBeacon + fetch fallback) |
| `apps/astro-content/.env` | Add `PUBLIC_PERSONA_WORKER_URL` |
| `apps/astro-content/src/lib/cdp-db.ts` | **New** — Supabase client + time-range helpers |
| `apps/astro-content/src/pages/api/cdp/metrics.ts` | Real Supabase queries |
| `apps/astro-content/src/pages/api/cdp/events.ts` | Real Supabase queries |
| `apps/astro-content/src/pages/api/cdp/searches.ts` | Real Supabase queries |
| `apps/astro-content/src/components/dashboard/CDPDashboard.tsx` | Remove mocks, three-state UI, freshness |

## 9. Existing Code to Reuse

- **Supabase client pattern:** `src/lib/services/mothership.ts` — singleton `getSupabaseClient()` with null checks
- **Persona types:** `apps/persona-worker/src/types.ts` — `PersonaId`, `JourneyStage`, `PixelEvent`, `VisitorData`
- **Dashboard types:** `src/components/dashboard/types.ts` — `CDPMetrics`, `CDPEvent`, `SearchQuery`
- **Pixel tracking pattern:** `src/lib/analytics.ts` — `window.pdPixel.track()`
- **BaseLayout pixel config:** `src/layouts/BaseLayout.astro:89-95` — `pdPixelConfig` injection point

---

## 10. Manual Infrastructure Steps

1. **Create Cloudflare KV namespaces** in Workers and Pages dashboard — note the IDs
2. **Run `docs/schemas/cdp-events.sql`** in Mothership Supabase SQL Editor
3. **Deploy persona-worker** via `pnpm deploy:production`
4. **Set wrangler secrets** for Supabase URL + service key
5. **Add `PUBLIC_PERSONA_WORKER_URL`** to Cloudflare Pages env vars

---

## 11. Security Checklist

- [ ] Service key only in Workers env secrets + Astro Pages env vars (never in `PUBLIC_*`)
- [ ] `cdp_events`/`cdp_searches`/`cdp_profiles` are server-only — no RLS, no client SDK access
- [ ] Worker endpoint is public but only accepts the limited `PixelEvent` payload shape
- [ ] No PII in sampled logs (strip email, customer_id before logging)
- [ ] `event_id` uniqueness constraint prevents replay/injection amplification

---

## 12. Verification

1. **Worker health:** `curl https://southland-persona-worker.workers.dev/health` -> `{ "status": "ok" }`
2. **Dual-fire:** Visit live site, DevTools Network -> verify POST to both pixel + worker URL
3. **Supabase ingestion:** Check `cdp_events` table — rows with correct `brand_id`, `event_type`, persona fields
4. **Dashboard API:** `curl http://localhost:4400/api/cdp/events` -> real rows (or empty array)
5. **End-to-end:** Visit site -> Decision Engine persona selection -> Supabase row appears -> refresh `/admin/cdp/` -> event in stream, persona donut updates
6. **Error state:** Temporarily break Supabase URL -> dashboard shows "CDP offline" (not crash, not mock data)

---

## 13. Architectural Guardrails (from review)

### Schema Governance
- Event types are a controlled vocabulary — add new types to `docs/cdp-event-contract.md` first
- Persona/stage fields are first-class columns (not buried in JSON) for indexable aggregation
- `properties` is strictly event-specific payload; never query it for core analytics
- Migration SQL lives in repo (`docs/schemas/`) — never rely on manual Supabase UI changes alone

### Worker Design
- Use raw REST API for Supabase, not JS client SDK — keeps cold starts minimal
- Fire-and-forget to Supabase (non-blocking, like existing BigQuery forwarding)
- Worker normalizes: `brand_id`, ISO/UTC `timestamp`, `event_id` generation
- Future analytics features reuse enriched columns, never re-implement enrichment

### Dual-Fire Discipline
- point.dog fires first, worker second — worker failures never break existing analytics
- `sendBeacon` preferred (reliable during navigation), `fetch` with `keepalive` as fallback
- Payload shape is a versioned contract (v1) matching `PixelEvent` interface

### Dashboard API Contract
- 3 endpoints max (`/metrics`, `/events`, `/searches`); chart data included in `/metrics` response
- All time-range + delta logic centralized in API, not in UI
- Canonical time-series shape: `{ date: string, 'Backyard Betty': number, ... }`
- Distinguish "offline" vs "empty" in error responses
- Revenue fields use `status: 'unavailable'` (not zeros) until Shopify Admin API connected

### Observability
- Worker logs Supabase failures with event type + HTTP status
- 1-in-100 event payload sampling (PII stripped)
- `last_event_at` in KV for liveness
- Periodically `EXPLAIN` heaviest Supabase queries; add indexes as needed
