# @southland/ui-react

Shared React components for the Southland Organics platform.

## Components

### Header

Responsive navigation header with dropdown menus, mobile support, and Shopify integration.

```tsx
import { Header } from '@southland/ui-react';

<Header
  logoUrl="https://..."
  logoAlt="Southland Organics"
  navigation={[
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop', children: [
      { label: 'Poultry', href: '/shop/poultry' },
      { label: 'Lawn', href: '/shop/lawn' },
    ]},
  ]}
  currentPath="/shop"
/>
```

**Props:**
- `logoUrl` - URL for the header logo
- `logoAlt` - Alt text for the logo
- `navigation` - Array of `NavItem` objects (from `@southland/ui-schema`)
- `currentPath` - Current page path for active state highlighting

### Footer

Four-column footer with social links, navigation, payment icons, and parallax background.

```tsx
import { Footer } from '@southland/ui-react';

<Footer
  columns={[...]}
  copyright="© 2026 Southland Organics"
  socialLinks={[
    { platform: 'facebook', url: 'https://...', icon: '' },
  ]}
  whiteLogoUrl="https://..."
  address="189 Luke Road\nBogart, GA 30622"
  phone="800-608-3755"
/>
```

**Props:**
- `columns` - Array of `FooterColumn` objects
- `copyright` - Copyright text
- `socialLinks` - Social media links
- `whiteLogoUrl` - Optional white logo URL (defaults to Cloudinary asset)
- `moleculesPatternUrl` - Optional background pattern URL
- `address` - Company address
- `phone` - Company phone number

### LayoutProvider

React context provider for sharing layout data across the app.

```tsx
import { LayoutProvider, useLayout, useHeader, useFooter } from '@southland/ui-react';

// In root layout
<LayoutProvider data={layoutData}>
  {children}
</LayoutProvider>

// In any component
const { header, footer } = useLayout();
const headerData = useHeader();
const footerData = useFooter();
```

## Dependencies

- `@southland/ui-schema` - TypeScript type definitions
- `@southland/ui-tokens` - Design tokens
- `react` (peer dependency)

## Development

```bash
# Build
pnpm --filter @southland/ui-react build

# Watch mode
pnpm --filter @southland/ui-react dev

# Type check
pnpm --filter @southland/ui-react typecheck
```

## Usage

These components are used in:
- `apps/astro-content` - Content site (podcast, blog)
- Future: Shopify theme components via web components
