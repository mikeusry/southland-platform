#!/usr/bin/env node
/**
 * Lightweight Research Brief Generator
 *
 * For any page type: topics, blog posts, landing pages, podcast companions.
 * Pulls DataForSEO keywords + Mothership voice RAG + persona context
 * into a single brief that feeds content writing.
 *
 * Usage:
 *   node scripts/research-brief.mjs "soil health organic farming"
 *   node scripts/research-brief.mjs "backyard chicken probiotics" --persona backyard
 *   node scripts/research-brief.mjs "humic acid lawn care" --persona lawn --depth deep
 *
 * Options:
 *   --persona <backyard|commercial|lawn>   Target persona (auto-detected if omitted)
 *   --depth <standard|deep>               standard=2 API calls, deep=5 (default: standard)
 *   --type <blog|topic|landing|podcast>    Page type for brief framing (default: blog)
 *   --skip-research                        Skip DataForSEO (use when you have keywords already)
 *   --skip-voice                           Skip voice RAG lookup
 *
 * Output:
 *   briefs/{keyword-slug}-{date}.json   — structured brief
 *   briefs/{keyword-slug}-{date}.md     — readable summary
 *
 * Zero external dependencies — uses REST APIs directly.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Load env ───────────────────────────────────────────────────────────────

const envPath = resolve(ROOT, 'apps/astro-content/.env')
const envFile = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envFile.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/)
  if (match) env[match[1]] = match[2].trim()
}

const DFS_LOGIN = env.DATAFORSEO_LOGIN
const DFS_PASSWORD = env.DATAFORSEO_PASSWORD
const SUPABASE_URL = env.MOTHERSHIP_SUPABASE_URL
const SUPABASE_KEY = env.MOTHERSHIP_SUPABASE_SERVICE_KEY
const OPENAI_KEY = env.OPENAI_API_KEY

// ── Parse CLI args ─────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const flags = {}
const positional = []

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2)
    if (args[i + 1] && !args[i + 1].startsWith('--')) {
      flags[key] = args[++i]
    } else {
      flags[key] = true
    }
  } else {
    positional.push(args[i])
  }
}

const seed = positional.join(' ')
if (!seed) {
  console.error('Usage: node scripts/research-brief.mjs "keyword phrase" [--persona backyard] [--depth deep]')
  process.exit(1)
}

const PERSONA = flags.persona || null // auto-detect
const DEPTH = flags.depth || 'standard'
const PAGE_TYPE = flags.type || 'blog'
const SKIP_RESEARCH = flags['skip-research'] === true
const SKIP_VOICE = flags['skip-voice'] === true

const slug = seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const date = new Date().toISOString().slice(0, 10)

console.log(`\n  Research Brief: "${seed}"`)
console.log(`  Persona: ${PERSONA || 'auto-detect'}`)
console.log(`  Depth: ${DEPTH}`)
console.log(`  Page type: ${PAGE_TYPE}\n`)

// ── Helpers ────────────────────────────────────────────────────────────────

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

const dfsHeaders = {
  Authorization: `Basic ${Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString('base64')}`,
  'Content-Type': 'application/json',
}

async function dfsPost(endpoint, body) {
  const res = await fetch(`https://api.dataforseo.com/v3${endpoint}`, {
    method: 'POST',
    headers: dfsHeaders,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${await res.text()}`)
  return res.json()
}

async function sbGet(table, select, filter = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filter}`
  const res = await fetch(url, { headers: sbHeaders })
  if (!res.ok) throw new Error(`Supabase GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function generateEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.data[0].embedding
}

// ── Step 1: DataForSEO Keyword Research ────────────────────────────────────

function extractKeyword(item) {
  return {
    keyword: item.keyword,
    volume: item.keyword_info?.search_volume || 0,
    difficulty: item.keyword_properties?.keyword_difficulty ?? null,
    cpc: item.keyword_info?.cpc || 0,
    intent: item.search_intent_info?.main_intent || 'unknown',
    isQuestion: /^(what|how|why|when|where|who|which|can|does|do|is|are|should|will)\b/i.test(item.keyword),
  }
}

async function researchKeywords() {
  if (SKIP_RESEARCH || !DFS_LOGIN || !DFS_PASSWORD) {
    if (!SKIP_RESEARCH) console.log('  ! DataForSEO credentials missing — skipping research')
    return { clusters: [], questions: [], overview: { total_keywords: 0, total_volume: 0 } }
  }

  console.log('  Fetching keyword suggestions...')
  const suggestionsRes = await dfsPost('/dataforseo_labs/google/keyword_suggestions/live', [{
    keyword: seed,
    location_code: 2840,
    language_code: 'en',
    limit: 50,
    include_seed_keyword: true,
  }])

  const rawSuggestions = suggestionsRes.tasks?.[0]?.result?.[0]?.items || []
  const suggestions = rawSuggestions
    .filter((item) => item?.keyword_data?.keyword || item?.keyword)
    .map((item) => extractKeyword(item.keyword_data || item))
  console.log(`    ${suggestions.length} keyword suggestions`)

  console.log('  Fetching related keywords...')
  const relatedRes = await dfsPost('/dataforseo_labs/google/related_keywords/live', [{
    keyword: seed,
    location_code: 2840,
    language_code: 'en',
    limit: 20,
    depth: 2,
  }])

  // Build clusters from related keyword groups
  const clusters = []
  const relatedGroups = relatedRes.tasks?.[0]?.result || []

  for (const group of relatedGroups) {
    if (!group?.keyword_data?.keyword) continue
    const head = extractKeyword(group.keyword_data)
    const children = (group.related_keywords || [])
      .filter((r) => r?.keyword_data?.keyword)
      .map((r) => extractKeyword(r.keyword_data))
    const all = [head, ...children].filter((k) => k.volume >= 50)

    if (all.length === 0) continue

    const totalVolume = all.reduce((sum, k) => sum + k.volume, 0)
    if (totalVolume < 200) continue

    clusters.push({
      name: head.keyword,
      volume: totalVolume,
      avgDifficulty: Math.round(all.reduce((s, k) => s + (k.difficulty || 0), 0) / all.length),
      intent: head.intent,
      keywords: all.sort((a, b) => b.volume - a.volume),
      questions: all.filter((k) => k.isQuestion),
    })
  }

  // Deep mode: expand top 3 clusters
  if (DEPTH === 'deep' && clusters.length > 0) {
    const topSeeds = clusters.slice(0, 3).map((c) => c.name)
    for (const s of topSeeds) {
      console.log(`  Deep expanding: "${s}"...`)
      const expandRes = await dfsPost('/dataforseo_labs/google/keyword_suggestions/live', [{
        keyword: s,
        location_code: 2840,
        language_code: 'en',
        limit: 30,
        include_seed_keyword: false,
      }])
      const expanded = (expandRes.tasks?.[0]?.result || []).map(extractKeyword)
      const cluster = clusters.find((c) => c.name === s)
      if (cluster) {
        const existing = new Set(cluster.keywords.map((k) => k.keyword))
        for (const kw of expanded) {
          if (!existing.has(kw.keyword) && kw.volume >= 50) {
            cluster.keywords.push(kw)
            if (kw.isQuestion) cluster.questions.push(kw)
            existing.add(kw.keyword)
          }
        }
        cluster.keywords.sort((a, b) => b.volume - a.volume)
        cluster.volume = cluster.keywords.reduce((s, k) => s + k.volume, 0)
      }
    }
  }

  // Merge standalone suggestions into clusters or create unclustered bucket
  const clusteredKws = new Set(clusters.flatMap((c) => c.keywords.map((k) => k.keyword)))
  const unclustered = suggestions.filter((k) => !clusteredKws.has(k.keyword) && k.volume >= 50)
  if (unclustered.length > 0) {
    clusters.push({
      name: `${seed} (unclustered)`,
      volume: unclustered.reduce((s, k) => s + k.volume, 0),
      avgDifficulty: Math.round(unclustered.reduce((s, k) => s + (k.difficulty || 0), 0) / unclustered.length),
      intent: 'mixed',
      keywords: unclustered.sort((a, b) => b.volume - a.volume),
      questions: unclustered.filter((k) => k.isQuestion),
    })
  }

  clusters.sort((a, b) => b.volume - a.volume)

  const allKeywords = clusters.flatMap((c) => c.keywords)
  const allQuestions = clusters.flatMap((c) => c.questions)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 15)

  return {
    clusters,
    questions: allQuestions,
    overview: {
      total_keywords: allKeywords.length,
      total_volume: allKeywords.reduce((s, k) => s + k.volume, 0),
      avg_difficulty: allKeywords.length
        ? Math.round(allKeywords.reduce((s, k) => s + (k.difficulty || 0), 0) / allKeywords.length)
        : 0,
      questions_found: allQuestions.length,
      clusters_found: clusters.length,
    },
  }
}

// ── Step 2: Voice RAG ──────────────────────────────────────────────────────

const BIZ_KEYWORDS = {
  backyard: ['poultry', 'chicken', 'backyard', 'flock', 'hen', 'egg', 'bird', 'probiotic'],
  commercial: ['poultry', 'broiler', 'commercial', 'grower', 'integrator', 'mortality', 'feed'],
  lawn: ['lawn', 'turf', 'soil', 'garden', 'grass', 'organic', 'microbe', 'humic'],
}

const PERSONA_TO_BIZ = {
  backyard: 'backyard-poultry',
  commercial: 'commercial-poultry',
  lawn: 'lawn-garden',
}

async function fetchVoice(persona) {
  if (SKIP_VOICE || !SUPABASE_URL || !SUPABASE_KEY) {
    if (!SKIP_VOICE) console.log('  ! Supabase credentials missing — skipping voice')
    return { knowledge: [], style: [], brand: [] }
  }

  const biz = PERSONA_TO_BIZ[persona] || 'general'
  const searchTerms = BIZ_KEYWORDS[persona] || seed.split(/\s+/).slice(0, 3)

  // Fetch voice videos for this business unit
  console.log(`  Fetching voice samples (${biz})...`)
  let videoIds = []
  try {
    const videos = await sbGet('voice_videos', 'id,title', `&business_unit=eq.${biz}&limit=10`)
    videoIds = videos.map((v) => v.id)
  } catch {
    // voice_videos table may not exist for all brands
  }

  let knowledge = []
  let style = []

  if (videoIds.length > 0) {
    const idList = `(${videoIds.join(',')})`

    try {
      const knowledgeChunks = await sbGet(
        'transcript_chunks',
        'content,chunk_type,topics',
        `&video_id=in.${idList}&chunk_type=in.(howto,fact,story)&limit=8`
      )
      knowledge = knowledgeChunks.map((c) => ({
        content: c.content,
        type: c.chunk_type,
        topics: c.topics,
      }))
    } catch { /* table may not exist */ }

    try {
      const styleChunks = await sbGet(
        'transcript_chunks',
        'content,chunk_type',
        `&video_id=in.${idList}&chunk_type=in.(story,opinion,rant)&limit=5`
      )
      style = styleChunks.map((c) => ({
        content: c.content,
        type: c.chunk_type,
      }))
    } catch { /* table may not exist */ }
  }

  // Fetch brand knowledge
  console.log('  Fetching brand knowledge...')
  let brand = []
  try {
    const SOUTHLAND_BRAND_ID = 'dbca74d1-d751-48c2-95ed-f432490b0826'
    const bk = await sbGet(
      'brand_knowledge',
      'title,content,content_type,knowledge_type,tags',
      `&brand_id=eq.${SOUTHLAND_BRAND_ID}&limit=20`
    )
    // Filter by relevance to seed keyword
    const seedWords = seed.toLowerCase().split(/\s+/)
    brand = bk
      .map((doc) => {
        const text = `${doc.title} ${doc.content}`.toLowerCase()
        const relevance = seedWords.filter((w) => text.includes(w)).length
        return { ...doc, relevance }
      })
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5)
      .map(({ relevance, ...doc }) => doc)
  } catch { /* table may not exist */ }

  return { knowledge, style, brand }
}

// ── Step 3: Persona Detection ──────────────────────────────────────────────

async function detectPersona() {
  if (PERSONA) return PERSONA

  if (!OPENAI_KEY || !SUPABASE_URL) {
    console.log('  ! Cannot auto-detect persona — using general')
    return 'general'
  }

  console.log('  Auto-detecting persona...')
  const embedding = await generateEmbedding(seed)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_personas`, {
    method: 'POST',
    headers: sbHeaders,
    body: JSON.stringify({
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 3,
      p_brand_slug: 'southland-organics',
    }),
  })

  if (!res.ok) {
    console.log('  ! Persona detection failed — using general')
    return 'general'
  }

  const matches = await res.json()
  if (matches.length === 0) return 'general'

  const slugMap = {
    'broiler-bill': 'commercial',
    'backyard-betty': 'backyard',
    'turf-pro-taylor': 'lawn',
    'turf-taylor': 'lawn',
  }

  const top = matches[0]
  const detected = slugMap[top.slug] || 'general'
  console.log(`  Detected: ${top.name} (${(top.similarity * 100).toFixed(1)}%)`)
  return detected
}

// ── Step 4: Assemble Brief ─────────────────────────────────────────────────

const FIELD_CONSTRAINTS = {
  blog: {
    title: { maxChars: 70, description: 'SEO title tag' },
    metaDescription: { minChars: 150, maxChars: 160 },
    body: { minWords: 800, maxWords: 2000 },
    faq: { minItems: 3, maxItems: 6 },
  },
  topic: {
    title: { maxChars: 60, description: 'Topic page title' },
    metaDescription: { minChars: 150, maxChars: 160 },
    body: { minWords: 200, maxWords: 600 },
    faq: { minItems: 0, maxItems: 3 },
  },
  landing: {
    heroHeadline: { maxChars: 60 },
    heroSubheadline: { maxChars: 120 },
    seoDescription: { minChars: 150, maxChars: 160 },
    body: { minWords: 300, maxWords: 800 },
    faq: { minItems: 3, maxItems: 6 },
  },
  podcast: {
    title: { maxChars: 80, description: 'Episode title' },
    description: { minChars: 100, maxChars: 300 },
    talkingPoints: { minItems: 5, maxItems: 10 },
    body: { minWords: 200, maxWords: 500, description: 'Show notes' },
  },
}

function assembleBrief(research, voice, persona) {
  const topKeywords = research.clusters
    .flatMap((c) => c.keywords)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 15)

  return {
    seed,
    generatedAt: new Date().toISOString(),
    pageType: PAGE_TYPE,
    persona,

    // Research
    research: {
      overview: research.overview,
      topKeywords,
      questions: research.questions,
      clusters: research.clusters.map((c) => ({
        name: c.name,
        volume: c.volume,
        avgDifficulty: c.avgDifficulty,
        intent: c.intent,
        keywordCount: c.keywords.length,
        topKeywords: c.keywords.slice(0, 5),
        questions: c.questions.slice(0, 3),
      })),
    },

    // Voice
    voice: {
      knowledge: voice.knowledge,
      style: voice.style,
      brand: voice.brand,
    },

    // Constraints
    fieldConstraints: FIELD_CONSTRAINTS[PAGE_TYPE] || FIELD_CONSTRAINTS.blog,
  }
}

// ── Step 5: Render Markdown Summary ────────────────────────────────────────

function renderMarkdown(brief) {
  const lines = []
  const ln = (s = '') => lines.push(s)

  ln(`# Research Brief: ${brief.seed}`)
  ln()
  ln(`**Generated:** ${brief.generatedAt}`)
  ln(`**Page Type:** ${brief.pageType}`)
  ln(`**Target Persona:** ${brief.persona}`)
  ln()

  // Overview
  const o = brief.research.overview
  ln(`## Research Overview`)
  ln()
  ln(`| Metric | Value |`)
  ln(`|--------|-------|`)
  ln(`| Total Keywords | ${o.total_keywords} |`)
  ln(`| Total Search Volume | ${o.total_volume.toLocaleString()} |`)
  ln(`| Avg Difficulty | ${o.avg_difficulty} |`)
  ln(`| Questions Found | ${o.questions_found} |`)
  ln(`| Clusters | ${o.clusters_found} |`)
  ln()

  // Top keywords
  if (brief.research.topKeywords.length > 0) {
    ln(`## Top Keywords`)
    ln()
    ln(`| Keyword | Volume | KD | Intent |`)
    ln(`|---------|--------|-----|--------|`)
    for (const k of brief.research.topKeywords) {
      ln(`| ${k.keyword} | ${k.volume.toLocaleString()} | ${k.difficulty ?? '—'} | ${k.intent} |`)
    }
    ln()
  }

  // Questions
  if (brief.research.questions.length > 0) {
    ln(`## Questions to Answer`)
    ln()
    for (const q of brief.research.questions) {
      ln(`- ${q.keyword} (${q.volume.toLocaleString()}/mo)`)
    }
    ln()
  }

  // Clusters
  if (brief.research.clusters.length > 0) {
    ln(`## Keyword Clusters`)
    ln()
    for (const c of brief.research.clusters) {
      ln(`### ${c.name}`)
      ln(`Volume: ${c.volume.toLocaleString()} | KD: ${c.avgDifficulty} | Intent: ${c.intent} | Keywords: ${c.keywordCount}`)
      ln()
      if (c.topKeywords.length > 0) {
        for (const k of c.topKeywords) {
          ln(`- ${k.keyword} (${k.volume.toLocaleString()}/mo, KD ${k.difficulty ?? '—'})`)
        }
        ln()
      }
    }
  }

  // Voice samples
  if (brief.voice.knowledge.length > 0) {
    ln(`## Voice Samples (Knowledge)`)
    ln()
    for (const v of brief.voice.knowledge) {
      ln(`> ${v.content.slice(0, 200)}...`)
      ln(`> — *${v.type}*`)
      ln()
    }
  }

  if (brief.voice.style.length > 0) {
    ln(`## Voice Samples (Style)`)
    ln()
    for (const v of brief.voice.style) {
      ln(`> ${v.content.slice(0, 200)}...`)
      ln(`> — *${v.type}*`)
      ln()
    }
  }

  // Constraints
  ln(`## Field Constraints`)
  ln()
  ln(`| Field | Constraint |`)
  ln(`|-------|-----------|`)
  for (const [field, constraint] of Object.entries(brief.fieldConstraints)) {
    const parts = Object.entries(constraint).filter(([k]) => k !== 'description').map(([k, v]) => `${k}: ${v}`)
    ln(`| ${field} | ${parts.join(', ')} |`)
  }
  ln()

  ln(`---`)
  ln(`*Use this brief to write content, then validate with \`/api/content-score\` for persona alignment.*`)

  return lines.join('\n')
}

// ── Run ────────────────────────────────────────────────────────────────────

async function main() {
  const persona = await detectPersona()
  console.log()

  const [research, voice] = await Promise.all([
    researchKeywords(),
    fetchVoice(persona),
  ])

  console.log()
  console.log(`  Research: ${research.overview.total_keywords} keywords, ${research.overview.questions_found} questions`)
  console.log(`  Voice: ${voice.knowledge.length} knowledge, ${voice.style.length} style, ${voice.brand.length} brand`)
  console.log()

  const brief = assembleBrief(research, voice, persona)
  const markdown = renderMarkdown(brief)

  // Write output
  const outDir = resolve(ROOT, 'briefs')
  mkdirSync(outDir, { recursive: true })

  const jsonPath = resolve(outDir, `${slug}-${date}.json`)
  const mdPath = resolve(outDir, `${slug}-${date}.md`)

  writeFileSync(jsonPath, JSON.stringify(brief, null, 2))
  writeFileSync(mdPath, markdown)

  console.log(`  Written:`)
  console.log(`    ${jsonPath}`)
  console.log(`    ${mdPath}`)
  console.log()
}

main().catch((err) => {
  console.error('\nFatal:', err.message)
  process.exit(1)
})
