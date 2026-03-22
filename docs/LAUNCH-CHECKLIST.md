# Launch Checklist — Persona System + Content Infrastructure

**Created:** 2026-03-22
**Strategy:** Deploy first. Wire the systems. Then let data drive what content to build next.

The previous approach was "build all the content, then deploy." That's backwards — we can't validate persona scoring, content gap analysis, or JTBD coverage without live data flowing through the systems. Deploy what we have, connect the pipes, then build from insight instead of guessing.

---

## Phase 1: Deploy (Day 1)

Everything built this session ships to pages.dev.

### Code changes to commit

| File | What changed |
|------|-------------|
| `src/lib/persona-profiles.ts` | 10 personas (was 3). Full profiles for Sam, Gary, Hannah, Maggie, Bob, Tom, Greg |
| `src/lib/site-audit-pages.ts` | Persona type expanded to 10 slugs. PERSONA_DISPLAY for all 10. Betty lander marked shipped. Breeder/turkey/game-bird assigned to Bob/Tom/Greg. Betty Content group added (3 posts) |
| `src/pages/admin/personas/index.astro` | Pipeline table (was cards). Underline tabs, left border accent, status tokens |
| `src/pages/admin/personas/[slug].astro` | getStaticPaths from PERSONAS array (was hardcoded 3) |
| `src/content/blog/whats-wrong-with-my-chicken-symptom-guide.mdx` | New — Betty diagnostic guide |
| `src/content/blog/backyard-chicken-dosing-guide.mdx` | New — Small flock dosing tables |
| `src/content/blog/new-chicken-owner-first-30-days.mdx` | New — First 30 days guide |
| `src/content/shopCollections/backyard-birds.mdx` | Added guide links at bottom |
| `src/pages/poultry/backyard/index.astro` | Added Section 7B resources grid |

### Deploy steps

```bash
# 1. Verify build passes locally
pnpm build

# 2. Commit
git add [files above]
git commit -m "feat: 10-persona system, pipeline table, Betty content"

# 3. Push — auto-deploys to Cloudflare Pages
git push

# 4. Verify on pages.dev
#    - /admin/personas/ — pipeline table with 10 rows
#    - /admin/personas/betty/ — command center with updated JTBD
#    - /blog/whats-wrong-with-my-chicken-symptom-guide/
#    - /blog/backyard-chicken-dosing-guide/
#    - /blog/new-chicken-owner-first-30-days/
#    - /poultry/backyard/ — resources section before final CTA
```

---

## Phase 2: Wire the Systems (Day 1-2)

Connect Mothership to the new content. This is the handoff that was previously a gap.

### 2a. Re-crawl the site

```bash
cd ~/CODING/mothership
python scripts/crawl-and-embed-site.py --site southland
```

~5-10 min. After this, all new pages are in Mothership's `website_content` table with embeddings.

### 2b. Seed 7 new persona embeddings

Mothership only has 3 persona embeddings (Bill, Betty, Taylor). The 7 new personas need embeddings so `match_personas` can score content against all 10.

```bash
# Script needs to be written — reads persona-profiles.ts,
# generates embeddings from narrative + values + pain points + language rules,
# upserts to Mothership persona table.
#
# TODO: Create scripts/seed-personas.py in mothership
```

**Input:** Each persona's `narrative` + `values` + `painPoints` + `languageRules.use` concatenated
**Output:** 7 new rows in Mothership persona table with embeddings

### 2c. Update scorePersonas mapping

After seeding, update `src/lib/services/mothership.ts` to handle 10 personas instead of 3.

Current `nameMap` only maps 3:
```typescript
const nameMap = {
  'broiler-bill': 'broilerBill',
  'backyard-betty': 'backyardBetty',
  'turf-taylor': 'turfTaylor',
}
```

Needs to map all 10 persona slugs.

### 2d. Verify integration

1. Go to `/admin/site-audit`
2. Run scan on one of the new Betty posts
3. Content gap scan should now return results (ORPHAN/WEAK/OK)
4. Persona scoring should show all 10 personas, not just 3

---

## Phase 3: Validate with Data (Day 2-3)

Now that systems are wired, use the data to validate what we built and plan what's next.

### 3a. Run site-audit scans on all new content

| Page | Expected persona | Check for |
|------|-----------------|-----------|
| What's Wrong With My Chicken? | Betty | Gap status, voice alignment, internal link count |
| Dosing Guide for Small Flocks | Betty | Gap status (should be ORPHAN — nothing like it exists) |
| First 30 Days With Chickens | Betty | Gap status, check for overlap with existing beginner posts |

### 3b. Audit the persona pipeline table

Look at the pipeline table at `/admin/personas/`. For each persona:

- Is the JTBD coverage accurate?
- Is the lander status correct (Live/Building/Greenfield)?
- Does the "Next Move" column show the right priority?

### 3c. Run content gap scans on ALL blog content

```bash
# Trigger full blog scan from site-audit UI
# or POST /api/site-audit/scan with { route: '/blog/[slug]', limit: 50 }
```

This tells you:
- Which existing posts are CONFUSED (near-duplicates that should be consolidated)
- Which are ORPHAN (filling a gap or off-topic)
- Where the real content gaps are — by persona, by funnel stage

### 3d. Check Betty's JTBD against scan results

Betty's profile says 4/6 jobs covered. Validate:

| Job | Status | Validation |
|-----|--------|-----------|
| Keep birds healthy without chemicals | Covered | Does the lander + Big Ole Bird content actually rank for this? |
| Diagnose sick birds | Covered (new) | Does the symptom guide show up in relevant searches? |
| Prevent seasonal problems | Partial | What content would close this? Scans may suggest existing posts to upgrade. |
| Get reliable advice without a vet | Covered (new) | All 3 new guides support this. Verify voice alignment. |
| Know dosing for small flocks | Covered (new) | Dosing guide is purpose-built. Check gap scan for overlap. |
| Feel confident doing right | Partial | Community proof / UGC needed. Not a content problem — it's a campaign problem. |

---

## Phase 4: Plan Next Content from Data (Day 3+)

**Do not write more content until Phase 3 is complete.** The whole point of deploying first is to let data drive decisions.

### What the data will tell you

1. **Content gap scans** → which personas have ORPHAN content (filling real gaps) vs which have CONFUSED content (duplicates to consolidate)
2. **Persona scoring** → which existing blog posts actually align with the new personas (Sam, Gary, Hannah, Maggie, Bob, Tom, Greg) — some of the 293 existing posts may already serve them
3. **JTBD coverage** → which gaps are real and which are already covered by content we didn't realize served that persona
4. **Voice alignment** → which new persona content sounds like Southland vs which needs rewriting

### Likely next actions (to be confirmed by data)

| Persona | Probable next step | Why |
|---------|-------------------|-----|
| Betty | Seasonal care calendar (partial JTBD) | Only remaining content gap after 3 new posts |
| Bill | Post-placement troubleshooting article (gap JTBD) | Biggest uncovered job |
| Taylor | Lander page at /lawn/ (greenfield) | No lander exists |
| Gary | Lander page at /lawn/golf/ (greenfield) | No lander, but pillar page + collection exist |
| Hannah | Lander page at /lawn/homeowner/ (greenfield) | Has subscription product, no lander |
| Sam | Lander page at /waste/ (greenfield) | Revenue-generating, zero targeting |
| Maggie | Lander page at /garden/ (greenfield) | Reachable via Betty's channels |
| Bob | Finalize /poultry/breeders/ copy (building) | Page built, needs copy review |
| Tom | Finalize /poultry/turkey/ copy (building) | Page built, needs copy review |
| Greg | Amplify Tuck Farms case study (building) | Page built, strongest social proof in portfolio |

---

## Docs Created This Session

| Doc | Purpose |
|-----|---------|
| [PIPELINE-DESIGN-PATTERN.md](PIPELINE-DESIGN-PATTERN.md) | Admin UI pattern spec: underline tabs, pipeline tables, no pills, no useless color |
| [MOTHERSHIP-SITE-AUDIT-OVERLAP.md](MOTHERSHIP-SITE-AUDIT-OVERLAP.md) | Architecture: who owns what, 3 vs 10 persona problem, integration options |
| [CONTENT-LIFECYCLE.md](CONTENT-LIFECYCLE.md) | Plan → Write → Audit → Ship → Crawl → Scan → Iterate |
| [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) | This doc |

## Related Docs

| Doc | Purpose |
|-----|---------|
| [AI-CONTENT-INITIATIVE.md](AI-CONTENT-INITIATIVE.md) | 6 pillar pages + FAQ upgrades (Mar 2026, mostly shipped) |
| [PAGE-WORKFLOW.md](PAGE-WORKFLOW.md) | Research → Write → Build → Design → Screenshot → Review → Deploy → Track |
| [SOUTHLAND-CDP-PLAYBOOK.md](SOUTHLAND-CDP-PLAYBOOK.md) | 4 personas (original), 10 journey stages, vector personalization |
