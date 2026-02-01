# Southland Content Layer

Content system for Southland Organics' "fake headless" hybrid architecture. Built with Astro, deployed to Cloudflare Pages.

## Architecture

```
southlandorganics.com
        │
        ▼
  Cloudflare Worker (future)
        │
        ├── /podcast/*  ──────▶  Cloudflare Pages (this repo)
        │
        └── /* (everything else) ──▶  Shopify
```

**Current Status:** MVP - Podcast Hub (`/podcast/*`)

**Future Expansion:**
- `/` - Homepage
- `/poultry/*` - Poultry segment hub
- `/turf/*` - Turf segment hub
- `/agriculture/*` - Agriculture segment hub
- `/blog/*` - Blog posts
- `/resources/*` - Guides, calculators
- `/science/*` - Lab results, proof

## Tech Stack

- **Astro 5** - Static site generation with content collections
- **Tailwind CSS 3** - Utility-first styling with brand colors
- **MDX** - Rich content with components
- **TypeScript** - Type safety throughout

## Brand Colors

```css
--brand-green: #1a5f3c
--white: #ffffff
--light-gray: #f5f5f5
--dark-gray: #727272
--black: #1a1a1a
```

## Project Structure

```
southland-content/
├── astro.config.mjs          # Astro configuration
├── tailwind.config.mjs       # Tailwind with brand tokens
├── tsconfig.json             # TypeScript config
├── public/
│   ├── favicon.svg           # Site favicon
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service worker (offline support)
│   └── images/podcast/       # Podcast images
├── src/
│   ├── layouts/
│   │   ├── BaseLayout.astro      # HTML skeleton, meta, tracking
│   │   └── PodcastLayout.astro   # Podcast-specific wrapper
│   ├── components/
│   │   ├── shared/               # Reusable across ALL sections
│   │   │   ├── Header.astro      # Main navigation (matches Shopify)
│   │   │   ├── Footer.astro      # Footer (matches Shopify)
│   │   │   ├── EmailCapture.astro
│   │   │   ├── TopicTag.astro
│   │   │   ├── SearchBox.astro
│   │   │   ├── SearchResults.astro
│   │   │   ├── SchemaMarkup.astro
│   │   │   └── SocialMeta.astro
│   │   └── podcast/              # Podcast-specific
│   │       ├── EpisodeCard.astro
│   │       ├── EpisodeGrid.astro
│   │       ├── VideoEmbed.astro
│   │       ├── AudioPlayer.astro
│   │       ├── ChapterMarkers.astro
│   │       ├── InteractiveTranscript.astro
│   │       ├── ShareClipTool.astro
│   │       ├── SubscribeButtons.astro
│   │       ├── GuestCard.astro
│   │       ├── RelatedEpisodes.astro
│   │       └── EpisodeNav.astro
│   ├── pages/
│   │   ├── index.astro           # Redirects to /podcast/
│   │   └── podcast/
│   │       ├── index.astro       # Podcast hub
│   │       ├── [...slug].astro   # Episode pages
│   │       ├── search.astro      # Transcript search
│   │       ├── guests/           # Guest directory
│   │       ├── topics/           # Topic browser
│   │       └── feed.xml.ts       # RSS feed
│   ├── content/
│   │   ├── config.ts             # Content collection schemas
│   │   └── episodes/             # Episode MDX files
│   └── styles/
│       └── global.css            # Tailwind imports + custom
└── dist/                         # Built output (gitignored)
```

## Pages Built

| Route | Description |
|-------|-------------|
| `/podcast/` | Hub with episode grid, subscribe buttons, email capture |
| `/podcast/[slug]/` | Episode page with video, transcript, chapters |
| `/podcast/search/` | Full-text transcript search |
| `/podcast/guests/` | Guest directory |
| `/podcast/topics/` | Topic browser |
| `/podcast/feed.xml` | RSS 2.0 with iTunes extensions |

## Content Schema

### Episode (`src/content/episodes/*.mdx`)

```yaml
---
title: "Episode Title"
episodeNumber: 1
publishDate: 2026-01-05
description: "Short description"
gumletId: "abc123xyz"           # Video embed ID
audioUrl: "https://..."         # For RSS/audio player
youtubeUrl: "https://..."
applePodcastUrl: "https://..."
spotifyUrl: "https://..."
thumbnail: "/images/podcast/episodes/ep-001.jpg"
duration: "45:32"
durationSeconds: 2732

chapters:
  - time: 0
    title: "Introduction"
  - time: 330
    title: "Main Topic"

guests:
  - name: "Dr. Jane Smith"
    slug: "dr-jane-smith"
    role: "Poultry Nutritionist"

topics:
  - poultry-health
  - gut-microbiome

transcript:
  - time: 0
    speaker: "Host"
    text: "Welcome to Ag & Culture..."
---

Episode show notes in markdown...
```

## Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview built site
npm run preview
# or
npx serve dist

# Type checking
npm run astro check
```

## Environment Variables

```bash
# .env.example

# Supabase (point.dog platform) - future
SUPABASE_URL=https://zpjvhvyersytloyykylf.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# Klaviyo (email capture) - future
KLAVIYO_PUBLIC_API_KEY=your_public_key
KLAVIYO_LIST_ID=your_list_id

# Site URL
PUBLIC_SITE_URL=https://southlandorganics.com
```

## Deployment

### Cloudflare Pages

1. Connect repo to Cloudflare Pages
2. Build command: `npm run build`
3. Build output: `dist`
4. Deploy to staging: `podcast-staging.southlandorganics.com`

### Production Routing (Future)

Cloudflare Worker will route:
- `/podcast/*` → Cloudflare Pages (this repo)
- Everything else → Shopify

## Header/Footer

Navigation matches the live SouthlandOrganics.com site:

**Header Navigation:**
- Poultry (dropdown: Broilers, Layers/Breeders, Turkey, Game Birds, Backyard Birds, Biosecurity)
- Lawn & Garden (dropdown: Lawn Care, Programs, Garden, Hydroseeders, Landscapers, Golf Courses)
- Septic & Waste (dropdown: Septic Care, Odor Control, Sanitizers)
- Swine
- About (dropdown: Contact, Blog, Case Studies, Why Southland, Loyalty Program, FAQs)
- **Podcast** (highlighted in green)

**Footer:**
- Dark background (#1a1a1a)
- Company info, social icons, quick links
- Payment icons (Visa, MC, Amex, Discover, PayPal)

## RSS Feed

Generated at `/podcast/feed.xml` with:
- RSS 2.0 specification
- iTunes namespace extensions
- Podcast Index namespace
- Chapter and transcript URLs

## PWA Features

- `manifest.json` - Install to home screen
- `sw.js` - Service worker for offline caching
- Responsive design - Mobile-first

## SEO

- Schema.org JSON-LD (PodcastSeries, PodcastEpisode)
- Open Graph / Twitter Card meta tags
- Canonical URLs
- Sitemap generation

## TODO

- [ ] Deploy to Cloudflare Pages staging
- [ ] Add real episode content
- [ ] Improve footer styling to closer match Shopify
- [ ] Add podcast cover image
- [ ] Add episode thumbnails
- [ ] Connect Klaviyo email capture
- [ ] Add tracking pixel integration
- [ ] Set up Cloudflare Worker routing for production

## Related Repos

- **mothership** - Orchestration, scripts, CLI tools
- **point.dog** - CDP and analytics platform
- **shopify-theme** - Southland Organics Shopify theme

---

Built for Southland Organics | [southlandorganics.com](https://southlandorganics.com)
