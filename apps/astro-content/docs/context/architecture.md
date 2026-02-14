# Architecture

Technical architecture for the Southland Platform astro-content app.

## Hybrid Architecture

This repo is part of a "fake headless" approach where Cloudflare sits in front of both Shopify and custom content:

```
┌─────────────────────────────────────────────────────────────┐
│                    southlandorganics.com                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Cloudflare DNS  │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Cloudflare      │
                    │ Worker (future) │
                    └─────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
   ┌─────────────────┐                ┌─────────────────┐
   │ /podcast/*      │                │ /* (default)    │
   │ Cloudflare Pages│                │ Shopify         │
   │ (this repo)     │                │ (unchanged)     │
   └─────────────────┘                └─────────────────┘
```

**Benefits:**
- Single domain (no subdomain fragmentation)
- Shopify handles checkout, products, accounts
- Astro handles content-rich pages (faster, SEO-optimized)
- Zero changes to existing Shopify theme

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Astro 5 (static site generation) |
| Content CMS | TinaCMS (Git-backed, migrated from Keystatic Feb 2026) |
| Content Format | MDX with content collections |
| Styling | Tailwind CSS 3 with brand tokens |
| Types | TypeScript |
| Hosting | Cloudflare Pages |
| Routing | Cloudflare Pages middleware (`functions/_middleware.ts`) |

## Project Structure

```
apps/astro-content/
├── .claude-context.md        # Quick reference for Claude
├── astro.config.mjs          # Astro configuration
├── tailwind.config.mjs       # Tailwind with brand tokens
├── tsconfig.json             # TypeScript config
│
├── public/
│   ├── favicon.svg
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service worker
│   └── images/podcast/       # Podcast images
│
├── src/
│   ├── layouts/
│   │   ├── BaseLayout.astro      # HTML skeleton
│   │   └── PodcastLayout.astro   # Podcast wrapper
│   │
│   ├── components/
│   │   ├── shared/               # Cross-section components
│   │   │   ├── Header.astro      # Main nav
│   │   │   ├── Footer.astro      # Footer
│   │   │   ├── EmailCapture.astro
│   │   │   └── ...
│   │   └── podcast/              # Podcast-specific
│   │       ├── EpisodeCard.astro
│   │       ├── VideoEmbed.astro
│   │       ├── AudioPlayer.astro
│   │       └── ...
│   │
│   ├── pages/
│   │   ├── index.astro           # Redirects to /podcast/
│   │   └── podcast/
│   │       ├── index.astro       # Hub page
│   │       ├── [...slug].astro   # Episode pages
│   │       ├── search.astro      # Search
│   │       ├── guests/           # Guest directory
│   │       ├── topics/           # Topic browser
│   │       └── feed.xml.ts       # RSS feed
│   │
│   ├── content/
│   │   ├── config.ts             # Collection schemas
│   │   └── episodes/             # MDX episode files
│   │
│   └── styles/
│       └── global.css            # Tailwind + custom
│
├── docs/
│   └── context/
│       ├── architecture.md       # This file
│       └── integrations.md       # External services
│
└── dist/                         # Build output (gitignored)
```

## Utility Libraries (`src/lib/`)

### `analytics.ts` - Podcast Event Tracking

Client-side analytics for podcast interactions. Integrates with point.dog pixel and GTM.

**Functions:**
| Function | Purpose |
|----------|---------|
| `trackPodcastEvent()` | Base event tracker (sends to pdPixel + dataLayer) |
| `trackEpisodePlay()` | Episode play start |
| `trackEpisodeProgress()` | Progress milestones (25%, 50%, 75%, 100%) |
| `trackEpisodeComplete()` | Episode finished |
| `trackShareClip()` | Clip sharing |
| `trackTranscriptClick()` | Transcript timestamp jump |
| `trackChapterClick()` | Chapter navigation |
| `trackPodcastSearch()` | Search queries |
| `trackPodcastEmailSignup()` | Email signup from podcast |
| `trackSubscribeClick()` | Platform subscribe clicks |
| `trackProductCTAClick()` | Product CTA from episode |

**Usage:**
```typescript
import { trackEpisodePlay } from '@/lib/analytics';
trackEpisodePlay({ slug: 'ep-001', episodeNumber: 1, title: 'Welcome' });
```

### `supabase.ts` - point.dog CDP Integration

Server-side Supabase client for semantic search and personalization.

**Exports:**
| Export | Purpose |
|--------|---------|
| `supabase` | Initialized Supabase client (or null if not configured) |
| `findRelatedContent()` | Semantic search for blog/pages related to episode |
| `findRelatedProducts()` | Find products matching episode content |
| `findTargetPersona()` | Match episode to best persona |
| `getProductsBySegment()` | Direct query for segment products |
| `getPersonas()` | Get all Southland personas |

**Types exported:** `WebsiteContent`, `Product`, `Persona`

**Usage:**
```typescript
import { findRelatedProducts, supabase } from '@/lib/supabase';
const products = await findRelatedProducts(episodeEmbedding, { matchCount: 3 });
```

---

## Content Collections

Five collections defined in TinaCMS (`tina/config.ts`):

| Collection | Purpose | Status |
|------------|---------|--------|
| `episodes` | Podcast episodes with full metadata | Active (1 episode) |
| `guests` | Guest directory | Active |
| `topics` | Shared taxonomy | Active |
| `blog` | Blog posts (287 migrated from Shopify) | Active |
| `team` | Team member profiles | Active |

### Episode Schema

```typescript
{
  title: string,
  episodeNumber: number,
  season: number (default: 1),
  publishDate: Date,
  description: string,
  longDescription?: string,

  // Media
  muxPlaybackId?: string,   // Mux video playback ID
  audioUrl?: string,        // For RSS
  youtubeUrl?: string,
  applePodcastUrl?: string,
  spotifyUrl?: string,
  thumbnail?: string,
  duration: string,         // "45:32" format
  durationSeconds: number,

  // Structure
  chapters?: [{ time: number, title: string }],
  guests?: [{ name, slug, role?, bio?, photo?, links? }],
  topics?: string[],
  transcript?: [{ time: number, speaker: string, text: string }],

  // Related
  relatedProducts?: [{ slug, name, cta? }],
  relatedBlogPosts?: [{ slug, title }],
  relatedEpisodes?: string[],

  // SEO
  metaTitle?: string,
  metaDescription?: string,
  ogImage?: string,
  draft?: boolean
}
```

### Guest Schema

```typescript
{
  name: string,
  role?: string,
  company?: string,
  bio: string,
  photo?: string,
  links?: { website?, linkedin?, twitter?, instagram? },
  episodes?: string[],    // Episode slugs they appeared in
  featured?: boolean
}
```

### Topic Schema

```typescript
{
  name: string,
  description: string,
  icon?: string,
  relatedTopics?: string[],
  relatedProducts?: string[],
  segment?: 'poultry' | 'turf' | 'agriculture' | 'general'
}
```

### Blog Schema (Active — 287 posts)

```typescript
{
  title: string,
  publishDate: Date,
  description: string,
  author?: string,
  topics?: string[],
  segment?: 'poultry' | 'turf' | 'agriculture' | 'general',
  featuredImage?: string,
  draft?: boolean,
  relatedProducts?: string[],
  relatedEpisodes?: string[]
}
```

### Team Schema (Active)

```typescript
{
  name: string,
  role: string,
  bio: string,
  photo?: string,
  email?: string,
  links?: { linkedin?, twitter? },
  order?: number           // Display order
}
```

### Products Schema (Future)

```typescript
{
  name: string,
  shopifyHandle: string,   // Links to Shopify product
  segment: 'poultry' | 'turf' | 'agriculture',
  shortDescription: string,
  benefits?: string[],
  useCases?: string[],
  topics?: string[],
  featured?: boolean
}
```

## Build Process

```bash
# Development
npm run dev              # Start dev server on :4321

# Production build
npm run build            # Output to dist/

# Preview build
npx serve dist           # Serve built files locally
npm run preview          # Or use Astro's preview

# Type checking
npm run astro check      # Validate types
```

## Key Patterns

### Dynamic Routes

Episode pages use Astro's rest parameter syntax for clean URLs:

```astro
// src/pages/podcast/[...slug].astro
export async function getStaticPaths() {
  const episodes = await getCollection('episodes');
  return episodes.map(episode => ({
    params: { slug: episode.slug },
    props: { episode },
  }));
}
```

### RSS Feed Generation

RSS is generated at build time via `feed.xml.ts`:

```typescript
// src/pages/podcast/feed.xml.ts
export async function GET() {
  const episodes = await getCollection('episodes');
  // Generate RSS 2.0 with iTunes extensions
  return new Response(rssXml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
```

### Header/Footer Parity

Components in `src/components/shared/` match the live Shopify site structure to ensure seamless navigation between content pages and e-commerce.

## Future Expansion

The architecture supports expanding beyond podcast:

| Route | Content Type |
|-------|--------------|
| `/` | Homepage |
| `/poultry/*` | Poultry segment hub |
| `/turf/*` | Turf/lawn segment hub |
| `/agriculture/*` | Agriculture segment hub |
| `/blog/*` | Blog posts |
| `/resources/*` | Guides, calculators |
| `/science/*` | Lab results, proof |

Each would follow the same pattern:
1. Add content collection in `src/content/`
2. Create pages in `src/pages/`
3. Add segment-specific components in `src/components/`
