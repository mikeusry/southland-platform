# Southland Platform - Claude Context

Monorepo for Southland Organics digital platform.

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
| Content CMS | Keystatic (Git-backed, visual Markdown editor) |
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
│  │         SEO Content (Keystatic) + Products (Shopify)         │   │
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
│   KEYSTATIC   │   │   SHOPIFY     │   │  CLOUDINARY   │
│   /keystatic  │   │  Storefront   │   │     CDN       │
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
| Collection SEO content | Keystatic | /keystatic | Marketing |
| Blog posts | Keystatic | /keystatic | Marketing |
| Podcast episodes | Keystatic | /keystatic | Marketing |
| Static pages | Keystatic | /keystatic | Marketing |
| Team bios | Keystatic | /keystatic | Marketing |
| Navigation menus | Shopify | Shopify Admin | Operations |
| Images | Cloudinary | Cloudinary | Anyone |

### URL Structure

| URL Pattern | Source | Notes |
|-------------|--------|-------|
| `/` | Astro + Keystatic | Homepage |
| `/podcast/` | Astro + Keystatic | Podcast hub |
| `/podcast/[slug]/` | Astro + Keystatic | Episode pages |
| `/blog/` | Astro + Keystatic | Blog index |
| `/blog/[slug]/` | Astro + Keystatic | Blog posts |
| `/collections/` | Astro | Collections index |
| `/collections/[slug]/` | Astro + Keystatic + Shopify | Collection pages |
| `/products/[handle]/` | Astro + Shopify | Product pages |
| `/cart/` | Astro (client-side) | Cart page |
| `/about/` | Astro + Keystatic | About page |
| `/contact/` | Astro + Keystatic | Contact page |
| `/keystatic/` | Keystatic | Admin UI |

### Current Phase: Phase 1 (Podcast Launch)

**Status:** Deploying `/podcast/*` routes via Cloudflare Pages

**Header/Footer Strategy (Phase 1):**
- TWO codebases temporarily: React (Astro) + Liquid (Shopify)
- Navigation data auto-synced from Shopify API at build time
- Visual styling manually kept in sync

**Header/Footer Strategy (Full Headless - Future):**
- ONE codebase: Astro components only
- Shopify becomes API-only (checkout, cart)

### Migration Phases

| Phase | Routes | Status |
|-------|--------|--------|
| 1 | `/podcast/*` | IN PROGRESS |
| 2 | `/blog/*` | Planned |
| 3 | `/collections/*` | Planned |
| 4 | `/products/*` | Planned |
| 5 | `/` (homepage) | Planned |

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
│   └── shopify-app/       # Shopify embedded app (Remix)
├── packages/
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
pnpm --filter @southland/astro-content dev    # Start just Astro
pnpm --filter @southland/ui-schema build      # Build just ui-schema
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

Astro 5 content site for:
- `/podcast/` - Ag & Culture Podcast hub
- `/admin/` - Admin dashboard (password protected)
- `/admin/branding/` - Brand guidelines

See [apps/astro-content/.claude-context.md](apps/astro-content/.claude-context.md) for details.

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

## Related Resources

- **Mothership:** `~/CODING/mothership/` - Orchestration platform
- **point.dog:** CDP/analytics integration
- **Shopify Store:** southland-organics.myshopify.com
