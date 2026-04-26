#!/usr/bin/env node
/**
 * Audit-only: for every PDP MDX, fetch Shopify product images and HEAD-check
 * the Cloudinary URL the ImageGallery component will request. Reports
 * missing assets per product. Read-only — no uploads.
 *
 * Usage: node scripts/audit-pdp-images.mjs
 */

import { readdir, readFile, readFileSync } from 'node:fs'
import { readdir as readdirP, readFile as readFileP } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const PRODUCTS_DIR = join(REPO_ROOT, 'apps/astro-content/src/content/products')

// Minimal .env parser
const envPath = join(REPO_ROOT, 'apps/astro-content/.env')
const envText = (await readFileP(envPath, 'utf8')).split('\n')
for (const line of envText) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const SHOP = 'southland-organics.myshopify.com'
const SF_TOKEN = process.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN
const CLOUD = 'southland-organics'

if (!SF_TOKEN) {
  console.error('Missing PUBLIC_SHOPIFY_STOREFRONT_TOKEN in apps/astro-content/.env')
  process.exit(1)
}

// Mirrors ImageGallery.tsx optimizeUrl filename → publicId logic
function expectedCloudinaryUrl(shopifyUrl, handle) {
  const cleanUrl = shopifyUrl.split('?')[0]
  const fullFilename = cleanUrl.split('/').pop() || ''
  const filename = fullFilename.replace(/\.[^.]+$/, '')
  const cleanFilename = decodeURIComponent(filename).replace(/[^a-zA-Z0-9_.-]/g, '_')
  const publicId = `Southland Website/products/${handle}/${cleanFilename}`
  return `https://res.cloudinary.com/${CLOUD}/image/upload/${encodeURI(publicId)}`
}

async function getShopifyImages(handle) {
  const res = await fetch(`https://${SHOP}/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SF_TOKEN,
    },
    body: JSON.stringify({
      query: `{ product(handle: "${handle}") { images(first: 20) { edges { node { url } } } } }`,
    }),
  })
  const json = await res.json()
  const product = json?.data?.product
  if (!product) return null
  return product.images.edges.map((e) => e.node.url)
}

async function headCheck(url) {
  const res = await fetch(url, { method: 'HEAD' })
  return res.status
}

async function getHandles() {
  const files = (await readdirP(PRODUCTS_DIR)).filter((f) => f.endsWith('.mdx'))
  const handles = []
  for (const f of files) {
    const content = await readFileP(join(PRODUCTS_DIR, f), 'utf8')
    const m = content.match(/^shopifyHandle:\s*"([^"]+)"/m)
    if (m) handles.push({ mdx: f, handle: m[1] })
  }
  return handles
}

async function main() {
  const handles = await getHandles()
  console.log(`Auditing ${handles.length} PDP products\n`)

  const rows = []
  let totalImages = 0
  let totalMissing = 0

  for (const { mdx, handle } of handles) {
    const shopifyUrls = await getShopifyImages(handle)
    if (!shopifyUrls) {
      rows.push({ handle, mdx, status: 'NOT_FOUND_IN_SHOPIFY', missing: [] })
      continue
    }
    const checks = await Promise.all(
      shopifyUrls.map(async (url) => {
        const cdnUrl = expectedCloudinaryUrl(url, handle)
        const status = await headCheck(cdnUrl)
        return { url, cdnUrl, status }
      })
    )
    const missing = checks.filter((c) => c.status !== 200)
    totalImages += checks.length
    totalMissing += missing.length
    rows.push({ handle, mdx, total: checks.length, missing })
  }

  console.log('Results:\n')
  console.log('Product Handle'.padEnd(45) + 'Total'.padEnd(8) + 'Missing')
  console.log('-'.repeat(70))
  for (const r of rows) {
    if (r.status === 'NOT_FOUND_IN_SHOPIFY') {
      console.log(`${r.handle.padEnd(45)}${'—'.padEnd(8)}NOT IN SHOPIFY`)
      continue
    }
    const mark = r.missing.length === 0 ? '✓' : '✗'
    console.log(
      `${r.handle.padEnd(45)}${String(r.total).padEnd(8)}${String(r.missing.length).padEnd(4)} ${mark}`
    )
  }

  console.log('\n' + '='.repeat(70))
  console.log(`Totals: ${totalImages} images checked, ${totalMissing} missing`)

  const broken = rows.filter((r) => r.missing && r.missing.length > 0)
  if (broken.length > 0) {
    console.log('\nMissing assets detail:\n')
    for (const r of broken) {
      console.log(`\n[${r.handle}]`)
      for (const m of r.missing) {
        const filename = m.url.split('?')[0].split('/').pop()
        console.log(`  ${m.status}  ${filename}`)
      }
    }
  } else {
    console.log('\nAll PDP images resolve in Cloudinary. ✓')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
