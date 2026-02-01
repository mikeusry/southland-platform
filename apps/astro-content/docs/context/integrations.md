# Integrations

External services and APIs used by the Southland Content layer.

## Current Integrations

### Shopify Admin API (Theme Sync)

**Status:** Available via Mothership

For syncing Header/Footer with the live Shopify theme, use the Shopify Admin API configured in Mothership.

| Setting | Value |
|---------|-------|
| Store URL | `southland-organics.myshopify.com` |
| API Version | `2024-04` |
| Credentials | See `mothership/.env` |

**API Access:**

```bash
# Credentials in mothership/.env
SHOPIFY_STORE_URL=southland-organics.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_***  # See mothership/.env for full token
SHOPIFY_API_VERSION=2024-04
```

**Relevant Endpoints:**

- `/admin/api/2024-04/themes.json` - List themes
- `/admin/api/2024-04/themes/{id}/assets.json` - Get theme assets (Liquid files)
- `/admin/api/2024-04/pages.json` - Static pages
- `/admin/api/2024-04/blogs.json` - Blog structure

**Theme Files of Interest:**

- `sections/footer.liquid` - Footer HTML structure
- `sections/header.liquid` - Header HTML structure
- `config/settings_data.json` - Theme settings (colors, fonts, etc.)

**Usage Example (curl):**

```bash
curl -X GET "https://southland-organics.myshopify.com/admin/api/2024-04/themes.json" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN"
```

**Related Scripts (in Mothership):**

- `scripts/sync-shopify-content.py` - Syncs products, collections, pages, blog to Supabase

---

### Cloudflare Pages (Hosting)

**Status:** Staging deployment pending

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output | `dist` |
| Staging URL | `podcast-staging.southlandorganics.com` |
| Production URL | `southlandorganics.com/podcast/*` (via Worker) |

**Deployment:**
1. Connect repo to Cloudflare Pages dashboard
2. Configure build settings
3. Deploy to staging first for testing

### Cloudinary (Image Optimization)

**Status:** Implemented

Cloud name: `southland-organics`

#### Components

| Component | Purpose | File |
|-----------|---------|------|
| `CloudinaryImage` | Base image with lazy loading, placeholders | `src/components/CloudinaryImage.astro` |
| `CloudinaryAvatar` | Circular profile images with face detection | `src/components/CloudinaryAvatar.astro` |
| `CloudinaryHero` | Full-width hero banners with overlays | `src/components/CloudinaryHero.astro` |
| `CloudinaryGallery` | Image galleries with lightbox | `src/components/CloudinaryGallery.astro` |

#### Basic Usage

```astro
---
import CloudinaryImage from '../components/CloudinaryImage.astro';
---

<!-- Basic image with blur placeholder -->
<CloudinaryImage
  publicId="podcast/episode-01"
  alt="Episode thumbnail"
  width={800}
  height={450}
/>

<!-- LCP image (eager load, no placeholder) -->
<CloudinaryImage
  publicId="hero-banner"
  alt="Hero"
  width={1920}
  height={600}
  loading="eager"
  fetchpriority="high"
  placeholder="none"
/>

<!-- With effects -->
<CloudinaryImage
  publicId="product-photo"
  alt="Product"
  width={400}
  height={400}
  effect="grayscale"
  radius={20}
/>
```

#### Avatar Component

```astro
---
import CloudinaryAvatar from '../components/CloudinaryAvatar.astro';
---

<CloudinaryAvatar
  publicId="team/john-doe"
  alt="John Doe"
  size={64}
  showStatus={true}
  status="online"
  borderColor="44883e"
  borderWidth={2}
/>
```

#### Hero Banner

```astro
---
import CloudinaryHero from '../components/CloudinaryHero.astro';
---

<CloudinaryHero
  publicId="banners/podcast-hero"
  alt="Ag & Culture Podcast"
  height={500}
  overlay="dark"
  overlayOpacity={60}
  priority={true}
>
  <h1 class="text-4xl font-bold text-white">Welcome to the Podcast</h1>
  <p class="text-xl text-white/80 mt-4">Stories from the field</p>
</CloudinaryHero>
```

#### Image Gallery

```astro
---
import CloudinaryGallery from '../components/CloudinaryGallery.astro';

const images = [
  { publicId: 'gallery/farm-1', alt: 'Farm view', caption: 'Our facility' },
  { publicId: 'gallery/team-1', alt: 'Team photo' },
  { publicId: 'gallery/product-1', alt: 'Product line' },
];
---

<CloudinaryGallery
  images={images}
  layout="grid"
  columns={3}
  gap={4}
  lightbox={true}
  showCaptions={true}
  hoverEffect="zoom"
/>
```

#### Direct URL Functions

```typescript
import {
  buildCloudinaryUrl,
  buildSouthlandUrl,
  getEpisodeThumbnail,
  getGuestImage,
  getAvatarUrl,
  getHeroBannerUrl,
  buildPlaceholderUrl
} from '../lib/cloudinary';

// Basic URL with transforms
const url = buildCloudinaryUrl('my-image', {
  width: 800,
  height: 600,
  crop: 'fill',
  effect: 'blur:200'
});

// Southland folder prefix
const southlandUrl = buildSouthlandUrl('podcast/ep-01', { width: 400 });

// Specialized helpers
const thumbnail = getEpisodeThumbnail('ep-001', 400);  // 16:9
const guest = getGuestImage('john-doe', 200);          // Square, face
const avatar = getAvatarUrl('team/jane', 64);          // Circular
const hero = getHeroBannerUrl('banner', { darken: true });

// Placeholder for blur-up
const placeholder = buildPlaceholderUrl('my-image', { type: 'blur' });
```

#### TypeScript Types

```typescript
import type {
  CloudinaryTransformOptions,
  CropMode,
  Gravity,
  ImageFormat,
  Quality,
  ImageEffect,
  ResponsiveImageSet,
  PlaceholderOptions
} from '../lib/cloudinary';
```

#### Supported Effects

```typescript
type ImageEffect =
  | 'blur' | 'blur:100' | 'blur:500' | 'blur:1000'
  | 'grayscale' | 'sepia'
  | 'brightness:50' | 'brightness:150'
  | 'contrast:50' | 'contrast:150'
  | 'sharpen' | 'pixelate'
  | 'art:athena' | 'art:hokusai' | 'art:zorro' // ... more
```

#### Performance Tips

1. **LCP Images**: Use `loading="eager"`, `fetchpriority="high"`, `placeholder="none"`
2. **Below-fold**: Default lazy loading with blur placeholder is optimal
3. **Fixed-size**: Use `useDprSrcset={true}` for avatars/icons
4. **Preload critical**: Use `getResponsivePreloadLink()` in `<head>`

**Required env var:**

```bash
PUBLIC_CLOUDINARY_CLOUD_NAME=southland-organics
```

### Gumlet (Video Hosting)

**Status:** Ready for integration

Video embeds use Gumlet player via `gumletId` in episode frontmatter:

```astro
<!-- src/components/podcast/VideoEmbed.astro -->
<iframe
  src={`https://play.gumlet.io/embed/${gumletId}`}
  allowfullscreen
/>
```

**Episode frontmatter:**
```yaml
gumletId: "abc123xyz"
```

---

## Planned Integrations

### Cloudflare Worker (Routing)

**Status:** Not yet implemented

Worker will route requests based on path:

```javascript
// Pseudocode
addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/podcast')) {
    // Proxy to Cloudflare Pages
    return fetch(`https://southland-content.pages.dev${url.pathname}`);
  }

  // Default: proxy to Shopify
  return fetch(`https://southland-organics.myshopify.com${url.pathname}`);
});
```

**Setup steps:**
1. Create Worker in Cloudflare dashboard
2. Configure routes for `southlandorganics.com/podcast/*`
3. Test with staging before production cutover

### Klaviyo (Email Capture)

**Status:** ✅ Active - Podcast subscriber capture live

Email capture component at `src/components/shared/EmailCapture.astro`.

**Credentials:**

| Setting | Value |
|---------|-------|
| Company ID | `p8XW7D` |
| List ID | `QQxdLS` (Southland Newsletter Signup) |
| API Key | `pk_2ca07d7eb76d4777c34f744957a76100eb` (in southland-sep/.env) |

**Env vars (in .env):**
```bash
PUBLIC_KLAVIYO_COMPANY_ID=p8XW7D
PUBLIC_KLAVIYO_LIST_ID=QQxdLS
```

**Podcast Subscriber Properties:**

Subscribers from podcast pages get these custom profile properties:

| Property | Type | Description |
|----------|------|-------------|
| `podcast_subscriber` | boolean | Always `true` for podcast signups |
| `podcast_subscribed_at` | date | ISO timestamp of signup |
| `podcast_signup_source` | string | `"episode_page"`, `"hub"`, or `"footer"` |
| `podcast_signup_episode` | string | Episode slug (if signed up from episode page) |

**Segmentation in Klaviyo:**

Create a segment for podcast subscribers:
1. Go to Lists & Segments → Create Segment
2. Name: "Podcast Subscribers"
3. Condition: `podcast_subscriber` equals `true`

**Flow Recommendations:**

| Flow | Trigger | Purpose |
|------|---------|---------|
| Podcast Welcome | `podcast_subscriber` set to true | Welcome series, back catalog |
| New Episode Alert | Event: `new_episode_published` | Push new episodes |
| Content-to-Product | `podcast_subscriber` + no orders 30 days | Soft product intro |

**Component Usage:**

```astro
<!-- On episode pages -->
<EmailCapture
  source="episode_page"
  episodeSlug={episodeSlug}
/>

<!-- On podcast hub -->
<EmailCapture
  source="hub"
/>

<!-- In footer -->
<EmailCapture
  source="footer"
/>
```

**Integration approach:**
- Client-side form submission to Klaviyo Client API
- No server-side processing needed (static site)
- Tracks signup via point.dog pixel

### point.dog (Tracking/CDP)

**Status:** Not yet implemented

Will integrate with the point.dog platform for:
- Page view tracking
- Event tracking (video plays, email signups)
- Persona attribution

**Required env vars:**
```bash
SUPABASE_URL=https://zpjvhvyersytloyykylf.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
```

**Integration approach:**
- Tracking pixel in `BaseLayout.astro`
- Event calls via client-side JavaScript

---

## Podcast Platform Links

Each episode can link to external platforms:

| Platform | Frontmatter Key | Example |
|----------|-----------------|---------|
| YouTube | `youtubeUrl` | `https://youtube.com/watch?v=...` |
| Apple Podcasts | `applePodcastUrl` | `https://podcasts.apple.com/...` |
| Spotify | `spotifyUrl` | `https://open.spotify.com/...` |
| Audio file | `audioUrl` | `https://cdn.example.com/ep1.mp3` |

These populate the `SubscribeButtons.astro` component and RSS feed.

---

## RSS Feed

Generated at `/podcast/feed.xml` with:

- RSS 2.0 specification
- iTunes namespace (for Apple Podcasts)
- Podcast Index namespace
- Chapter markers (podcast:chapters)
- Transcript URLs (podcast:transcript)

**Feed URL:** `https://southlandorganics.com/podcast/feed.xml`

---

## Environment Variables

All environment variables are documented in `.env.example`:

```bash
# Supabase (point.dog platform) - future
SUPABASE_URL=https://zpjvhvyersytloyykylf.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# Klaviyo (email capture) - future
KLAVIYO_PUBLIC_API_KEY=your_public_key
KLAVIYO_LIST_ID=your_list_id

# Site URL
PUBLIC_SITE_URL=https://southlandorganics.com
```

---

## Related Repos

| Repo | Integration Point |
|------|-------------------|
| `mothership/` | point.dog CDP, brand knowledge |
| `southland-sep/` | Southland sales data (indirect) |
| Shopify theme | Header/footer parity, seamless navigation |
