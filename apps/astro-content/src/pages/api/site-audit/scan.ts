/**
 * Site Audit Scan Endpoint
 *
 * POST /api/site-audit/scan
 *
 * Two-axis content evaluation:
 * - Persona axis: WHO does this content speak to? (Supabase vector similarity)
 * - Quality axis: Is the content structurally sound + well-written? (local metrics)
 *
 * These are INDEPENDENT. Never blended into a single score.
 */
import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import type { PersonaScores, GapStatus } from '../../../lib/content-score.types'
import { scorePersonas, analyzeContentGap } from '../../../lib/services/mothership'
import { computeLocalSEOMetrics } from '../../../lib/services/dataforseo'

// =============================================================================
// CONSTANTS
// =============================================================================

const SCAN_VERSION = 2

// =============================================================================
// TYPES — Two independent axes, never blended
// =============================================================================

interface PersonaResult {
  audience: string
  alignment: number // 0-100
  scores: { bill: number; betty: number; taylor: number }
  unclear: boolean // no persona > 30%
}

interface QualityResult {
  // Structural
  wordCount: number
  hasMetaDescription: boolean
  metaDescOptimal: boolean
  internalLinks: number
  externalLinks: number
  stubbed: boolean
  // Writing quality (from computeLocalSEOMetrics — free, no API)
  headings: {
    h1: number
    h2: number
    h3: number
    properStructure: boolean
  }
  readability: {
    fleschKincaid: number
    gradeLevel: string
  }
}

interface EntryResult {
  slug: string
  title: string
  url: string
  persona: PersonaResult | null
  quality: QualityResult
  gap: GapStatus | null
}

interface ScanResponse {
  route: string
  scannedAt: string
  scanVersion: number
  entryCount: number
  scoredCount: number
  entries: EntryResult[]
  aggregate: {
    persona: {
      primaryAudience: string
      avgAlignment: number
      unclearCount: number
    } | null
    quality: {
      avgWordCount: number
      missingMeta: number
      noInternalLinks: number
      stubbedCount: number
      avgReadability: number
      badHeadingsCount: number
    }
    gap: {
      orphan: number
      weak: number
      confused: number
      ok: number
    } | null
  }
}

interface RouteMapping {
  pattern: string
  collection?: string
  type: 'dynamic' | 'index' | 'non-content'
  segment?: string
  defaultLimit?: number
  extractor?: (entry: any) => {
    title: string
    body: string
    description?: string
    url: string
  }
}

// =============================================================================
// EXTRACTORS — pull title + body from each collection type
// =============================================================================

function extractEpisode(entry: any) {
  const d = entry.data
  const transcriptText = d.transcript?.map((t: any) => t.text).join(' ') || ''
  return {
    title: d.title,
    body: [d.description, d.longDescription, entry.body, transcriptText]
      .filter(Boolean)
      .join('\n\n'),
    description: d.metaDescription || d.description,
    url: `/podcast/${entry.id.replace(/\.mdx?$/, '')}/`,
  }
}

function extractBlog(entry: any) {
  const d = entry.data
  return {
    title: d.title,
    body: [d.description, entry.body].filter(Boolean).join('\n\n'),
    description: d.description,
    url: `/blog/${entry.id.replace(/\.mdx?$/, '')}/`,
  }
}

function extractTeam(entry: any) {
  const d = entry.data
  return {
    title: d.name,
    body: [d.role, d.bio, entry.body, ...(d.storyParagraphs || [])].filter(Boolean).join('\n\n'),
    description: d.bio,
    url: `/team/${entry.id.replace(/\.mdx?$/, '')}/`,
  }
}

function extractTopic(entry: any) {
  const d = entry.data
  return {
    title: d.name,
    body: [d.description, entry.body].filter(Boolean).join('\n\n'),
    description: d.metaDescription || d.description,
    url: `/podcast/topics/${entry.id.replace(/\.mdx?$/, '')}/`,
  }
}

function extractShopCollection(entry: any) {
  const d = entry.data
  const faqText = (d.faq || []).map((f: any) => `${f.question}\n${f.answer}`).join('\n\n')
  return {
    title: d.title,
    body: [d.seoDescription, d.heroHeadline, d.heroSubheadline, faqText]
      .filter(Boolean)
      .join('\n\n'),
    description: d.seoDescription,
    url: `/collections/${d.handle || entry.id.replace(/\.mdx?$/, '')}/`,
  }
}

// =============================================================================
// DATA-DRIVEN ROUTE MAPPING — add new routes here
// =============================================================================

const ROUTE_MAP: RouteMapping[] = [
  {
    pattern: '/podcast/[slug]',
    collection: 'episodes',
    type: 'dynamic',
    segment: 'agriculture',
    defaultLimit: 50,
    extractor: extractEpisode,
  },
  {
    pattern: '/blog/[slug]',
    collection: 'blog',
    type: 'dynamic',
    defaultLimit: 10,
    extractor: extractBlog,
  },
  {
    pattern: '/team/[slug]',
    collection: 'team',
    type: 'dynamic',
    defaultLimit: 50,
    extractor: extractTeam,
  },
  {
    pattern: '/podcast/topics/[slug]',
    collection: 'topics',
    type: 'dynamic',
    segment: 'agriculture',
    defaultLimit: 50,
    extractor: extractTopic,
  },
  {
    pattern: '/collections/[slug]',
    collection: 'shopCollections',
    type: 'dynamic',
    defaultLimit: 50,
    extractor: extractShopCollection,
  },
  { pattern: '/podcast/', type: 'index' },
  { pattern: '/podcast/search', type: 'non-content' },
  { pattern: '/podcast/topics/', type: 'index' },
  { pattern: '/podcast/guests/', type: 'index' },
  { pattern: '/blog/', type: 'index' },
  { pattern: '/blog/category/[segment]', type: 'non-content' },
  { pattern: '/team/', type: 'index' },
]

function findMapping(route: string): RouteMapping | undefined {
  return ROUTE_MAP.find((m) => m.pattern === route)
}

// =============================================================================
// QUALITY METRICS — structural + writing quality
// =============================================================================

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function extractLinks(body: string): { internal: number; external: number } {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let internal = 0
  let external = 0
  let match
  while ((match = linkRegex.exec(body)) !== null) {
    const url = match[2]
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (url.includes('southlandorganics.com')) internal++
      else external++
    } else {
      internal++
    }
  }
  return { internal, external }
}

function computeQuality(body: string, description?: string): QualityResult {
  const wordCount = countWords(body)
  const links = extractLinks(body)
  const descLength = description?.length || 0

  // Local SEO metrics (free — no DataForSEO API call)
  const seo = computeLocalSEOMetrics(body)

  return {
    wordCount,
    hasMetaDescription: Boolean(description),
    metaDescOptimal: descLength >= 120 && descLength <= 160,
    internalLinks: links.internal,
    externalLinks: links.external,
    stubbed: wordCount < 150,
    headings: {
      h1: seo.headings?.h1Count ?? 0,
      h2: seo.headings?.h2Count ?? 0,
      h3: seo.headings?.h3Count ?? 0,
      properStructure: seo.headings?.hasProperStructure ?? false,
    },
    readability: {
      fleschKincaid: seo.readability?.fleschKincaid ?? 0,
      gradeLevel: seo.readability?.gradeLevel ?? 'unknown',
    },
  }
}

// =============================================================================
// PERSONA MAPPING — convert raw Mothership scores to PersonaResult
// =============================================================================

function mapPersona(raw: PersonaScores): PersonaResult {
  return {
    audience: raw.primary.name,
    alignment: Math.round(raw.primary.score * 100),
    scores: {
      bill: Math.round(raw.scores.broilerBill * 100),
      betty: Math.round(raw.scores.backyardBetty * 100),
      taylor: Math.round(raw.scores.turfTaylor * 100),
    },
    unclear: raw.primary.score < 0.3,
  }
}

// =============================================================================
// ENDPOINT
// =============================================================================

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()

  try {
    const { route, limit } = (await request.json()) as {
      route: string
      limit?: number
    }

    if (!route) {
      return new Response(
        JSON.stringify({ error: true, message: 'Missing required field: route' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const mapping = findMapping(route)

    // Non-content or unmapped route
    if (!mapping || mapping.type === 'non-content' || mapping.type === 'index') {
      return new Response(
        JSON.stringify({
          route,
          scannable: false,
          type: mapping?.type || 'non-content',
          scanVersion: SCAN_VERSION,
          scannedAt: new Date().toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Dynamic route — fetch collection entries and score
    const collectionName = mapping.collection!
    const extractor = mapping.extractor!
    const entryLimit = limit ?? mapping.defaultLimit ?? 50

    let allEntries: any[]
    try {
      allEntries = await getCollection(collectionName as any, ({ data }: any) => {
        return data.draft !== true
      })
    } catch {
      allEntries = await getCollection(collectionName as any)
    }

    // Sort by date (newest first) for consistent sampling
    allEntries.sort((a: any, b: any) => {
      const dateA = a.data.publishDate || a.data.order || 0
      const dateB = b.data.publishDate || b.data.order || 0
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

    const entriesToScore = allEntries.slice(0, entryLimit)
    const entries: EntryResult[] = []

    for (const entry of entriesToScore) {
      const extracted = extractor(entry)
      const contentText = `${extracted.title}\n\n${extracted.body}`

      // Persona axis (Supabase + OpenAI)
      const personaRaw = await scorePersonas(contentText, mapping.segment)
      const persona = personaRaw ? mapPersona(personaRaw) : null

      // Gap analysis (Supabase)
      const gap = await analyzeContentGap(extracted.title, extracted.body, extracted.url)

      // Quality axis (always — local computation)
      const quality = computeQuality(extracted.body, extracted.description)

      entries.push({
        slug: entry.id.replace(/\.mdx?$/, ''),
        title: extracted.title,
        url: extracted.url,
        persona,
        quality,
        gap,
      })
    }

    // =========================================================================
    // AGGREGATES
    // =========================================================================

    // Persona aggregate
    const entriesWithPersona = entries.filter((e) => e.persona !== null)
    const personaAggregate =
      entriesWithPersona.length > 0
        ? {
            primaryAudience: mode(entriesWithPersona.map((e) => e.persona!.audience)),
            avgAlignment: Math.round(avg(entriesWithPersona.map((e) => e.persona!.alignment))),
            unclearCount: entriesWithPersona.filter((e) => e.persona!.unclear).length,
          }
        : null

    // Quality aggregate (always present)
    const qualityAggregate = {
      avgWordCount: Math.round(avg(entries.map((e) => e.quality.wordCount))),
      missingMeta: entries.filter((e) => !e.quality.hasMetaDescription).length,
      noInternalLinks: entries.filter((e) => e.quality.internalLinks === 0).length,
      stubbedCount: entries.filter((e) => e.quality.stubbed).length,
      avgReadability: Math.round(avg(entries.map((e) => e.quality.readability.fleschKincaid))),
      badHeadingsCount: entries.filter((e) => !e.quality.headings.properStructure).length,
    }

    // Gap aggregate
    const entriesWithGap = entries.filter((e) => e.gap !== null)
    const gapAggregate =
      entriesWithGap.length > 0
        ? {
            orphan: entriesWithGap.filter((e) => e.gap!.status === 'ORPHAN').length,
            weak: entriesWithGap.filter((e) => e.gap!.status === 'WEAK').length,
            confused: entriesWithGap.filter((e) => e.gap!.status === 'CONFUSED').length,
            ok: entriesWithGap.filter((e) => e.gap!.status === 'OK').length,
          }
        : null

    const resp: ScanResponse = {
      route,
      scannedAt: new Date().toISOString(),
      scanVersion: SCAN_VERSION,
      entryCount: allEntries.length,
      scoredCount: entries.length,
      entries,
      aggregate: {
        persona: personaAggregate,
        quality: qualityAggregate,
        gap: gapAggregate,
      },
    }

    const duration = Date.now() - startTime
    const personaInfo = personaAggregate
      ? `persona: ${personaAggregate.primaryAudience} @ ${personaAggregate.avgAlignment}%`
      : 'persona: unavailable'
    console.log(
      `[site-audit] scanned ${route}: ${entries.length} entries, ${personaInfo}, ${qualityAggregate.noInternalLinks} no links (${duration}ms)`
    )

    return new Response(JSON.stringify(resp), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[site-audit] scan error:', err)
    return new Response(
      JSON.stringify({
        error: true,
        message: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function mode(values: string[]): string {
  const counts = new Map<string, number>()
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1)
  }
  let best = values[0]
  let bestCount = 0
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v
      bestCount = c
    }
  }
  return best
}
