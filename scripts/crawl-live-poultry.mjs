#!/usr/bin/env node
/**
 * Playwright crawl of live Shopify poultry pages
 *
 * Extracts: title, H1, meta description, product handles, internal links,
 * collection grid products, navigation structure, and full text content.
 *
 * Waits for Shopify JS to hydrate (the earlier Apify crawl missed this).
 *
 * Usage: cd mothership && npx playwright test --config=../southland-platform/scripts/crawl-live-poultry.mjs
 * OR:    node scripts/crawl-live-poultry.mjs  (uses playwright directly)
 */

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = join(__dirname, '..', 'test-results', 'live-crawl')
mkdirSync(RESULTS_DIR, { recursive: true })

const BASE = 'https://www.southlandorganics.com'

// All poultry-related URLs to crawl on the live Shopify site
const POULTRY_URLS = [
  // Homepage
  '/',

  // Collection pages (these are what Shopify currently serves)
  '/collections/poultry',
  '/collections/poultry-broilers',
  '/collections/backyard-birds',
  '/collections/poultry-breeders',
  '/collections/turkey',
  '/collections/game-birds',

  // Product pages (poultry products)
  '/products/poultry-probiotic',
  '/products/hen-helper',
  '/products/poultry-litter-amendment',
  '/products/catalyst-poultry-vitamin',
  '/products/natural-mite-control-livestock-poultry',
  '/products/backyard-poultry-bundle-chicken-supplements',
  '/products/mother-load-apple-cider-vinegar-for-chickens',
  '/products/liquid-catalyst',

  // Blog/content pages that might reference poultry
  '/blogs/news/tagged/poultry',
  '/blogs/news/tagged/backyard-chickens',

  // Pages that might exist
  '/pages/about',
  '/pages/contact',
  '/pages/poultry',  // might 404
  '/pages/commercial-poultry', // might 404
]

async function crawlPage(page, url) {
  const fullUrl = `${BASE}${url}`
  console.log(`  Crawling: ${fullUrl}`)

  const result = {
    url: fullUrl,
    path: url,
    timestamp: new Date().toISOString(),
    status: null,
    redirectedTo: null,
    title: null,
    h1: null,
    h2s: [],
    metaDescription: null,
    metaCanonical: null,
    ogTitle: null,
    ogDescription: null,
    productHandles: [],
    productTitles: [],
    productPrices: [],
    collectionTitle: null,
    collectionDescription: null,
    internalLinks: [],
    navLinks: [],
    breadcrumbs: [],
    images: [],
    videoEmbeds: [],
    schemaOrg: [],
    bodyTextPreview: null, // first 2000 chars of visible text
    productCount: 0,
    hasAddToCart: false,
    hasReviews: false,
    shopifyThemeSection: null,
    error: null,
  }

  try {
    const response = await page.goto(fullUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    result.status = response?.status() ?? null
    result.redirectedTo = response?.url() !== fullUrl ? response?.url() : null

    // Wait for Shopify's JS to hydrate — this is what the Apify crawl missed
    await page.waitForTimeout(3000)

    // Try waiting for common Shopify elements
    try {
      await page.waitForSelector('.product-card, .collection-product, .grid__item, [data-product-id]', { timeout: 5000 })
    } catch {
      // Not all pages have products — that's OK
    }

    // Extract everything
    result.title = await page.title()

    result.h1 = await page.$eval('h1', el => el.textContent?.trim()).catch(() => null)
    result.h2s = await page.$$eval('h2', els => els.map(el => el.textContent?.trim()).filter(Boolean)).catch(() => [])

    result.metaDescription = await page.$eval('meta[name="description"]', el => el.getAttribute('content')).catch(() => null)
    result.metaCanonical = await page.$eval('link[rel="canonical"]', el => el.getAttribute('href')).catch(() => null)
    result.ogTitle = await page.$eval('meta[property="og:title"]', el => el.getAttribute('content')).catch(() => null)
    result.ogDescription = await page.$eval('meta[property="og:description"]', el => el.getAttribute('content')).catch(() => null)

    // Product handles from links
    result.productHandles = await page.$$eval('a[href*="/products/"]', els => {
      const handles = new Set()
      els.forEach(el => {
        const match = el.getAttribute('href')?.match(/\/products\/([^/?#]+)/)
        if (match) handles.add(match[1])
      })
      return [...handles]
    }).catch(() => [])

    // Product titles from grid cards
    result.productTitles = await page.$$eval(
      '.product-card__title, .product-card h3, .grid-product__title, [data-product-title], .product-title',
      els => els.map(el => el.textContent?.trim()).filter(Boolean)
    ).catch(() => [])

    // Product prices
    result.productPrices = await page.$$eval(
      '.product-card__price, .grid-product__price, .product-price, [data-product-price], .money',
      els => els.map(el => el.textContent?.trim()).filter(Boolean)
    ).catch(() => [])

    result.productCount = Math.max(result.productHandles.length, result.productTitles.length)

    // Collection-specific
    result.collectionTitle = await page.$eval('.collection-header__title, .collection__title, h1.title', el => el.textContent?.trim()).catch(() => null)
    result.collectionDescription = await page.$eval('.collection-header__description, .collection__description, .rte', el => el.textContent?.trim()).catch(() => null)

    // Internal links
    result.internalLinks = await page.$$eval('a[href^="/"]', els => {
      const links = new Set()
      els.forEach(el => {
        const href = el.getAttribute('href')?.split('?')[0]?.split('#')[0]
        if (href && !href.startsWith('/cdn') && !href.startsWith('/checkouts')) links.add(href)
      })
      return [...links].sort()
    }).catch(() => [])

    // Nav links (header/footer navigation)
    result.navLinks = await page.$$eval('nav a, header a, .site-nav a, .main-menu a', els => {
      return els.map(el => ({
        text: el.textContent?.trim(),
        href: el.getAttribute('href'),
      })).filter(l => l.text && l.href)
    }).catch(() => [])

    // Breadcrumbs
    result.breadcrumbs = await page.$$eval('.breadcrumb a, .breadcrumbs a, nav[aria-label="breadcrumb"] a', els => {
      return els.map(el => ({
        text: el.textContent?.trim(),
        href: el.getAttribute('href'),
      }))
    }).catch(() => [])

    // Images (non-icon, non-tracking)
    result.images = await page.$$eval('img', els => {
      return els
        .filter(el => {
          const src = el.getAttribute('src') || ''
          const w = el.naturalWidth || el.width || 0
          return w > 50 && !src.includes('tracking') && !src.includes('pixel')
        })
        .map(el => ({
          src: el.getAttribute('src'),
          alt: el.getAttribute('alt'),
          width: el.naturalWidth || el.width,
        }))
        .slice(0, 30) // cap at 30
    }).catch(() => [])

    // Video embeds
    result.videoEmbeds = await page.$$eval('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="mux"]', els => {
      return els.map(el => el.getAttribute('src'))
    }).catch(() => [])

    // Schema.org (JSON-LD)
    result.schemaOrg = await page.$$eval('script[type="application/ld+json"]', els => {
      return els.map(el => {
        try { return JSON.parse(el.textContent) }
        catch { return null }
      }).filter(Boolean)
    }).catch(() => [])

    // Add to cart present?
    result.hasAddToCart = await page.$('form[action*="/cart/add"], button[name="add"], .add-to-cart, [data-add-to-cart]').then(el => !!el).catch(() => false)

    // Reviews section?
    result.hasReviews = await page.$('.yotpo, .judge-me, .stamped, .spr-review, [data-reviews]').then(el => !!el).catch(() => false)

    // Body text preview (skip nav/footer)
    result.bodyTextPreview = await page.$eval('main, #MainContent, .main-content, [role="main"]', el => {
      return el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 2000)
    }).catch(async () => {
      // Fallback: get body text minus header/footer
      return await page.evaluate(() => {
        const body = document.body.cloneNode(true)
        body.querySelectorAll('header, footer, nav, script, style').forEach(el => el.remove())
        return body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 2000)
      })
    })

    // Shopify theme section info
    result.shopifyThemeSection = await page.$$eval('[id^="shopify-section-"]', els => {
      return els.map(el => el.id)
    }).catch(() => [])

  } catch (err) {
    result.error = err.message
    console.error(`  ERROR: ${err.message}`)
  }

  return result
}

async function main() {
  console.log('=== Live Shopify Poultry Page Crawl ===')
  console.log(`Target: ${BASE}`)
  console.log(`Pages: ${POULTRY_URLS.length}`)
  console.log()

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  })

  const page = await context.newPage()
  const results = []

  for (const url of POULTRY_URLS) {
    const result = await crawlPage(page, url)
    results.push(result)

    // Be polite — don't hammer the server
    await page.waitForTimeout(1500)
  }

  await browser.close()

  // Write full results
  const outPath = join(RESULTS_DIR, 'poultry-crawl-results.json')
  writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`\nFull results: ${outPath}`)

  // Write summary
  const summary = results.map(r => ({
    path: r.path,
    status: r.status,
    redirectedTo: r.redirectedTo,
    title: r.title,
    h1: r.h1,
    productCount: r.productCount,
    productHandles: r.productHandles,
    hasAddToCart: r.hasAddToCart,
    error: r.error,
  }))

  const summaryPath = join(RESULTS_DIR, 'poultry-crawl-summary.json')
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  console.log(`Summary: ${summaryPath}`)

  // Print quick report
  console.log('\n=== Quick Report ===\n')
  for (const r of results) {
    const status = r.error ? `ERROR` : r.redirectedTo ? `${r.status} → ${r.redirectedTo}` : `${r.status}`
    console.log(`${status.padEnd(50)} ${r.path}`)
    if (r.h1) console.log(`  H1: ${r.h1}`)
    if (r.productCount) console.log(`  Products: ${r.productCount} (${r.productHandles.slice(0, 5).join(', ')})`)
    console.log()
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
