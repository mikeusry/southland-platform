# Southland Platform - Claude Context

Monorepo for Southland Organics digital platform.

## Nexus Task System

Tasks are managed in **Southland Nexus** (southland-inventory repo). When Mike references a task number (T-42, T-74, etc.), use `/task T-42` or query the Nexus database directly to read it, then **execute it immediately**.

- **DB:** `https://lmtjxckdcsdymqxpgjxo.supabase.co` (Southland Supabase)
- **Credentials:** `SUPABASE_SERVICE_ROLE_KEY` in `/Users/mikeusry/CODING/southland-inventory/.env.local`
- **Skill:** `/task T-42` — reads and manages tasks from any repo
- **Task URL:** `https://nexus.southlandorganics.com/work/tasks/T-42`

When Mike mentions a task number, **read it and start solving it**. The task description is the brief.

## Quick Reference

| Item | Value |
|------|-------|
| **Purpose** | E-commerce + content platform for southlandorganics.com |
| **Stack** | Turborepo, Astro, Remix (Shopify), TypeScript |
| **Package Manager** | pnpm 9.15+ |
| **Node** | 18.20+ |

---

## HEADLESS ARCHITECTURE PLAN

**Goal:** Migrate from Shopify Liquid theme to Astro-powered headless architecture with full SEO control, unified header/footer, and marketing-friendly content editing.

### Stack

| Layer | Technology |
|-------|------------|
| Frontend | Astro (static site generation) |
| Content CMS | TinaCMS (Git-backed, visual editor) |
| Commerce Backend | Shopify Storefront API (products, cart, checkout) |
| Images | Cloudinary CDN |
| Hosting | Cloudflare Pages |
| Fonts | Self-hosted (Eveleth Dot WOFF2, Open Sans via Google Fonts) |

### Architecture Diagram

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

### Content Ownership Matrix

| Content Type | Storage | Edited In | Edited By |
|--------------|---------|-----------|-----------|
| Products | Shopify | Shopify Admin | Operations |
| Inventory | Shopify | Shopify Admin | Operations |
| Orders | Shopify | Shopify Admin | Operations |
| Collections (products) | Shopify | Shopify Admin | Operations |
| Collection SEO content | TinaCMS | /admin | Marketing |
| Blog posts | TinaCMS | /admin | Marketing |
| Podcast episodes | TinaCMS | /admin | Marketing |
| Static pages | TinaCMS | /admin | Marketing |
| Team bios | TinaCMS | /admin | Marketing |
| Navigation menus | Shopify | Shopify Admin | Operations |
| Images | Cloudinary | Cloudinary | Anyone |

### URL Structure

| URL Pattern | Source | Notes |
|-------------|--------|-------|
| `/` | Shopify (proxied) | Homepage |
| `/podcast/` | Astro + TinaCMS | Podcast hub |
| `/podcast/[slug]/` | Astro + TinaCMS | Episode pages |
| `/blog/` | Astro + TinaCMS | Blog index (287 posts migrated) |
| `/blog/[slug]/` | Astro + TinaCMS | Blog posts |
| `/collections/[slug]/` | Shopify (proxied) | Collection pages (Astro built, not routed yet) |
| `/products/[handle]/` | Shopify (proxied) | Product pages |
| `/build-a-case/` | Astro + Shopify Storefront API | Mix & Match gallon case builder |
| `/application-rate-calculator/` | Astro + React island | Application rate calculator (12 products, Add to Cart) |
| `/erosion-control-seed-calculator/` | Astro + React island | Erosion control seed mix calculator |
| `/cart/` | Shopify (proxied) | Cart page |
| `/about/` | Astro | About page |
| `/contact/` | Astro | Contact page |
| `/distribution/` | Astro | Distribution info |
| `/store-locator/` | Astro | Dealer locator |
| `/team/[slug]/` | Astro | Team member pages |
| `/admin/` | TinaCMS | Content admin UI |
| `/admin/videos/` | Astro + Mothership Supabase | Mux video library + transcript search |
| `/api/video-search` | Astro API | Transcript text search for video library |

### Current Phase: Phase 1 — Testing (Feb 19, 2026)

**Status:** Deployed to `southland-website.pages.dev`. DNS still at Shopify. NOT live on production domain.

**Astro routes (all verified 200 OK on pages.dev):**
- `/podcast/*` — Hub, episodes, topics, search, RSS feed
- `/about/` — About page
- `/contact/` — Contact page
- `/distribution/` — Distribution info
- `/store-locator/` — Dealer locator
- `/team/*` — Team member pages
- `/blog/*` — Blog index + posts
- `/admin/*` — Admin dashboard, video library

**Middleware Architecture:**
- `src/middleware.ts` (Astro middleware) — runs inside the Cloudflare Worker
- All routes are Astro-owned. Commerce uses Shopify Storefront API (headless). No HTML proxying.
- Middleware responsibilities: path-level REDIRECTS (legacy Shopify URLs → new Astro routes), per-IP rate limiting on `/api/*`
- `_routes.json` auto-generated by adapter; configured via `routes.extend` in `astro.config.mjs`
- `functions/` directory NOT used (Advanced Mode ignores it)

**Canonical host:**
- Apex `southlandorganics.com` is canonical (HTML canonical tag, OG URL, schema `@id`)
- `www.southlandorganics.com` 301s to apex via Cloudflare Redirect Rule (zone-level)

### Migration Phases

| Phase | Routes | Status |
|-------|--------|--------|
| 1 | `/podcast/*`, `/about/`, `/contact/`, `/distribution/`, `/store-locator/`, `/team/*`, `/blog/*` | **Deployed to pages.dev, DNS pending** |
| 2 | `/collections/*` | Built (SSR), proxied to Shopify |
| 3 | `/products/*` | Planned |
| 4 | `/` (homepage) | Planned |

---

## CDP PLAYBOOK

**Master Document:** [docs/SOUTHLAND-CDP-PLAYBOOK.md](docs/SOUTHLAND-CDP-PLAYBOOK.md)

Comprehensive Customer Data Platform strategy combining:
- **4 Personas:** Broiler Bill, Backyard Betty, Turf Pro Taylor, Mold Molly
- **10 Hero Journey Stages:** unAware → Evangelist
- **Vector-powered personalization:** Supabase embeddings + semantic search
- **Outcome tracking:** FCR, mortality, problem-solved metrics

### Current CDP Phase

**Status:** Week 4 Complete - Persona Scoring Worker

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

### Reality Tunnels (Week 2)

**Concept:** Same site shows different content based on visitor persona. Components conditionally render CTAs, messaging, and content sections.

#### Personas

| ID | Name | Storage Key | Color |
|----|------|-------------|-------|
| `backyard` | Backyard Betty | `southland_persona` | Amber |
| `commercial` | Broiler Bill | `southland_persona` | Green |
| `lawn` | Turf Pro Taylor | `southland_persona` | Emerald |
| `general` | Skipped selection | `southland_persona` | Gray |

#### CDP Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `DecisionEngine` | Homepage 3-way branch | `components/cdp/DecisionEngine.astro` |
| `PersonaContent` | Show/hide by persona | `components/cdp/PersonaContent.astro` |
| `PersonaCTA` | CTA changes by persona | `components/cdp/PersonaCTA.astro` |
| `PersonaBanner` | Bottom bar + change modal | `components/cdp/PersonaBanner.astro` |
| `OutcomeSurvey` | Post-purchase surveys | `components/cdp/OutcomeSurvey.astro` |

#### Persona Utilities

```typescript
import { getPersonaId, setPersona, getPersonaConfig } from '../lib/persona';

// Get current persona
const persona = getPersonaId(); // 'backyard' | 'commercial' | 'lawn' | 'general' | null

// Set persona (fires 'persona-changed' event)
setPersona('commercial', 'decision_engine');
```

#### Usage Examples

```astro
<!-- Show content only for commercial users -->
<PersonaContent show="commercial">
  <p>Call our commercial team: 1-800-XXX-XXXX</p>
</PersonaContent>

<!-- CTA that auto-changes by persona -->
<PersonaCTA variant="primary" />
<!-- Backyard sees "Shop Backyard Products" → /shop/poultry/backyard/ -->
<!-- Commercial sees "Talk to a Specialist" → /contact/commercial/ -->
```

### Key CDP Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Outcomes start Week 1 | ✅ | Proof points are the moat |
| Betty tunnels before Bill | ✅ | Her loop is fully online |
| Bill tunnels gated | ✅ | Need 30+ days phone outcomes first |
| Dual-track execution | ✅ | Ads cleanup shouldn't block CDP |

---

## Repository Structure

```
southland-platform/
├── apps/
│   ├── astro-content/     # Content site (podcast, blog, branding)
│   ├── persona-worker/    # Cloudflare Worker for CDP persona scoring
│   └── shopify-app/       # Shopify embedded app (Remix)
├── packages/
│   ├── shopify-storefront/ # Shopify Storefront API client + queries
│   ├── ui-react/          # Shared React components
│   ├── ui-schema/         # TypeScript types/schemas
│   └── ui-tokens/         # Design tokens
└── turbo.json             # Turborepo config
```

## Commands

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all apps in dev mode
pnpm build                # Build all packages and apps
pnpm lint                 # Lint all apps/packages
pnpm format               # Format all code
pnpm check                # Full quality check (lint + typecheck + format)
pnpm --filter @southland/astro-content dev           # Start just Astro
pnpm --filter @southland/astro-content build-partials # Rebuild header/footer HTML partials
pnpm --filter @southland/ui-react build              # Rebuild shared React components
pnpm --filter @southland/ui-schema build             # Build just ui-schema
```

---

## Developer Tooling (Feb 2026)

### ESLint

- **Config**: ESLint 9 flat config per app/package
- **Files**: `eslint.config.js` in each app/package
- **TypeScript**: `@typescript-eslint/eslint-plugin`
- **Astro files**: Excluded from ESLint (use `astro check` instead)

### Prettier

- **Style**: No semicolons, single quotes, trailing commas
- **Plugins**: `prettier-plugin-astro`, `prettier-plugin-tailwindcss`
- **Root config**: `.prettierrc`
- **Astro config**: `apps/astro-content/.prettierrc` (local plugins)

### Files Excluded from Prettier

Some Astro files have HTML comments in JSX expressions that the parser can't handle:
- `CloudinaryImage.astro`, `CloudinaryHero.astro`, `CloudinaryGallery.astro`
- `BaseLayout.astro`, `DecisionEngine.astro`, `RealityTunnel.astro`
- `AuthorCard.astro`, `BlogCard.astro`, `TeamCard.astro`, `search.astro`

Listed in `apps/astro-content/.prettierignore`

### CI Quality Gate

`.github/workflows/quality.yml` runs on push/PR to main:
1. `pnpm lint` - ESLint all packages
2. `pnpm typecheck` - TypeScript + Astro check
3. `pnpm format:check` - Prettier verification

### Turbo Tasks

| Task | Caching | Description |
|------|---------|-------------|
| `build` | ✅ | Build all packages |
| `lint` | ✅ | ESLint all packages |
| `typecheck` | ✅ | Type checking |
| `format` | ❌ | Prettier write |
| `format:check` | ✅ | Prettier check |

---

## Apps

### astro-content (Port 4400)

Astro 5 content site — Phase 1 LIVE routes:

- `/podcast/*` — Ag & Culture Podcast hub, episodes, topics, search, RSS
- `/blog/*` — Blog index + 287 posts
- `/about/`, `/contact/`, `/distribution/`, `/store-locator/` — Static pages
- `/team/*` — Team member pages
- `/admin/` — Admin dashboard (password protected)
- `/admin/videos/` — Mux video library with transcript search
- `/build-a-case/` — Mix & Match gallon case builder
- `/application-rate-calculator/` — Application rate calculator (12 products, 3 segments)
- `/erosion-control-seed-calculator/` — Erosion control seed mix calculator

Lead Magnets / Calculators:

- Shared `src/lib/leadCapture.ts` — Nexus POST helper, attribution, analytics events
- Calculators use React islands (`client:load`) with fire-and-forget POST to Nexus
- Nexus lead types: `erosion_calculator` (22), `roi_calculator` (22) — registered in `southland-inventory/src/lib/leads.ts`
- Cart import MUST be lazy (`await import('../../lib/cart')`) — static import blocks hydration
- Product data hardcoded in `src/lib/appRateRules.ts` with Shopify variant GIDs for Add to Cart
- Nav links: Poultry > Resources and Lawn & Garden > Resources in `layout.json`

Infrastructure:

- `build-partials` script renders `StaticHeader`/`Footer` to HTML for HTMLRewriter injection
- Cloudflare Pages middleware proxies non-Astro routes to Shopify
- HTMLRewriter dormant until Shopify section IDs identified

See [apps/astro-content/.claude-context.md](apps/astro-content/.claude-context.md) for details.

### persona-worker

Cloudflare Worker for real-time CDP persona scoring. Receives pixel events, computes persona probability scores, caches in KV, forwards to BigQuery.

See [apps/persona-worker/.claude-context.md](apps/persona-worker/.claude-context.md) for details.

### shopify-app

Remix-based Shopify embedded app. Requires dev store setup via `shopify app dev`.

## Cloudinary

**Cloud Name:** `southland-organics`

### Folder Structure

```
Southland Website/
├── Southland Branding/      # Logos, brand assets
│   └── logos/               # Logo variations
├── podcast/                 # Podcast assets
│   ├── episodes/            # Episode thumbnails
│   └── guests/              # Guest headshots
├── products/                # Product images
├── team/                    # Team photos
└── heroes/                  # Hero/banner images
```

### Usage

```typescript
import { buildSouthlandUrl, buildBrandingUrl } from './lib/cloudinary';

// General images
const heroUrl = buildSouthlandUrl('heroes/field', { width: 1600 });

// Branding assets
const logoUrl = buildBrandingUrl('logos/southland-logo-primary', { width: 300 });
```

### Environment Variable

```bash
PUBLIC_CLOUDINARY_CLOUD_NAME=southland-organics
```

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Dark Green | `#2C5234` | Titles, logo dark half |
| Light Green | `#44883E` | Links, buttons, logo light half |
| Text | `#191D21` | Body copy |
| Secondary | `#686363` | Muted text |

## Typography

- **Headings:** Eveleth Dot (self-hosted)
- **Body:** Open Sans (Google Fonts)

## Admin Access

Admin pages at `/admin/` are password protected.

**Default Password:** `southland2024`

Change in `apps/astro-content/src/layouts/AdminLayout.astro` line 227.

## AI Search Content Initiative (March 2026)

**Full doc:** [docs/AI-CONTENT-INITIATIVE.md](docs/AI-CONTENT-INITIATIVE.md)

AI visibility audit found we rank on 4/10 situation queries but are cited in 0/10 AI Overviews. Built 6 pillar pages + upgraded 4 collection pages to fix this.

### New Pillar Pages (blog posts)

| File | Target Situation |
|------|-----------------|
| `how-to-reduce-ammonia-in-poultry-house-naturally.mdx` | Poultry ammonia control |
| `natural-alternatives-to-chemical-poultry-treatments.mdx` | Chemical → natural transition |
| `organic-soil-health-bermuda-grass-fairways.mdx` | Golf course soil health |
| `how-to-fix-southern-clay-soil-organically.mdx` | Southern clay soil remediation |
| `best-organic-fertilizers-warm-season-grass.mdx` | Warm season grass fertilizer guide |
| `building-soil-biology-farm-fields.mdx` | Farm soil biology rebuilding |

### Content Rules (for all future pillar pages)
1. Problem-first, product-second — always
2. Specific data (ppm, $/acre, FCR) — not vague claims
3. Honest competitor comparisons
4. Structured for AI extraction (H2/H3, tables, FAQ schema)
5. Products appear as ONE option among several
6. Author: `mike-usry` for E-E-A-T

### PMax Rewrite
Situation-first ad headlines in `mothership/docs/advertising/campaigns/southland-pmax-situation-rewrite-2026-03.md`. A/B test: keep 5 existing, swap 10 situation-framed.

### Launch Tasks
Tracked in Nexus `/hr/todos` (13 tasks, Mar 23-Apr 3).

---

## Klaviyo Flow Integration

**Master Roadmap:** `mothership/docs/KLAVIYO-FLOW-ROADMAP.md`

Platform's role in the Klaviyo flow ecosystem:
- **CDP Personas** (Broiler Bill, Backyard Betty, Turf Pro Taylor) drive post-purchase email segmentation — product education and cross-sell flows branch by persona
- **Reality Tunnels** content strategy aligns with post-purchase education emails (same content, different channel)
- **Replenishment timing** data from BigQuery CDP informs reorder email scheduling
- Nexus owns event infrastructure (delivery events, fulfillment sync); Mothership owns flow definitions; Platform owns persona/content strategy

## Lead Magnets & Nexus Integration

**Spec:** [docs/LEAD-MAGNETS.md](docs/LEAD-MAGNETS.md) — UX specs, benchmarks, analytics events, Nexus POST patterns for all lead capture tools.

**4 tools to build:**
1. **Gate the Erosion Calculator** — add "Save Your Recommendation" email capture below results → POST to Nexus as `lead_type: 'erosion_calculator'`
2. **Lawn Health Assessment Quiz** — 5-7 question wizard → personalized product recommendations → POST as `lead_type: 'product_quiz'`
3. **Application Rate Calculator** — product → area → quantities + cost + add-to-cart → POST as `lead_type: 'roi_calculator'`
4. **Talk to a Rep** — inline form on every product page, pre-filled with product context → POST as `lead_type: 'lead_magnet'`

**Nexus API:** `POST https://nexus.southlandorganics.com/api/leads` — CORS configured for southlandorganics.com. Fire-and-forget, never block UX. Include honeypot (`website` field) + sessionStorage attribution (`sl_gclid`, `sl_utm_*`, `sl_landing_page`).

**Existing forms:** Contact + Distribution forms already dual-write to Nexus. Pattern is proven — follow the same fire-and-forget approach.

## Related Resources

- **Mothership:** `~/CODING/mothership/` - Orchestration platform
  - `docs/KLAVIYO-FLOW-ROADMAP.md` — Klaviyo flow master checklist (post-purchase, NBA, loyalty, leads)
- **Nexus (Inventory):** `~/CODING/southland-inventory/` - Order management, shipping, EOS todos
  - `docs/LEAD-MAGNETS.md` — Canonical lead magnet spec (mirrored in this repo)
  - `docs/LEAD-SCORING-SOP.md` — How lead scoring and MQL/SQL qualification works
  - `docs/UARZO-FLOW.md` — Customer journey framework + Revenue Operating Scorecard
- **point.dog:** CDP/analytics integration
- **Shopify Store:** southland-organics.myshopify.com
