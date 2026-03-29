#!/usr/bin/env node
/**
 * Ingest 10 Gumlet videos into Mux, then update blog post frontmatter.
 *
 * Flow:
 *   1. Query Gumlet API for each video's HLS playback URL + metadata
 *   2. Create Mux asset from URL (Mux ingests the HLS stream)
 *   3. Wait for Mux to finish processing
 *   4. Get Mux playback ID
 *   5. Update MDX frontmatter with muxPlaybackIds
 *   6. Insert into Supabase voice_videos for catalog completeness
 *
 * Usage: node scripts/gumlet-to-mux-ingest.mjs
 */

import { readFileSync, writeFileSync } from 'fs'

// ── Config (read from environment — never hardcode secrets) ─────────────────
const GUMLET_KEY = process.env.GUMLET_API_KEY
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const BRAND_ID = 'dbca74d1-d751-48c2-95ed-f432490b0826' // Southland

if (!GUMLET_KEY || !MUX_TOKEN_ID || !MUX_TOKEN_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required env vars: GUMLET_API_KEY, MUX_TOKEN_ID, MUX_TOKEN_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const BLOG_DIR = './apps/astro-content/src/content/blog'

const GUMLET_VIDEOS = [
  { slug: 'how-smart-lighting-systems-help-create-calmer-more-productive-flocks', gumletId: '693b134d3cf0cd39b93f81b6' },
  { slug: 'dealing-with-mass-mortality-the-emotional-side-of-poultry-farming', gumletId: '693b0fca3cf0cd39b93f1c5f' },
  { slug: 'tips-and-tricks-for-poultry-farmers-part-8', gumletId: '693b09803cf0cd39b93e5912' },
  { slug: 'behind-the-equipment-innovative-poultry-products-llc-at-the-sunbelt-ag-expo', gumletId: '6900d23960d267cdc06173b3' },
  { slug: '7-electrical-best-practices-for-poultry-growers', gumletId: '693b0b107ada4a2333dfb200' },
  { slug: 'tips-and-tricks-for-poultry-farmers-part-7', gumletId: '693b0980b45f2098f4b4de9d' },
  { slug: 'behind-the-equipment-apex-predator-mortality-disposal-at-the-sunbelt-ag-expo', gumletId: '6900d3015ecad45f6c8bbed7' },
  { slug: 'a-thanksgiving-message-of-gratitude-and-encouragement', gumletId: '691e3940d00d0f5c9436946c' },
  { slug: 'all-about-litter-what-s-really-happening-on-the-poultry-house-floor', gumletId: '690bde44ea35e3d6340f1f3e' },
  { slug: 'water-consumption-what-it-indicates-about-bird-health', gumletId: '68e7a9454d658cce80568ebb' },
]

const muxAuth = 'Basic ' + Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64')

// ── Step 1: Get Gumlet video metadata ───────────────────────────────────────
async function getGumletVideo(gumletId) {
  const res = await fetch(`https://api.gumlet.com/v1/video/assets/${gumletId}`, {
    headers: { Authorization: `Bearer ${GUMLET_KEY}` },
  })
  if (!res.ok) throw new Error(`Gumlet ${gumletId}: ${res.status}`)
  return res.json()
}

// ── Step 2: Create Mux asset from URL ───────────────────────────────────────
async function createMuxAsset(videoUrl, title) {
  const res = await fetch('https://api.mux.com/video/v1/assets', {
    method: 'POST',
    headers: {
      Authorization: muxAuth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [{ url: videoUrl }],
      playback_policy: ['public'],
      passthrough: JSON.stringify({ title, source: 'gumlet-migration' }),
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Mux create asset: ${res.status} ${err}`)
  }
  const data = await res.json()
  return data.data
}

// ── Step 3: Poll until Mux asset is ready ───────────────────────────────────
async function waitForMuxAsset(assetId, maxWaitMs = 300_000) {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
      headers: { Authorization: muxAuth },
    })
    const data = await res.json()
    const status = data.data.status

    if (status === 'ready') return data.data
    if (status === 'errored') throw new Error(`Mux asset ${assetId} errored`)

    console.log(`    Mux status: ${status}... waiting`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error(`Mux asset ${assetId} timed out`)
}

// ── Step 4: Update MDX frontmatter ──────────────────────────────────────────
function updateMdxFrontmatter(slug, muxPlaybackId) {
  const path = `${BLOG_DIR}/${slug}.mdx`
  let content = readFileSync(path, 'utf-8')

  if (content.includes('muxPlaybackIds:')) {
    // Already has the field — replace
    content = content.replace(
      /muxPlaybackIds:\s*\[[^\]]*\]/,
      `muxPlaybackIds: ["${muxPlaybackId}"]`
    )
  } else if (content.includes('featuredImage:')) {
    content = content.replace(
      /(featuredImage:\s*"[^"]*")/,
      `$1\nmuxPlaybackIds: ["${muxPlaybackId}"]`
    )
  }

  writeFileSync(path, content)
}

// ── Step 5: Insert into Supabase ────────────────────────────────────────────
async function insertSupabase(record) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/voice_videos`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(record),
  })
  if (!res.ok) {
    const err = await res.text()
    console.warn(`    Supabase insert warning: ${res.status} ${err}`)
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Gumlet → Mux Ingest ===')
  console.log(`Videos: ${GUMLET_VIDEOS.length}`)
  console.log()

  const results = []

  for (const video of GUMLET_VIDEOS) {
    console.log(`[${video.slug}]`)

    // 1. Get Gumlet metadata
    console.log('  1. Fetching Gumlet metadata...')
    const gumlet = await getGumletVideo(video.gumletId)
    const title = gumlet.input.title
    const duration = Math.round(gumlet.input.duration)
    const downloadUrl = gumlet.original_download_url
    console.log(`     Title: ${title}`)
    console.log(`     Duration: ${duration}s`)
    console.log(`     Download URL: ${downloadUrl?.substring(0, 80)}...`)

    if (!downloadUrl) throw new Error('No download URL from Gumlet')

    // 2. Create Mux asset from signed download URL
    console.log('  2. Creating Mux asset...')
    const muxAsset = await createMuxAsset(downloadUrl, title)
    const assetId = muxAsset.id
    console.log(`     Asset ID: ${assetId}`)

    // 3. Wait for ready
    console.log('  3. Waiting for Mux processing...')
    const readyAsset = await waitForMuxAsset(assetId)
    const playbackId = readyAsset.playback_ids?.[0]?.id
    console.log(`     Playback ID: ${playbackId}`)

    // 4. Update MDX
    console.log('  4. Updating MDX frontmatter...')
    updateMdxFrontmatter(video.slug, playbackId)
    console.log('     Done')

    // 5. Insert into Supabase
    console.log('  5. Inserting into Supabase...')
    await insertSupabase({
      brand_id: BRAND_ID,
      business_unit: 'commercial-poultry',
      source_platform: 'mux',
      external_id: assetId,
      original_platform: 'gumlet',
      original_external_id: video.gumletId,
      title,
      duration_seconds: duration,
      url: `https://stream.mux.com/${playbackId}.m3u8`,
      thumbnail_url: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
      author: 'allen',
      transcript_status: 'pending',
    })
    console.log('     Done')

    results.push({ slug: video.slug, title, gumletId: video.gumletId, muxAssetId: assetId, muxPlaybackId: playbackId })
    console.log(`  ✅ Complete: ${playbackId}`)
    console.log()
  }

  // Write results
  writeFileSync('./test-results/live-crawl/gumlet-to-mux-results.json', JSON.stringify(results, null, 2))
  console.log('=== DONE ===')
  console.log(`Ingested: ${results.length}/${GUMLET_VIDEOS.length}`)
  results.forEach((r) => {
    console.log(`  ${r.slug}: ${r.muxPlaybackId}`)
  })
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
