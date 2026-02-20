/**
 * Tailwind config for header/footer partials injected into Shopify pages.
 *
 * Key differences from main tailwind.config.mjs:
 * - Scans ONLY the generated partial HTML files
 * - No preflight (don't fight Shopify's CSS reset)
 * - Same theme tokens so visuals match Astro pages
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./public/_partials/header.html', './public/_partials/footer.html'],
  important: '.sl-hf',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        shopify: {
          bg: '#ffffff',
          text: '#191d21',
          title: '#2c5234',
          'secondary-bg': '#efefef',
          'secondary-text': '#686363',
          link: '#44883e',
          accent: '#44883e',
          'accent-hover': '#2c5234',
          alert: '#ef5600',
        },
      },
      fontFamily: {
        sans: ['"Open Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['"Eveleth Dot"', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        shopify: '1400px',
      },
    },
  },
  plugins: [],
}
