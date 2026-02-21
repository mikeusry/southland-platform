#!/usr/bin/env npx tsx
/**
 * Pre-render header/footer partials for HTMLRewriter injection.
 *
 * Run with: npx tsx scripts/build-partials.ts
 *
 * Runs AFTER fetch-layout.js (needs layout.json) and BEFORE astro build
 * (outputs to public/ which Astro copies to dist/).
 *
 * Input:  layout.json + StaticHeader + Footer (from @southland/ui-react src/)
 * Output: public/_partials/header.html
 *         public/_partials/footer.html
 *         public/_partials/partials.css
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Make React available globally — tsx compiles JSX as React.createElement
// for files in packages/ whose tsconfig resolves differently
;(globalThis as Record<string, unknown>).React = React

// Import component source files directly (tsx compiles TSX on the fly)
const { StaticHeader } = await import('../../../packages/ui-react/src/StaticHeader.js')
const { Footer } = await import('../../../packages/ui-react/src/Footer.js')

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const partialsDir = join(projectRoot, 'public', '_partials')

// Ensure output directory exists
if (!existsSync(partialsDir)) {
  mkdirSync(partialsDir, { recursive: true })
}

// Load layout data
const layoutPath = join(projectRoot, 'src', 'data', 'layout.json')
if (!existsSync(layoutPath)) {
  console.error('  layout.json not found — run fetch-layout.js first')
  process.exit(1)
}
const layout = JSON.parse(readFileSync(layoutPath, 'utf-8'))
console.log('Building header/footer partials...')

// --- HEADER ---

const headerElement = createElement(StaticHeader, {
  logoUrl: layout.header.logoUrl,
  logoAlt: layout.header.logoAlt || 'Southland Organics',
  navigation: layout.header.navigation,
})

const headerMarkup = renderToStaticMarkup(headerElement)

// Inline JS for mobile menu toggle + active nav highlighting
const headerScript = `
<script>
(function(){
  // Mobile menu toggle
  var btn = document.querySelector('[data-sl-menu-toggle]');
  var menu = document.querySelector('[data-sl-mobile-menu]');
  var iconOpen = document.querySelector('[data-sl-icon-open]');
  var iconClose = document.querySelector('[data-sl-icon-close]');
  if (btn && menu) {
    btn.addEventListener('click', function() {
      var isHidden = menu.classList.contains('hidden');
      menu.classList.toggle('hidden', !isHidden);
      if (iconOpen) iconOpen.classList.toggle('hidden', isHidden);
      if (iconClose) iconClose.classList.toggle('hidden', !isHidden);
      btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });
  }
  // Active nav highlighting
  var path = window.location.pathname;
  var links = document.querySelectorAll('[data-sl-nav-href]');
  links.forEach(function(link) {
    var href = link.getAttribute('data-sl-nav-href');
    if (!href) return;
    var isActive = (href === path) ||
      (href === '/' && path === '/') ||
      (href !== '/' && path.startsWith(href));
    if (isActive) {
      link.classList.remove('text-shopify-text');
      link.classList.add('text-shopify-accent');
    }
  });
})();
</script>`

const headerHtml = `<div class="sl-hf">${headerMarkup}</div>${headerScript}`

writeFileSync(join(partialsDir, 'header.html'), headerHtml)
console.log('  header.html written')

// --- FOOTER ---

// Same column assembly logic as Footer.astro
const podcastColumn = {
  title: 'Ag & Culture Podcast',
  links: [
    { label: 'All Episodes', href: '/podcast/' },
    { label: 'Topics', href: '/podcast/topics/' },
    { label: 'Guests', href: '/podcast/guests/' },
  ],
}

const baseColumns =
  layout.footer.columns.length > 0 && layout.footer.columns[0].links.length > 0
    ? layout.footer.columns
    : [
        {
          title: 'Products',
          links: [
            { label: 'Poultry', href: '/collections/poultry' },
            { label: 'Lawn & Garden', href: '/collections/turf' },
            { label: 'Septic & Waste', href: '/collections/waste' },
            { label: 'Swine', href: '/collections/pig-and-swine-supplements' },
          ],
        },
        {
          title: 'Resources',
          links: [
            { label: 'Blog', href: '/blogs/news' },
            { label: 'Case Studies', href: '/blogs/case-studies' },
            { label: 'Humate Hub', href: '/blogs/humate-hub' },
            { label: 'FAQs', href: '/pages/faqs' },
          ],
        },
        {
          title: 'Company',
          links: [
            { label: 'About Us', href: '/about/' },
            { label: 'Contact', href: '/contact/' },
            { label: 'Find a Dealer', href: '/store-locator/' },
            { label: 'Distribution', href: '/distribution/' },
            { label: 'Rewards Program', href: '/pages/southland-organics-rewards' },
          ],
        },
      ]

const columns = [...baseColumns.slice(0, 3), podcastColumn]

const footerElement = createElement(Footer, {
  columns,
  copyright: layout.footer.copyright,
  socialLinks: layout.footer.socialLinks,
  logoUrl: layout.header.logoUrl,
})

const footerMarkup = renderToStaticMarkup(footerElement)
const footerHtml = `<div class="sl-hf" style="flex:none">${footerMarkup}</div>`

writeFileSync(join(partialsDir, 'footer.html'), footerHtml)
console.log('  footer.html written')

// --- CSS ---

// Run Tailwind to generate utility CSS for the partials
console.log('  Generating partials CSS...')
const tailwindInput = join(partialsDir, '_input.css')
writeFileSync(tailwindInput, '@tailwind components;\n@tailwind utilities;\n')
try {
  execSync(
    `npx tailwindcss -c tailwind.partials.config.mjs --input ${tailwindInput} -o ${join(partialsDir, 'partials.css')} --minify`,
    { cwd: projectRoot, stdio: 'pipe' },
  )
} catch (e: any) {
  console.log('  Tailwind CLI warning (non-fatal):', e.stderr?.toString().slice(0, 200))
}
// Clean up temp input file
try { unlinkSync(tailwindInput) } catch {}

// Append scoping CSS and font imports
const scopingCss = `
/* Font imports */
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');

@font-face {
  font-family: "Eveleth Dot";
  src: url("/fonts/eveleth-dot-regular.woff2") format("woff2"),
       url("/fonts/eveleth-dot-regular.ttf") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

/* Scoping reset — isolate injected header/footer from Shopify theme CSS */
.sl-hf {
  font-family: "Open Sans", system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #191d21;
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.sl-hf *, .sl-hf *::before, .sl-hf *::after {
  box-sizing: border-box;
}
.sl-hf ul, .sl-hf ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
.sl-hf img {
  max-width: 100%;
  height: auto;
}
.sl-hf a {
  text-decoration: none;
  color: inherit;
}

/* Reset Shopify's .grid (12x12 grid-template) — our grid-cols-* handle column count */
.sl-hf .grid {
  grid-template: none !important;
}

/* Override Shopify's sticky header z-index if needed */
.sl-hf .sl-header {
  position: sticky;
  top: 0;
  z-index: 9999;
}
`

// Read existing partials.css (from Tailwind) and append scoping
const existingCss = existsSync(join(partialsDir, 'partials.css'))
  ? readFileSync(join(partialsDir, 'partials.css'), 'utf-8')
  : ''

writeFileSync(join(partialsDir, 'partials.css'), scopingCss + '\n' + existingCss)
console.log('  partials.css written')

console.log('Partials build complete.')
