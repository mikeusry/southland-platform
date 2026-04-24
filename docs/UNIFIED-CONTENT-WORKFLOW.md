---
title: Unified Content Workflow — pointer to canonical doc
date: 2026-04-24
status: canonical doc lives in southland-inventory
---

# Unified Content Workflow

> This is a **pointer**. The canonical doc lives in southland-inventory (Nexus) because that's where 90% of the implementation happens.

**Canonical:** `/Users/mikeusry/CODING/southland-inventory/docs/content-pipeline/UNIFIED-CONTENT-WORKFLOW.md`

## Why it lives there

- All schema changes (content_briefs extensions, video_assets table, content_ideas table) land in southland-inventory migrations
- The admin UI (idea-gen surface, brief editor, production UI, YouTube audit tool) is a Nexus app route
- The distribution orchestrator (state machine, Klaviyo API, GitHub API for MDX commits) runs in Nexus
- southland-platform's role is narrow: render the episode page, expose RSS, receive MDX commits from Nexus

## What this repo (southland-platform) owns in the unified workflow

| Asset | Status | Reference |
|-------|--------|-----------|
| Episode MDX template + JSON-LD (PodcastEpisode + FAQPage) | ✅ shipped this session | `apps/astro-content/src/pages/podcast/[...slug].astro` |
| FAQ block component | ✅ shipped this session | `apps/astro-content/src/components/podcast/EpisodeFAQ.astro` |
| UTM helper | ✅ shipped this session | `apps/astro-content/src/lib/podcastUtm.ts` |
| llms.txt with episode entries | ✅ shipped this session | `apps/astro-content/public/llms.txt` |
| Episode content collection schema | ✅ shipped this session (faq field added) | `apps/astro-content/src/content/config.ts` |
| RSS feed | Existing | `apps/astro-content/src/pages/podcast/feed.xml.ts` |
| MDX receiver (target for Nexus-generated PRs) | Existing path — needs no code change; target is `apps/astro-content/src/content/episodes/*.mdx` | — |
| (Future) SSR episode pages from Nexus API | Tier 4, not scheduled | — |

## Related docs in this repo

- [PODCAST-GAME-PLAN.md](./PODCAST-GAME-PLAN.md) — pre-unification podcast plan. Platform-side episode-page details still accurate. Workflow details superseded by the unified doc.
- [PODCAST-JOSEPH-CHECKLIST-DRAFT.md](./PODCAST-JOSEPH-CHECKLIST-DRAFT.md) — Joseph's starter checklist. Will be absorbed into the Nexus production UI.
- [PODCAST-PERPLEXITY-BRIEF.md](./PODCAST-PERPLEXITY-BRIEF.md) — research brief that informed the plan.

## Path B locked

**Southland is a video-first operation that publishes audio, blogs, emails, and social as derivatives.** Podcast is an audio echo of studio-shot video. Same workflow for podcast, field videos, D2 content, PBS technical content. See canonical doc for the full design.
