#!/usr/bin/env node
/**
 * import-dealers.mjs
 *
 * Fetches Hog Slat / Georgia Poultry / Eastern Shore Poultry store locations
 * from hogslat.com, merges with manual dealers, and writes dealers.json.
 *
 * Usage:
 *   node scripts/import-dealers.mjs              # fetch + merge
 *   node scripts/import-dealers.mjs --offline     # skip fetch, use cached raw
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const RAW_PATH = resolve(__dirname, 'raw/hogslat-crawl.json')
const MANUAL_PATH = resolve(ROOT, 'src/data/manual-dealers.json')
const OUTPUT_PATH = resolve(ROOT, 'src/data/dealers.json')

const OFFLINE = process.argv.includes('--offline')

// ─── Helpers ───────────────────────────────────────────────────

function slugify(name, city) {
  return `${name}-${city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    const options = new URL(url)
    options.headers = { 'User-Agent': 'Mozilla/5.0 (compatible; SouthlandBot/1.0)' }
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject)
      }
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => resolve(body))
      res.on('error', reject)
    })
    req.on('error', reject)
  })
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').trim()
}

// US state abbreviations (including territories)
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC','PR','VI','GU','AS','MP',
])

// ─── Step 1: Fetch or load raw Hog Slat data ──────────────────

async function fetchHogSlatData() {
  if (OFFLINE) {
    if (!existsSync(RAW_PATH)) {
      console.error('ERROR: --offline but no cached data at', RAW_PATH)
      process.exit(1)
    }
    console.log('Using cached raw data from', RAW_PATH)
    return JSON.parse(readFileSync(RAW_PATH, 'utf-8'))
  }

  console.log('Fetching Hog Slat store locator...')
  const html = await fetch('https://www.hogslat.com/allshops')

  // Find the embedded JSON array with Id, Name, Latitude, Longitude
  const idx = html.indexOf('"Latitude"')
  if (idx === -1) {
    console.error('ERROR: Could not find store data in HTML')
    process.exit(1)
  }

  // Walk backward to find the opening [
  let start = html.lastIndexOf('[{', idx)
  if (start === -1) {
    console.error('ERROR: Could not find JSON array start')
    process.exit(1)
  }

  // Walk forward to find matching ]
  let depth = 0
  let end = start
  for (let i = start; i < html.length; i++) {
    if (html[i] === '[') depth++
    else if (html[i] === ']') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }

  const raw = html.slice(start, end)
  // HTML-unescape
  const decoded = raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")

  const data = JSON.parse(decoded)
  console.log(`Extracted ${data.length} raw locations`)

  // Cache for future --offline runs
  writeFileSync(RAW_PATH, JSON.stringify(data, null, 2))
  console.log('Cached to', RAW_PATH)

  return data
}

// ─── Step 2: Parse raw data into dealer schema ─────────────────

function parseHogSlatEntry(entry) {
  const name = entry.Name || ''
  const lat = parseFloat(entry.Latitude) || 0
  const lng = parseFloat(entry.Longitude) || 0
  const desc = entry.ShortDescription || ''

  // Determine brand
  let brand = 'Georgia Poultry Equipment'
  if (name.startsWith('Hog Slat')) brand = 'Hog Slat'
  else if (name.startsWith('Eastern Shore')) brand = 'Eastern Shore Poultry'
  else if (name.startsWith('Shenandoah')) brand = 'Shenandoah Ag Supply'

  // Extract state from name (e.g., "Georgia Poultry - Hope, AR")
  const nameStateMatch = name.match(/,\s*([A-Z]{2})\s*$/)
  const nameState = nameStateMatch ? nameStateMatch[1] : ''

  // Parse description HTML for address, city/state/zip, phone
  // Remove sup/sub tags, normalize br tags
  const cleanDesc = desc
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<sub[^>]*>.*?<\/sub>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')

  // Extract text from spans or just strip HTML
  const spans = [...cleanDesc.matchAll(/<span[^>]*>(.*?)<\/span>/gs)]
  let textLines = spans.length > 0
    ? spans.map((m) => stripHtml(m[1]))
    : stripHtml(cleanDesc).split('\n').filter(Boolean)

  // Flatten any remaining newlines
  textLines = textLines.flatMap((l) => l.split('\n')).filter(Boolean)

  let address = ''
  let city = ''
  let state = ''
  let zip = ''
  let phone = ''

  for (const line of textLines) {
    // Phone line
    const phoneMatch = line.match(/Phone:\s*([\d().\-\s]+)/)
    if (phoneMatch) {
      phone = phoneMatch[1].trim()
      continue
    }

    // City, State Zip line
    const cszMatch = line.match(/^(.*?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$/)
    if (cszMatch) {
      city = cszMatch[1].trim()
      state = cszMatch[2]
      zip = cszMatch[3] || ''
      continue
    }

    // Check for "City STATE, ZIP" variant (e.g., "Pittsfield IL, 62363")
    const altCszMatch = line.match(/^(.*?)\s+([A-Z]{2}),?\s*(\d{5}(?:-\d{4})?)?\s*$/)
    if (altCszMatch && US_STATES.has(altCszMatch[2])) {
      city = altCszMatch[1].trim()
      state = altCszMatch[2]
      zip = altCszMatch[3] || ''
      continue
    }

    // Must be address line
    if (!address) {
      address = line.trim()
    }
  }

  // Fallback: extract state from name if not parsed from description
  if (!state && nameState) {
    state = nameState
  }

  // Extract city from name if not parsed (e.g., "Hog Slat - Sigourney, IA")
  if (!city) {
    const nameCityMatch = name.match(/-\s*(.*?),\s*[A-Z]{2}\s*$/)
    if (nameCityMatch) city = nameCityMatch[1].trim()
  }

  // Determine chain
  let chain = 'hog-slat'

  // Short display name (strip brand + location suffix)
  const displayName = name

  return {
    name: displayName,
    slug: slugify(brand.split(' ')[0] + '-' + (city || name.split('-').pop()), state || 'us'),
    dealerType: 'farm_store',
    chain,
    address,
    city,
    state,
    zip,
    phone,
    lat,
    lng,
    categories: ['poultry'],
    website: 'https://www.hogslat.com',
    hours: '',
    active: true,
  }
}

// ─── Step 3: Run ───────────────────────────────────────────────

async function main() {
  // Fetch raw data
  const rawData = await fetchHogSlatData()

  // Parse all entries
  const hogSlatDealers = rawData.map(parseHogSlatEntry)

  // Filter out Canadian and invalid entries
  const usDealers = hogSlatDealers.filter((d) => {
    if (!US_STATES.has(d.state)) {
      console.log(`  Filtered out: ${d.name} (state: "${d.state}")`)
      return false
    }
    return true
  })

  console.log(`\n${usDealers.length} US Hog Slat locations`)

  // Deduplicate by slug
  const slugMap = new Map()
  for (const d of usDealers) {
    if (slugMap.has(d.slug)) {
      // Keep the one with more data
      const existing = slugMap.get(d.slug)
      if (!existing.address && d.address) slugMap.set(d.slug, d)
    } else {
      slugMap.set(d.slug, d)
    }
  }

  // Load manual dealers
  let manualDealers = []
  if (existsSync(MANUAL_PATH)) {
    manualDealers = JSON.parse(readFileSync(MANUAL_PATH, 'utf-8'))
    console.log(`Loaded ${manualDealers.length} manual dealers`)
  } else {
    console.log('No manual-dealers.json found, skipping manual merge')
  }

  // Manual dealers always win on slug collision
  for (const d of manualDealers) {
    slugMap.set(d.slug, d)
  }

  // Sort by state, then city
  const allDealers = [...slugMap.values()].sort((a, b) => {
    if (a.state !== b.state) return a.state.localeCompare(b.state)
    return a.city.localeCompare(b.city)
  })

  console.log(`\nTotal: ${allDealers.length} dealers`)

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(allDealers, null, 2) + '\n')
  console.log(`Written to ${OUTPUT_PATH}`)

  // Summary by state
  const byState = {}
  for (const d of allDealers) {
    byState[d.state] = (byState[d.state] || 0) + 1
  }
  console.log('\nBy state:')
  for (const [st, count] of Object.entries(byState).sort()) {
    console.log(`  ${st}: ${count}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
