# PDP Full Redesign — Implementation Plan (v2)

## Context

The current PDP (`/products/[handle]`) is a bare SSR template with no StoryBrand structure, no proof, no trust badges, thin Shopify HTML descriptions, and only 2 products with video. Every other page type has been upgraded. The PDP is the last major gap before go-live.

**Reviewer feedback incorporated:** Product structured data, variant markup, Cloudflare cache strategy, persona/crawl separation, sticky mobile ATC, editorial governance, section-level analytics, and metadata completeness.

---

## Architecture

### Two-tier rendering
- **Full mode** — TinaCMS product MDX exists → 9 sections, StoryBrand rhythm
- **Baseline mode** — No MDX → improved layout with trust badges, collection FAQ fallback, generic proof band, CTA

### Data ownership (hard separation)
| Owner | Fields | Rule |
|-------|--------|------|
| **Shopify (commercial truth)** | Price, compareAtPrice, availability, variants, SKU, vendor, images, productType | NEVER overridden by editorial |
| **TinaCMS (editorial persuasion)** | Headline, bullets, PAS framing, features→benefits, FAQ, guide CTA, blog links, video | Curated conversion copy |
| **System (governance)** | Trust badge defaults, shipping policy, return policy, BBB rating, company stats | Globally governed, not per-product |

### Persona as UX experiment, NOT crawlable content
- Persona cookie (`sl_persona`) affects CTA button text/emphasis only
- Persona NEVER changes: title, meta description, canonical, schema, price, H1, or primary copy
- Crawlers always see the default (no-persona) version
- Cloudflare cache: persona variation is client-side JS swap after hydration, NOT server-rendered variation

### Cloudflare cache contract
| Content | Cache | Rule |
|---------|-------|------|
| Anonymous PDP HTML | Aggressive (1h+ edge cache) | Same HTML for all users, persona CTA swapped client-side |
| Cart/checkout/account | No cache (private) | Bypass via cookie detection |
| Product images | Long cache (Cloudinary CDN) | Already cached at origin |
| Mux video embeds | Lazy-loaded, no LCP impact | Script import deferred |
| Schema JSON-LD | Static in HTML | Cached with page, always reflects Shopify truth |

---

## Structured Data (must-have before launch)

### Product JSON-LD (already exists, needs enhancement)
The current template already generates Product schema with AggregateOffer/Offer, shipping details, and variant data. **Enhancements needed:**

| Markup | Current | Change |
|--------|---------|--------|
| `Product` | Present (name, description, image, brand, offers) | Add `sku`, `gtin` if available from Shopify metafields |
| `AggregateOffer` / `Offer` | Present (price, currency, availability, shipping) | Already solid — keep |
| `ProductGroup` + `hasVariant` | Missing | Add when product has size/type variants (gallons vs quarts) |
| `BreadcrumbList` | Missing | Add schema matching visible breadcrumbs |
| `FAQPage` | In plan | Only emit when FAQ content is **visibly rendered** on-page |
| `Review` / `AggregateRating` | Missing | Stub for future — only add when real review data exists |

### Heading hierarchy (enforced)
- Exactly 1 `<h1>` per page (product headline)
- Each section gets 1 `<h2>` (font-heading uppercase)
- Subsections use `<h3>` — no skipped levels
- MDX body content rendered through prose container inherits `prose-headings:font-heading`
- Template enforces this — editorial cannot produce multiple H1s

---

## TinaCMS Schema Changes

### content/config.ts — Extend productsCollection:

```typescript
// --- PDP Hero ---
headline: z.string().optional(),                    // Benefit headline, not SKU name
heroBullets: z.array(z.string()).optional().default([]),

// --- SEO (editorial override) ---
seoTitle: z.string().optional(),                    // <title> override
seoDescription: z.string().optional(),              // <meta description> override

// --- Video ---
muxPlaybackId: z.string().optional(),
videoTitle: z.string().optional(),

// --- PAS Section ---
problemHeadline: z.string().optional(),
problemCards: z.array(z.object({
  title: z.string(),
  body: z.string(),
})).optional().default([]),

// --- Features/Benefits ---
features: z.array(z.object({
  feature: z.string(),
  benefit: z.string(),
})).optional().default([]),

// --- Dosing (only for complex application products) ---
dosingInstructions: z.string().optional(),
applicationMethod: z.string().optional(),

// --- Proof ---
proofStats: z.array(z.object({
  value: z.string(),
  label: z.string(),
  source: z.string().optional(),
})).optional().default([]),
testimonials: z.array(z.object({
  quote: z.string(),
  name: z.string(),
  role: z.string().optional(),
})).optional().default([]),

// --- FAQ ---
faq: z.array(z.object({
  question: z.string(),
  answer: z.string(),
})).optional().default([]),
allowFaqSchema: z.boolean().optional().default(true),  // Editorial kill switch

// --- Trust + Persona ---
trustBadges: z.array(z.string()).optional().default([]),
primaryPersona: z.string().optional(),
guideName: z.string().optional(),
guidePhoto: z.string().optional(),

// --- Related ---
relatedProductHandles: z.array(z.string()).optional().default([]),
relatedBlogSlugs: z.array(z.string()).optional().default([]),

// --- Image alt overrides ---
imageAltOverrides: z.array(z.string()).optional().default([]),
```

### FAQ guardrails
- Collection-level FAQ fallback renders **only** if ≤2 products share that FAQ set (prevents near-duplicate PDPs)
- If >2 products would inherit same FAQ, skip FAQ section on baseline products
- `allowFaqSchema: false` lets editors suppress schema emission even when FAQ renders

---

## PDP Sections (9 total)

### S0: Breadcrumbs (gray-50 bar) — ALWAYS
- Home → [Collection from productType] → Product Name
- BreadcrumbList schema.org JSON-LD emitted alongside Product schema

### S1: HERO (two-column) — ALWAYS
- **Left**: ImageGallery (unchanged)
- **Right**: Benefit headline (`tina.headline` || Shopify title) as H1
- Hero bullets (`tina.heroBullets`) if present
- Price + AddToCartButton (unchanged, Shopify-owned)
- Trust badges row (tina → segment defaults → system defaults)
- **Sticky mobile ATC**: fixed bottom bar on mobile after hero scrolls out of viewport

### S2: VIDEO (white, conditional)
- `tina.muxPlaybackId` || `PRODUCT_VIDEOS[handle]`
- Mux player, lazy script, deferred — NOT in LCP path
- Skip if no video

### S3: PAS / PROBLEM (gray-50, conditional — full mode only)
- 3 hex-icon cards (same pattern as sanitizers/commercial)
- Skip entirely on baseline

### S4: FEATURES + HOW IT WORKS (cream)
- **Full mode**: Two-column features→benefits + dosing (if complex product)
- **Baseline mode**: Cleaned Shopify descriptionHtml in prose container
- Dosing merges into features for simple products; standalone section only when application complexity is a conversion barrier

### S5: PROOF (dark green) — ALWAYS
- **Full mode**: proofStats[] + testimonials[] — strongest proof element
- **Baseline mode**: Generic company stats (2009, A+ BBB, 1000+ farms)
- **Key**: one proof element (e.g., "6.2% mortality reduction") also appears as a badge near ATC in S1, not buried only in S5

### S6: FAQ (gray-50, conditional)
- Source: `tina.faq[]` → collection FAQ (with dedup guardrail) → skip
- AccordionFaq component
- FAQ schema only when `allowFaqSchema` is true AND content is unique to this product

### S7: RELATED PRODUCTS + CROSS-LINKS (white) — ALWAYS
- Products: `tina.relatedProductHandles[]` → auto-fetch by productType
- Blog links: `tina.relatedBlogSlugs[]` if present
- Internal link diversity requirement: at least 1 hub link + 1 blog link + product links

### S8: FINAL CTA (dark green) — ALWAYS
- Persona CTA text swapped **client-side via JS** after hydration
- Server-rendered HTML always shows default dual CTA (phone + shop)
- Guide photo/name from TinaCMS if available

---

## Analytics Spec (section-level events)

| Event | Trigger | Data |
|-------|---------|------|
| `pdp_hero_atc_view` | ATC button enters viewport | handle, variant, persona |
| `pdp_hero_atc_click` | ATC button clicked | handle, variant, quantity, persona |
| `pdp_video_impression` | Video section scrolls into view | handle, muxPlaybackId |
| `pdp_video_progress` | 25/50/75/100% watched | handle, percent |
| `pdp_faq_open` | FAQ item expanded | handle, question_index |
| `pdp_related_product_click` | Related product card clicked | handle, related_handle |
| `pdp_related_blog_click` | Blog cross-link clicked | handle, blog_slug |
| `pdp_final_cta_click` | Final CTA clicked | handle, cta_type (phone/shop), persona |
| `pdp_scroll_depth` | 25/50/75/100% page scrolled | handle, tier (enriched/baseline) |
| `pdp_variant_change` | Variant selector changed | handle, old_variant, new_variant |

Enriched vs baseline cohort tagging via `data-pdp-tier="enriched|baseline"` on `<main>`.

---

## Implementation Order (phased by risk)

### Phase 1: Schema + Metadata + Structured Data
1. Extend `content/config.ts` products schema (all optional)
2. Add products collection to `tina/config.ts`
3. Add BreadcrumbList schema to template
4. Enhance Product JSON-LD (add ProductGroup/hasVariant for multi-variant products)
5. Define heading hierarchy rules in template
6. Verify: existing 5 MDX files validate, schema passes Google validator

### Phase 2: Baseline Improvements
7. Refactor `[handle].astro` — add TinaCMS loading + `hasTinaContent` gate
8. Add trust badges row to hero (always, tag/segment inferred)
9. Add sticky mobile ATC (CSS `position: sticky`)
10. Add collection FAQ fallback (with dedup guardrail)
11. Add generic proof band (always)
12. Add final CTA section (always, server-rendered default)
13. Add cross-links section (hub + blog + products diversity)
14. Expand PRODUCT_VIDEOS map (query Supabase, 15+ entries)
15. Verify: every product has improved baseline, canonical/meta/alt present

### Phase 3: Full StoryBrand Mode
16. Add conditional sections (PAS, features, proof stats, testimonials, dosing)
17. Add video section
18. Add persona CTA client-side swap (JS, not SSR)
19. Add FAQ schema (gated on `allowFaqSchema` + visible rendering)
20. Section-level analytics events
21. Verify: Big Ole Bird renders full 9-section template

### Phase 4: Content Population
22. Enrich big-ole-bird.mdx as reference implementation
23. Enrich remaining 4 MDX files (hen-helper, humates, desecticide, torched)
24. Create 5-10 new MDX files for high-traffic products
25. Editorial QA checklist: uniqueness, claim substantiation, search intent mapping

### Phase 5: Audit + Cache + Launch
26. Go-live audit on enriched products (architecture, design, SEO, voice)
27. Rich result validation (Product, FAQ, BreadcrumbList)
28. Cloudflare cache behavior testing (with/without persona cookie)
29. Lighthouse (performance, a11y, SEO)
30. Mobile responsiveness + sticky ATC verification
31. Enriched vs baseline A/B attribution baseline established

---

## Verification

- `astro build` succeeds after schema changes
- `/products/poultry-probiotic/` (enriched) → full 9-section StoryBrand, all schema valid
- `/products/some-unenriched-product/` → clean baseline with trust badges, FAQ, CTA
- Google Rich Results Test passes for Product + BreadcrumbList + FAQ
- No persona cookie → default dual CTA rendered server-side
- Persona cookie → CTA text swapped client-side, page source unchanged
- Video plays on mapped products, lazy-loaded, not in LCP
- Mobile: sticky ATC visible after hero scroll, all sections stack cleanly
- Cache: anonymous request cached, persona-cookie request serves same HTML
