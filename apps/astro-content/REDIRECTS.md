# URL Redirects - Shopify to Astro Migration

This document tracks the URL redirects needed when migrating from Shopify-hosted pages to Astro-hosted pages.

## Team/Staff Pages

When the team pages go live on Astro, these redirects need to be configured:

| Old Shopify URL | New Astro URL | Status |
|----------------|---------------|--------|
| `/pages/mike-usry` | `/team/mike-usry/` | Pending |
| `/pages/contact` (team section) | `/team/` | Partial - Contact page still exists |
| `/pages/{staff-name}` | `/team/{staff-name}/` | Pattern for future staff |

### Implementation Options

#### Option 1: Cloudflare Pages Middleware (Recommended for Hybrid Period)

Add redirect handling to `functions/_middleware.ts`:

```typescript
// Add to the middleware before Shopify proxy
const REDIRECTS: Record<string, string> = {
  '/pages/mike-usry': '/team/mike-usry/',
  // Add more as team members are migrated
};

// In onRequest handler:
const redirect = REDIRECTS[pathname];
if (redirect) {
  return Response.redirect(new URL(redirect, url.origin).toString(), 301);
}
```

#### Option 2: Shopify URL Redirects (For Post-Migration)

After full migration, add redirects in Shopify Admin:
1. Go to **Online Store > Navigation**
2. Click **URL Redirects**
3. Add each redirect

#### Option 3: CDN/DNS Level

Configure at Cloudflare or your CDN for highest performance.

## Current Staff to Migrate

Based on Shopify `/pages/contact` team section:

- [ ] Mike Usry → `/team/mike-usry/`
- [ ] (Add other team members as identified)

## Blog Author Pages

Blog posts reference team members as authors. Ensure author slugs match team member slugs:

| Author Slug | Team Page |
|-------------|-----------|
| `mike-usry` | `/team/mike-usry/` |

## Notes

- All Astro URLs should end with trailing slash (`/team/mike-usry/`)
- Use 301 (permanent) redirects for SEO preservation
- Test redirects before announcing migration complete
- Monitor 404s after migration to catch missed redirects
