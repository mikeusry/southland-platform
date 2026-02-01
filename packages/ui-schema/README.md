# @southland/ui-schema

TypeScript type definitions for the Southland Organics platform UI.

## Types

### Navigation Types

```typescript
import type { NavItem, NavChild, FooterColumn, FooterData } from '@southland/ui-schema';

// Navigation item (header menu)
interface NavChild {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
}

// Footer column
interface FooterColumn {
  title: string;
  links: Array<{ label: string; href: string }>;
}

// Complete footer data
interface FooterData {
  columns: FooterColumn[];
  copyright: string;
  socialLinks: Array<{ platform: string; url: string; icon: string }>;
  logoUrl?: string;
}
```

### Layout Types

```typescript
import type { HeaderData, LayoutData } from '@southland/ui-schema';

// Header configuration
interface HeaderData {
  logoUrl: string;
  logoAlt: string;
  navigation: NavItem[];
}

// Complete layout (synced from Shopify)
interface LayoutData {
  _meta: {
    synced: string;   // ISO timestamp of last sync
    source: string;   // "shopify" or "manual"
  };
  header: HeaderData;
  footer: FooterData;
}
```

## Usage

```typescript
import type { NavItem, LayoutData } from '@southland/ui-schema';

const menuItem: NavItem = {
  label: 'Shop',
  href: '/shop',
  children: [
    { label: 'Poultry', href: '/shop/poultry' },
    { label: 'Lawn', href: '/shop/lawn' },
  ],
};
```

## Data Source

Layout data is synced from the Shopify Admin API at build time:
- Navigation menus: `shopify.admin.menu.items`
- Footer structure: Custom metafields

The sync script is in `apps/astro-content/scripts/sync-layout.ts`.

## Development

```bash
# Build
pnpm --filter @southland/ui-schema build

# Type check
pnpm --filter @southland/ui-schema typecheck
```
