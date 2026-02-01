#!/usr/bin/env node
/**
 * Sync Shopify Theme CSS to local tokens
 *
 * Fetches the active theme's CSS and extracts typography tokens
 * for pixel-perfect matching with Southland Organics Shopify store.
 *
 * Usage:
 *   node scripts/sync-shopify-theme.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from mothership/.env manually
function loadEnv(path) {
  try {
    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          let value = trimmed.slice(eqIndex + 1).trim();
          // Remove quotes
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      }
    }
  } catch (e) {
    console.log(`   Note: Could not load ${path}`);
  }
}

loadEnv('/Users/mikeusry/CODING/mothership/.env');

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL || 'southland-organics.myshopify.com';
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2024-04';

if (!SHOPIFY_TOKEN) {
  console.error('❌ SHOPIFY_ACCESS_TOKEN not set in mothership/.env');
  process.exit(1);
}

async function shopifyRequest(endpoint) {
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getActiveTheme() {
  console.log('📦 Fetching themes...');
  const data = await shopifyRequest('/themes.json');
  const activeTheme = data.themes.find(t => t.role === 'main');

  if (!activeTheme) {
    throw new Error('No active theme found');
  }

  console.log(`   Active theme: ${activeTheme.name} (ID: ${activeTheme.id})`);
  return activeTheme;
}

async function getThemeAsset(themeId, assetKey) {
  try {
    const data = await shopifyRequest(`/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`);
    return data.asset?.value || null;
  } catch (e) {
    return null;
  }
}

async function getThemeSettings(themeId) {
  console.log('\n📄 Fetching theme settings...');
  const settingsData = await getThemeAsset(themeId, 'config/settings_data.json');

  if (settingsData) {
    try {
      return JSON.parse(settingsData);
    } catch (e) {
      console.log('   ⚠️  Could not parse settings_data.json');
    }
  }

  return null;
}

async function getThemeCSS(themeId) {
  console.log('\n🎨 Fetching theme CSS...');

  // Get list of all assets
  const assetsData = await shopifyRequest(`/themes/${themeId}/assets.json`);
  const allAssets = assetsData.assets || [];

  // Filter to CSS files
  const cssAssets = allAssets
    .filter(a => a.key.endsWith('.css') || a.key.endsWith('.scss.css'))
    .map(a => a.key);

  console.log(`   Found ${cssAssets.length} CSS files`);

  let combinedCSS = '';

  for (const cssKey of cssAssets) {
    const css = await getThemeAsset(themeId, cssKey);
    if (css) {
      combinedCSS += `\n/* === ${cssKey} === */\n${css}\n`;
      console.log(`   ✅ ${cssKey}`);
    }
  }

  return combinedCSS;
}

function extractTypographyFromSettings(settings) {
  if (!settings?.current) return {};

  const current = settings.current;
  const typography = {};

  // Extract font and color settings
  for (const [key, value] of Object.entries(current)) {
    if (key.includes('font') || key.includes('type') || key.includes('heading') ||
        key.includes('body') || key.includes('color') || key.includes('background')) {
      typography[key] = value;
    }
  }

  return typography;
}

function extractTypographyFromCSS(css) {
  const tokens = {
    fonts: {},
    fontSizes: {},
    fontWeights: {},
    lineHeights: {},
    letterSpacing: {},
    colors: {}
  };

  // Extract CSS custom properties from :root
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/g);
  if (rootMatch) {
    for (const block of rootMatch) {
      const props = block.match(/--[^:]+:\s*[^;]+/g) || [];
      for (const prop of props) {
        const [name, value] = prop.split(':').map(s => s.trim());

        if (name.includes('font-family') || name.includes('type-')) {
          tokens.fonts[name] = value;
        } else if (name.includes('font-size') || name.includes('size-')) {
          tokens.fontSizes[name] = value;
        } else if (name.includes('font-weight') || name.includes('weight-')) {
          tokens.fontWeights[name] = value;
        } else if (name.includes('line-height') || name.includes('leading-')) {
          tokens.lineHeights[name] = value;
        } else if (name.includes('letter-spacing') || name.includes('tracking-')) {
          tokens.letterSpacing[name] = value;
        } else if (name.includes('color') || name.includes('background') || name.includes('text')) {
          tokens.colors[name] = value;
        }
      }
    }
  }

  return tokens;
}

function generateTokensCSS(settings, cssTokens) {
  const timestamp = new Date().toISOString().split('T')[0];

  let output = `/**
 * Shopify Theme Tokens
 *
 * Design tokens extracted from Southland Organics Shopify theme.
 * These ensure pixel-perfect consistency between Astro content pages and Shopify.
 *
 * Last synced: ${timestamp}
 * Source: Shopify Admin API (Theme: Booster)
 */

/* Eveleth Dot - Heading Font (self-hosted, premium) */
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

  /* Font Sizes (from Shopify Booster theme) */
  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-base: 16px;
  --font-size-md: 24px;
  --font-size-lg: 38px;
  --font-size-xl: 48px;

  /* Font Weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Line Heights */
  --line-height-tight: 1.2;
  --line-height-snug: 1.375;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* Letter Spacing */
  --letter-spacing-tighter: -0.03em;
  --letter-spacing-tight: -0.02em;
  --letter-spacing-normal: 0;
  --letter-spacing-wide: 0.05em;

  /* Colors - Primary (synced from Shopify Jan 2025) */
  --color-bg: #ffffff;
  --color-text: #191d21;
  --color-title: #2c5234;
  --color-link: #44883e;
  --color-accent: #44883e;
  --color-accent-hover: #2c5234;

  /* Colors - Secondary */
  --color-secondary-bg: #efefef;
  --color-secondary-text: #686363;
  --color-alert: #ef5600;
  --color-success: #44883e;
  --color-border: #e5e7eb;

  /* Layout */
  --max-width: 1400px;
  --border-radius: 0px;
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;

  /* Spacing */
  --header-height: 75px;
  --section-padding: 4rem;
  --container-padding: 1rem;
`;

  // Add any additional tokens from theme
  if (Object.keys(cssTokens.colors).length > 0) {
    output += `\n  /* Additional theme tokens */\n`;
    for (const [name, value] of Object.entries(cssTokens.colors)) {
      output += `  ${name}: ${value};\n`;
    }
  }

  output += `}

/* Typography Base Styles - Matches Shopify Booster Theme */
body {
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-normal);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: var(--color-title);
  margin: 0;
}

h1 {
  font-size: var(--font-size-xl);
  letter-spacing: var(--letter-spacing-tighter);
}

h2 {
  font-size: var(--font-size-lg);
  letter-spacing: var(--letter-spacing-tight);
}

h3 {
  font-size: var(--font-size-md);
  letter-spacing: var(--letter-spacing-tight);
}

h4 {
  font-size: 1.25rem;
  letter-spacing: var(--letter-spacing-normal);
}

h5 {
  font-size: var(--font-size-base);
  letter-spacing: var(--letter-spacing-normal);
}

h6 {
  font-size: var(--font-size-sm);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

a {
  color: var(--color-link);
  text-decoration: none;
  transition: color 0.2s ease;
}

a:hover {
  color: var(--color-accent-hover);
}

p {
  margin: 0 0 1em;
}

/* Prose Content Spacing */
.prose h1,
.prose h2,
.prose h3,
.prose h4,
.prose h5,
.prose h6,
article h1,
article h2,
article h3,
article h4,
article h5,
article h6 {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

.prose h1:first-child,
.prose h2:first-child,
.prose h3:first-child,
article > h1:first-child,
article > h2:first-child,
article > h3:first-child {
  margin-top: 0;
}

.prose h2,
article h2 {
  margin-top: 2em;
}

.prose p,
.prose ul,
.prose ol {
  margin-bottom: 1em;
}

.prose ul,
.prose ol {
  padding-left: 1.5em;
}

.prose li {
  margin-bottom: 0.25em;
}

.prose strong {
  font-weight: var(--font-weight-semibold);
}

.prose a {
  color: var(--color-link);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.prose a:hover {
  color: var(--color-accent-hover);
}

/* Blockquote */
.prose blockquote {
  border-left: 4px solid var(--color-accent);
  padding-left: 1em;
  margin: 1.5em 0;
  color: var(--color-secondary-text);
  font-style: italic;
}

/* Code */
.prose code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875em;
  background: var(--color-secondary-bg);
  padding: 0.2em 0.4em;
  border-radius: var(--border-radius-sm);
}

.prose pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1em;
  border-radius: var(--border-radius-md);
  overflow-x: auto;
  margin: 1.5em 0;
}

.prose pre code {
  background: none;
  padding: 0;
}
`;

  return output;
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🛍️  Shopify Theme → Local Tokens Sync');
  console.log('=' .repeat(60));
  console.log(`\n📋 Configuration:`);
  console.log(`   Store: ${SHOPIFY_STORE}`);

  try {
    // Get active theme
    const theme = await getActiveTheme();

    // Get theme settings
    const settings = await getThemeSettings(theme.id);
    const settingsTokens = settings ? extractTypographyFromSettings(settings) : {};

    if (Object.keys(settingsTokens).length > 0) {
      console.log(`   Found ${Object.keys(settingsTokens).length} theme settings`);
    }

    // Get theme CSS
    const css = await getThemeCSS(theme.id);
    const cssTokens = extractTypographyFromCSS(css);

    console.log(`\n📊 Extracted tokens:`);
    console.log(`   Fonts: ${Object.keys(cssTokens.fonts).length}`);
    console.log(`   Font sizes: ${Object.keys(cssTokens.fontSizes).length}`);
    console.log(`   Colors: ${Object.keys(cssTokens.colors).length}`);

    // Generate output CSS
    const outputCSS = generateTokensCSS(settingsTokens, cssTokens);

    // Write to file
    const outputPath = join(__dirname, '../src/styles/shopify-tokens.css');
    writeFileSync(outputPath, outputCSS);

    console.log(`\n✅ Written to: src/styles/shopify-tokens.css`);

    // Also save raw CSS for reference
    const rawPath = join(__dirname, '../.shopify-theme-raw.css');
    writeFileSync(rawPath, css);
    console.log(`📁 Raw CSS saved to: .shopify-theme-raw.css`);

    console.log('=' .repeat(60));

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
