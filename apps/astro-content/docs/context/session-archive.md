# Session Archive

Historical session notes for southland-platform astro-content.

---

## 2026-02-14 - Documentation Audit & Staleness Fixes

**Goal:** Full doc-audit to identify and fix stale documentation after TinaCMS migration.

**Findings:**
- 8 stale doc files, overall grade dropped from 100% → 85% (Grade B)
- Root cause: Keystatic → TinaCMS migration (Feb 2) not reflected in docs

**Fixed:**
- `CLAUDE.md` — Replaced all Keystatic refs with TinaCMS, added persona-worker to structure
- `README.md` — Corrected brand colors, updated TODOs, changed npm→pnpm
- `.claude-context.md` — Fixed Phase 2 TODOs, removed Keystatic refs
- `docs/context/architecture.md` — Fixed project name, updated collection statuses (blog=Active 287 posts, team=Active)
- `docs/context/integrations.md` — Updated all status fields (Klaviyo, point.dog, CF middleware now "Implemented")
- `docs/context/session-archive.md` — Added missing session entries

**Created:**
- `docs/DOC-AUDIT-REPORT.md` — Full audit report

---

## 2026-02-05 - ESLint, Prettier & CI Quality Workflow

**Goal:** Add developer tooling for consistent code quality across monorepo.

**Created:**
- `eslint.config.js` per app/package — ESLint 9 flat config
- `.prettierrc` — No semicolons, single quotes, trailing commas
- `apps/astro-content/.prettierrc` — Local Astro/Tailwind plugins
- `apps/astro-content/.prettierignore` — Astro files with HTML-in-JSX issues
- `.github/workflows/quality.yml` — CI gate: lint + typecheck + format:check

**Updated:**
- `CLAUDE.md` — Added Developer Tooling section
- `turbo.json` — Added lint, typecheck, format, format:check tasks

---

## 2026-02-02 - TinaCMS Migration

**Goal:** Migrate from Keystatic to TinaCMS for visual editing.

**Commit:** `322993d`

**Changes:**
- Replaced Keystatic with TinaCMS (Git-backed, visual editor)
- `tina/config.ts` — 5 collections: episodes, guests, topics, blog, team
- Admin UI now at `/admin/` (was `/keystatic/`)
- Content schema migrated to TinaCMS format

---

## 2026-01-30 - CDP Week 4: Persona Scoring Worker

**Goal:** Complete CDP Week 4 deliverable — persona scoring Cloudflare Worker.

**Created:**
- `apps/persona-worker/` — New app in monorepo
  - Cloudflare Worker receiving pixel events
  - Persona probability scoring via KV storage
  - BigQuery event forwarding

**Updated:**
- CDP status to Week 4 complete in docs

---

## 2026-01-28 - CDP Week 3: Semantic Search & Proof Points

**Goal:** Semantic search infrastructure and first proof-point content.

**Created:**
- Supabase pgvector integration for semantic search
- E-E-A-T author/reviewer system for blog posts (`AuthorCard`, `ReviewerBadge`)
- First proof-point content pages

---

## 2026-01-24 - CDP Week 2: Reality Tunnels Infrastructure

**Goal:** Build persona-conditional content rendering system.

**Created:**
- `src/components/cdp/` — DecisionEngine, PersonaContent, PersonaCTA, PersonaBanner, OutcomeSurvey
- `src/components/tunnels/` — Reality Tunnel page components with README
- `src/components/dashboard/` — CDP admin dashboard with README
- `src/lib/persona.ts` — Persona utilities (get/set/config)

**Updated:**
- `.claude-context.md` — Added CDP/Reality Tunnels section
- Navigation — Added admin routes

---

## 2026-01-20 - CDP Week 1: Decision Engine & Outcome Surveys

**Goal:** Launch CDP foundation — persona selection and outcome tracking.

**Created:**
- Decision Engine (3-way homepage persona selector)
- Outcome surveys (post-purchase for Backyard Betty, Broiler Bill)
- Sales log admin page
- API endpoints: `/api/survey/submit`, `/api/sales-log/submit`
- BigQuery schema: `docs/schemas/bigquery-outcomes.sql`

**Updated:**
- `docs/SOUTHLAND-CDP-PLAYBOOK.md` — Comprehensive 97KB strategy document

---

## 2026-01-30 - Blog Migration (287 Posts)

**Goal:** Migrate all blog content from Shopify to Astro MDX.

**Commit:** `6a0be75`

**Created:**
- 287 `.mdx` blog post files in `src/content/blog/`
- Blog content collection schema in TinaCMS config
- Blog-specific components (BlogCard, AuthorCard)

---

## 2026-01-27 - Monorepo Setup

**Goal:** Migrate from standalone repo to Turborepo monorepo.

**Commit:** `05e2e32`

**Created:**
- `turbo.json` — Turborepo config with task pipelines
- `packages/ui-react/` — Shared React components (Header/Footer)
- `packages/ui-schema/` — TypeScript types/schemas
- `packages/ui-tokens/` — Design tokens + Tailwind preset
- `apps/shopify-app/` — Remix-based Shopify embedded app

**Updated:**
- Moved astro-content to `apps/astro-content/`
- Converted all commands from npm to pnpm
- Root `CLAUDE.md` created with monorepo context

---

## 2026-01-15 - Team Pages & Footer Refinements

**Goal:** Add staff/team pages and finalize footer from Shopify Admin API data.

**Created:**
- Team content collection and pages
- Staff member profiles with Cloudinary photos

**Updated:**
- Footer rebuilt from Shopify `settings_data.json`: correct structure, payment icons, social links
- Cloudinary background image on footer

---

## 2026-01-06 - Shopify Theme Sync & Cloudinary Integration

**Goal:** Pixel-perfect Shopify style matching + Cloudinary image components.

**Created:**
- `src/lib/cloudinary.ts` - Full Cloudinary URL builder with transforms, responsive srcset, placeholder generation
- `src/components/CloudinaryImage.astro` - Base image component with lazy loading, blur placeholders
- `src/components/CloudinaryAvatar.astro` - Circular profile images with face detection
- `src/components/CloudinaryHero.astro` - Full-width hero banners with overlays
- `src/components/CloudinaryGallery.astro` - Image galleries with lightbox support
- `src/styles/shopify-tokens.css` - CSS custom properties synced from Shopify theme
- `public/fonts/eveleth-dot-regular.ttf` - Self-hosted Eveleth Dot heading font

**Updated:**
- `src/components/shared/Footer.astro` - Rebuilt from Shopify Admin API `settings_data.json`:
  - Correct structure: Logo, Address, Navigate, Products, Podcast, Social, Sam.Gov
  - Real payment icons (SVGs from Simple Icons)
  - Cloudinary background image
  - Social links from Shopify settings
- `src/components/shared/Header.astro` - Updated colors to match Shopify theme
- `tailwind.config.mjs` - Added Shopify color palette and font families
- `src/styles/global.css` - Import shopify-tokens, base typography
- `src/layouts/BaseLayout.astro` - Google Fonts (Open Sans) import
- `docs/context/integrations.md` - Added Shopify Admin API and Cloudinary documentation
- `.claude-context.md` - Added brand colors, fonts, Cloudinary usage

**Shopify API Access (via Mothership):**
- Store: `southland-organics.myshopify.com`
- Theme ID: `136292630773` (Booster-Default-6.1.0)
- Fetched: `config/settings_data.json`, `sections/footer.liquid`

**Brand Colors (from Shopify):**
- Accent: `#44883e` (primary green)
- Title: `#2c5234` (dark green)
- Text: `#191d21`
- Secondary: `#686363`

**Fonts:**
- Headings: Eveleth Dot (self-hosted)
- Body: Open Sans (Google Fonts)

**Pending:**
- Vector CDP mapping integration with point.dog
- Footer styling refinements (if needed after review)

---

## 2025-01-06 - Documentation Structure Setup

**Goal:** Bring repo into compliance with workspace documentation standard.

**Created:**
- `.claude-context.md` (106 lines) - Quick reference
- `docs/context/architecture.md` - Tech stack, lib utilities, all 6 content schemas
- `docs/context/integrations.md` - Cloudflare, Klaviyo, point.dog
- `docs/context/session-archive.md` - This file

**Updated:**
- `~/CODING/WORKSPACE.md` - Added southland-content to:
  - Task Routing table
  - Client Websites table
  - Doc Status list (marked as Structured)

**Doc Audit Results:**
- Pattern: Spider (root → context docs → details)
- Coverage: 85% → 100%
- All gaps addressed

**Next Session Priorities:**
1. Deploy to Cloudflare Pages staging
2. Add real episode content
3. Improve footer styling to match Shopify
4. Connect Klaviyo email capture

---

## 2025-01-05 - MVP Build

**Goal:** Build Ag & Culture Podcast hub MVP.

**Created:**
- Full project structure (Astro 5 + Tailwind + MDX)
- Podcast pages: hub, episode detail, search, guests, topics
- RSS feed with iTunes extensions
- Header/Footer matching Shopify
- Content collections: episodes, guests, topics, blog, team, products
- Utility libraries: analytics.ts, supabase.ts
- PWA support: manifest.json, sw.js

**Architecture:**
- "Fake headless" hybrid: Cloudflare Worker routes /podcast/* to this repo
- Everything else stays on Shopify
- Single domain: southlandorganics.com

**Reference:**
- Plan: `~/.claude/plans/twinkly-launching-petal.md`
- Spec: `~/CODING/mothership/docs/future/southland-organics-hybrid-architecture-spec.md`
