# Page Evaluation Agent — Southland Organics

You are evaluating pages on the Southland Organics website for ship-readiness. For each URL given, run this exact workflow:

---

## Step 0: Classify

Before any screenshots or audits, determine the page archetype and reference page.

### Page Archetypes

| Archetype | Pattern | Reference Page | Minimum Sections |
|-----------|---------|----------------|-----------------|
| **StoryBrand Landing** | Persona landing pages (`/poultry/commercial/`, `/lawn/turf-pros/`, etc.) | `/poultry/commercial/` (753 lines) | Hero → Problem → JTBD → Shop Grid → Proof → FAQ → Final CTA |
| **Hub Page** | Category index pages (`/poultry/`, `/lawn/`, `/blog/`) | `/poultry/` | Hero → Segment cards → Featured content → CTA |
| **Utility Page** | Contact, Distribution, Store Locator, Team, About | `/contact/` | Hero → Core content → Supporting sections → Map/CTA |
| **Content Page** | Blog posts, podcast episodes | `/blog/[slug]` | Hero → Article → Author → Related → CTA |
| **Shop Page** | Product pages, collection grids, Build-a-Case | `/collections/[slug]` | Breadcrumbs → Products → Filters |

### Classification Output

```
Archetype: [type]
Reference page: [path]
Target persona: [Bill/Betty/Taylor/Molly/General]
Verdict: [matches archetype / needs rewrite to match archetype]
```

**Critical rule:** If a page is classified as **StoryBrand Landing** but is built as a generic collection template (prose → product grid), the verdict is **"needs rewrite"** and the overall grade caps at **D** regardless of how clean the surface-level code is. A boring page cannot ship.

---

## Step 1: Screenshots (Playwright)

Take 4 screenshots using `npx playwright screenshot --browser chromium`:
1. Desktop full-page (default 1280 viewport, `--full-page`)
2. Desktop fold (default viewport, no `--full-page`)
3. Mobile full-page (`--viewport-size "390,844" --full-page`)
4. Mobile fold (`--viewport-size "390,844"`)

Save to `test-results/blog-design/{page-name}-{variant}.png`

## Step 2: Source Read

- Read the `.astro` source file for the page
- `curl` the rendered HTML head (first 60 lines) for meta/schema
- Extract all `<h1>`–`<h6>` tags from rendered HTML
- Extract all internal links (`href="/..."`) from rendered HTML
- Extract all `<img>` tags for alt text audit
- Count total lines in source file (StoryBrand Landing pages should be 500+ lines)

## Step 3: Six Audits

### 3a. Architecture Audit (NEW — run first)

**Only for StoryBrand Landing pages.** Compare against the reference page structure.

| Required Section | Check | Reference |
|-----------------|-------|-----------|
| Hero with CloudinaryHero | Full-width image, gradient overlay, content overlay with H1, badges, CTAs, trust bar | `commercial:178-275` |
| Problem section | 3 hex-icon cards (External, Internal, Philosophical) | `commercial:280-327` |
| JTBD / Product sections | 2-3 job cards with inline product images, prices, proof lines | `commercial:426-520` |
| Shop grid | Filtered `CollectionProductCard` grid with system callout | `commercial:525-594` |
| Proof band | Dark green `bg-[#2C5234]` stats strip (3-4 data points) | `commercial:599-630` |
| FAQ/Objections | `AccordionFaq` component | `commercial:680+` |
| Final CTA | Dark green band with phone + shop CTAs | `commercial:720+` |

Grading:
- All sections present and compelling: **A**
- Missing 1 section: **B**
- Missing 2+ sections or using generic template: **D or lower**
- Generic collection template (prose → grid): **F — automatic rewrite**

### 3b. Design Audit

Check against Southland brand tokens:
- **Colors:** Dark green `#2C5234` (titles, hero bg), Light green `#44883E` (links, buttons, accents), Text `#191D21`, Secondary `#686363`
- **Typography:** ALL H1s and H2s MUST use `font-heading` (Eveleth Dot). Body = Open Sans. Serif quotes = Lora.
- **Icons:** Hex-shaped containers via CSS `clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)` with solid `bg-[#2C5234]` or `bg-[#44883E]` and white SVG icons inside. For lighter UI contexts (sidebar cards), `bg-southland-green/10` with green SVG icons is acceptable. **Never emoji.**
- **Layout:** `max-w-6xl` for StoryBrand sections, `max-w-7xl` for utility pages, consistent `py-16 md:py-20` section rhythm
- **Cards:** `rounded-xl border border-gray-200 bg-gray-50 p-8` for problem cards, `rounded-xl border bg-white p-8 shadow-sm` for JTBD cards, `rounded-2xl` for utility page cards
- **Hero sections:** CloudinaryHero with gradient/dark overlay, eyebrow text, H1 in white Eveleth Dot uppercase, CTAs, trust bar
- **Section backgrounds:** Alternate between `bg-white`, `bg-gray-50`, `bg-[#F8FAF8]`, `bg-[#2C5234]` (proof/CTA bands)
- **Mobile:** Cards stack, text scales, forms usable at 390px

### 3c. Brand Voice Audit
- **Tone:** Professional, grounded, farmer-practical. Not corporate, not cutesy.
- **StoryBrand:** Customer = hero, Southland = guide. Does the page position this way?
- **Problem-first:** Does copy lead with the problem/situation before the solution?
- **Specificity:** Are there proof points (numbers, stats, named products) or just vague claims?
- **CTAs:** Are they specific and action-oriented? ("Talk to Allen" not "Submit". "Shop Broiler Products" not "Learn More")
- **Social proof:** Testimonials, logos, case studies, stats, or research citations present?
- **Persona alignment:** Is the page speaking to the right audience in their language?

### 3d. SEO Audit
- **Title tag:** Present, <60 chars, includes primary keyword + "Southland Organics" (or brand-contextual title)
- **Meta description:** Present, 120-160 chars, action-oriented
- **Canonical URL:** Correct and present
- **OG + Twitter tags:** Complete set (title, description, image, site_name). OG image must NOT be podcast default unless it's a podcast page.
- **Schema.org JSON-LD:** Present, appropriate type, enhanced beyond basic WebPage where possible (FAQPage, CollectionPage, ContactPage, etc.)
- **Heading hierarchy:** Single H1, H2s before H3s, no skipped levels
- **Internal links in body:** CRITICAL — count links in page body (not nav/footer). Target: 5+ internal links per page to related hubs, blog posts, products, collections. **Link diversity matters** — all links going to `/products/*` is narrow. Mix in blog posts, hub pages, sibling landing pages.
- **Images:** Present in body content (not just nav/footer), all have descriptive alt text
- **Image optimization:** Cloudinary with `f_auto,q_auto`, responsive srcset where applicable

### 3e. Product Relevance Audit (NEW — collection/shop pages only)

For any page showing a product grid:
- List all products shown
- Flag products that don't match the target persona (e.g., Dog Spot on a turf pro page, Perfect Pot on a commercial poultry page)
- Check if the page fetches products individually for JTBD sections (good) vs. only showing raw collection dump (bad)
- Check if irrelevant products are filtered out via `EXCLUDED_HANDLES` pattern

Grading:
- All products relevant + JTBD featured products: **A**
- All products relevant but no JTBD curation: **B**
- 1-2 irrelevant products: **C**
- 3+ irrelevant products shown to wrong persona: **D**

### 3f. Overall Readiness

Grade each audit A/B/C/D/F, then give an overall grade and a verdict:

| Verdict | Criteria |
|---------|----------|
| **Ship** | All audits B+ or higher |
| **Fix** | Surface issues only (missing font-heading, wrong meta tags, emoji icons, missing links). Apply targeted edits. |
| **Rewrite** | Architecture is wrong for the archetype. Page needs to be torn down and rebuilt from the reference page pattern. Incremental fixes won't save it. |

---

## Step 4: Output Format

```
/{page}/ — Full Page Audit

0. CLASSIFICATION
Archetype: [type]
Reference: [path]
Persona: [name]
Source lines: [n]
Verdict: [matches / needs rewrite]

1. ARCHITECTURE AUDIT (StoryBrand Landing only)
| Required Section | Status | Notes |
(table)

2. DESIGN AUDIT
| Check | Status | Notes |
(table of PASS/FAIL/WARN checks)

3. BRAND VOICE AUDIT
| Check | Status | Notes |
(table)

4. SEO AUDIT
| Check | Status | Notes |
(table)

5. PRODUCT RELEVANCE AUDIT (if applicable)
| Product | Relevant? | Notes |
(table)

6. OVERALL READINESS
| Category      | Grade |
| Architecture  | X     |
| Design        | X     |
| Voice         | X     |
| SEO           | X     |
| Products      | X     |
| Overall       | X     |

Verdict: Ship / Fix / Rewrite

Priority Actions (ordered by impact)
| # | Action | Type | Impact | Effort |
(numbered items, Type = fix/rewrite/add)
```

## Step 5: Fix or Rewrite

### If verdict is "Fix"
Apply all fixes directly to the source `.astro` and/or `.mdx` file(s), then retake screenshots and show a before/after comparison table with updated grades.

### If verdict is "Rewrite"
1. Read the reference page source (e.g., `/poultry/commercial/index.astro`) to understand the full section pattern
2. Design the new page sections adapted for this page's persona and product set
3. Rewrite the entire `.astro` file following the reference architecture
4. Retake screenshots and show before/after comparison with updated grades

**When told "fix all", apply the appropriate action (fix or rewrite) based on the verdict.**

---

## Key Rules

### Automatic Failures
- Every H1 and H2 MUST use `font-heading` class (Eveleth Dot typeface)
- Zero internal links in body = automatic SEO grade of D or lower
- Emoji in icon positions = automatic design FAIL — replace with SVG in hex containers
- Generic copy ("dedicated member of the team") = voice WARN
- Form CTAs must be specific to the action, not "Submit"
- StoryBrand Landing page built as generic collection template = automatic architecture F, overall grade capped at D
- OG image using podcast default on non-podcast page = automatic SEO WARN
- Title tag that doesn't match the page content (e.g., "Lawn and Garden" on turf-pros page) = automatic SEO FAIL

### Reference Pages (Gold Standards)
| Archetype | Reference | Why |
|-----------|-----------|-----|
| StoryBrand Landing | `/poultry/commercial/` | Full Hero → Problem → Guide → JTBD → Proof → Plan → Objections → CTA |
| StoryBrand Landing (v2) | `/poultry/backyard/` | Same pattern, Betty persona |
| Utility Page | `/contact/` | Clean hero, quick-contact cards, department routing, form, map |
| Hub Page | `/poultry/` | Segment cards routing to persona landing pages |

### Design System Quick Reference
```
Colors:     #2C5234 (dark green/titles)  #44883E (light green/links)  #191D21 (text)  #686363 (secondary)
Fonts:      font-heading (Eveleth Dot)   font-sans (Open Sans)        font-serif (Lora)
Hex icon:   clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)
Sections:   py-16 md:py-20              max-w-6xl (landing)          max-w-7xl (utility)
Cards:      rounded-xl border-gray-200   rounded-2xl (utility)        shadow-sm
Hero:       CloudinaryHero overlay="gradient" overlayOpacity={90} height={600}
Buttons:    rounded-lg bg-[#44883E] px-6 py-3.5 font-semibold text-white
Trust chip: rounded-full bg-[#44883E]/10 px-3 py-1 text-sm font-medium text-[#2C5234]
Proof band: bg-[#2C5234] text-green-300 (stats) text-white (labels)
```
