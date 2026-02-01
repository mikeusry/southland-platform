# Southland Platform: Shopify App + Monorepo Plan

## Decision Summary

| Question | Decision |
|----------|----------|
| **App hosting** | Cloudflare Workers (adapt Remix template) |
| **Theme extensions** | Not needed - `/api/layout` only |
| **Cart in Astro** | `@shopify/hydrogen-react` via `@astrojs/react` |
| **API strategy** | Storefront API direct for public ops, app for privileged |
| **Layout fetch** | Build-time with JSON cache + optional client refresh |

---

## Architecture

```
southland-platform/                        # NEW monorepo
├── packages/
│   ├── ui-tokens/                         # Design system
│   │   ├── tailwind.preset.js             # Shared Tailwind config
│   │   ├── tokens.css                     # CSS custom properties
│   │   └── package.json
│   │
│   ├── ui-react/                          # Shared React components
│   │   ├── src/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Cart.tsx                   # Uses hydrogen-react
│   │   │   └── index.ts
│   │   └── package.json                   # Depends on ui-tokens, ui-schema
│   │
│   └── ui-schema/                         # TypeScript interfaces
│       ├── src/
│       │   ├── navigation.ts
│       │   ├── layout.ts
│       │   └── index.ts
│       └── package.json
│
├── apps/
│   ├── shopify-app/                       # Remix on Cloudflare Workers
│   │   ├── app/
│   │   │   ├── routes/
│   │   │   │   ├── api.layout.ts          # GET /api/layout
│   │   │   │   └── webhooks.tsx           # Shopify webhooks
│   │   │   └── shopify.server.ts          # Shopify API client
│   │   ├── extensions/                    # Empty for now
│   │   ├── wrangler.toml                  # Cloudflare config
│   │   └── package.json
│   │
│   └── astro-content/                     # Migrated southland-content
│       ├── src/
│       │   ├── components/
│       │   │   └── shared/
│       │   │       ├── Header.astro       # Wraps @southland/ui-react Header
│       │   │       └── Footer.astro       # Wraps @southland/ui-react Footer
│       │   ├── data/
│       │   │   └── layout.json            # Cached from /api/layout at build
│       │   └── ...existing content
│       ├── scripts/
│       │   └── fetch-layout.js            # Build-time layout fetch + cache
│       └── astro.config.mjs               # @astrojs/react integration
│
├── package.json                           # pnpm workspaces
├── pnpm-workspace.yaml
└── turbo.json                             # Optional: Turborepo for builds
```

---

## Schema Definitions

### `@southland/ui-schema/navigation.ts`

```typescript
export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
}

export interface FooterColumn {
  title: string;
  links: Array<{ label: string; href: string }>;
}

export interface FooterData {
  columns: FooterColumn[];
  copyright: string;
  socialLinks: Array<{ platform: string; url: string; icon: string }>;
}

export interface LayoutData {
  _meta: {
    synced: string;
    source: string;
  };
  header: {
    logoUrl: string;
    logoAlt: string;
    navigation: NavItem[];
  };
  footer: FooterData;
  tokens: {
    colorAccent: string;
    colorTitle: string;
    colorText: string;
    colorSecondaryText: string;
  };
}
```

---

## API Response: `/api/layout`

```json
{
  "_meta": {
    "synced": "2026-01-30T10:00:00Z",
    "source": "Shopify Admin API + Menus"
  },
  "header": {
    "logoUrl": "https://southlandorganics.com/cdn/shop/files/Southland_Organics_Horizontal.svg",
    "logoAlt": "Southland Organics",
    "navigation": [
      {
        "label": "Poultry",
        "href": "https://southlandorganics.com/collections/poultry",
        "children": [
          { "label": "Broilers", "href": "https://southlandorganics.com/collections/broilers" },
          { "label": "Layers/Breeders", "href": "https://southlandorganics.com/collections/layers-breeders" }
        ]
      },
      {
        "label": "About",
        "href": "https://southlandorganics.com/pages/about",
        "children": [
          { "label": "Podcast", "href": "/podcast/" },
          { "label": "Contact", "href": "https://southlandorganics.com/pages/contact" }
        ]
      }
    ]
  },
  "footer": {
    "columns": [
      {
        "title": "Products",
        "links": [
          { "label": "Poultry", "href": "https://southlandorganics.com/collections/poultry" }
        ]
      }
    ],
    "copyright": "© 2026 Southland Organics. All rights reserved.",
    "socialLinks": [
      { "platform": "facebook", "url": "https://facebook.com/southlandorganics", "icon": "facebook" }
    ]
  },
  "tokens": {
    "colorAccent": "#44883e",
    "colorTitle": "#2c5234",
    "colorText": "#191d21",
    "colorSecondaryText": "#686363"
  }
}
```

---

## Component Wiring

### `@southland/ui-react/Header.tsx`

```tsx
import type { NavItem } from '@southland/ui-schema';

interface HeaderProps {
  logoUrl: string;
  logoAlt: string;
  navigation: NavItem[];
  currentPath?: string;
}

export function Header({ logoUrl, logoAlt, navigation, currentPath }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[75px]">
          <a href="https://southlandorganics.com" className="flex-shrink-0">
            <img src={logoUrl} alt={logoAlt} className="h-10 w-auto" />
          </a>
          <nav className="hidden lg:flex items-center">
            {navigation.map((item) => (
              <NavDropdown key={item.label} item={item} currentPath={currentPath} />
            ))}
          </nav>
          {/* ... cart, search, mobile menu */}
        </div>
      </div>
    </header>
  );
}
```

### `apps/astro-content/src/components/shared/Header.astro`

```astro
---
import { Header as HeaderReact } from '@southland/ui-react';
import layout from '../../data/layout.json';

const { pathname } = Astro.url;
---

<HeaderReact
  client:load
  logoUrl={layout.header.logoUrl}
  logoAlt={layout.header.logoAlt}
  navigation={layout.header.navigation}
  currentPath={pathname}
/>
```

---

## Migration Steps

### Phase 1: Scaffold (Day 1)
1. Create `southland-platform/` monorepo with pnpm workspaces
2. Run `npm init @shopify/app@latest` inside `apps/shopify-app/`
3. Move `southland-content/` → `apps/astro-content/`
4. Create empty `packages/ui-tokens`, `ui-react`, `ui-schema`

### Phase 2: Schema + API (Day 2)
1. Define TypeScript interfaces in `ui-schema`
2. Add `/api/layout` route to Shopify app (reads menus via GraphQL)
3. Test locally with `shopify app dev`

### Phase 3: Shared Components (Day 3)
1. Extract Header.astro → Header.tsx in `ui-react`
2. Add `@astrojs/react` to Astro
3. Update Header.astro to wrap React component
4. Add `fetch-layout.js` build script

### Phase 4: Deploy (Day 4)
1. Adapt Shopify app for Cloudflare Workers
2. Deploy app to Cloudflare
3. Update Astro build to fetch from production `/api/layout`
4. Deploy Astro to Cloudflare Pages

### Phase 5: Cart + Polish (Future)
1. Add `@shopify/hydrogen-react` to `ui-react`
2. Build Cart.tsx with CartProvider
3. Add cart island to Astro pages
4. Wire up Storefront API credentials

---

## Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Monorepo location** | New `~/CODING/southland-platform/` | Clean slate, keep old repo as safety net |
| **Package manager** | pnpm | Better workspaces, tolerate CLI friction during scaffold |
| **Shopify app name** | `southland-platform-app` | Clear it's the central platform app |
| **Credentials** | Keep mothership/.env for now | Gradually centralize; app secrets → Cloudflare Workers env |

## Refinements

- **URL normalization**: App normalizes all URLs (fully qualified or root-relative) so clients don't do gymnastics
- **LayoutProvider**: Wrap `Header`, `Footer`, `Cart` in a single provider for simpler Astro usage
- **Build timestamps**: `fetch-layout.js` writes `_meta.synced` and logs staleness warnings

---

## Concrete Implementation: `/api/layout` Resolver

### Shopify Menu GraphQL Query

```graphql
query GetLayoutData {
  # Main navigation menu (handle: "main-menu" in Shopify)
  menu(handle: "main-menu") {
    items {
      title
      url
      items {
        title
        url
      }
    }
  }

  # Footer menu (handle: "footer")
  footerMenu: menu(handle: "footer") {
    items {
      title
      url
      items {
        title
        url
      }
    }
  }

  # Shop info for logo, etc.
  shop {
    name
    brand {
      logo {
        image {
          url
        }
      }
    }
  }
}
```

### Resolver Logic (`apps/shopify-app/app/routes/api.layout.ts`)

```typescript
import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { authenticate } from "../shopify.server";
import type { LayoutData, NavItem } from "@southland/ui-schema";

const SHOPIFY_DOMAIN = "https://southlandorganics.com";
const PODCAST_PATHS = ["/podcast"];

/**
 * Normalize Shopify URLs:
 * - Relative paths that match PODCAST_PATHS stay relative (served by Astro)
 * - All other relative paths get SHOPIFY_DOMAIN prepended
 * - Absolute URLs pass through unchanged
 */
function normalizeUrl(url: string | null): string {
  if (!url) return "#";

  // Already absolute
  if (url.startsWith("http")) {
    // Check if it's a Shopify URL pointing to podcast (make relative)
    const podcastMatch = url.match(/southlandorganics\.com(\/podcast.*)/);
    if (podcastMatch) return podcastMatch[1];
    return url;
  }

  // Relative URL
  if (url.startsWith("/")) {
    // Podcast paths stay relative
    if (PODCAST_PATHS.some(p => url.startsWith(p))) {
      return url;
    }
    // Everything else → Shopify
    return `${SHOPIFY_DOMAIN}${url}`;
  }

  return url;
}

function transformMenuItem(item: ShopifyMenuItem): NavItem {
  return {
    label: item.title,
    href: normalizeUrl(item.url),
    children: item.items?.length
      ? item.items.map(child => ({
          label: child.title,
          href: normalizeUrl(child.url),
        }))
      : undefined,
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  // For public layout data, we use Storefront API (no auth needed)
  // Or Admin API if we need unpublished menus

  const response = await fetch(
    `https://southland-organics.myshopify.com/api/2024-04/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": process.env.STOREFRONT_TOKEN!,
      },
      body: JSON.stringify({ query: LAYOUT_QUERY }),
    }
  );

  const { data } = await response.json();

  const layoutData: LayoutData = {
    _meta: {
      synced: new Date().toISOString(),
      source: "Shopify Storefront API + Menus",
    },
    header: {
      logoUrl: data.shop?.brand?.logo?.image?.url ||
        "https://southlandorganics.com/cdn/shop/files/Southland_Organics_Horizontal.svg",
      logoAlt: data.shop?.name || "Southland Organics",
      navigation: data.menu?.items?.map(transformMenuItem) || [],
    },
    footer: {
      columns: transformFooterToColumns(data.footerMenu?.items || []),
      copyright: `© ${new Date().getFullYear()} Southland Organics. All rights reserved.`,
      socialLinks: [
        { platform: "facebook", url: "https://facebook.com/southlandorganics", icon: "facebook" },
        { platform: "instagram", url: "https://instagram.com/southlandorganics", icon: "instagram" },
        { platform: "youtube", url: "https://youtube.com/@southlandorganics", icon: "youtube" },
      ],
    },
    tokens: {
      colorAccent: "#44883e",
      colorTitle: "#2c5234",
      colorText: "#191d21",
      colorSecondaryText: "#686363",
    },
  };

  return json(layoutData, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600", // 5min client, 1hr edge
    },
  });
}
```

### Current Header.astro → Schema Mapping

Your existing nav (lines 22-73) maps directly:

| Current Astro | Schema Field | Notes |
|---------------|--------------|-------|
| `navigation[].label` | `NavItem.label` | Identical |
| `navigation[].href` | `NavItem.href` | App normalizes URLs |
| `navigation[].children` | `NavItem.children` | Same structure |

The interfaces you already defined in Header.astro (lines 11-20) become `@southland/ui-schema`:

```typescript
// packages/ui-schema/src/navigation.ts
// Literally copy-paste from your Header.astro, now shared
export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
}
```

### LayoutProvider Pattern

```tsx
// packages/ui-react/src/LayoutProvider.tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { LayoutData } from '@southland/ui-schema';

const LayoutContext = createContext<LayoutData | null>(null);

export function LayoutProvider({
  layout,
  children
}: {
  layout: LayoutData;
  children: ReactNode
}) {
  return (
    <LayoutContext.Provider value={layout}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider');
  return ctx;
}

export function useHeader() {
  return useLayout().header;
}

export function useFooter() {
  return useLayout().footer;
}
```

### Astro Usage with LayoutProvider

```astro
---
// apps/astro-content/src/layouts/BaseLayout.astro
import { LayoutProvider } from '@southland/ui-react';
import { Header } from '@southland/ui-react';
import { Footer } from '@southland/ui-react';
import layout from '../data/layout.json';

const { pathname } = Astro.url;
---

<html>
  <head>...</head>
  <body>
    <LayoutProvider client:load layout={layout}>
      <Header client:load currentPath={pathname} />
      <main>
        <slot />
      </main>
      <Footer client:load />
    </LayoutProvider>
  </body>
</html>
```

---

## Files to Reference

- Current Header: `src/components/shared/Header.astro` (lines 22-73 have nav)
- Theme sync script: `scripts/sync-shopify-theme.js` (API client pattern)
- Tokens CSS: `src/styles/shopify-tokens.css` (extracted values)

---

# IMPLEMENTATION GUIDE

## Prerequisites Checklist

### Required Tools
```bash
# Verify these are installed
node --version    # v18.20+ or v20.10+
pnpm --version    # v8+ (install: npm install -g pnpm)
git --version     # v2.28+
```

### Required Accounts & Credentials
- [ ] **Shopify Partner Account** - https://partners.shopify.com
- [ ] **Development Store** - Create one in Partner dashboard if needed
- [ ] **Storefront Access Token** - From Shopify Admin → Settings → Apps → Develop apps
- [ ] **Admin API Access Token** - Same location (already have in mothership/.env)

### Verify Shopify Menu Handles
Before starting, confirm these menu handles exist in Shopify Admin → Online Store → Navigation:
- [ ] `main-menu` (or note actual handle: _________)
- [ ] `footer` (or note actual handle: _________)

### Environment Variables Needed
```bash
# Will be needed in apps/shopify-app/.env
SHOPIFY_API_KEY=           # From Partner dashboard app
SHOPIFY_API_SECRET=        # From Partner dashboard app
SHOPIFY_SCOPES=read_products,read_content  # Minimum needed
STOREFRONT_TOKEN=          # Public Storefront API token
```

---

## Phase 1: Scaffold Monorepo (Detailed)

### Step 1.1: Create Directory Structure

```bash
# Create monorepo root
mkdir -p ~/CODING/southland-platform
cd ~/CODING/southland-platform

# Create package directories
mkdir -p packages/ui-schema/src
mkdir -p packages/ui-tokens/src
mkdir -p packages/ui-react/src
mkdir -p apps
```

### Step 1.2: Initialize pnpm Workspace

**File: `~/CODING/southland-platform/pnpm-workspace.yaml`**
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

**File: `~/CODING/southland-platform/package.json`**
```json
{
  "name": "southland-platform",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  },
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=18.20.0"
  }
}
```

**File: `~/CODING/southland-platform/turbo.json`**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

**File: `~/CODING/southland-platform/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  }
}
```

### Step 1.3: Create ui-schema Package

**File: `packages/ui-schema/package.json`**
```json
{
  "name": "@southland/ui-schema",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

**File: `packages/ui-schema/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**File: `packages/ui-schema/src/navigation.ts`**
```typescript
export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
}

export interface FooterColumn {
  title: string;
  links: Array<{ label: string; href: string }>;
}

export interface FooterData {
  columns: FooterColumn[];
  copyright: string;
  socialLinks: Array<{ platform: string; url: string; icon: string }>;
}
```

**File: `packages/ui-schema/src/layout.ts`**
```typescript
import type { NavItem, FooterData } from './navigation';

export interface LayoutTokens {
  colorAccent: string;
  colorTitle: string;
  colorText: string;
  colorSecondaryText: string;
  colorBg: string;
  colorSecondaryBg: string;
}

export interface HeaderData {
  logoUrl: string;
  logoAlt: string;
  navigation: NavItem[];
}

export interface LayoutData {
  _meta: {
    synced: string;
    source: string;
  };
  header: HeaderData;
  footer: FooterData;
  tokens: LayoutTokens;
}
```

**File: `packages/ui-schema/src/index.ts`**
```typescript
export * from './navigation';
export * from './layout';
```

### Step 1.4: Create ui-tokens Package

**File: `packages/ui-tokens/package.json`**
```json
{
  "name": "@southland/ui-tokens",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./tailwind": "./tailwind.preset.js",
    "./css": "./tokens.css"
  },
  "scripts": {
    "build": "cp src/* dist/",
    "dev": "pnpm build --watch"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0"
  }
}
```

**File: `packages/ui-tokens/tailwind.preset.js`**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        'shopify-accent': '#44883e',
        'shopify-title': '#2c5234',
        'shopify-text': '#191d21',
        'shopify-secondary-text': '#686363',
        'shopify-bg': '#ffffff',
        'shopify-secondary-bg': '#efefef',
        'shopify-alert': '#ef5600',
        'shopify-success': '#44883e',
        'shopify-border': '#e5e7eb',
      },
      fontFamily: {
        heading: ['"Eveleth Dot"', 'system-ui', 'sans-serif'],
        body: ['"Open Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      maxWidth: {
        'shopify': '1400px',
      },
      height: {
        'header': '75px',
      },
    },
  },
};
```

**File: `packages/ui-tokens/tokens.css`**
```css
/**
 * Southland Platform Design Tokens
 * Synced from Shopify Booster theme
 */

@font-face {
  font-family: 'Eveleth Dot';
  src: url('/fonts/eveleth-dot-regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

:root {
  /* Typography */
  --font-body: "Open Sans", system-ui, -apple-system, sans-serif;
  --font-heading: "Eveleth Dot", system-ui, sans-serif;

  /* Colors - Primary */
  --color-bg: #ffffff;
  --color-text: #191d21;
  --color-title: #2c5234;
  --color-link: #44883e;
  --color-accent: #44883e;
  --color-accent-hover: #2c5234;

  /* Colors - Secondary */
  --color-secondary-bg: #efefef;
  --color-secondary-text: #686363;
  --color-border: #e5e7eb;

  /* Layout */
  --max-width: 1400px;
  --header-height: 75px;
}
```

**File: `packages/ui-tokens/src/index.ts`**
```typescript
export const tokens = {
  colors: {
    accent: '#44883e',
    title: '#2c5234',
    text: '#191d21',
    secondaryText: '#686363',
    bg: '#ffffff',
    secondaryBg: '#efefef',
    border: '#e5e7eb',
  },
  fonts: {
    heading: '"Eveleth Dot", system-ui, sans-serif',
    body: '"Open Sans", system-ui, -apple-system, sans-serif',
  },
  layout: {
    maxWidth: '1400px',
    headerHeight: '75px',
  },
} as const;

export type Tokens = typeof tokens;
```

### Step 1.5: Create ui-react Package (Skeleton)

**File: `packages/ui-react/package.json`**
```json
{
  "name": "@southland/ui-react",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@southland/ui-schema": "workspace:*",
    "@southland/ui-tokens": "workspace:*",
    "react": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "typescript": "^5.4.0"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  }
}
```

**File: `packages/ui-react/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../ui-schema" },
    { "path": "../ui-tokens" }
  ]
}
```

**File: `packages/ui-react/src/index.ts`**
```typescript
// Components will be added in Phase 3
export { LayoutProvider, useLayout, useHeader, useFooter } from './LayoutProvider';
export { Header } from './Header';
export { Footer } from './Footer';
```

**File: `packages/ui-react/src/LayoutProvider.tsx`**
```typescript
import { createContext, useContext, type ReactNode } from 'react';
import type { LayoutData } from '@southland/ui-schema';

const LayoutContext = createContext<LayoutData | null>(null);

interface LayoutProviderProps {
  layout: LayoutData;
  children: ReactNode;
}

export function LayoutProvider({ layout, children }: LayoutProviderProps) {
  return (
    <LayoutContext.Provider value={layout}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutData {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return ctx;
}

export function useHeader() {
  return useLayout().header;
}

export function useFooter() {
  return useLayout().footer;
}
```

**File: `packages/ui-react/src/Header.tsx`** (Placeholder)
```typescript
// Full implementation in Phase 3
export function Header() {
  return <header>Header placeholder</header>;
}
```

**File: `packages/ui-react/src/Footer.tsx`** (Placeholder)
```typescript
// Full implementation in Phase 3
export function Footer() {
  return <footer>Footer placeholder</footer>;
}
```

### Step 1.6: Scaffold Shopify App

```bash
cd ~/CODING/southland-platform/apps

# Run Shopify CLI scaffold (use npm for initial scaffold per docs)
npm init @shopify/app@latest -- --name southland-platform-app --template remix

# This creates apps/southland-platform-app/
# Rename to match our convention
mv southland-platform-app shopify-app

# Navigate into app
cd shopify-app
```

### Step 1.7: Move Astro Content

```bash
# Copy southland-content to monorepo (don't move yet - keep as backup)
cp -r ~/CODING/southland-content ~/CODING/southland-platform/apps/astro-content

# Remove git history from copy (will use monorepo git)
rm -rf ~/CODING/southland-platform/apps/astro-content/.git

# Update package name in apps/astro-content/package.json
# Change "name" to "@southland/astro-content"
```

### Step 1.8: Install Dependencies

```bash
cd ~/CODING/southland-platform
pnpm install
```

### Step 1.9: Initialize Git

```bash
cd ~/CODING/southland-platform
git init
git add .
git commit -m "scaffold: Initial monorepo structure

- pnpm workspaces with turbo
- @southland/ui-schema package
- @southland/ui-tokens package
- @southland/ui-react package (skeleton)
- Shopify app scaffold
- Astro content migrated
"
```

### Phase 1 Verification Checklist

```bash
cd ~/CODING/southland-platform

# ✓ Workspace resolves
pnpm install   # Should complete without errors

# ✓ Packages build
pnpm --filter @southland/ui-schema build
pnpm --filter @southland/ui-tokens build

# ✓ Shopify app runs
cd apps/shopify-app
pnpm dev   # Should start (will fail auth - that's OK for now)

# ✓ Astro runs
cd ../astro-content
pnpm dev --port 4400   # Should start on localhost:4400
```

---

## Phase 2: Schema + API (Detailed)

### Step 2.1: Configure Shopify App

**Update: `apps/shopify-app/shopify.app.toml`**
```toml
name = "Southland Platform"
client_id = "YOUR_CLIENT_ID_FROM_PARTNER_DASHBOARD"
application_url = "https://localhost:3000"
embedded = false

[access_scopes]
scopes = "read_products,read_content"

[webhooks]
api_version = "2024-04"
```

**Create: `apps/shopify-app/.env`**
```bash
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
STOREFRONT_TOKEN=your_storefront_token
SHOP_DOMAIN=southland-organics.myshopify.com
```

### Step 2.2: Add Layout API Route

**Create: `apps/shopify-app/app/routes/api.layout.ts`**
```typescript
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import type { LayoutData, NavItem } from "@southland/ui-schema";

const SHOPIFY_DOMAIN = "https://southlandorganics.com";
const PODCAST_PATHS = ["/podcast"];
const SHOP_DOMAIN = process.env.SHOP_DOMAIN || "southland-organics.myshopify.com";
const STOREFRONT_TOKEN = process.env.STOREFRONT_TOKEN!;

const LAYOUT_QUERY = `
  query GetLayoutData {
    menu(handle: "main-menu") {
      items {
        title
        url
        items {
          title
          url
        }
      }
    }
    footerMenu: menu(handle: "footer") {
      items {
        title
        url
        items {
          title
          url
        }
      }
    }
    shop {
      name
      brand {
        logo {
          image {
            url
          }
        }
      }
    }
  }
`;

interface ShopifyMenuItem {
  title: string;
  url: string | null;
  items?: ShopifyMenuItem[];
}

function normalizeUrl(url: string | null): string {
  if (!url) return "#";

  // Already absolute
  if (url.startsWith("http")) {
    // Check if it's a Shopify URL pointing to podcast (make relative)
    const podcastMatch = url.match(/southlandorganics\.com(\/podcast.*)/);
    if (podcastMatch) return podcastMatch[1];
    return url;
  }

  // Relative URL
  if (url.startsWith("/")) {
    // Podcast paths stay relative (served by Astro)
    if (PODCAST_PATHS.some(p => url.startsWith(p))) {
      return url;
    }
    // Everything else → Shopify
    return `${SHOPIFY_DOMAIN}${url}`;
  }

  return url;
}

function transformMenuItem(item: ShopifyMenuItem): NavItem {
  return {
    label: item.title,
    href: normalizeUrl(item.url),
    children: item.items?.length
      ? item.items.map(child => ({
          label: child.title,
          href: normalizeUrl(child.url),
        }))
      : undefined,
  };
}

function transformFooterToColumns(items: ShopifyMenuItem[]) {
  // Group footer items into columns
  return items.map(item => ({
    title: item.title,
    links: item.items?.map(child => ({
      label: child.title,
      href: normalizeUrl(child.url),
    })) || [],
  }));
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const response = await fetch(
      `https://${SHOP_DOMAIN}/api/2024-04/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
        },
        body: JSON.stringify({ query: LAYOUT_QUERY }),
      }
    );

    if (!response.ok) {
      throw new Error(`Storefront API error: ${response.status}`);
    }

    const { data, errors } = await response.json();

    if (errors) {
      console.error("GraphQL errors:", errors);
      throw new Error("GraphQL query failed");
    }

    const layoutData: LayoutData = {
      _meta: {
        synced: new Date().toISOString(),
        source: "Shopify Storefront API + Menus",
      },
      header: {
        logoUrl: data.shop?.brand?.logo?.image?.url ||
          "https://southlandorganics.com/cdn/shop/files/Southland_Organics_Horizontal.svg",
        logoAlt: data.shop?.name || "Southland Organics",
        navigation: data.menu?.items?.map(transformMenuItem) || [],
      },
      footer: {
        columns: transformFooterToColumns(data.footerMenu?.items || []),
        copyright: `© ${new Date().getFullYear()} Southland Organics. All rights reserved.`,
        socialLinks: [
          { platform: "facebook", url: "https://facebook.com/southlandorganics", icon: "facebook" },
          { platform: "instagram", url: "https://instagram.com/southlandorganics", icon: "instagram" },
          { platform: "youtube", url: "https://youtube.com/@southlandorganics", icon: "youtube" },
        ],
      },
      tokens: {
        colorAccent: "#44883e",
        colorTitle: "#2c5234",
        colorText: "#191d21",
        colorSecondaryText: "#686363",
        colorBg: "#ffffff",
        colorSecondaryBg: "#efefef",
      },
    };

    return json(layoutData, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Layout API error:", error);
    return json(
      { error: "Failed to fetch layout data" },
      { status: 500 }
    );
  }
}
```

### Step 2.3: Add Shopify App Dependencies

```bash
cd ~/CODING/southland-platform/apps/shopify-app
pnpm add @southland/ui-schema@workspace:*
```

### Phase 2 Verification Checklist

```bash
cd ~/CODING/southland-platform/apps/shopify-app

# Start the app
pnpm dev

# In another terminal, test the API
curl http://localhost:3000/api/layout | jq .

# ✓ Should return JSON with header.navigation array
# ✓ Should return footer.columns array
# ✓ _meta.synced should be current timestamp
```

---

## Phase 3: Shared Components (Detailed)

### Step 3.1: Implement Full Header Component

**Update: `packages/ui-react/src/Header.tsx`**
```typescript
import { useState } from 'react';
import type { NavItem } from '@southland/ui-schema';

interface HeaderProps {
  logoUrl: string;
  logoAlt: string;
  navigation: NavItem[];
  currentPath?: string;
}

interface NavDropdownProps {
  item: NavItem;
  currentPath?: string;
}

function NavDropdown({ item, currentPath }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = currentPath?.startsWith(item.href);

  if (!item.children?.length) {
    return (
      <a
        href={item.href}
        className={`nav-link px-4 py-6 text-sm font-medium transition-colors ${
          isActive ? 'text-shopify-title' : 'text-shopify-secondary-text hover:text-shopify-text'
        }`}
      >
        {item.label}
      </a>
    );
  }

  return (
    <div
      className="nav-item relative group"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <a
        href={item.href}
        className={`nav-link flex items-center gap-1 px-4 py-6 text-sm font-medium transition-colors ${
          isActive ? 'text-shopify-title' : 'text-shopify-secondary-text hover:text-shopify-text'
        }`}
      >
        {item.label}
        <svg
          className={`w-3 h-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </a>
      {isOpen && (
        <div className="dropdown absolute top-full left-0 pt-0 z-50">
          <div className="bg-white shadow-lg border border-gray-200 py-2 min-w-[220px]">
            {item.children.map((child) => (
              <a
                key={child.label}
                href={child.href}
                className="block px-5 py-2.5 text-sm text-shopify-secondary-text hover:text-shopify-text hover:bg-shopify-secondary-bg transition-colors"
              >
                {child.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Header({ logoUrl, logoAlt, navigation, currentPath }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[75px]">
          {/* Logo */}
          <a href="https://southlandorganics.com" className="flex-shrink-0">
            <img
              src={logoUrl}
              alt={logoAlt}
              className="h-10 w-auto"
              width={200}
              height={40}
            />
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center">
            {navigation.map((item) => (
              <NavDropdown key={item.label} item={item} currentPath={currentPath} />
            ))}
          </nav>

          {/* Right side utilities */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <button
              className="p-3 text-shopify-secondary-text hover:text-shopify-text transition-colors"
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Account */}
            <a
              href="https://southlandorganics.com/account/login"
              className="hidden sm:flex items-center gap-1 px-3 py-2 text-sm text-shopify-secondary-text hover:text-shopify-text transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden md:inline">Login</span>
            </a>

            {/* Cart */}
            <a
              href="https://southlandorganics.com/cart"
              className="flex items-center gap-1 px-3 py-2 text-sm text-shopify-secondary-text hover:text-shopify-text transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="hidden md:inline">Cart</span>
            </a>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-3 text-shopify-secondary-text hover:text-shopify-text transition-colors"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="lg:hidden border-t border-gray-200 bg-white max-h-[calc(100vh-75px)] overflow-y-auto">
          <div className="px-4 py-2">
            {navigation.map((item) => (
              <div key={item.label} className="border-b border-gray-100">
                <a
                  href={item.href}
                  className="block py-3 font-medium text-shopify-secondary-text hover:text-shopify-text"
                >
                  {item.label}
                </a>
                {item.children && (
                  <div className="pl-4 pb-3">
                    {item.children.map((child) => (
                      <a
                        key={child.label}
                        href={child.href}
                        className="block py-2 text-sm text-shopify-secondary-text hover:text-shopify-text"
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="py-4 flex gap-4">
              <a
                href="https://southlandorganics.com/account/login"
                className="text-sm text-shopify-secondary-text hover:text-shopify-text font-medium"
              >
                Login
              </a>
              <a
                href="https://southlandorganics.com/account/register"
                className="text-sm text-shopify-secondary-text hover:text-shopify-text font-medium"
              >
                Register
              </a>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
```

### Step 3.2: Implement Footer Component

**Update: `packages/ui-react/src/Footer.tsx`**
```typescript
import type { FooterData } from '@southland/ui-schema';

interface FooterProps extends FooterData {}

const socialIcons: Record<string, JSX.Element> = {
  facebook: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  instagram: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"/>
    </svg>
  ),
  youtube: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
};

export function Footer({ columns, copyright, socialLinks }: FooterProps) {
  return (
    <footer className="bg-shopify-secondary-bg border-t border-gray-200">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-12">
        {/* Footer columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="font-heading text-shopify-title text-lg mb-4">
                {column.title}
              </h3>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-shopify-secondary-text hover:text-shopify-text transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-300 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-shopify-secondary-text">{copyright}</p>

          {/* Social links */}
          <div className="flex gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.platform}
                href={social.url}
                className="text-shopify-secondary-text hover:text-shopify-accent transition-colors"
                aria-label={social.platform}
                target="_blank"
                rel="noopener noreferrer"
              >
                {socialIcons[social.platform] || social.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
```

### Step 3.3: Add React to Astro

```bash
cd ~/CODING/southland-platform/apps/astro-content
pnpm add @astrojs/react react react-dom
pnpm add -D @types/react @types/react-dom
pnpm add @southland/ui-react@workspace:* @southland/ui-schema@workspace:* @southland/ui-tokens@workspace:*
```

**Update: `apps/astro-content/astro.config.mjs`**
```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

export default defineConfig({
  integrations: [
    react(),
    tailwind(),
    mdx(),
  ],
  output: 'static',
});
```

**Update: `apps/astro-content/tailwind.config.mjs`**
```javascript
import southlandPreset from '@southland/ui-tokens/tailwind';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [southlandPreset],
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
    '../../packages/ui-react/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### Step 3.4: Create fetch-layout Script

**Create: `apps/astro-content/scripts/fetch-layout.js`**
```javascript
#!/usr/bin/env node
/**
 * Fetch layout data from Shopify app and cache locally
 * Run before build: node scripts/fetch-layout.js
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In production, this would be your deployed Shopify app URL
const LAYOUT_API_URL = process.env.LAYOUT_API_URL || 'http://localhost:3000/api/layout';

async function fetchLayout() {
  console.log('Fetching layout data...');
  console.log(`  URL: ${LAYOUT_API_URL}`);

  try {
    const response = await fetch(LAYOUT_API_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const layout = await response.json();

    // Ensure data directory exists
    const dataDir = join(__dirname, '../src/data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Write layout data
    const outputPath = join(dataDir, 'layout.json');
    writeFileSync(outputPath, JSON.stringify(layout, null, 2));

    console.log(`  Synced: ${layout._meta.synced}`);
    console.log(`  Navigation items: ${layout.header.navigation.length}`);
    console.log(`  Footer columns: ${layout.footer.columns.length}`);
    console.log(`  Written to: src/data/layout.json`);

  } catch (error) {
    console.error(`  Error: ${error.message}`);

    // If fetch fails, check for existing cached data
    const cachedPath = join(__dirname, '../src/data/layout.json');
    if (existsSync(cachedPath)) {
      console.log('  Using cached layout.json');
    } else {
      console.error('  No cached data available. Build may fail.');
      process.exit(1);
    }
  }
}

fetchLayout();
```

### Step 3.5: Update Astro Header Component

**Update: `apps/astro-content/src/components/shared/Header.astro`**
```astro
---
import { Header as HeaderReact } from '@southland/ui-react';
import layout from '../../data/layout.json';

const { pathname } = Astro.url;
---

<HeaderReact
  client:load
  logoUrl={layout.header.logoUrl}
  logoAlt={layout.header.logoAlt}
  navigation={layout.header.navigation}
  currentPath={pathname}
/>
```

### Step 3.6: Update Astro Footer Component

**Update: `apps/astro-content/src/components/shared/Footer.astro`**
```astro
---
import { Footer as FooterReact } from '@southland/ui-react';
import layout from '../../data/layout.json';
---

<FooterReact
  client:load
  columns={layout.footer.columns}
  copyright={layout.footer.copyright}
  socialLinks={layout.footer.socialLinks}
/>
```

### Step 3.7: Update package.json Scripts

**Update: `apps/astro-content/package.json`** (scripts section)
```json
{
  "scripts": {
    "dev": "astro dev --port 4400",
    "build": "node scripts/fetch-layout.js && astro build",
    "preview": "astro preview",
    "astro": "astro",
    "fetch-layout": "node scripts/fetch-layout.js"
  }
}
```

### Phase 3 Verification Checklist

```bash
# Terminal 1: Start Shopify app
cd ~/CODING/southland-platform/apps/shopify-app
pnpm dev

# Terminal 2: Fetch layout and start Astro
cd ~/CODING/southland-platform/apps/astro-content
pnpm fetch-layout    # Should create src/data/layout.json
pnpm dev             # Should start on localhost:4400

# Verify in browser:
# ✓ Header shows navigation from Shopify menus
# ✓ Dropdowns work on hover
# ✓ Mobile menu works
# ✓ Footer shows columns from Shopify
# ✓ /podcast/ link is relative (stays on Astro)
# ✓ Other links go to southlandorganics.com
```

---

## Phase 4: Deploy (Detailed)

### Step 4.1: Adapt Shopify App for Cloudflare Workers

```bash
cd ~/CODING/southland-platform/apps/shopify-app
pnpm add @remix-run/cloudflare @cloudflare/workers-types
```

**Create: `apps/shopify-app/wrangler.toml`**
```toml
name = "southland-platform-app"
main = "build/index.js"
compatibility_date = "2024-01-01"

[vars]
SHOP_DOMAIN = "southland-organics.myshopify.com"

# Secrets are set via: wrangler secret put STOREFRONT_TOKEN
# wrangler secret put SHOPIFY_API_KEY
# wrangler secret put SHOPIFY_API_SECRET
```

### Step 4.2: Deploy Shopify App to Cloudflare

```bash
cd ~/CODING/southland-platform/apps/shopify-app

# Build for Cloudflare
pnpm build

# Deploy
npx wrangler deploy

# Set secrets
npx wrangler secret put STOREFRONT_TOKEN
npx wrangler secret put SHOPIFY_API_KEY
npx wrangler secret put SHOPIFY_API_SECRET
```

### Step 4.3: Update Astro for Production Layout URL

**Update: `apps/astro-content/.env.production`**
```bash
LAYOUT_API_URL=https://southland-platform-app.YOUR_SUBDOMAIN.workers.dev/api/layout
```

### Step 4.4: Deploy Astro to Cloudflare Pages

```bash
cd ~/CODING/southland-platform/apps/astro-content

# Build
pnpm build

# Deploy via Cloudflare Pages dashboard or wrangler
npx wrangler pages deploy dist
```

### Phase 4 Verification Checklist

```bash
# ✓ Shopify app responds at workers.dev URL
curl https://southland-platform-app.YOUR_SUBDOMAIN.workers.dev/api/layout

# ✓ Astro site loads at Cloudflare Pages URL
# ✓ Header/Footer match Shopify menus
# ✓ Navigation works correctly
# ✓ Podcast links stay on Astro domain
```

---

## Testing Checklist (End-to-End)

### Local Development
- [ ] `pnpm install` completes without errors at monorepo root
- [ ] `pnpm build` builds all packages
- [ ] Shopify app starts with `pnpm dev`
- [ ] `/api/layout` returns valid JSON
- [ ] Astro starts with `pnpm dev --port 4400`
- [ ] Header displays navigation from API
- [ ] Footer displays columns from API
- [ ] Mobile menu opens/closes
- [ ] Dropdown menus work on desktop

### Production
- [ ] Shopify app deployed to Cloudflare Workers
- [ ] `/api/layout` responds with <500ms latency
- [ ] Astro deployed to Cloudflare Pages
- [ ] Header/Footer match Shopify admin menus
- [ ] Changing menu in Shopify → rebuild → reflects in Astro

---

## Rollback Plan

### If Monorepo Breaks
1. Original `southland-content` repo is unchanged at `~/CODING/southland-content`
2. Can continue developing there while debugging monorepo

### If Shopify App Fails
1. Fall back to static `layout.json` committed to repo
2. Manually update JSON when menus change
3. Script: `apps/astro-content/scripts/fallback-layout.json`

### If Astro Build Fails
1. `fetch-layout.js` uses cached data if API unreachable
2. Keep last working `layout.json` in git

### Emergency: Revert to Old Header
```bash
cd ~/CODING/southland-platform/apps/astro-content
git checkout HEAD~1 -- src/components/shared/Header.astro
```

---

## Commands Quick Reference

```bash
# Monorepo root
cd ~/CODING/southland-platform
pnpm install              # Install all deps
pnpm build                # Build all packages
pnpm dev                  # Start all dev servers (via turbo)

# Individual packages
pnpm --filter @southland/ui-schema build
pnpm --filter @southland/ui-react build

# Shopify app
cd apps/shopify-app
pnpm dev                  # Local dev server
pnpm build                # Build for deploy
npx wrangler deploy       # Deploy to Cloudflare

# Astro content
cd apps/astro-content
pnpm fetch-layout         # Sync layout from API
pnpm dev                  # Local dev (port 4400)
pnpm build                # Build static site
npx wrangler pages deploy dist  # Deploy to Cloudflare
```
