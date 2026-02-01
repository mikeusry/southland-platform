# @southland/ui-tokens

Design tokens for the Southland Organics brand.

## Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `accent` | `#44883e` | Links, buttons, CTAs (Light Green) |
| `title` | `#2c5234` | Headings, logo dark half (Dark Green) |
| `text` | `#191d21` | Body text |
| `secondaryText` | `#686363` | Muted text, captions |
| `bg` | `#ffffff` | Primary background |
| `secondaryBg` | `#efefef` | Secondary background |
| `border` | `#e5e7eb` | Borders, dividers |

### Fonts

| Token | Value | Usage |
|-------|-------|-------|
| `heading` | `"Eveleth Dot", system-ui, sans-serif` | Headings (H1-H6) |
| `body` | `"Open Sans", system-ui, sans-serif` | Body text, UI |

### Layout

| Token | Value | Usage |
|-------|-------|-------|
| `maxWidth` | `1400px` | Container max-width |
| `headerHeight` | `75px` | Fixed header height |

## Usage

### JavaScript/TypeScript

```typescript
import { tokens } from '@southland/ui-tokens';

const style = {
  color: tokens.colors.accent,
  fontFamily: tokens.fonts.body,
};
```

### Tailwind CSS

```javascript
// tailwind.config.js
const { tokens } = require('@southland/ui-tokens');

module.exports = {
  theme: {
    extend: {
      colors: {
        'shopify-accent': tokens.colors.accent,
        'shopify-title': tokens.colors.title,
        'shopify-text': tokens.colors.text,
        'shopify-secondary-text': tokens.colors.secondaryText,
      },
      fontFamily: {
        heading: ['"Eveleth Dot"', 'system-ui', 'sans-serif'],
        body: ['"Open Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
};
```

### CSS Custom Properties

```css
/* Import tokens.css */
@import '@southland/ui-tokens/css';

.button {
  background-color: var(--color-accent);
  font-family: var(--font-body);
}
```

## Exports

| Export | Description |
|--------|-------------|
| `.` | Default - TypeScript tokens object |
| `./tailwind` | Tailwind CSS preset |
| `./css` | CSS custom properties |

## Development

```bash
# Build
pnpm --filter @southland/ui-tokens build

# Type check
pnpm --filter @southland/ui-tokens typecheck
```
