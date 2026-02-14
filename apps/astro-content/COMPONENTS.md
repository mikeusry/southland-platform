# Southland Organics Component Library

> **Design System Reference**: tremor.so aesthetic for data-heavy UI (clean layouts, generous whitespace, subtle borders, muted bases with intentional accents).
>
> **Brand Source of Truth**: Internal Southland Organics brand guidelines for color, typography, and tone.

---

## Table of Contents

- [Layouts](#layouts)
- [Shared Components](#shared-components)
- [Cloudinary Components](#cloudinary-components)
- [Podcast Components](#podcast-components)
- [Admin Components](#admin-components)
- [Page Component Usage](#page-component-usage)

---

## Layouts

### BaseLayout

**File:** `src/layouts/BaseLayout.astro`

**Purpose:** Root layout wrapper providing SEO metadata, analytics tracking, and shared header/footer for all public-facing pages.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Page title |
| `description` | `string` | required | Meta description |
| `ogImage` | `string` | `/images/podcast/og-default.jpg` | OG image URL |
| `ogType` | `'website' \| 'article' \| 'video.episode'` | `'website'` | OG type |
| `canonicalUrl` | `string` | auto-generated | Canonical URL |
| `noIndex` | `boolean` | `false` | Exclude from search engines |
| `schema` | `object` | - | JSON-LD schema.org data |

**Features:**
- point.dog pixel tracking
- GTM support
- Service Worker registration
- Pre-connects to Google Fonts

**Example:**
```astro
<BaseLayout
  title="Episode 42 - Regenerative Farming"
  description="Learn about regenerative practices..."
  ogType="video.episode"
>
  <main>...</main>
</BaseLayout>
```

---

### AdminLayout

**File:** `src/layouts/AdminLayout.astro`

**Purpose:** Secure admin interface layout with sidebar navigation and client-side password protection.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Page title |
| `activeNav` | `string` | - | Active nav item href for highlighting |

**Navigation Items:**
- Dashboard (`/admin`)
- Branding (`/admin/branding`)
- Images (`/admin/images`)
- SEO Audit (`/admin/seo`)
- Content (`/admin/content`)

**Features:**
- Password gate with session storage
- Responsive sidebar (collapses at 900px)
- Southland green accent (#44883e)

**Example:**
```astro
<AdminLayout title="Brand Guide" activeNav="/admin/branding">
  <header class="page-header">
    <h1 class="page-title">Brand Guide</h1>
  </header>
  <!-- content -->
</AdminLayout>
```

---

### PodcastLayout

**File:** `src/layouts/PodcastLayout.astro`

**Purpose:** Extended layout for podcast pages with episode-specific metadata and styling.

---

## Shared Components

### Header

**File:** `src/components/shared/Header.astro`

**Purpose:** Wrapper that renders the shared React Header from @southland/ui-react with dynamic navigation.

**Props:** None (uses `layout.json`)

---

### Footer

**File:** `src/components/shared/Footer.astro`

**Purpose:** Footer wrapper extending the shared React Footer with podcast-specific links.

**Props:** None (uses `layout.json`)

---

### EmailCapture

**File:** `src/components/shared/EmailCapture.astro`

**Purpose:** Reusable email subscription form integrated with Klaviyo.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `headline` | `string` | `'Subscribe to Ag & Culture'` | Form headline |
| `description` | `string` | generic text | Form description |
| `listId` | `string` | `'QQxdLS'` | Klaviyo list ID |
| `source` | `'episode_page' \| 'hub' \| 'footer' \| 'blog' \| 'website'` | - | Signup source |
| `episodeSlug` | `string` | - | Episode slug for tracking |
| `buttonText` | `string` | `'Subscribe'` | Submit button text |
| `variant` | `'inline' \| 'card' \| 'banner'` | `'card'` | Visual variant |
| `class` | `string` | - | Custom CSS classes |

**Variants:**
- `inline` - No styling wrapper
- `card` - White box with shadow and border
- `banner` - Full-width green banner with white text

**Example:**
```astro
<EmailCapture
  headline="Get Episode Updates"
  source="episode_page"
  episodeSlug="ep-42"
  variant="card"
/>
```

---

### ProductCard

**File:** `src/components/shared/ProductCard.astro`

**Purpose:** Displays product information with link to Shopify.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | required | Product name |
| `slug` | `string` | required | Product slug for URL |
| `description` | `string` | - | Short description |
| `image` | `string` | placeholder | Product image URL |
| `cta` | `string` | `'Shop Now'` | CTA button text |
| `price` | `string` | - | Price display string |
| `segment` | `string` | - | Product segment badge |
| `class` | `string` | - | Custom CSS classes |

**Example:**
```astro
<ProductCard
  name="Big Ole Bird"
  slug="big-ole-bird"
  description="Complete poultry supplement"
  price="$34.99"
  segment="Poultry"
/>
```

---

### TopicTag

**File:** `src/components/shared/TopicTag.astro`

**Purpose:** Clickable pill tag linking to topic filter/archive pages.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `topic` | `string` | required | Topic name |
| `href` | `string` | auto-generated | Custom href |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Tag size |
| `variant` | `'default' \| 'outline' \| 'solid'` | `'default'` | Visual style |
| `class` | `string` | - | Custom CSS classes |

**Size Variants:**
- `sm` - px-2 py-0.5, text-xs
- `md` - px-3 py-1, text-sm
- `lg` - px-4 py-1.5, text-base

**Style Variants:**
- `default` - Light green bg, green text
- `outline` - Green border, green text
- `solid` - Filled green bg, white text

**Example:**
```astro
<TopicTag topic="Regenerative Farming" size="md" variant="solid" />
```

---

### Breadcrumbs

**File:** `src/components/shared/Breadcrumbs.astro`

**Purpose:** Navigation breadcrumb trail with Schema.org BreadcrumbList markup.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `BreadcrumbItem[]` | required | Array of breadcrumb items |
| `class` | `string` | - | Custom CSS classes |

**BreadcrumbItem:**
```typescript
{ label: string; href: string; }
```

**Example:**
```astro
<Breadcrumbs items={[
  { label: 'Podcast', href: '/podcast' },
  { label: 'Episodes', href: '/podcast/episodes' },
  { label: 'Episode 42', href: '/podcast/episodes/ep-42' }
]} />
```

---

### SchemaMarkup

**File:** `src/components/shared/SchemaMarkup.astro`

**Purpose:** JSON-LD schema.org structured data renderer.

---

### SocialMeta

**File:** `src/components/shared/SocialMeta.astro`

**Purpose:** Open Graph and Twitter Card meta tags generator.

---

## Cloudinary Components

### CloudinaryImage

**File:** `src/components/CloudinaryImage.astro`

**Purpose:** Full-featured image component with lazy loading, blur placeholders, responsive srcset, and error handling.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `publicId` | `string` | required | Cloudinary public ID |
| `alt` | `string` | required | Alt text |
| `width` | `number` | - | Desired width |
| `height` | `number` | - | Desired height |
| `crop` | `CropMode` | `'fill'` | Crop/resize mode |
| `quality` | `Quality` | `'auto'` | Image quality |
| `format` | `ImageFormat` | `'auto'` | Image format |
| `gravity` | `Gravity` | `'auto'` | Focus point |
| `effect` | `ImageEffect` | - | Image effects |
| `placeholder` | `'blur' \| 'color' \| 'none'` | `'blur'` | Loading placeholder |
| `loading` | `'lazy' \| 'eager'` | `'lazy'` | Loading strategy |
| `fetchpriority` | `'high' \| 'low' \| 'auto'` | - | Fetch priority |
| `responsive` | `boolean` | `true` | Generate responsive srcset |
| `responsiveWidths` | `number[]` | `[400,800,1200,1600]` | Srcset widths |
| `useDprSrcset` | `boolean` | `false` | DPR-based srcset |
| `fallbackSrc` | `string` | - | Fallback on error |

**Example:**
```astro
<CloudinaryImage
  publicId="Southland Website/podcast/episodes/ep-01"
  alt="Episode thumbnail"
  width={800}
  height={450}
  placeholder="blur"
/>
```

---

### CloudinaryHero

**File:** `src/components/CloudinaryHero.astro`

**Purpose:** Full-width hero banner with overlay support and optional parallax.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `publicId` | `string` | required | Cloudinary public ID |
| `alt` | `string` | required | Alt text |
| `height` | `number` | `500` | Height in pixels |
| `overlay` | `'none' \| 'light' \| 'dark' \| 'gradient' \| 'brand'` | `'dark'` | Overlay type |
| `overlayColor` | `string` | - | Custom overlay color (hex) |
| `overlayOpacity` | `number` | `50` | Overlay opacity (0-100) |
| `contentAlign` | `'start' \| 'center' \| 'end'` | `'center'` | Vertical alignment |
| `contentJustify` | `'start' \| 'center' \| 'end'` | `'center'` | Horizontal alignment |
| `priority` | `boolean` | `false` | LCP image (eager + preload) |
| `parallax` | `boolean` | `false` | Enable parallax effect |
| `effect` | `'blur' \| 'grayscale' \| 'sepia' \| 'darken' \| 'none'` | `'none'` | Image effect |

**Example:**
```astro
<CloudinaryHero
  publicId="Southland Website/heroes/farm"
  alt="Southland Farm"
  height={500}
  overlay="gradient"
  overlayOpacity={60}
  priority
>
  <h1>Welcome to Southland</h1>
</CloudinaryHero>
```

---

### CloudinaryAvatar

**File:** `src/components/CloudinaryAvatar.astro`

**Purpose:** Circular avatar with face detection and status indicators.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `publicId` | `string` | required | Cloudinary public ID |
| `alt` | `string` | required | Alt text |
| `size` | `number` | `64` | Avatar size in pixels |
| `showStatus` | `boolean` | `false` | Show status indicator |
| `status` | `'online' \| 'offline' \| 'away' \| 'busy'` | `'offline'` | Status state |
| `borderColor` | `string` | - | Border color (hex) |
| `borderWidth` | `number` | `0` | Border width |
| `fallbackInitials` | `string` | - | Initials if image fails |

**Example:**
```astro
<CloudinaryAvatar
  publicId="Southland Website/team/john-doe"
  alt="John Doe"
  size={64}
  showStatus
  status="online"
/>
```

---

### CloudinaryGallery

**File:** `src/components/CloudinaryGallery.astro`

**Purpose:** Image gallery with lightbox support.

---

## Podcast Components

### EpisodeCard

**File:** `src/components/podcast/EpisodeCard.astro`

**Purpose:** Podcast episode display card with optional featured variant.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Episode title |
| `slug` | `string` | required | URL slug |
| `episodeNumber` | `number` | required | Episode number |
| `description` | `string` | required | Episode summary |
| `thumbnail` | `string` | - | Thumbnail URL |
| `duration` | `string` | required | Duration (e.g., "45 min") |
| `publishDate` | `Date` | required | Publication date |
| `topics` | `string[]` | - | Associated topics |
| `featured` | `boolean` | `false` | Featured layout variant |
| `class` | `string` | - | Custom CSS classes |

**Variants:**
- Default - Vertical card (image top, content below)
- Featured - Horizontal layout with "Listen Now" CTA

---

### GuestCard

**File:** `src/components/podcast/GuestCard.astro`

**Purpose:** Guest profile card with multiple layout options.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | required | Guest name |
| `slug` | `string` | required | URL slug |
| `role` | `string` | - | Job title/role |
| `company` | `string` | - | Company name |
| `bio` | `string` | - | Biography text |
| `photo` | `string` | - | Profile photo URL |
| `links` | `GuestLink` | - | Social media links |
| `episodeCount` | `number` | - | Number of appearances |
| `variant` | `'default' \| 'compact' \| 'sidebar'` | `'default'` | Layout variant |

**Variants:**
- `default` - Full card with bio and social links
- `compact` - Horizontal, no bio/links
- `sidebar` - Minimal with small avatar

---

### EpisodeGrid

**File:** `src/components/podcast/EpisodeGrid.astro`

**Purpose:** Grid layout for episode cards with responsive columns.

---

### AudioPlayer

**File:** `src/components/podcast/AudioPlayer.astro`

**Purpose:** Custom audio player with progress bar and controls.

---

### VideoEmbed

**File:** `src/components/podcast/VideoEmbed.astro`

**Purpose:** Mux video player embed with tracking and lazy loading.

---

### SubscribeButtons

**File:** `src/components/podcast/SubscribeButtons.astro`

**Purpose:** Podcast platform subscribe buttons (Apple, Spotify, etc.).

---

### RelatedEpisodes

**File:** `src/components/podcast/RelatedEpisodes.astro`

**Purpose:** Related/suggested episode carousel or grid.

---

### ChapterMarkers

**File:** `src/components/podcast/ChapterMarkers.astro`

**Purpose:** Episode chapter/timestamp navigation.

---

### InteractiveTranscript

**File:** `src/components/podcast/InteractiveTranscript.astro`

**Purpose:** Searchable, clickable transcript with timestamp sync.

---

### ShareClipTool

**File:** `src/components/podcast/ShareClipTool.astro`

**Purpose:** Social sharing tool for episode clips.

---

### EpisodeNav

**File:** `src/components/podcast/EpisodeNav.astro`

**Purpose:** Previous/next episode navigation.

---

## Admin Components

> These patterns are extracted from AdminLayout and admin pages. Use when building admin interfaces.
>
> **Note:** Admin patterns are currently CSS-only (not Astro components). They're documented here for consistency. Extract to components only when reuse increases significantly.

### Shared Styles in AdminLayout

These CSS classes are defined globally in AdminLayout and available to all admin pages:

| Class | Purpose |
|-------|---------|
| `.card` | White content container with border, padding, margin-bottom |
| `.card-header` | Flex container for title + badge/actions |
| `.card-title` | Section title (14px, semibold) |
| `.badge` | Inline pill status indicator |
| `.badge-success/warning/error/neutral` | Badge color variants |
| `.btn` | Base button style |
| `.btn-primary/secondary` | Button color variants |
| `.page-header` | Page title section (mb-32px) |
| `.page-title` | H1 title (24px, semibold) |
| `.page-subtitle` | Subtitle text (14px, secondary) |

### Duplicated Patterns (Consolidation Candidates)

These patterns are duplicated across multiple admin pages and should be moved to AdminLayout:

| Pattern | Files | Action |
|---------|-------|--------|
| `.code-block` | images.astro, branding.astro | Move to AdminLayout |
| `.section-desc` | images.astro, branding.astro | Move to AdminLayout |
| `.subsection-title` | images.astro, branding.astro | Move to AdminLayout |

### Page-Specific Patterns

#### /admin (Dashboard)

| Pattern | Purpose |
|---------|---------|
| `.stats-grid` | Auto-fit grid for stat cards |
| `.stat-card` | Clickable stat card with icon and value |
| `.stat-icon` | Colored icon container with variants (.green, .blue, .cyan, .orange, .purple) |
| `.quick-actions` | Action button grid |
| `.action-card` | Icon + label action button |
| `.info-grid` | Site information key-value grid |

#### /admin/branding

| Pattern | Purpose |
|---------|---------|
| `.logo-grid` | Grid for logo display cards |
| `.logo-card` | Logo preview container with .light/.dark variants |
| `.pattern-grid` | Grid for brand pattern previews |
| `.color-grid` | Primary color swatch display |
| `.tint-grid` | Color tint scale rows |
| `.neutral-grid` | Neutral color chips |
| `.font-samples` | Typography specimen display |
| `.type-scale` | Type scale demonstration |
| `.guidelines-grid` | Do/Don't usage guidelines |
| `.button-samples` | Button variant showcase |

#### /admin/images

| Pattern | Purpose |
|---------|---------|
| `.quick-ref-grid` | Key-value reference items |
| `.props-table-wrapper` | Scrollable props table container |
| `.props-table` | Component props documentation table |
| `.features-grid` | Feature cards with icon, title, desc, code |
| `.effects-grid` | Effect code snippets with descriptions |
| `.helper-section` | Function documentation with code example |
| `.best-practices` | Do/Don't practice cards |

### Pattern Extraction Priority

| Priority | Pattern | Reason |
|----------|---------|--------|
| High | `.code-block` | Duplicate CSS, used on 2+ pages |
| High | `.section-desc` | Duplicate CSS, semantic consistency |
| High | `.subsection-title` | Duplicate CSS, semantic consistency |
| Medium | `.props-table` | Likely reused in future docs pages |
| Medium | `.feature-card` | Reusable for feature showcases |
| Low | Page-specific grids | Only needed once per page |

### Admin Page Structure

Standard admin page structure:

```astro
<AdminLayout title="Page Title" activeNav="/admin/page-slug">
  <header class="page-header">
    <h1 class="page-title">Page Title</h1>
    <p class="page-subtitle">Description text</p>
  </header>

  <div class="card">
    <div class="card-header">
      <h2 class="card-title">Section Title</h2>
      <span class="badge badge-success">Status</span>
    </div>
    <!-- content -->
  </div>
</AdminLayout>
```

### Admin CSS Classes (from AdminLayout)

**Layout:**
- `.page-header` - Page title section (mb-32px)
- `.page-title` - H1 title (24px, semibold)
- `.page-subtitle` - Subtitle text (14px, secondary)

**Cards:**
- `.card` - White card container (border, radius, padding, mb)
- `.card-header` - Flex header with title and actions
- `.card-title` - Section title (14px, semibold)

**Badges:**
- `.badge` - Inline status badge (pill shape)
- `.badge-success` - Green background
- `.badge-warning` - Yellow background
- `.badge-error` - Red background
- `.badge-neutral` - Gray background

**Buttons:**
- `.btn` - Base button style
- `.btn-primary` - Green background, white text
- `.btn-secondary` - White background, border

**Grids:**
- `.stats-grid` - Auto-fit grid for stat cards
- `.stat-card` - Interactive stat card with icon
- `.quick-actions` - Action button grid

---

## Page Component Usage

### Page: /admin

**Components:**
- AdminLayout
- stat-card (custom pattern)
- quick-actions (custom pattern)

---

### Page: /admin/branding

**Components:**
- AdminLayout
- card (pattern)
- logo-grid (custom pattern)
- pattern-grid (custom pattern)
- color-grid (custom pattern)

**Notes:**
- Uses buildBrandingUrl() for Cloudinary logos
- Custom patterns for brand asset display

---

### Page: /admin/images

**Components:**
- AdminLayout
- card (pattern)
- props-table (custom pattern)
- code-block (custom pattern)
- features-grid (custom pattern)

**Notes:**
- Documentation page for Cloudinary components
- Heavy use of code examples

---

### Page: /podcast (hub)

**Components:**
- BaseLayout / PodcastLayout
- EpisodeCard (featured + default)
- EpisodeGrid
- EmailCapture
- TopicTag
- Breadcrumbs

---

### Page: /podcast/episodes/[slug]

**Components:**
- BaseLayout / PodcastLayout
- VideoEmbed
- AudioPlayer
- ChapterMarkers
- InteractiveTranscript
- GuestCard (sidebar)
- RelatedEpisodes
- ProductCard
- EmailCapture
- ShareClipTool
- TopicTag
- Breadcrumbs

---

## Component Creation Checklist

Before creating a new component:

1. [ ] Check if an existing component can be extended
2. [ ] Review similar components in the library
3. [ ] Design with reuse in mind (neutral naming, flexible props)
4. [ ] Add responsive behavior
5. [ ] Document props with types and defaults
6. [ ] Add usage example
7. [ ] Update this file immediately after creation

When a component is created:

1. [ ] Add entry to this file
2. [ ] Include purpose, props table, variants, example
3. [ ] Update page usage sections
4. [ ] Flag any patterns that emerged for potential extraction
