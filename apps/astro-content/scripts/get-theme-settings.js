#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

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
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      }
    }
  } catch (e) {}
}

loadEnv('/Users/mikeusry/CODING/mothership/.env');

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL || 'southland-organics.myshopify.com';
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2024-04';

async function shopifyRequest(endpoint) {
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}

async function main() {
  const themes = await shopifyRequest('/themes.json');
  const activeTheme = themes.themes.find(t => t.role === 'main');

  console.log('Theme:', activeTheme.name);

  const settingsAsset = await shopifyRequest(`/themes/${activeTheme.id}/assets.json?asset[key]=config/settings_data.json`);
  const settings = JSON.parse(settingsAsset.asset.value);

  // Save full settings for reference
  writeFileSync('.shopify-theme-settings.json', JSON.stringify(settings, null, 2));
  console.log('\nFull settings saved to .shopify-theme-settings.json');

  // Extract typography-related settings
  const current = settings.current || {};
  const typographyKeys = Object.keys(current).filter(k =>
    k.includes('font') || k.includes('type') || k.includes('heading') ||
    k.includes('body') || k.includes('color') || k.includes('text')
  );

  console.log('\nTypography Settings:');
  console.log('====================');
  for (const key of typographyKeys.sort()) {
    const val = current[key];
    console.log(`${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
  }
}

main();
