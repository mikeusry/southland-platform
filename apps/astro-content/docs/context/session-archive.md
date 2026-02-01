# Session Archive

Historical session notes for southland-content.

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
