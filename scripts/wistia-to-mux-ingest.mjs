#!/usr/bin/env node
/**
 * Ingest 15 Wistia videos into Mux, then update blog post frontmatter.
 *
 * Flow:
 *   1. Query Wistia API for each video's metadata + download URL
 *   2. Create Mux asset from URL
 *   3. Wait for Mux to finish processing
 *   4. Get Mux playback ID
 *   5. Update MDX frontmatter with muxPlaybackIds
 *   6. Remove Wistia swatch image from MDX body
 *   7. Insert into Supabase voice_videos for catalog completeness
 *
 * Usage: node scripts/wistia-to-mux-ingest.mjs
 */

import { readFileSync, writeFileSync } from 'fs'

// ── Config ──────────────────────────────────────────────────────────────────
const WISTIA_API_TOKEN = '90757b9571dd615301058c01be307133c704aa02aa48c5aa3708f14718cb46bb'
const MUX_TOKEN_ID = '97056194-f5c3-474a-a059-435cef221507'
const MUX_TOKEN_SECRET = 'wMRhOmRQDxVGSEEdXL+EH20VDRry97CISK8XuDy4YJYOlUQ9u+NGVbcv6dAS3nCW382ovqQzaim'
const SUPABASE_URL = 'https://zpjvhvyersytloyykylf.supabase.co'
const SUPABASE_KEY = 'sb_secret_7BrR3qU0iZSRYzpdjp1M_g_P7X9HAJX'
const BRAND_ID = 'dbca74d1-d751-48c2-95ed-f432490b0826' // Southland

const BLOG_DIR = './apps/astro-content/src/content/blog'

const WISTIA_VIDEOS = [
  { slug: 'clean-sanitize-or-disinfect', wistiaId: '7gqmjbra30' },
  { slug: 'rickets-in-chickens', wistiaId: 'n6wwiytglt' },
  { slug: 'how-to-run-big-ole-bird-poultry-probiotic', wistiaId: 'al945kyt5k' },
  { slug: 'vitamins-for-chickens-catalyst', wistiaId: 'bve6faql8u' },
  { slug: 'catalyst-liquid-chicken-vitamins', wistiaId: 'osatgf6xk8' },
  { slug: 'our-best-organic-lawn-care-products', wistiaId: 'pev4h9zny6' },
  { slug: 'when-do-chickens-start-laying-eggs', wistiaId: 'eykcmcwty0' },
  { slug: 'how-to-use-our-products-for-healthy-backyard-birds', wistiaId: 'wjpk8b6kzd' },
  { slug: 'defeating-dermatitis', wistiaId: 'll3lp318zy' },
  { slug: 'a-healthy-floor-is-a-healthy-bird', wistiaId: 'z1cooyso1x' },
  { slug: 'difference-between-surfactant-and-surfactin', wistiaId: 'th4b968qtb' },
  { slug: 'port-for-vault-toilets', wistiaId: '4mmes7iu66' },
  { slug: 'perfect-gifts-for-people-with-chickens', wistiaId: '7360poi69v' },
  { slug: 'video-keys-to-windrow-success-part-1', wistiaId: '9ywo9ag0a3' },
  { slug: 'the-secret-to-a-perfect-thanksgiving', wistiaId: '67x9bdycm2' },
]

const muxAuth = 'Basic ' + Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64')

// ── Step 1: Get Wistia video metadata + download URL ────────────────────────
async function getWistiaVideo(wistiaId) {
  const res = await fetch(`https://api.wistia.com/v1/medias/${wistiaId}.json`, {
    headers: { Authorization: `Bearer ${WISTIA_API_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Wistia ${wistiaId}: ${res.status} ${await res.text()}`)
  const data = await res.json()

  // Find the best quality original file asset
  const assets = data.assets || []
  const original = assets.find((a) => a.type === 'OriginalFile') ||
    assets.find((a) => a.type === 'HdMp4VideoFile') ||
    assets.find((a) => a.type === 'Mp4VideoFile') ||
    assets[0]

  return {
    title: data.name,
    duration: Math.round(data.duration || 0),
    downloadUrl: original?.url,
    wistiaId: data.hashed_id,
  }
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
      passthrough: JSON.stringify({ title, source: 'wistia-migration' }),
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

// ── Step 4: Update MDX frontmatter + remove Wistia swatch ──────────────────
function updateMdx(slug, muxPlaybackId, wistiaId) {
  const path = `${BLOG_DIR}/${slug}.mdx`
  let content = readFileSync(path, 'utf-8')

  // Add muxPlaybackIds to frontmatter
  if (content.includes('muxPlaybackIds:')) {
    content = content.replace(
      /muxPlaybackIds:\s*\[[^\]]*\]/,
      `muxPlaybackIds: ["${muxPlaybackId}"]`,
    )
  } else if (content.includes('featuredImage:')) {
    content = content.replace(
      /(featuredImage:\s*"[^"]*")/,
      `$1\nmuxPlaybackIds: ["${muxPlaybackId}"]`,
    )
  }

  // Remove Wistia swatch image lines (with or without bold wrappers)
  content = content.replace(/\*?\*?\!\[\]\(https:\/\/fast\.wistia\.com\/embed\/medias\/[^)]+\)\*?\*?\s*\n?/g, '')

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
  console.log('=== Wistia → Mux Ingest ===')
  console.log(`Videos: ${WISTIA_VIDEOS.length}`)
  console.log()

  const results = []

  for (const video of WISTIA_VIDEOS) {
    console.log(`[${video.slug}]`)

    // 1. Get Wistia metadata
    console.log('  1. Fetching Wistia metadata...')
    const wistia = await getWistiaVideo(video.wistiaId)
    console.log(`     Title: ${wistia.title}`)
    console.log(`     Duration: ${wistia.duration}s`)
    console.log(`     Download URL: ${wistia.downloadUrl?.substring(0, 80)}...`)

    if (!wistia.downloadUrl) throw new Error(`No download URL for Wistia ${video.wistiaId}`)

    // 2. Create Mux asset
    console.log('  2. Creating Mux asset...')
    const muxAsset = await createMuxAsset(wistia.downloadUrl, wistia.title)
    const assetId = muxAsset.id
    console.log(`     Asset ID: ${assetId}`)

    // 3. Wait for ready
    console.log('  3. Waiting for Mux processing...')
    const readyAsset = await waitForMuxAsset(assetId)
    const playbackId = readyAsset.playback_ids?.[0]?.id
    console.log(`     Playback ID: ${playbackId}`)

    // 4. Update MDX
    console.log('  4. Updating MDX...')
    updateMdx(video.slug, playbackId, video.wistiaId)
    console.log('     Done')

    // 5. Insert into Supabase
    console.log('  5. Inserting into Supabase...')
    await insertSupabase({
      brand_id: BRAND_ID,
      business_unit: 'southland',
      source_platform: 'mux',
      external_id: assetId,
      original_platform: 'wistia',
      original_external_id: video.wistiaId,
      title: wistia.title,
      duration_seconds: wistia.duration,
      url: `https://stream.mux.com/${playbackId}.m3u8`,
      thumbnail_url: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
      author: 'allen',
      transcript_status: 'pending',
    })
    console.log('     Done')

    results.push({
      slug: video.slug,
      title: wistia.title,
      wistiaId: video.wistiaId,
      muxAssetId: assetId,
      muxPlaybackId: playbackId,
    })
    console.log(`  ✅ Complete: ${playbackId}`)
    console.log()
  }

  // Write results
  writeFileSync('./test-results/wistia-to-mux-results.json', JSON.stringify(results, null, 2))
  console.log('=== DONE ===')
  console.log(`Ingested: ${results.length}/${WISTIA_VIDEOS.length}`)
  results.forEach((r) => {
    console.log(`  ${r.slug}: ${r.muxPlaybackId}`)
  })
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
