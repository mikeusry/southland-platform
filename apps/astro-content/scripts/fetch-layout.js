#!/usr/bin/env node
/**
 * Fetch navigation layout from Shopify
 *
 * Tries in order:
 * 1. LAYOUT_API_URL env var (e.g., running Shopify app's /api/layout)
 * 2. Shopify Storefront API with STOREFRONT_TOKEN
 * 3. Falls back to existing cached layout.json
 *
 * Usage: node scripts/fetch-layout.js
 *        LAYOUT_API_URL=http://localhost:3000/api/layout node scripts/fetch-layout.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../src/data');
const outputPath = join(dataDir, 'layout.json');

// Load env file
function loadEnv(path) {
  try {
    const content = readFileSync(path, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          let value = trimmed.slice(eqIndex + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      }
    }
  } catch (e) {
    // Silently ignore
  }
}

// Load from shopify-app/.env
loadEnv(join(__dirname, '../../shopify-app/.env'));

const SHOP_DOMAIN = process.env.SHOP_DOMAIN || 'southland-organics.myshopify.com';
const STOREFRONT_TOKEN = process.env.STOREFRONT_TOKEN;
const LAYOUT_API_URL = process.env.LAYOUT_API_URL;
const SHOPIFY_DOMAIN = 'https://southlandorganics.com';
const PODCAST_PATHS = ['/podcast'];

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

function normalizeUrl(url) {
  if (!url) return '#';
  if (url.startsWith('http')) {
    const podcastMatch = url.match(/southlandorganics\.com(\/podcast.*)/);
    if (podcastMatch) return podcastMatch[1];
    return url;
  }
  if (url.startsWith('/')) {
    if (PODCAST_PATHS.some(p => url.startsWith(p))) return url;
    return `${SHOPIFY_DOMAIN}${url}`;
  }
  return url;
}

function transformMenuItem(item) {
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

function transformFooterToColumns(items) {
  return items?.map(item => ({
    title: item.title,
    links: item.items?.map(child => ({
      label: child.title,
      href: normalizeUrl(child.url),
    })) || [],
  })) || [];
}

// Method 1: Fetch from running Shopify app's /api/layout endpoint
async function fetchFromApp() {
  if (!LAYOUT_API_URL) return null;

  console.log(`  Trying app endpoint: ${LAYOUT_API_URL}`);
  const response = await fetch(LAYOUT_API_URL);
  if (!response.ok) throw new Error(`App API error: ${response.status}`);

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// Method 2: Fetch directly from Storefront API
async function fetchFromStorefront() {
  if (!STOREFRONT_TOKEN) return null;

  console.log(`  Trying Storefront API: ${SHOP_DOMAIN}`);
  const response = await fetch(
    `https://${SHOP_DOMAIN}/api/2024-04/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: LAYOUT_QUERY }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Storefront API error: ${response.status} - ${text.slice(0, 100)}`);
  }

  const { data, errors } = await response.json();
  if (errors?.length) throw new Error(`GraphQL: ${errors[0].message}`);

  return {
    _meta: {
      synced: new Date().toISOString(),
      source: 'Shopify Storefront API',
    },
    header: {
      logoUrl: data.shop?.brand?.logo?.image?.url ||
        'https://southlandorganics.com/cdn/shop/files/Southland_Organics_Horizontal.svg',
      logoAlt: data.shop?.name || 'Southland Organics',
      navigation: data.menu?.items?.map(transformMenuItem) || [],
    },
    footer: {
      columns: transformFooterToColumns(data.footerMenu?.items),
      copyright: `© ${new Date().getFullYear()} Southland Organics. All rights reserved.`,
      socialLinks: [
        { platform: 'facebook', url: 'https://facebook.com/southlandorganics', icon: 'facebook' },
        { platform: 'instagram', url: 'https://instagram.com/southlandorganics', icon: 'instagram' },
        { platform: 'youtube', url: 'https://youtube.com/@southlandorganics', icon: 'youtube' },
      ],
    },
  };
}

async function fetchLayout() {
  console.log('Fetching layout data...');

  let layoutData = null;
  let source = null;

  // Try app endpoint first
  try {
    layoutData = await fetchFromApp();
    if (layoutData) source = 'app';
  } catch (err) {
    console.log(`  App endpoint failed: ${err.message}`);
  }

  // Try Storefront API
  if (!layoutData) {
    try {
      layoutData = await fetchFromStorefront();
      if (layoutData) source = 'storefront';
    } catch (err) {
      console.log(`  Storefront API failed: ${err.message}`);
    }
  }

  // Fall back to cached
  if (!layoutData && existsSync(outputPath)) {
    console.log('  Using cached layout.json');
    const cached = JSON.parse(readFileSync(outputPath, 'utf-8'));
    console.log(`  Cached from: ${cached._meta?.synced || 'unknown'}`);
    return; // Don't overwrite
  }

  if (!layoutData) {
    console.error('  No data source available and no cache exists');
    process.exit(1);
  }

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(layoutData, null, 2));

  console.log(`  Source: ${source}`);
  console.log(`  Navigation items: ${layoutData.header.navigation.length}`);
  layoutData.header.navigation.forEach(item => {
    console.log(`    - ${item.label} (${item.children?.length || 0} children)`);
  });
  console.log(`  Footer columns: ${layoutData.footer.columns.length}`);
  console.log(`  Written to: src/data/layout.json`);
}

fetchLayout().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
