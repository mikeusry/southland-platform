# Mothership + Site Audit: Overlap & Integration Plan

**Status:** Documented 2026-03-22. Not yet addressed. Two systems work independently but don't talk to each other.

## Architecture: Who Owns What

The separation is intentional. These are not duplicates — they answer different questions.

**Mothership (Data/Vector Layer):**
- Source of truth for: indexed page *content*, persona similarity, content-to-content similarity, brand voice vs transcripts
- Questions it answers: "What does the live site currently say?" "Which content is similar to X?" "Which persona does this piece sound like?"

**Site Audit + persona-profiles (Ops/Workflow Layer):**
- Source of truth for: route registry, pipeline/owner/blocker, JTBD coverage, plays, missions
- Questions it answers: "What pages should exist?" "Where are we in the workflow?" "Which persona jobs are covered/gaps?"

The relationship is **sequence, not deduplication.** Content flows from Site Audit (planned → built → shipped) into Mothership (crawled → embedded → scorable). See [docs/CONTENT-LIFECYCLE.md](CONTENT-LIFECYCLE.md) for the full sequence.

## The Two Systems

### Mothership (Data/Vector Layer)

**Repo:** `~/CODING/mothership/`
**Database:** Southland Supabase (`vjwjbcfnpygvybdooiic`)

| What | How | Where |
|------|-----|-------|
| Content inventory | Apify crawls live site, stores in `website_content` table | 213 pages indexed, embeddings via `text-embedding-ada-002` |
| Persona scoring | `match_personas` RPC — vector similarity against 3 persona embeddings | Only 3 personas seeded: Bill, Betty, Taylor |
| Content gap analysis | `match_content` RPC — find similar existing pages by embedding | Threshold 0.7 = OK, 0.85 = CONFUSED, 0 results = ORPHAN |
| Brand voice scoring | `search_voice_chunks` RPC — similarity against Allen Reynolds transcripts | Mothership Supabase (`zpjvhvyersytloyykylf`), 283+ video transcripts |
| Re-index trigger | **Manual.** `python scripts/crawl-and-embed-site.py --site southland` | ~5-10 min, requires Apify token + OpenAI key |

### Site Audit (Ops/Workflow Layer)

**Repo:** `~/CODING/southland-platform/`
**File:** `apps/astro-content/src/lib/site-audit-pages.ts`

| What | How | Where |
|------|-----|-------|
| Content inventory | Manually maintained TypeScript array (`PAGE_GROUPS`) | ~50 pages registered, grouped by section |
| Persona assignment | Hardcoded `persona` field per page entry | 10 personas defined (Bill, Betty, Taylor, Sam, Gary, Hannah, Maggie, Bob, Tom, Greg) |
| Pipeline tracking | `pipeline` field: no-copy → copy-draft → copy-approved → built → design-review → shipped | Per-page workflow status |
| Blocker tracking | `blocker` field: copy / dev / design / data | Per-page blocker |
| JTBD coverage | `persona-profiles.ts` — covered / partial / gap per persona | 10 personas × 6 jobs each = 60 JTBD items |
| Plays & missions | `persona-profiles.ts` — marketing campaigns with targets and deadlines | Per-persona, hardcoded |
| Page count per persona | Computed from `PAGE_GROUPS` by matching `persona` slug | Feeds persona pipeline table |

---

## Where They Overlap

### 1. Persona Definitions — TWO SOURCES OF TRUTH

| Aspect | Mothership | Site Audit |
|--------|-----------|------------|
| Personas defined | 3 (Bill, Betty, Taylor) | 10 (+ Sam, Gary, Hannah, Maggie, Bob, Tom, Greg) |
| Storage | Supabase rows with embeddings | TypeScript objects in `persona-profiles.ts` |
| Scoring | Vector similarity (content → persona embedding) | Manual assignment (human tags page with persona slug) |
| Used by | `/api/site-audit/scan` persona axis | `/admin/personas/` pipeline table, `/admin/site-audit` page registry |

**Problem:** Mothership only knows about 3 personas. The persona scoring in site-audit scans will never detect Sam, Gary, Hannah, Maggie, Bob, Tom, or Greg because they don't exist as embeddings in Supabase.

**Impact:** The "Primary: Backyard Betty at 61%" scan result (screenshot) only compares against 3 options. If the content is actually best suited for a new persona, it can't tell you.

### 2. Content Inventory — TWO REGISTRIES

| Aspect | Mothership | Site Audit |
|--------|-----------|------------|
| Source | Crawled live site (Apify) | Manually maintained TypeScript |
| Coverage | 213 pages (whatever's deployed) | ~50 explicitly registered pages |
| Freshness | Stale until re-crawl | Stale until developer updates the file |
| New content | Invisible until deployed + re-crawled | Invisible until added to `PAGE_GROUPS` |

**Problem:** New blog posts (like the 3 Betty guides) exist in neither system until:
1. Added to `site-audit-pages.ts` (done this session)
2. Deployed to pages.dev
3. Mothership crawl re-run

The content gap scan returns empty because the posts aren't on the live site yet, so `match_content` can't compare against them.

### 3. Content Gap Analysis — DEPENDS ON STALE DATA

The gap scan (`analyzeContentGap`) embeds the new content and searches Mothership's `website_content` for similar pages. But `website_content` only contains what was crawled last time. If the crawl is stale:

- New posts show as ORPHAN (no similar content found) even if related content exists
- Overlapping posts won't be flagged as CONFUSED because the duplicate isn't indexed yet
- The gap analysis is only as good as the last crawl

---

## Where They DON'T Overlap (Keep Separate)

| Capability | Owner | Why it stays |
|-----------|-------|-------------|
| Pipeline workflow (no-copy → shipped) | Site Audit | Mothership has no concept of content workflow |
| JTBD coverage tracking | Site Audit | Business strategy, not data infrastructure |
| Marketing plays & missions | Site Audit | Ops planning, not vector search |
| Brand voice scoring (transcript similarity) | Mothership | Requires 3072-dim embeddings + transcript chunks |
| BigQuery sync for attribution | Mothership | Data warehouse, not admin UI |
| Apify crawl infrastructure | Mothership | External service orchestration |

---

## The Handoff Gap

Today's workflow has a manual gap:

```
Developer writes content (southland-platform)
        ↓
Developer adds to site-audit-pages.ts (manual)
        ↓
Developer deploys to pages.dev (manual or CI)
        ↓
    ??? GAP ???
        ↓
Someone runs crawl-and-embed-site.py in mothership (manual)
        ↓
Content appears in Mothership Supabase
        ↓
Site audit scans can now find it for gap/persona analysis
```

**Nothing bridges the deploy → re-crawl step.** The content gap scan on the site audit page will show "run scan" / empty results for any content that hasn't been crawled.

---

## Options for Resolution

### Option A: Keep Separate, Fix the Handoff

**Effort:** Low (1-2 hours)
**What:** Add a post-deploy hook or reminder. Don't merge the systems.

1. After `pnpm build` deploys to Cloudflare Pages, trigger the Mothership crawl
2. Could be: GitHub Action in southland-platform that SSHs/calls mothership crawl
3. Could be: n8n workflow triggered by Cloudflare Pages deploy webhook
4. Could be: Manual step in deploy checklist ("after deploy, run `make crawl-southland` in mothership")

**Pros:** Minimal code change. Both systems keep working as-is.
**Cons:** Still two sources of truth for personas. New personas won't be scorable.

### Option B: Seed 7 New Personas into Mothership

**Effort:** Medium (half day)
**What:** Add the 7 new persona embeddings to Mothership Supabase so `match_personas` can score against all 10.

1. Write a seed script that takes each persona's narrative + values + pain points + language rules from `persona-profiles.ts`
2. Generate embeddings for each persona
3. Upsert into Mothership's persona table
4. Update `scorePersonas()` in `mothership.ts` to handle 10 personas instead of 3

**Pros:** Persona scoring works for all 10. Site audit scans become more accurate.
**Cons:** Two places to update when a persona changes (profiles.ts + Supabase). Need to keep in sync.

### Option C: Make Mothership the Source of Truth for Personas

**Effort:** High (1-2 days)
**What:** Move persona definitions from `persona-profiles.ts` into Mothership Supabase. Site audit reads from Supabase instead of local TypeScript.

1. Design a `personas` table in Southland Supabase with all fields from `PersonaProfile`
2. Build an API endpoint or direct Supabase query to fetch personas at build time
3. Replace `persona-profiles.ts` hardcoded data with fetched data
4. Admin pages become dynamic (read from Supabase, not static prerender)

**Pros:** Single source of truth. Edit personas in one place.
**Cons:** Adds runtime dependency on Supabase. Build-time fetch adds complexity. Prerendered admin pages would need to become SSR or use ISR. Significant refactor.

### Option D: Make Site Audit the Source of Truth, Push to Mothership

**Effort:** Medium-High (1 day)
**What:** Keep `persona-profiles.ts` as the canonical source. Add a sync script that pushes persona data + embeddings to Mothership on build.

1. `persona-profiles.ts` stays as-is (developer-friendly, version-controlled, reviewable)
2. Build step or CLI script: read profiles → generate embeddings → upsert to Mothership Supabase
3. Crawl script already handles content; persona sync handles the other half

**Pros:** Git remains the source of truth (reviewable, diffable). Mothership stays in sync automatically.
**Cons:** Need to run sync after persona changes. Adds a build dependency on OpenAI API.

---

## Recommended Path

### Now

1. **Option A (fix the handoff):** Document the manual step. Add "Re-run Mothership crawl" to the deploy checklist. See [docs/CONTENT-LIFECYCLE.md](CONTENT-LIFECYCLE.md).
2. **Option B (seed 7 new personas):** Add embeddings for Sam, Gary, Hannah, Maggie, Bob, Tom, Greg to Mothership so `match_personas` scores against all 10. This is the highest-value fix — persona scoring that only knows 3 of 10 is giving incomplete results.

### Long-term decision: Persona embeddings

The 10 personas in `persona-profiles.ts` are the canonical definitions. When they stabilize, re-embed all 10 into Mothership and retire the old 3-persona set. `persona-profiles.ts` stays the source of truth (version-controlled, diffable, reviewable). A sync script pushes to Mothership on demand. This is Option D.

**Do NOT make Mothership the source of truth for personas.** The profiles contain business strategy (JTBD, plays, missions) that belongs in Git, not a database.

### UI improvements (when time allows)

1. **Join key:** Store canonical URL in `site-audit-pages.ts`, match against `website_content.url` in Mothership. Site Audit drawer can then show: "Crawled: yes/no · Last crawled: date".
2. **Local vs Live indicator:** In site audit, show "State: Local only" vs "State: Live + Crawled" per page. Makes it clear why new posts don't have gap/persona scan results.
3. **Last crawled timestamp:** Display in Site Audit footer so stale vectors are visible.

---

## Related Files

| File | Repo | Purpose |
|------|------|---------|
| `scripts/crawl-and-embed-site.py` | mothership | Crawl + embed site content |
| `scripts/apify/southland-content-crawler.json` | mothership | Apify crawler config |
| `supabase/migrations/20241230000001_website_content_embeddings.sql` | mothership | website_content table schema |
| `supabase/migrations/20260219000001_fix_match_content.sql` | mothership | match_content RPC |
| `supabase/migrations/20260218000001_match_personas_rpc.sql` | mothership | match_personas RPC |
| `apps/astro-content/src/lib/services/mothership.ts` | southland-platform | Supabase client for scoring |
| `apps/astro-content/src/lib/persona-profiles.ts` | southland-platform | 10 persona definitions |
| `apps/astro-content/src/lib/site-audit-pages.ts` | southland-platform | Page registry |
| `apps/astro-content/src/pages/api/site-audit/scan.ts` | southland-platform | Scan endpoint |
