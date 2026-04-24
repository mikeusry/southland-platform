---
title: Ag & Culture Podcast — Production & Distribution Game Plan
date: 2026-04-24
status: v2 — Perplexity findings integrated + claims verified
owner: Mike Usry
stakeholders: Mike, Joseph, Claude, (future) editor
---

> **Status:** v1 was pre-research. v2 (this doc) incorporates Perplexity's 14-day calendar, asset matrix, publish-order analysis, email sequence benchmarks, and attribution recommendations. Every specific API / schema / tool claim was then verified against official docs — flagged below.
>
> **Verification summary:**
> - ✅ Klaviyo API `POST /api/campaigns/` and `POST /api/campaign-send-jobs/` exist (official docs) — Nexus can build + send campaigns end-to-end, no Zapier needed.
> - ❌ Klaviyo has **no native RSS trigger**. RSS blocks are content-only; they do not auto-send. Community confirms. → Game plan changed accordingly.
> - ✅ Schema.org `PodcastEpisode` supports `partOfSeries`, `datePublished`, `audio`, `video`, `duration`, `episodeNumber`, `actor` (via inheritance from Episode/CreativeWork/Thing).
> - ❌ Schema.org `PodcastEpisode` does NOT have a `transcript` property. Transcripts go in HTML body, not JSON-LD.
> - ❌ **Magellan AI is for ad buyers, not brand-owned podcast attribution.** Drop it from the stack. Use UTM + Klaviyo + GA4 + Nexus cohort analysis.
> - ⚠ Zapier "RSS → Klaviyo Send Campaign" works only with pre-built draft campaigns. Useful as a fallback, but Nexus API path is stronger.

# Podcast Operating System — Silky-Smooth Game Plan

> **North star:** Every episode is a **content asset** — not a file. One recording becomes a video, a podcast, a web page, an email, a shorts-pack, and a lead-gen magnet. Every asset must be **discoverable, attributable, and persona-routed**.

---

## The core problem

Joseph uploads episodes to Spotify / Apple / YouTube. Mike has been the only person able to produce the MDX episode page on the website (via Claude). These two tracks are **out of sync** — which means:
- Episodes go live on Spotify but not on southlandorganics.com/podcast
- No Klaviyo email fires when a new episode drops (list `WqRKi8` is dormant)
- YouTube titles/descriptions aren't optimized (Nexus YouTube audit tool exists but doesn't auto-run on new episodes)
- Derivative content (shorts, graphics, transcript blogs) either doesn't get made or gets made ad-hoc

**The fix:** One workflow, owned in Nexus, that treats each episode as a **record with a lifecycle state**. Every stakeholder sees the same checklist. Publishing to any channel flips a state bit.

---

## System architecture

```
                        ┌──────────────────────────────────────┐
                        │   NEXUS — Episode Record (source of  │
                        │   truth, content_documents table)    │
                        │                                      │
                        │   • Pre-production brief             │
                        │   • Recording metadata               │
                        │   • Post-production checklist        │
                        │   • Publish states per channel       │
                        │   • Derivative assets                │
                        │   • Attribution + analytics          │
                        └────────┬────────────────────┬────────┘
                                 │                    │
                 Pushes to ↓                          ↓ Pulls from
        ┌────────────────────┐             ┌────────────────────────┐
        │ southland-platform │             │  Spotify / Apple /     │
        │ (Astro MDX episode │             │  Overcast / YouTube    │
        │  page + RSS)       │             │  (via RSS + direct)    │
        └─────────┬──────────┘             └────────────────────────┘
                  │
                  ↓ triggers
        ┌────────────────────┐
        │ Klaviyo (list      │
        │ WqRKi8) — RSS      │
        │ → campaign        │
        └────────────────────┘
```

### Ownership matrix

| Layer | Tool | Owned by | Why |
|-------|------|----------|-----|
| Planning + brief | Nexus | Mike + Joseph | Keyword research, persona targeting, talking points |
| Recording | Existing setup | Joseph | Unchanged |
| Audio mastering | (TBD) | Joseph or editor | Could be Descript, Auphonic, or manual |
| Video editing | (TBD) | Editor | Mux + YouTube |
| Web publishing | Astro MDX | Claude / Mike (until Joseph has admin) | Generated from Nexus episode record |
| YouTube optimization | Nexus YouTube tool | Auto + Joseph review | Already built, Haiku suggestions live |
| Email | Klaviyo RSS-triggered | Set once, runs forever | No manual send |
| Social derivatives | (TBD) | Editor | Shorts, clips, quote cards |
| Attribution | Nexus analytics | Mike | Persona tagging + revenue tie-back |

---

## Episode lifecycle — 7 states

Each episode moves through these states in Nexus. Every state has an owner, a definition of done, and (where possible) an automated transition.

| # | State | Owner | Definition of done |
|---|-------|-------|--------------------|
| 1 | `planned` | Mike/Joseph | Topic selected, keyword targets set, persona targets set, guest confirmed, pre-production brief written |
| 2 | `recorded` | Joseph | Raw audio + raw video uploaded to Mux/R2, chapters timestamped |
| 3 | `edited` | Editor | Cleaned audio, YouTube video rendered, cover art in Cloudinary |
| 4 | `transcribed` | System | Full transcript with timestamps in `content_documents.episode_metadata.transcript` |
| 5 | `page_ready` | Claude/system | Episode MDX generated, SEO fields filled, PR merged to southland-platform |
| 6 | `published` | Joseph | Live on Spotify + Apple + YouTube; live on website; RSS updated |
| 7 | `amplified` | Editor/Mike | Email sent, derivatives (shorts, blog, social) shipped, first-week analytics captured |

State 5→6 is the critical sync point we don't currently have.

---

## Pre-production: the search-first brief

**Rule:** Don't write the brief from what Mike feels like talking about. Write it from what buyers are searching for.

### Brief template (lives on episode record in Nexus)

```
EPISODE BRIEF — Ag & Culture #NNN

Working title:               [first draft]
Target keyword(s):           [primary + 2 secondary]
Target persona(s):           [Betty / Bill / Taylor / Molly / general]
Search volume evidence:      [Ahrefs KD + volume, or Google Trends]
SERP analysis:               [top 3 competing pages — what do they cover?]
People Also Ask:             [3-5 questions surfaced from SERP]
Reddit/Quora threads:        [links to recent relevant threads]
Customer-support themes:     [tickets in last 30 days that map to this topic]
YouTube SERP:                [top 3 videos on same query — view counts, chapter structure]
Guest (if any):              [name, bio, why them]
Key talking points:          [8-12 bullets, each tied to a keyword/query]
Chapter plan:                [6-10 chapters, each answering a specific question]
CTA per persona:             [what product/page do we send listeners to?]
Related episodes:            [2-3 that cross-link]
Related blog posts:          [2-3 pillar pages that link to this episode]
Cross-sell product(s):       [SKUs surfaced on page]
```

### Where the data comes from

| Field | Source |
|-------|--------|
| Keywords | DataForSEO (already wired in Nexus) |
| SERP competitors | DataForSEO SERP API |
| People Also Ask | DataForSEO |
| YouTube SERP | YouTube Data API (already wired in Nexus) |
| Support themes | Nexus ticket queue |
| Reddit threads | Manual for now (Perplexity can help) |

---

## Production & post-production

### What Joseph does on record day
1. Record in Riverside/Descript (or current tool).
2. Upload raw audio → R2 (existing pattern). Upload video → Mux.
3. Fill in `recorded` state in Nexus: raw file URLs, chapter timestamps, guest consent form signed.

### What the editor does (or what we automate)
1. Audio: noise reduction, level matching, intro/outro bumpers.
2. Video: thumbnail selection, burn-in captions for first 15s.
3. Transcript: Whisper via `/api/work/tickets/transcribe` pattern (already built in Nexus) → write to `content_documents.episode_metadata.transcript`.
4. Chapter titles: pass transcript + draft titles through Nexus YouTube audit tool's chapter suggester.

---

## Web publishing — the missing sync

**Problem today:** Joseph can't create the MDX page. Only Mike/Claude can.

**Solution:** Generate MDX from the Nexus episode record automatically.

### Two-phase rollout

**Phase 1 — Now (no new code):**
- Joseph fills out the episode record in Nexus (title, description, chapter list, guests, topics, Mux playback ID, Spotify/Apple/YouTube URLs, cover image Cloudinary ID, related products).
- A Nexus action **"Generate MDX"** renders the episode file and either:
  - (a) Posts it as a PR to southland-platform via GitHub API, or
  - (b) Writes it to a shared folder for Mike/Claude to commit.
- Auto-fill SEO fields (metaTitle, metaDescription) from the brief's keyword targets.

**Phase 2 — Later:**
- Episode pages become SSR-rendered from the Nexus API (no MDX commit needed). Same schema, different source. This removes the GitHub round-trip entirely.

**Why not Phase 2 right now:** Astro MDX pages have better SEO caching and edge performance; rendering from API is a bigger change and doesn't solve Joseph's workflow problem — Phase 1 does.

---

## Distribution order — 14-day episode calendar

Perplexity's research recommended **near-simulcast, YouTube-primed 24–72h before site launch** for mid-size B2B/D2C ag brands. **Decision (Mike, 2026-04-24): 48h lead time.** YouTube video publishes 48 hours ahead of the website episode page + Klaviyo email. Reasoning: YouTube is a primary B2B search engine in 2026, so the 48h head-start gives the video a full day of organic discovery and indexing before we push email/paid traffic to the owned episode page. We can A/B across the first 6 episodes to validate.

### Full schedule

| Window | Action | Owner | Channel |
|--------|--------|-------|---------|
| **T−14 to T−10** | Search-first brief finalized (topic, keywords, personas, SERP review, PAA, YouTube autocomplete, support-ticket themes) | Mike + Joseph | Nexus brief |
| **T−9 to T−7** | Confirm guest; record main episode (30–40 min raw); log clip-candidate timestamps in Nexus | Joseph | — |
| **T−6 to T−4** | Rough-cut → final; transcript via Whisper; draft title/meta/show notes; generate schema JSON-LD | Editor + Claude | — |
| **T−3** | YouTube full video publishes (run through Nexus YouTube audit tool first); generate 2–4 Shorts candidates | Joseph | YouTube |
| **T−2** | Episode page publishes on southlandorganics.com/podcast (Mux embed, transcript in HTML, schema, FAQ, product modules); audio file to RSS | Claude/Mike | Site + RSS |
| **T−1** | Schedule Klaviyo campaign (via Nexus); draft LinkedIn + social copy | Mike + Nexus | — |
| **T0** | Email blast to podcast list + matched personas; YouTube goes public if staged unlisted; first Short drops | Nexus + Joseph | Email + YouTube + social |
| **T+1 to T+3** | Remaining 1–3 Shorts/Reels stagger; LinkedIn carousel; quote graphics | Editor + Mike | Organic social |
| **T+3 to T+5** | Value-forward follow-up email to non-clickers only (takeaways + clip) | Nexus | Email |
| **T+4 to T+7** | Companion SEO blog post (if topic warrants); analytics review | Claude + Mike | Site + analytics |

### Why website-first for email/paid traffic

Perplexity's recommendation: all **email, paid, and social links point to the episode page on your site**, never to Spotify/YouTube directly. Reasoning:

- Centralizes attribution (UTMs resolve on your domain, not a platform).
- Surfaces product modules and persona CTAs.
- Feeds the CDP persona engine — every play fires a pixel event.
- Compounds domain authority vs. platform authority.

YouTube and Spotify are **discovery channels**. Your site is the **conversion channel**.

---

## Email strategy — verified

### List: `WqRKi8` (Ag & Culture Podcast Subscribers) — exists, currently dormant.

### The Klaviyo trigger reality

**Verified against Klaviyo docs:** Klaviyo has **no native RSS-triggered campaign feature**. RSS feeds can be used as content *inside* a campaign template, but they do not auto-send when a new feed item appears. Zapier's Klaviyo integration can call "Send Campaign" on a pre-built draft, but cannot build+send a net-new campaign from an RSS item.

**What Klaviyo API actually supports (verified):**
- `POST /api/campaigns/` — create a campaign
- `POST /api/campaign-send-jobs/` — send a created campaign
- `PATCH /api/campaign-send-jobs/` — cancel a send

This means **Nexus owns the flow end-to-end**:

1. When an episode record moves to state `published`, Nexus calls `POST /api/campaigns/` with the episode's hook, cover, chapter list, and persona segment.
2. Nexus calls `POST /api/campaign-send-jobs/` to schedule or send immediately.
3. Reply attribution (opens, clicks, revenue) is pulled back via Klaviyo API into the episode record.

**Fallback:** Zapier + pre-built draft campaign template. Lower reliability, but zero-code. Use this while the Nexus integration is still being built.

### Signup surfaces

- Already wired: [EmailCapture.astro](apps/astro-content/src/components/shared/EmailCapture.astro) sets `podcast_subscriber: true` profile property when context is podcast.
- Place the component on: `/podcast/` hub, every episode page (bottom), homepage (if persona=general), footer.

### Send pattern (v1 — verified 2-touch, per Perplexity research)

Perplexity found that indiscriminate multi-touch per episode increases unsubscribes. The winning pattern for weekly/bi-weekly B2B shows is **2 touches**:

**Touch 1 — Launch campaign (T0)**
- Subject patterns: `"New: [Outcome] for [Persona] with [Guest]"` or `"How to cut [problem] on your farm"`
- Segment: only personas strongly matched to topic (don't blast all personas)
- Body: hero image → 2–3 bullets (problems solved) → primary CTA to episode page → secondary CTA to related product
- Source subject/hook from the `hook` field already in the episode MDX schema

**Touch 2 — Value follow-up (T+3 to T+5)**
- **Send only to non-clickers** from Touch 1 (Klaviyo segment filter)
- Subject patterns: `"3 takeaways from this week's Ag & Culture episode"` or `"A simple trick from [guest]"`
- Body: distilled tip/checklist from the episode, 30-sec clip or pull-quote, CTA to episode page
- Optional enhancement to **regular newsletter** rather than a standalone send, if list fatigue shows up

### What we are NOT doing

- ❌ 3-touch per episode for every episode. List fatigue trap.
- ❌ Sending to the full list regardless of persona match. Lowers engagement baseline.
- ❌ Subject-line keyword stuffing.
- ❌ Auto-sending via a feature that doesn't exist (Klaviyo's native "RSS trigger" is not real).

---

## YouTube — use the Nexus audit tool you already built

Every new episode, after publish:

1. Syncs automatically via `/api/cron/youtube-sync` (daily 02:00 ET).
2. Nexus audit runs, scores the video.
3. If score <80, Nexus flags it and suggests title/description/chapter fixes (Haiku already wired).
4. Joseph reviews suggestions, applies fixes in YouTube Studio.
5. `mark-fixed` captures baseline view count for 30-day lift tracking.

**This is already 95% built.** No new code needed except: make sure each new podcast episode has its `primary_keyword` set in the Nexus episode record, so the audit knows what to score against.

---

## Derivative asset matrix — verified, ranked

Perplexity's ranking, ranked by **value-per-minute-invested**. Numbers are editor hands-on minutes (AI-assisted), not wall-clock.

### Must tier — do every episode

| Asset | Effort (min) | ROI signal | Owner |
|-------|--------------|-----------|-------|
| Optimized YouTube full video (title, desc, chapters, tags via Nexus audit tool) | 45–60 | Search discovery, long-tail views, retargeting seed. YouTube is a primary B2B search engine in 2026. | Editor + Nexus |
| Episode landing page on Astro with embedded player, full transcript, schema, internal links, product modules | 60–90 | Highest long-term ROI — evergreen SEO, AI-citation, attribution anchor | Claude/Nexus |
| Conversion-oriented show notes (300–700 words, scannable) | 30–45 | Organic search, LLM snippets | Claude from transcript |
| 1 primary email campaign to `WqRKi8` + persona-matched segments | 45–60 | Repeat touch on ICP, revenue attribution | Nexus + Klaviyo API |
| 2–4 vertical Shorts/Reels (30–90s chapter highlights) | 60–90 total | Reach, awareness, guest amplification — core discovery driver, not optional | Editor |
| 1 LinkedIn post from Mike + company page | 30–40 | B2B reach, partnership signal, guest's network amplifies | Mike + Joseph |

### Should tier — add when bandwidth allows

| Asset | Effort | ROI signal | Owner |
|-------|--------|-----------|-------|
| SEO-extended blog post (longer body on same URL or companion `/blog` post) | +60–90 incremental | Evergreen search, backlink target | Claude |
| Persona-specific CTAs + product modules on episode page | 20–30 | Revenue, attribution clarity | Mike + Claude |
| Quote graphics (2–3) for LinkedIn, Instagram, X | 30–45 | Shareability, guest ego-bait | Editor |
| Gated playbook/checklist PDF when episode has process content | 90–120 | MQL capture | Mike + editor |
| LinkedIn carousel (3–5 takeaways) | 60 | High engagement, saves, shares | Editor |
| Nurture-flow insert — 1–2 "insight" emails reusing clips in persona sequences | 30–40 | Non-subscriber exposure | Mike + Klaviyo |

### Optional tier — usually traps

| Asset | Why skip by default |
|-------|--------------------|
| 10–20 micro-clips per episode | Diminishing returns, editorial fatigue, content theater |
| Standalone transcript page | Redundant with integrated transcript on episode page |
| Long-form PDF recap | Weaker for search than blog; better as on-page content |
| Dedicated TikTok chapter sequences per episode | Highly variable for ag B2B; only works when visually demonstrable |
| Static audiograms for X/LinkedIn | Outperformed by true video clips in 2026 |

**Rule enforced:** Anything below Must is optional until Must tier has 4+ weeks of data. Don't add Should-tier work until v1 shows lift.

---

## AI-search & LLM citation on-page checklist — verified

**Verified against Schema.org docs.** PodcastEpisode properties confirmed: `name`, `description`, `partOfSeries`, `datePublished`, `associatedMedia`, `audio`, `video`, `duration`, `url`, `episodeNumber`, `actor`.

**Important correction:** `transcript` is NOT a Schema.org property on PodcastEpisode. Don't put transcripts in JSON-LD. Transcripts belong in the HTML body (as plain, crawlable text) — which is what AI crawlers want anyway since they don't execute JS.

### Per episode page checklist

- [ ] `PodcastEpisode` JSON-LD with: `name`, `description`, `partOfSeries` (pointing to `PodcastSeries` for Ag & Culture), `datePublished`, `episodeNumber`, `duration` (ISO 8601), `url`, `associatedMedia` (pointing to the `AudioObject`/`VideoObject` with `contentUrl`)
- [ ] Separate `PodcastSeries` JSON-LD block for the show itself (once per page or site-wide)
- [ ] Full transcript rendered in HTML body, semantic headings, timestamps as plain text
- [ ] FAQ section at bottom sourced from the PAA (People Also Ask) captured in the brief, with `FAQPage` schema
- [ ] Clear entity links: guests → `/team/[slug]`, products → `/products/[handle]`, related episodes → `/podcast/[slug]`
- [ ] `llms.txt` episode entries — extend the existing llms.txt builder to list top episodes
- [ ] Canonical → apex host (already enforced site-wide)
- [ ] OG image = Mux thumbnail, 1200×630
- [ ] Link headers for audio + transcript URLs (follow AI-agent readiness round 2 pattern)
- [ ] Stable URLs — never change the `/podcast/[slug]` once published

---

## Attribution & analytics — verified stack

**Verified finding:** Magellan AI is for **podcast ad buyers**, not brands attributing their own show's listeners. Drop it from the stack.

**Verified approach (Perplexity + cross-check):** For a brand-owned podcast, attribution is UTM + owned analytics + cohort comparison, not 1:1 last-click. The goal is trend-level: "did episode-touched customers convert at higher rates than baseline?"

### The actual stack

| Layer | Tool | Role |
|-------|------|------|
| Link tagging | UTM convention (source=podcast, medium=audio, campaign=ep-[slug], content=[placement]) | All episode links (YouTube description, show notes, email, social) |
| Website events | pd-attribution.js + Nexus events API | Page load, play start, play 50%, related-product click, cart-add from episode page |
| Email metrics | Klaviyo campaign reporting + Klaviyo attributed revenue | Open, click, revenue per episode campaign |
| YouTube metrics | YouTube Analytics + audit tool's 30-day view-count delta | Retention curves, view growth post-fix |
| CDP persona | persona-worker + Supabase | Which personas are actually listening, persona shift after episode exposure |
| Cohort analysis | Nexus dashboard (queries BigQuery `shopify_orders` + Klaviyo profile data) | Compare "episode-touched" vs baseline cohort for LTV, repeat rate, AOV |

### What we track per episode

| Metric | Source | Purpose |
|--------|--------|---------|
| Website plays | pd-attribution.js + custom event | Which episodes drive site engagement |
| Email open/click rate | Klaviyo | Validates subject lines + send time |
| Klaviyo-attributed revenue | Klaviyo | Does the episode email drive sales? |
| YouTube retention | YouTube Analytics | Which chapters hold attention |
| YouTube views → website | UTM on description links | Off-platform → owned |
| Persona of listeners | CDP persona engine | Who is actually listening? |
| Related-product add-to-cart from episode page | Shopify event | Direct commerce lift |
| Cohort LTV lift | Nexus vs BigQuery | Episode-touched vs baseline over 90 days |

### Persona routing

- Every episode tagged with target personas in Nexus.
- Episode page reads visitor persona via `getPersonaId()`, surfaces persona-specific CTA via existing `<PersonaCTA>`.
- Post-listen pixel fire updates persona score (already built in persona-worker).

---

## Sync workflow — how nobody gets blocked

### Daily / weekly rituals

- **Monday 15-min stand-up (Mike + Joseph):** State review — what's in each state? What's blocking? Who's next?
- **Per-episode Nexus record:** Every comment, file, and state change lives there. No side-channel Slack threads about episodes.
- **Single notification rule:** When an episode state changes, the next-state owner gets a ping. No one checks manually.

### Nexus episode record — proposed fields

Building on the existing `content_documents.episode_metadata` schema:

```
episode_state:           enum of 7 lifecycle states above
state_owner:             user_id of current owner
target_keywords:         text[]
target_personas:         text[]
pre_production_brief:    jsonb (the search-first brief)
primary_keyword:         text (for YouTube audit link)
publish_date_planned:    date
publish_date_actual:     timestamptz
publish_checklist:       jsonb (per-channel flags: spotify_live, apple_live, youtube_live, website_live, email_sent)
derivatives:             jsonb (list of derivative assets + URLs)
analytics_7day:          jsonb (captured at T+7)
```

---

## What we're NOT building (yet)

- No custom Klaviyo flow logic beyond the verified 2-touch pattern. v2+ gets built only after v1 has 4+ weeks of data.
- No paid distribution (podcast ads, YouTube pre-roll) until organic retention is solid.
- No custom mobile app. Web + native podcast apps only.
- No multi-language transcripts. English-only.
- No separate podcast brand / second show. One show, one focus.
- No Magellan AI (wrong tool — built for ad buyers, not brand-owned shows).

## Failure modes — verified

From Perplexity's research, cross-checked against multiple B2B podcast ops guides. These are the traps:

1. **Over-production of low-impact derivatives.** Cutting 20–30 shorts per episode that never get properly promoted. "Content theater."
2. **Platform-only distribution.** Relying on Spotify/Apple pages as the canonical episode destination. Forfeits SEO, AI-citation, attribution.
3. **Keyword-stuffed show notes.** Penalized by search; natural structured content outperforms.
4. **No clear offer or next step.** Brand podcasts that never tell listeners what to do leave revenue on the table.
5. **Blasting episodes to the full list regardless of persona.** Increases unsubs, lowers baseline engagement.
6. **Analytics islands.** Podcast analytics, web analytics, email silo'd. Makes ROI invisible.
7. **Auto-blasting per Klaviyo's "RSS trigger" — which doesn't actually exist as a native auto-send.** Setting up a rumored feature and thinking you're done.

## Open questions to validate in practice (not worth more research)

- Does the 2-touch email pattern actually outperform 1-touch for Ag & Culture specifically? Measure from first 4 episodes.
- Which personas pay most attention to which topics? The pixel + cohort analysis will tell us.
- Is a 24–72h YouTube lead-time actually winning vs same-day simulcast? A/B across first 6 episodes.
- Do Shorts drive measurable episode page visits via UTM, or just platform-trapped views? UTM the Short description CTAs.

---

## Open questions → Perplexity brief

The unknowns that require outside research are enumerated in [PODCAST-PERPLEXITY-BRIEF.md](./PODCAST-PERPLEXITY-BRIEF.md). After Perplexity responds, this doc gets updated with:

- Verified asset matrix (currently "v1 — realistic" is my best guess)
- Verified publish-order data/case studies
- Verified email sequence benchmarks
- Verified AI-citation on-page patterns
- Verified attribution stack for 2026
- Verified RSS→Klaviyo automation pattern

---

## Next actions — verified punch list

Sequenced from highest leverage and lowest effort first. Each carries a repo tag — either `platform` (this repo) or `nexus` (southland-inventory).

### Platform (this repo) — can ship this week

1. **[platform]** Audit the current episode template's Schema.org JSON-LD. Add `PodcastEpisode` + `PodcastSeries` blocks with verified properties only (`name`, `description`, `partOfSeries`, `datePublished`, `associatedMedia`, `audio`, `video`, `duration`, `url`, `episodeNumber`, `actor`). Confirm transcript stays in HTML body, not JSON-LD.
2. **[platform]** Extend [public/llms.txt](apps/astro-content/public/llms.txt) builder to list all episode URLs. Keep the sha256 digest in `.well-known/agent-skills/index.json` in sync.
3. **[platform]** Add an FAQ block component to the episode template. Populates from an optional `faq` array in episode MDX frontmatter. Emits `FAQPage` JSON-LD.
4. **[platform]** Ensure `EmailCapture` component with podcast context is on: `/podcast/` hub, every episode page bottom, footer. (Currently wired but placement audit.)
5. **[platform]** Add UTM-building helper for episode links — `buildEpisodeUTM(episodeSlug, placement)` → used in share buttons, YouTube desc template, email links.

### Nexus — the big build

6. **[nexus]** Extend the episode record UI with the 7-state lifecycle + search-first brief fields (keywords, target personas, SERP PAA, YouTube autocomplete, support themes, chapter plan, clip candidates, CTA per persona).
7. **[nexus]** Build "Generate MDX" action. Takes the episode record, produces an MDX file matching the existing schema in [apps/astro-content/src/content/config.ts](apps/astro-content/src/content/config.ts), commits to southland-platform via GitHub API, opens a PR.
8. **[nexus]** Klaviyo integration service. On `published` state transition: build campaign via `POST /api/campaigns/`, send via `POST /api/campaign-send-jobs/`. Target list `WqRKi8` + persona segments. Subject from `hook` field. Record campaign ID + send job ID on the episode record.
9. **[nexus]** T+3-day non-clicker follow-up. Reads Klaviyo's "did not click" segment for the Touch 1 campaign, fires Touch 2 campaign with takeaway + clip.
10. **[nexus]** Link the episode record's `primary_keyword` to the existing YouTube audit tool — new episodes auto-enqueue for audit.
11. **[nexus]** Episode scoreboard dashboard — per-episode plays, email revenue, YouTube retention, cohort LTV lift. Pulls from Klaviyo API, YouTube Analytics, Supabase, BigQuery.

### Process — non-code

12. **Joseph onboarding** to Nexus episode record + brief template. 30-min walkthrough.
13. **Editor role** — decide internal vs contractor. Responsibilities: audio master, YouTube thumbnail, 2–4 Shorts, quote graphics.
14. **Monday 15-min sync** — Mike + Joseph review state of every in-flight episode. No side-channel Slack about podcast production.

---

## Decisions needed from Mike

- [ ] Approve the 7-state lifecycle as-is, or rework?
- [ ] Joseph gets Nexus access + trained on the brief template? Target date?
- [ ] Who owns the editor role (audio master, shorts, quote graphics)? Internal or contractor?
- [ ] Approve 2-touch email pattern (Touch 1 at T0 to persona-matched segments, Touch 2 at T+3 to non-clickers)?
- [ ] YouTube-first publish window: 24h, 48h, or 72h ahead of site launch? (Research leans 24–72h, pick one to standardize.)
- [ ] Greenlight the "Platform — can ship this week" punch list (items 1–5 above)?
- [ ] Who owns Nexus side — Claude in southland-inventory, or delegated?
