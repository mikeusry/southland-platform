/**
 * Design review screenshot tool
 *
 * Captures full-page screenshots of the local dev site for AI design review.
 * Uses Playwright (no install needed — npx handles it).
 *
 * Usage:
 *   node apps/astro-content/scripts/screenshots.mjs
 *
 * Prerequisites:
 *   - Dev server running: pnpm --filter @southland/astro-content dev
 *   - Playwright installed: npx playwright install chromium
 *
 * Output:
 *   apps/astro-content/screenshots/{name}-{viewport}.png
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.BASE_URL || 'http://localhost:4400'
const OUT = resolve(__dirname, '../screenshots')

mkdirSync(OUT, { recursive: true })

// ── Pages to capture ────────────────────────────────────────────────────────
const pages = [
  { name: '01-commercial-hero', path: '/poultry/commercial/' },
  { name: '02-podcast-hub', path: '/podcast/' },
  { name: '03-blog-index', path: '/blog/' },
  { name: '04-about', path: '/about/' },
  { name: '05-contact', path: '/contact/' },
]

// ── Viewports ───────────────────────────────────────────────────────────────
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
]

// ── Capture ─────────────────────────────────────────────────────────────────
const browser = await chromium.launch()
let success = 0
let failed = 0

for (const p of pages) {
  for (const vp of viewports) {
    const filename = `${p.name}-${vp.name}.png`
    try {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
      })
      await page.goto(`${BASE}${p.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      })
      await page.waitForTimeout(2000) // fonts + images
      await page.screenshot({ path: `${OUT}/${filename}`, fullPage: true })
      console.log(`  ${filename}`)
      success++
      await page.close()
    } catch (e) {
      console.log(`  ${filename} -- ${e.message.split('\n')[0]}`)
      failed++
    }
  }
}

await browser.close()
console.log(`\nDone: ${success} captured, ${failed} failed`)
console.log(`Screenshots: ${OUT}`)
