#!/usr/bin/env node
/**
 * Build Persona Blog Map
 *
 * Calls /api/site-audit/scan-blog in batches to score all blog posts
 * through Mothership persona vectors. Writes persona-blog-map.json.
 *
 * Usage:
 *   node scripts/build-persona-blog-map.mjs              # Full scan
 *   node scripts/build-persona-blog-map.mjs --limit 10   # Test with 10 posts
 *   node scripts/build-persona-blog-map.mjs --dry-run    # Show plan only
 *
 * Requires dev server running on port 4400.
 */

const BASE_URL = 'http://localhost:4400'
const BATCH_SIZE = 10
const OUTPUT_FILE = new URL('../src/data/persona-blog-map.json', import.meta.url)

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitArg = args.find((a) => a.startsWith('--limit'))
const maxLimit = limitArg ? parseInt(args[args.indexOf(limitArg) + 1] || '999', 10) : 999

// Normalize Mothership slugs (broiler-bill) to our short keys (bill)
function normalizeSlug(slug) {
  if (!slug) return null
  const map = { 'broiler-bill': 'bill', 'backyard-betty': 'betty', 'turf-taylor': 'taylor' }
  return map[slug] || slug
}

async function main() {
  console.log('🧠 Persona Blog Map Builder')
  console.log('='.repeat(50))
  console.log(`Server: ${BASE_URL}`)
  console.log(`Batch size: ${BATCH_SIZE}`)
  console.log(`Max posts: ${maxLimit}`)
  if (dryRun) console.log('⚠️  DRY RUN — no file will be written')
  console.log()

  // Check server is running
  try {
    const health = await fetch(`${BASE_URL}/admin/`, { redirect: 'manual' })
    if (health.status >= 500) throw new Error(`Server error: ${health.status}`)
  } catch (err) {
    console.error('❌ Dev server not running. Start with: pnpm --filter @southland/astro-content dev')
    process.exit(1)
  }

  const allResults = []
  let offset = 0
  let total = null

  while (true) {
    const limit = Math.min(BATCH_SIZE, maxLimit - offset)
    if (limit <= 0) break

    console.log(`  Scanning batch: offset=${offset}, limit=${limit}...`)

    if (dryRun) {
      console.log('  (skipped — dry run)')
      break
    }

    const res = await fetch(`${BASE_URL}/api/site-audit/scan-blog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset, limit }),
    })

    if (!res.ok) {
      console.error(`  ❌ API error: ${res.status}`)
      const text = await res.text()
      console.error(text.slice(0, 500))
      break
    }

    const data = await res.json()
    total = data.total
    allResults.push(...data.results)

    const scored = data.results.length
    const vectored = data.results.filter((r) => r.vector).length
    console.log(`  ✓ ${scored} scored (${vectored} with vectors), ${data.remaining} remaining`)

    if (data.remaining <= 0 || offset + scored >= maxLimit) break
    offset += scored

    // Pause between batches
    await new Promise((r) => setTimeout(r, 1000))
  }

  if (dryRun) {
    console.log('\nDry run complete. Would scan all blog posts.')
    return
  }

  // Build the map
  const map = {
    generatedAt: new Date().toISOString(),
    total: total || allResults.length,
    scored: allResults.length,
    entries: allResults.map((r) => ({
      slug: r.slug,
      title: r.title,
      tags: r.tags,
      segment: r.segment,
      heuristicPersona: r.heuristic?.persona || null,
      heuristicSource: r.heuristic?.source || null,
      vectorPersona: normalizeSlug(r.vector?.primarySlug) || null,
      vectorScore: r.vector?.score || 0,
      scores: r.vector?.scores || { bill: 0, betty: 0, taylor: 0 },
      aligned: r.vector?.aligned || false,
      confidence: r.vector?.aligned
        ? 'high'
        : r.heuristic
          ? 'medium'
          : 'low',
    })),
  }

  // Summary
  const byPersona = { bill: 0, betty: 0, taylor: 0, none: 0 }
  const agreementCount = { agree: 0, disagree: 0, heuristicOnly: 0, vectorOnly: 0, neither: 0 }

  for (const e of map.entries) {
    const final = e.vectorPersona || e.heuristicPersona
    if (final && final in byPersona) byPersona[final]++
    else byPersona.none++

    if (e.heuristicPersona && e.vectorPersona) {
      if (e.heuristicPersona === e.vectorPersona) agreementCount.agree++
      else agreementCount.disagree++
    } else if (e.heuristicPersona) agreementCount.heuristicOnly++
    else if (e.vectorPersona) agreementCount.vectorOnly++
    else agreementCount.neither++
  }

  console.log('\n📊 Summary')
  console.log(`  Total: ${map.scored} posts`)
  console.log(`  Bill: ${byPersona.bill} | Betty: ${byPersona.betty} | Taylor: ${byPersona.taylor} | None: ${byPersona.none}`)
  console.log(`  Agreement: ${agreementCount.agree} agree, ${agreementCount.disagree} disagree`)
  console.log(`  Heuristic only: ${agreementCount.heuristicOnly} | Vector only: ${agreementCount.vectorOnly} | Neither: ${agreementCount.neither}`)

  // Write file
  const { writeFileSync, mkdirSync } = await import('fs')
  const { dirname } = await import('path')
  const { fileURLToPath } = await import('url')

  const outPath = fileURLToPath(OUTPUT_FILE)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(map, null, 2))
  console.log(`\n✅ Written to ${outPath}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
