# Southland Content - Session Start

## Project Context

This is the **Astro content layer** for Southland Organics' "fake headless" hybrid architecture.

**Architecture:**
- Cloudflare Worker routes `/podcast/*` → this repo (Cloudflare Pages)
- Everything else → Shopify (unchanged)
- Single domain: southlandorganics.com

**Current State:** MVP complete - Ag & Culture Podcast hub

## Tech Stack

- Astro 5 + MDX + TypeScript
- Tailwind CSS 3 (brand green: #1a5f3c)
- Static site generation
- RSS 2.0 with iTunes extensions

## Key Files

| File | Purpose |
|------|---------|
| `src/pages/podcast/index.astro` | Podcast hub page |
| `src/pages/podcast/[...slug].astro` | Episode pages |
| `src/components/shared/Header.astro` | Main nav (matches Shopify) |
| `src/components/shared/Footer.astro` | Footer (needs polish) |
| `src/content/episodes/*.mdx` | Episode content |
| `src/content/config.ts` | Content collection schemas |

## Commands

```bash
npm run build && npx serve dist   # Build and preview
npm run dev                        # Dev server (port 4321)
```

## TODO (Priority Order)

1. **Improve footer styling** - Match SouthlandOrganics.com more closely
2. **Deploy to Cloudflare Pages staging** - podcast-staging.southlandorganics.com
3. **Add podcast cover image** - /public/images/podcast/cover.jpg
4. **Add episode thumbnails** - /public/images/podcast/episodes/
5. **Add real episode content** - Replace placeholder MDX files
6. **Connect Klaviyo** - Email capture integration
7. **Add tracking pixel** - point.dog integration
8. **Production routing** - Set up Cloudflare Worker

## Reference Docs

- Plan: `~/.claude/plans/twinkly-launching-petal.md`
- Hybrid architecture spec: `~/CODING/mothership/docs/future/southland-organics-hybrid-architecture-spec.md`

## Start Session

Read the README and check git status, then ask what to work on:

```
cat README.md | head -100
git status
```
