/**
 * Seed persona embeddings in Mothership Supabase
 *
 * Reads personas with full_content but no embedding,
 * generates embeddings via OpenAI, and stores them.
 *
 * Usage:
 *   node scripts/seed-persona-embeddings.mjs
 *
 * Zero dependencies — uses Supabase REST API + OpenAI REST API directly.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load env from astro-content/.env
const envPath = resolve(__dirname, '../apps/astro-content/.env')
const envFile = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envFile.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/)
  if (match) env[match[1]] = match[2].trim()
}

const SUPABASE_URL = env.MOTHERSHIP_SUPABASE_URL
const SUPABASE_KEY = env.MOTHERSHIP_SUPABASE_SERVICE_KEY
const OPENAI_KEY = env.OPENAI_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error('Missing env vars. Check apps/astro-content/.env')
  process.exit(1)
}

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
}

// ── Supabase REST helpers ──────────────────────────────────────────────────

async function sbGet(table, select, filter = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filter}`
  const res = await fetch(url, { headers: sbHeaders })
  if (!res.ok) throw new Error(`Supabase GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function sbPatch(table, id, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: sbHeaders,
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Supabase PATCH ${table}/${id}: ${res.status} ${await res.text()}`)
}

// ── OpenAI embedding ───────────────────────────────────────────────────────

async function generateEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    }),
  })

  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.data[0].embedding
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching personas...\n')

  const personas = await sbGet('personas', 'id,name,full_content,embedding', '&full_content=not.is.null')

  const needsEmbedding = personas.filter((p) => !p.embedding)
  const alreadyDone = personas.filter((p) => p.embedding)

  console.log(`Found ${personas.length} personas total`)
  console.log(`  ${alreadyDone.length} already have embeddings`)
  console.log(`  ${needsEmbedding.length} need embeddings\n`)

  for (const p of alreadyDone) {
    console.log(`  ✓ ${p.name} — already embedded`)
  }

  if (needsEmbedding.length === 0) {
    console.log('\nAll personas already have embeddings.')
    return
  }

  for (const persona of needsEmbedding) {
    const text = `${persona.name}\n\n${persona.full_content}`
    console.log(`  Generating embedding for "${persona.name}" (${text.length} chars)...`)

    const embedding = await generateEmbedding(text)
    await sbPatch('personas', persona.id, { embedding: JSON.stringify(embedding) })

    console.log(`  ✓ ${persona.name} — embedded (${embedding.length} dimensions)`)
  }

  // Verify
  console.log('\nVerifying...\n')
  const verified = await sbGet('personas', 'name,embedding', '&full_content=not.is.null')
  for (const p of verified) {
    console.log(`  ${p.embedding ? '✓ HAS EMBEDDING' : '✗ MISSING'} — ${p.name}`)
  }

  console.log('\nDone!')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
