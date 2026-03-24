# AI Search Content Initiative — March 2026

## Why This Exists

Google article ([AI Excellence: Customer Decision Journey](https://business.google.com/us/think/ai-excellence/customer-decision-journey-ai-search)) revealed that AI search compresses the buy journey into a single session. Brands win by being **recognized as solutions to specific situations**, not by being the loudest product in a category.

**Key insight:** AI Overviews appear on 100% of our target queries but cite Southland on 0% of them — even when we rank #1 organically. Product pages don't get cited. Structured, educational, problem-first content does.

---

## AI Visibility Audit (March 20, 2026)

### Methodology
10 situation-framed queries tested across Google organic results + AI Overviews.

### Results: 4/10 visible, 0/10 cited in AI Overview

| # | Query | Visible? | Position | AI Overview Cites Us? |
|---|-------|----------|----------|-----------------------|
| 1 | "how to reduce ammonia in a poultry house naturally" | **No** | — | No |
| 2 | "best organic litter treatment for broiler houses" | **Yes** | **#1, #3** | No (but mentioned) |
| 3 | "natural alternatives to chemical poultry treatments" | **No** | — | No |
| 4 | "best organic soil amendment for golf course greens" | **Yes** | **#1** | No |
| 5 | "how to improve soil health on bermuda grass fairways" | **No** | — | No |
| 6 | "organic lawn treatment for southern clay soil" | **No** | — | No |
| 7 | "best natural fertilizer for warm season grass" | **No** | — | No |
| 8 | "organic soil conditioner for row crops" | **Yes** | **#2, #10** | No |
| 9 | "how to improve soil biology in farm fields" | **No** | — | No |
| 10 | "natural sanitizer for food processing facilities" | **Yes** | **#1** | No |

### Pattern
- **Product/commercial queries** (2, 4, 8, 10) → we rank because product pages match
- **Problem/situational queries** (1, 3, 5, 6, 7, 9) → invisible, no content exists
- **AI Overviews** pull from structured educational content (extension services, how-to guides) — not product pages

### Who Beats Us
- University extensions (UGA, USGA, UMN, NRCS)
- Trade publications (The Poultry Site, Golfdom)
- Big brands with roundup placement (Milorganite, Espoma in HGTV/Home Depot lists)
- Academic papers (PMC/NIH)

---

## What We Built

### 6 Pillar Pages (New Blog Posts)

Files in `apps/astro-content/src/content/blog/`:

| File | Target Query | Segment | Products Mentioned |
|------|-------------|---------|-------------------|
| `how-to-reduce-ammonia-in-poultry-house-naturally.mdx` | Query 1 | poultry | Litter Life, Big Ole Bird |
| `natural-alternatives-to-chemical-poultry-treatments.mdx` | Query 3 | poultry | Litter Life, Big Ole Bird, Desecticide, ZeroPoint |
| `organic-soil-health-bermuda-grass-fairways.mdx` | Queries 4+5 | turf | Omega, Jump Start, Genesis |
| `how-to-fix-southern-clay-soil-organically.mdx` | Query 6 | turf | Revival, Jump Start, Genesis |
| `best-organic-fertilizers-warm-season-grass.mdx` | Query 7 | general | FertALive, Jump Start, Omega |
| `building-soil-biology-farm-fields.mdx` | Query 9 | agriculture | Jump Start, Omega, Genesis |

**Content principles:**
- Problem-first framing — lead with the situation, not the product
- Products appear as ONE option among several (not a sales pitch)
- Structured for AI extraction: clear H2/H3 headings, bullet lists, comparison tables, FAQ sections
- 1,500-2,000 words of substantive, technical content
- E-E-A-T: author attribution (mike-usry), specific data, practical advice
- Each has 5-7 FAQ questions for FAQPage schema
- References Ag & Culture podcast episodes where relevant

### 4 Collection Page Upgrades (FAQ + Data)

Files in `apps/astro-content/src/content/shopCollections/`:

| File | Current Rank | Changes |
|------|-------------|---------|
| `golf-courses.mdx` | #1 for query 4 | +3 FAQs, existing answers upgraded with specific data (rates, costs, CEC) |
| `sanitizers.mdx` | #1 for query 10 | +3 FAQs, added EPA regs, ppm concentrations, pathogen kill claims |
| `poultry-broilers.mdx` | Supports query 2 | +3 FAQs, added FCR benchmarks, ammonia thresholds, mortality data |
| `crops.mdx` | Supports query 8 | +3 FAQs, added ROI timeline, application timing, university trial data |

**What changed in existing FAQs:**
- Removed "Our [Product Name]" promotional language
- Added specific numbers: concentrations, rates, costs, data points
- Wrote as university extension service, not salesperson
- AI Overviews prefer concise factual answers — kept to 2-4 sentences each

---

## Video Assets Available (Mux)

For embedding in pillar pages via `<VideoEmbed>` component:

| Topic | Best Video | Mux Playback ID | Match |
|-------|-----------|-----------------|-------|
| Poultry ammonia/litter | Ep 6: Backyard to Commercial | `DzMjTY0247e48Tjk01015W1XPmK3ekivbtzeP7yCOe4k34` | Moderate |
| Natural poultry treatments | Ep 1: Invisible Economy | `5QJ01eBw11CKsXey3I6nKXFpda1EqMiPySDj5NmA7uyQ` | Strong |
| Bermuda/golf soil health | Ep 5: Lawn & Garden | `W6OPMUQfTof00nVGEFFPk4MjXrpH9t029Bpi02T027qBHpE` | Weak |
| Southern clay soil | Ep 5: Lawn & Garden | `W6OPMUQfTof00nVGEFFPk4MjXrpH9t029Bpi02T027qBHpE` | Moderate |
| Warm season fertilizer | Ep 3: Fertilizer Not Working | `VdxQA3Mdt02nO02LTvkiGMP8P9msVbx54Wf7I3UqJcpiY` | Moderate |
| Farm soil biology | Ep 1 + Ep 2: Humic vs Fulvic | `5QJ01eBw11CKsXey3I6nKXFpda1EqMiPySDj5NmA7uyQ` / `FiKRkXWNINnIC400z02tqEiY02o9JFa8ddz1HWUEABWNhs` | Strong |

**"Why Southland" brand videos** (7 total, generic — not topic-specific):
- Introduction: `n9Ue00D3CPCVEOzO00ALHxWt01XVYjuJMRHI6wjmOgjdxQ`
- Science: `LHOfdzXN6Ir00XQ8ddEb01CTD1LSdVx3OUpbqtHwJuGWU`
- Small Batch: `t58AWZo6gJgarOJub01HjmKgFwEHKHNudmVg01gKGTXAw`

### How to Embed Videos

```mdx
import VideoEmbed from '../../components/podcast/VideoEmbed.astro'

<VideoEmbed
  muxPlaybackId="5QJ01eBw11CKsXey3I6nKXFpda1EqMiPySDj5NmA7uyQ"
  title="The Invisible Economy Under Your Feet"
  episodeNumber={1}
  episodeSlug="ep-001-invisible-economy"
/>
```

---

## Google Ads PMax Rewrite

**Doc location:** `mothership/docs/advertising/campaigns/southland-pmax-situation-rewrite-2026-03.md`

### The Problem
Current PMax headlines are product-first: "Hen Helper - #1 Poultry Probiotic", "Big Ole Bird Probiotics", "Natural Weed Killer"

### The Fix
Situation-first framing: "Cut Poultry Ammonia 60%", "Stop Barn Mites Naturally", "Fix Clay Soil This Season"

### Campaigns Rewritten (7 asset groups total)

| Campaign | Asset Groups | Key Situation Angles |
|----------|-------------|---------------------|
| Poultry Supplements ($150/day) | Probiotics, Supplements, Brand | Ammonia, FCR, chick mortality, gut health |
| Desecticide ($100/day) | Equine, Livestock, Poultry Pest | Horse scratching, barn mites, darkling beetles |
| Torched ($75/day seasonal) | Natural Seekers | Pet-safe yard, clay soil, Roundup alternative |

### A/B Test Plan
- Keep 5 best-performing existing headlines
- Swap 10 with situation-framed versions
- Replace ALL long headlines and descriptions
- Monitor asset labels for 2 weeks
- Commit or iterate at week 4

---

## Launch Week Schedule (Mar 30 – Apr 4)

**Blocker:** Astro site must be live on `southlandorganics.com` (DNS cutover) before any of this matters. Blog posts and pillar pages only exist on `pages.dev` staging until then. Schedule shifted 7 days from original (was Mar 23-28).

Tasks tracked in Nexus at `/hr/todos` (13 tasks, all assigned to Mike).

| Day | Tasks |
|-----|-------|
| **Mon 3/30** | Review pillar pages, commit + deploy, verify Rich Results |
| **Tue 3/31** | Google Ads review — swap PMax headlines + search themes |
| **Wed 4/1** | Embed Mux videos in pages, upload 3 to YouTube for PMax |
| **Thu 4/2** | Re-run 10-query audit, submit URLs to GSC, set up rank tracking |
| **Fri 4/3** | Check indexing status + PMax asset labels |
| **Fri 4/10** | Week 2: audit comparison + PMax A/B decision |

---

## Measurement Plan

### Baseline (Pre-Launch — March 20)
- Organic visibility: 4/10 queries
- AI Overview citations: 0/10 queries
- PMax headlines: product-first (15.2x ROAS on poultry, 2.0x on Torched)

### Week 2 Check (April 10)
- Re-run all 10 queries
- Document organic position changes
- Check AI Overview citations
- PMax asset label performance (Best/Good/Low)

### Week 4 Check (April 24)
- Full audit re-run
- PMax A/B final decision
- GSC click/impression data for new pages
- Decide: iterate content, add more pillar pages, or expand to new verticals

### Success Criteria
- **Minimum:** 6/10 queries visible (up from 4/10)
- **Target:** 2+ queries cited in AI Overview
- **PMax:** Situation headlines match or beat product headlines on CTR
- **Traffic:** New pillar pages generating organic clicks within 4 weeks

---

## Content Creation Pattern (For Future Pillar Pages)

### Blog Post Template

```yaml
---
title: "How to [Solve Problem] [Naturally/Organically]"
publishDate: YYYY-MM-DD
description: "Under 160 chars, problem-first"
author: mike-usry
segment: poultry | turf | agriculture | general
tags: ["Topic1", "Topic2"]
featuredImage: ""
relatedProducts: ["product-handle-1", "product-handle-2"]
relatedEpisodes: ["ep-slug"]
draft: false
---

## The Problem (1-2 paragraphs with specific data)
## Method 1: [Most Accessible Solution]
## Method 2: [Next Option]
## Method 3: [Where Our Products Fit — as ONE option]
## Comparison Table (chemical vs natural, or product vs product)
## Seasonal/Timing Guide
## Common Mistakes
## FAQ (5-7 questions, concise factual answers)
## Key Takeaways (numbered list)
```

### Rules
1. **Problem first, product second** — always
2. **Specific data** — ppm, CFM, $/acre, FCR ratios, not vague claims
3. **Honest comparisons** — include competitors with real pros/cons
4. **Structured for AI** — H2/H3 headings, bullet lists, tables, FAQ schema
5. **Products are ONE solution** — never "our product is the best", always "biological amendments like [product] can..."
6. **Reference episodes** — link to Ag & Culture where relevant for authority
7. **Author attribution** — always `mike-usry` for E-E-A-T

---

## Related Docs
- [CDP Playbook](SOUTHLAND-CDP-PLAYBOOK.md) — Persona-driven content strategy
- [Shopify Nexus Architecture](../../../southland-inventory/docs/SHOPIFY-NEXUS-ARCHITECTURE.md) — Multi-store integration
- PMax Rewrite: `mothership/docs/advertising/campaigns/southland-pmax-situation-rewrite-2026-03.md`
- AI Audit raw data: conducted in Nexus repo session, March 20, 2026
