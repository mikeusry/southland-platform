# Page Creation Workflow — Southland Organics

Quick-reference for the full page pipeline. Master source: `/mothership/processes/page-creation-with-nlp.md`

---

## Flow

```
Research → Write → Build → Design → Screenshot → Review → Deploy → Track
```

---

## Step 1: Research Brief (One Command)

**Tool:** `scripts/research-brief.mjs` — generates keyword research + voice RAG + persona context in one shot.

```bash
# Basic — auto-detects persona from seed
node scripts/research-brief.mjs "soil health"

# With persona and page type
node scripts/research-brief.mjs "backyard chicken probiotics" --persona backyard --type blog

# Deep mode — expands top 3 keyword clusters
node scripts/research-brief.mjs "humic acid lawn care" --persona lawn --depth deep

# Topic page
node scripts/research-brief.mjs "soil health organic farming" --type topic
```

**Options:**

| Flag | Values | Default |
|------|--------|---------|
| `--persona` | `backyard`, `commercial`, `lawn` | auto-detect via vectors |
| `--type` | `blog`, `topic`, `landing`, `podcast` | `blog` |
| `--depth` | `standard`, `deep` | `standard` |
| `--skip-research` | (flag) | off |
| `--skip-voice` | (flag) | off |

**Output:** `briefs/{slug}-{date}.json` + `briefs/{slug}-{date}.md`

The brief contains:
- **Keyword clusters** — volume, KD, intent, questions
- **Voice samples** — knowledge + style chunks from Mothership transcript RAG
- **Brand knowledge** — company messaging, playbook, product context
- **Field constraints** — char/word limits per page type (matches TinaCMS schema)

**For collection pages:** Use the full Mothership 7-step pipeline instead (`/mothership/scripts/content-migration/`). This lighter tool is for everything else.

---

## Step 2: Write in Southland Voice (Vectors)

**Persona system:** Supabase pgvector embeddings (`text-embedding-3-small`)

```bash
# Check persona fit via API
POST /api/content-score
{
  "mode": "light",
  "title": "...",
  "body": "...",
  "segment": "poultry" | "turf" | "agriculture"
}
```

**Thresholds:**
| Score | Status |
|-------|--------|
| ≥ 75% | Strong alignment |
| ≥ 60% | Aligned (publishable) |
| 40-59% | Weak — rewrite needed |
| < 40% | **BLOCKER** — content blocked |

**Voice guidelines per persona:**

| Persona | Tone | Language |
|---------|------|----------|
| Backyard Betty | Warm, encouraging, practical | "your flock", "healthy eggs", "backyard" |
| Broiler Bill | Professional, results-focused | "FCR", "mortality", "ROI", "operation" |
| Turf Pro Taylor | Technical, efficiency-driven | "application rate", "turf quality", "coverage" |
| General | Educational, approachable | Plain language, benefit-focused |

**Content scoring:** See [MOTHERSHIP-INTEGRATION.md](apps/astro-content/docs/MOTHERSHIP-INTEGRATION.md) for full API contract.

---

## Step 4: Build the Page

```bash
# Start dev server
pnpm --filter @southland/astro-content dev
```

### For Astro pages:
- Use existing component library (Hero, FAQ, CTA sections)
- Add structured data (JSON-LD)
- Persona-aware content via `<PersonaContent>` components

### For TinaCMS content (blog/podcast/topics):
- Create `.mdx` in appropriate content collection
- Fill frontmatter: keywords, segment, relatedProducts, metaTitle, metaDescription
- Example: `src/content/topics/soil-health.mdx`

---

## Step 5: Design Agent Review

**Mandatory 2-pass review.** Use `/design review` skill.

### Pass 1 — Senior Designer
Analyzes: visual hierarchy, whitespace, typography scale, component consistency, mobile viability.

### Pass 2 — Polish
Refines: orphaned elements, icon consistency, CTA variety, hover states, micro-details.

### Final Checklist
- [ ] Eye flows to CTAs
- [ ] Most important info most prominent
- [ ] Whitespace intentional
- [ ] Components match design system
- [ ] No inline styles that should be components
- [ ] Hover states work
- [ ] Text readable without zoom (mobile)
- [ ] Buttons tappable (44px min)
- [ ] No horizontal scroll
- [ ] No orphaned grid items
- [ ] Icons are SVGs (not emoji)
- [ ] CTA copy varies by position

---

## Step 6: Playwright Screenshots

**Script:** `apps/astro-content/scripts/screenshots.mjs`

```bash
# Prerequisite (one-time)
npx playwright install chromium

# Capture (dev server must be running on :4400)
node apps/astro-content/scripts/screenshots.mjs
```

**Output:** `apps/astro-content/screenshots/` (gitignored)

**Viewports:** Desktop (1440×900), Mobile (375×812)

**Edit page list** in `screenshots.mjs` to target current work.

---

## Step 7: AI Review Loop

Feed screenshots to multiple reviewers:

1. **Claude** — `/design review` with screenshots
2. **ChatGPT** — Upload 3-5 screenshots + brand palette prompt
3. **Perplexity** — Research-backed design critique

Before/after comparison: take screenshots before changes, then after, feed both sets.

---

## Step 8: Deploy & Track

```bash
git add [specific files]
git commit -m "Add [page-name] page"
git push  # auto-deploys to CF Pages
```

**Post-deploy:**
1. Request GSC indexing
2. Insert tracking record in Supabase `content_tests`
3. Schedule t+30/60/90 performance reviews

**Success metrics (at t+90):**

| Metric | Success | Partial | Failed |
|--------|---------|---------|--------|
| Position | Improved 5+ | Improved 1-4 | Same/worse |
| Impressions | 2x+ baseline | 1.5x baseline | < baseline |
| CTR | Above 3% | 1-3% | < 1% |

---

## Quick Commands

```bash
# Research brief (all page types except collections)
node scripts/research-brief.mjs "keyword phrase" --type blog --persona backyard

# Dev server
pnpm --filter @southland/astro-content dev

# Content score check (persona alignment)
curl -X POST http://localhost:4400/api/content-score \
  -H "Content-Type: application/json" \
  -d '{"mode":"light","title":"...","body":"...","segment":"poultry"}'

# Screenshots
node apps/astro-content/scripts/screenshots.mjs

# Design review
/design review

# Collection pages (full pipeline — run from mothership)
cd /Users/mikeusry/CODING/mothership
node scripts/content-migration/migrate-collection.js --handle [slug]
```

---

## Source References

| Doc | Location |
|-----|----------|
| Master process | `/Users/mikeusry/CODING/mothership/processes/page-creation-with-nlp.md` |
| Screenshot workflow | `/Users/mikeusry/CODING/mothership/docs/context/screenshot-workflow.md` |
| Content scoring API | `apps/astro-content/docs/MOTHERSHIP-INTEGRATION.md` |
| SEO brief tool | `/Users/mikeusry/CODING/southland-sep/scripts/generate-seo-brief.js` |
| Persona creation | `/Users/mikeusry/CODING/mothership/processes/persona-creation-and-labeling.md` |
| Example tracking | `topics/organic-vs-natural-series.md` |
