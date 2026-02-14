# Episode Release Workflow

Process for adding new podcast episodes to the Ag & Culture hub.

## Episode Template

Create new episode at `src/content/episodes/ep-XXX-slug.mdx`:

```yaml
---
title: "Episode Title Here"
episodeNumber: X
season: 1
publishDate: YYYY-MM-DD
description: "1-2 sentence hook for cards and RSS feed."
longDescription: |
  2-3 paragraph expanded description for episode page.
  Include what viewers will learn and why it matters.

muxPlaybackId: "abc123xyz"  # From Mux dashboard → Assets → Playback ID
thumbnail: "https://image.mux.com/abc123xyz/thumbnail.jpg"
duration: "MM:SS"
durationSeconds: XXXX

chapters:
  - time: 0
    title: "Introduction"
  - time: 60
    title: "Topic 1"
  # Add chapters at key topic transitions

guests:
  - name: "Guest Name"
    slug: "guest-slug"
    role: "Title, Company"
    bio: "Brief bio."

topics:
  - topic-slug-1
  - topic-slug-2

relatedProducts:
  - slug: "product-handle"
    name: "Product Name"
    cta: "Action phrase"

metaTitle: "SEO Title | Ag & Culture Podcast"
metaDescription: "SEO description targeting keywords."

draft: false
---

## What You'll Learn

Key points in bullet format...

## Key Takeaways

### Takeaway 1
Explanation...

## Who This Episode Is For

- Audience segment 1
- Audience segment 2
```

## Release Checklist

### Pre-Release
- [ ] Video uploaded to Mux
- [ ] Prep notes/interview questions ready
- [ ] SEO keywords identified

### Content Creation
- [ ] Get Mux Playback ID from dashboard (Assets → Playback IDs)
- [ ] Fetch video metadata (duration from Mux, thumbnail auto-generated)
- [ ] Write description from prep notes
- [ ] Map chapters to interview structure
- [ ] Add topics and related products
- [ ] Write MDX body content

### Technical
- [ ] Create `ep-XXX-slug.mdx` file
- [ ] Run `npm run build` to verify
- [ ] Test locally with `npm run dev`
- [ ] Commit and deploy

### Post-Release
- [ ] Verify live on Cloudflare Pages
- [ ] Check RSS feed includes episode
- [ ] Share on social channels

## Episode Roadmap

| Ep | Title | Status | Mux Playback ID | Notes |
|----|-------|--------|-----------------|-------|
| 1 | The Invisible Economy Under Your Feet | **LIVE** | `5QJ01eBw11CKsXey3I6nKXFpda1EqMiPySDj5NmA7uyQ` | Soil biology intro |
| 2 | Humic vs. Fulvic: The Difference That Actually Matters | **LIVE** | `FiKRkXWNINnIC400z02tqEiY02o9JFa8ddz1HWUEABWNhs` | Humic/fulvic acid |
| 3 | Why Your Fertilizer Isn't Working | **LIVE** | `VdxQA3Mdt02nO02LTvkiGMP8P9msVbx54Wf7I3UqJcpiY` | Fertilizer + soil biology |
| 4 | Carbon: The Most Misunderstood Element | **LIVE** | `H4g01qTbnQxqs01kdMhxF8zj025JPK17OZMvT8O4ctC834` | Carbon in agriculture |
| 5 | Healthy Soil Starts at Home | **LIVE** | `W6OPMUQfTof00nVGEFFPk4MjXrpH9t029Bpi02T027qBHpE` | Lawn & garden |
| 6 | From Backyard to Commercial | **LIVE** | `DzMjTY0247e48Tjk01015W1XPmK3ekivbtzeP7yCOe4k34` | Scaling soil health |

## Content from Prep Notes

When creating episode content, extract from prep notes:

1. **Title** - Use the episode title as-is
2. **Description** - Adapt the "Angle" into a hook
3. **Topics** - Map SEO keywords to topic slugs
4. **Chapters** - Group interview questions into ~6-8 topic sections
5. **Key Takeaways** - Summarize main points from question themes
6. **Related Products** - Match products mentioned in prep

## SEO Strategy Per Episode

From prep notes, each episode targets:
- Primary keyword (higher volume)
- Secondary keyword (lower competition)
- Long-tail in meta description

Example from Ep 1:
- Primary: "soil microbes" (600/mo, KD 22)
- Secondary: "soil biology" (150/mo, KD 11)
- Meta: "What are soil microbes and why do they matter"

## File Naming Convention

```
ep-{NNN}-{slug}.mdx

Examples:
ep-001-invisible-economy.mdx
ep-002-poultry-gut-health.mdx
ep-010-cover-crops.mdx
```

Use 3-digit episode numbers for proper sorting.
