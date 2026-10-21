# Status History

Phase and status narrative moved out of the root `CLAUDE.md` (2026-10-21). These blocks are
**historical** — kept for context, not current state. The site is live on
`southlandorganics.com`; Astro on Cloudflare Pages serves all routes and Shopify is API-only.

---

## Architecture Diagram (original headless plan)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ASTRO FRONTEND                              │
│                    (southlandorganics.com)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │     /       │ │  /podcast/  │ │   /blog/    │ │   /about/   │   │
│  │  Homepage   │ │   Hub +     │ │  Articles   │ │  Contact    │   │
│  │             │ │  Episodes   │ │             │ │  Team, etc  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    /collections/[slug]/                      │   │
│  │         SEO Content (TinaCMS) + Products (Shopify)           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    /products/[handle]/                       │   │
│  │              Product Pages (Shopify Storefront API)          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Header / Footer (Astro Components)              │   │
│  │                    ONE source of truth                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   TINACMS     │   │   SHOPIFY     │   │  CLOUDINARY   │
│   /admin      │   │  Storefront   │   │     CDN       │
│               │   │     API       │   │               │
│  • Blog       │   │  • Products   │   │  • Images     │
│  • Episodes   │   │  • Cart       │   │  • Podcast    │
│  • Pages      │   │  • Checkout   │   │    covers     │
│  • Collections│   │  • Menus      │   │  • Team       │
│    SEO        │   │  • Inventory  │   │    photos     │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│    GitHub     │   │ Shopify Admin │
│  (content     │   │ (commerce     │
│   storage)    │   │  management)  │
└───────────────┘   └───────────────┘
```

---

## Phase 1 — Testing (Feb 19, 2026)

**Status at the time:** Deployed to `southland-website.pages.dev`. DNS still at Shopify. Not
yet live on the production domain. _(Superseded — the site has since gone live.)_

**Astro routes (all verified 200 OK on pages.dev):**
- `/podcast/*` — Hub, episodes, topics, search, RSS feed
- `/about/` — About page
- `/contact/` — Contact page
- `/distribution/` — Distribution info
- `/store-locator/` — Dealer locator
- `/team/*` — Team member pages
- `/blog/*` — Blog index + posts
- `/admin/*` — Admin dashboard, video library

The middleware and canonical-host facts from this block remain in `CLAUDE.md` under
**Middleware & Hosting**.

### Migration Phases

| Phase | Routes | Status (Feb 2026) |
|-------|--------|--------|
| 1 | `/podcast/*`, `/about/`, `/contact/`, `/distribution/`, `/store-locator/`, `/team/*`, `/blog/*` | Deployed to pages.dev, DNS pending |
| 2 | `/collections/*` | Built (SSR), proxied to Shopify |
| 3 | `/products/*` | Planned |
| 4 | `/` (homepage) | Planned |

---

## CDP Phase Tracker

**Status at the time:** Week 4 Complete - Persona Scoring Worker

| Track | Focus | Owner |
|-------|-------|-------|
| **Track A: Ads** | Consolidate 99 → 15 campaigns | Marketing |
| **Track B: CDP** | Reality Tunnels Content (Betty) | Dev/Data |

### CDP Build Order

| Week | Deliverable | Status |
|------|-------------|--------|
| 1 | Decision Engine + Outcome Surveys | ✅ COMPLETE |
| 2 | Reality Tunnels Infrastructure | ✅ COMPLETE |
| 3 | Semantic Search + First Proofs | ✅ COMPLETE |
| 4 | Persona Scoring Worker | ✅ COMPLETE |
| 5-6 | Reality Tunnels Content (Betty) | ← NEXT |
| 7-8 | Reality Tunnels Content (Bill) — GATED | Planned |

---

## AI Search Content Initiative (March 2026)

**Full doc:** [AI-CONTENT-INITIATIVE.md](AI-CONTENT-INITIATIVE.md)

AI visibility audit found we rank on 4/10 situation queries but are cited in 0/10 AI
Overviews. Built 6 pillar pages + upgraded 4 collection pages to fix this. The Content Rules
for pillar pages remain in `CLAUDE.md`.

### New Pillar Pages (blog posts)

| File | Target Situation |
|------|-----------------|
| `how-to-reduce-ammonia-in-poultry-house-naturally.mdx` | Poultry ammonia control |
| `natural-alternatives-to-chemical-poultry-treatments.mdx` | Chemical → natural transition |
| `organic-soil-health-bermuda-grass-fairways.mdx` | Golf course soil health |
| `how-to-fix-southern-clay-soil-organically.mdx` | Southern clay soil remediation |
| `best-organic-fertilizers-warm-season-grass.mdx` | Warm season grass fertilizer guide |
| `building-soil-biology-farm-fields.mdx` | Farm soil biology rebuilding |

### PMax Rewrite

Situation-first ad headlines in
`mothership/docs/advertising/campaigns/southland-pmax-situation-rewrite-2026-03.md`. A/B test:
keep 5 existing, swap 10 situation-framed.

### Launch Tasks

Tracked in Nexus `/hr/todos` (13 tasks, Mar 23-Apr 3).

---

## Klaviyo Flow Integration — SUPERSEDED

> **SUPERSEDED:** Klaviyo was retired; Nexus Klaviyo emitters were removed 2026-08-11. The ESP
> is now **Customer.io** — Nexus fires events and identifies profiles, Mothership documents
> automations. Kept for history only.

**Master Roadmap (at the time):** `mothership/docs/esp-klaviyo/reference/flow-roadmap.md`

Platform's role in the Klaviyo flow ecosystem:
- **CDP Personas** (Broiler Bill, Backyard Betty, Turf Pro Taylor) drive post-purchase email segmentation — product education and cross-sell flows branch by persona
- **Reality Tunnels** content strategy aligns with post-purchase education emails (same content, different channel)
- **Replenishment timing** data from BigQuery CDP informs reorder email scheduling
- Nexus owns event infrastructure (delivery events, fulfillment sync); Mothership owns flow definitions; Platform owns persona/content strategy
