# Go-Live Audit System — Implementation Plan

## Overview

Rebuild the `/admin/go-live/` page from a basic HTTP checker into a multi-layer automated audit system based on the Page Evaluation Agent spec (`docs/PAGE-EVALUATION-AGENT.md`).

## Three Layers

| Layer | What | Status |
|-------|------|--------|
| **1. Page Evaluation** | Architecture, design tokens, SEO, headings, links, product relevance | Build now |
| **2. Originality** | AI-generated content detection via OpenAI API | Stub now, wire later |
| **3. Brand Voice** | StoryBrand alignment, persona language, specificity scoring | Stub now, wire later |

## New Files

| File | Purpose |
|------|---------|
| `src/lib/services/page-audit.ts` | Core audit logic — HTML parsing, grading, verdict computation |
| `src/pages/api/go-live/audit.ts` | API endpoint — fetch page HTML, run audit pipeline, return results |

## Modified Files

| File | Change |
|------|--------|
| `src/pages/admin/go-live/index.astro` | Page list with classification data, new audit UI, grade display |
| `src/lib/services/compare-pages.ts` | Refactor `extractPageData()` into shared utility |

## Page Classification (Static)

Each page in the go-live list gets `archetype`, `persona`, and `referencePage` fields:

| Path | Archetype | Persona | Reference |
|------|-----------|---------|-----------|
| `/poultry/commercial/` | storybrand-landing | bill | (is the reference) |
| `/poultry/backyard/` | storybrand-landing | betty | `/poultry/commercial/` |
| `/lawn/turf-pros/` | storybrand-landing | taylor | `/poultry/commercial/` |
| `/lawn/golf-courses/` | storybrand-landing | taylor | `/poultry/commercial/` |
| `/lawn/homeowners/` | storybrand-landing | general | `/poultry/commercial/` |
| `/lawn/landscapers/` | storybrand-landing | taylor | `/poultry/commercial/` |
| `/agriculture/crops/` | storybrand-landing | general | `/poultry/commercial/` |
| `/livestock/swine/` | storybrand-landing | general | `/poultry/commercial/` |
| `/poultry/breeders/` | storybrand-landing | bill | `/poultry/commercial/` |
| `/poultry/turkey/` | storybrand-landing | bill | `/poultry/commercial/` |
| `/poultry/game-birds/` | storybrand-landing | bill | `/poultry/commercial/` |
| `/products/sanitizers/` | shop | general | — |
| `/products/waste-treatment/` | shop | general | — |
| `/poultry/` | hub | general | — |
| `/blog/` | hub | general | — |
| `/podcast/` | hub | general | — |
| `/about/` | utility | general | `/contact/` |
| `/contact/` | utility | general | (is the reference) |
| `/distribution/` | utility | general | `/contact/` |
| `/store-locator/` | utility | general | `/contact/` |
| `/team/` | utility | general | `/contact/` |
| `/build-a-case/` | shop | general | — |
| Proxy pages (`/`, `/products/*`, `/cart/`) | proxy | general | — (basic HTTP check only) |

## Audit Functions (what gets parsed from HTML)

### Architecture (StoryBrand Landing only)
- CloudinaryHero present (div with hero image + h1 overlay)
- Problem section (3 hex-icon cards)
- JTBD product sections (job cards with inline product links + prices)
- Shop grid (filtered product grid)
- Proof band (`bg-[#2C5234]` section with stats)
- FAQ/Objections (details/summary accordion)
- Final CTA (dark green band with CTAs)
- Generic template detector: if `<main>` has prose + grid with <5 sections = **automatic F**

### Design
- H1/H2 have `font-heading` class
- No emoji in icon positions (Unicode range scan)
- Hex clip-path containers present
- Brand colors in classes/styles (`#2C5234`, `#44883E`)
- Section rhythm (py-16/py-20)
- Max-width containers (6xl for landing, 7xl for utility)
- Images in body content
- Cloudinary optimization (f_auto, q_auto)

### SEO
- Title: present, <60 chars
- Meta description: present, 120-160 chars
- Canonical URL: present, correct
- OG tags: complete set, not podcast default on non-podcast pages
- Twitter tags: complete
- Schema.org JSON-LD: present, enhanced type
- Heading hierarchy: single H1, no skipped levels
- Internal links in body: 5+ target, diversity check
- Image alt text audit

### Product Relevance (collection/shop pages)
- List all product handles
- Flag persona-irrelevant products
- Check JTBD curation vs. raw grid dump
- Detect EXCLUDED_HANDLES filtering

## Grading

```
Overall = min(architecture, design, seo, products)  // nulls ignored
Ship:    all non-null grades B+
Fix:     surface issues only
Rewrite: architecture F, or 2+ audits at D/F
```

Automatic caps:
- Generic template on StoryBrand page → architecture F, overall D max
- Zero body links → SEO D max
- Missing font-heading → design C max
- Emoji in icons → design F

## UI Design

Per-page detail area shows:

```
[Classification] Archetype: StoryBrand Landing | Persona: Taylor | Ref: /poultry/commercial/
[Grades]         Arch: B | Design: A | SEO: C | Products: A | Overall: C | Verdict: FIX
[Sections]       > Architecture (B) ... collapsible check rows
                 > Design (A) ......... collapsible check rows
                 > SEO (C) ............ collapsible check rows
                 > Products (A) ....... collapsible product list
                 > Originality (--) ... stub
                 > Brand Voice (--) ... stub
[Actions]        1. [fix] Add font-heading to H2... | 2. [add] Internal links...
[Review]         [Approve] [Flag] [Skip] + notes
```

## Build Order

| Phase | Task | Depends on |
|-------|------|------------|
| A1 | `page-audit.ts` — types + HTML extraction utilities | — |
| A2 | `api/go-live/audit.ts` — API endpoint | A1 |
| B1 | SEO audit function | A1 |
| B2 | Design audit function | A1 |
| B3 | Architecture audit function | A1 |
| B4 | Product relevance audit function | A1 |
| C1 | Update page list with classification data | — |
| C2 | `renderAuditResult()` replaces check/compare rendering | B1-B4 |
| C3 | Collapsible audit sections + grade badges | C2 |
| C4 | "Audit All" button with progress | C2 |
| D1 | Layer 2/3 stubs wired | C2 |
| D2 | Summary bar uses audit grades in verdict | C2 |

## Key Decisions

- **All Layer 1 parsing is pure HTML** — no external APIs, sub-second per page
- **Classification is static** — defined in the page list, not inferred
- **Keep the existing compare API** — comparison answers "is new as good as old?", audit answers "does it meet our standards?"
- **localStorage version bump** — `v2` → `v3` for clean migration
- **Proxy pages get basic HTTP check only** — no audit (it's Shopify's HTML)
