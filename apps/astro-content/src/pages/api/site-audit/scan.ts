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
import type { PersonaScores, GapStatus, BrandVoiceScore } from '../../../lib/content-score.types'
import { scorePersonas, analyzeContentGap, scoreBrandVoice } from '../../../lib/services/mothership'
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

interface SEOResult {
  titleTag: { present: boolean; length: number; optimal: boolean }
  ogTags: { title: boolean; image: boolean; description: boolean }
  canonical: boolean
  imageAltCoverage: number
  schemaTypes: string[]
}

interface EEATResult {
  hasAuthor: boolean
  authorSlug: string | null
  hasUpdatedDate: boolean
  updatedDate: string | null
}

interface EntryResult {
  slug: string
  title: string
  url: string
  persona: PersonaResult | null
  quality: QualityResult
  gap: GapStatus | null
  voice: BrandVoiceScore | null
  seo: SEOResult | null
  eeat: EEATResult | null
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
// SEO + E-E-A-T CHECKS — computed from frontmatter + body content
// =============================================================================

function computeSEO(data: any, body: string): SEOResult {
  const title = data.title || data.name || ''
  const titleLength = title.length

  // OG tags: check frontmatter fields that typically map to OG
  const hasOgTitle = Boolean(data.title || data.metaTitle)
  const hasOgImage = Boolean(data.image || data.coverImage || data.heroImage || data.thumbnail)
  const hasOgDesc = Boolean(data.description || data.seoDescription || data.metaDescription)

  // Canonical: assume present if page exists (Astro generates canonical by default)
  const canonical = true

  // Image alt coverage: count markdown images with and without alt text
  const imgRegex = /!\[([^\]]*)\]\([^)]+\)/g
  let totalImages = 0
  let imagesWithAlt = 0
  let match
  while ((match = imgRegex.exec(body)) !== null) {
    totalImages++
    if (match[1] && match[1].trim().length > 0) imagesWithAlt++
  }
  const imageAltCoverage = totalImages > 0 ? Math.round((imagesWithAlt / totalImages) * 100) : 100

  // Schema types: infer from content structure
  const schemaTypes: string[] = []
  if (data.faq && data.faq.length > 0) schemaTypes.push('FAQPage')
  if (data.publishDate && data.author) schemaTypes.push('Article')
  if (data.episodeNumber || data.audioUrl) schemaTypes.push('PodcastEpisode')
  if (data.handle && data.variants) schemaTypes.push('Product')

  return {
    titleTag: { present: Boolean(title), length: titleLength, optimal: titleLength >= 30 && titleLength <= 60 },
    ogTags: { title: hasOgTitle, image: hasOgImage, description: hasOgDesc },
    canonical,
    imageAltCoverage,
    schemaTypes,
  }
}

function computeEEAT(data: any): EEATResult {
  const authorSlug = data.author || data.authorSlug || null
  const hasAuthor = Boolean(authorSlug) && authorSlug !== 'admin'

  const updatedDate = data.updatedDate || data.lastModified || data.publishDate || null
  const hasUpdatedDate = Boolean(updatedDate)

  return {
    hasAuthor,
    authorSlug: hasAuthor ? authorSlug : null,
    hasUpdatedDate,
    updatedDate: updatedDate ? String(updatedDate) : null,
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
    const { route, limit, slug, staticUrl } = (await request.json()) as {
      route: string
      limit?: number
      slug?: string
      staticUrl?: string
    }

    if (!route) {
      return new Response(
        JSON.stringify({ error: true, message: 'Missing required field: route' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // =========================================================================
    // STATIC PAGE SCAN — fetch rendered HTML and analyze
    // =========================================================================
    if (staticUrl) {
      return await scanStaticPage(route, staticUrl, request)
    }

    const mapping = findMapping(route)

    // Non-content or unmapped route — still scannable via staticUrl
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

    let entriesToScore: any[]

    if (slug) {
      // Single-entry lookup — fast path
      const { getEntry } = await import('astro:content')
      const entry = await getEntry(collectionName as any, slug)
      entriesToScore = entry ? [entry] : []
    } else {
      // Full collection scan
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

      entriesToScore = allEntries.slice(0, entryLimit)
    }
    const entries: EntryResult[] = []

    for (const entry of entriesToScore) {
      const extracted = extractor(entry)
      const contentText = `${extracted.title}\n\n${extracted.body}`

      // Run all axes in parallel
      const [personaRaw, gap, voice] = await Promise.all([
        scorePersonas(contentText, mapping.segment),
        analyzeContentGap(extracted.title, extracted.body, extracted.url),
        scoreBrandVoice(contentText),
      ])

      const persona = personaRaw ? mapPersona(personaRaw) : null

      // Quality axis (always — local computation)
      const quality = computeQuality(extracted.body, extracted.description)

      // SEO + E-E-A-T (local — from frontmatter + body)
      const seo = computeSEO(entry.data, extracted.body)
      const eeat = computeEEAT(entry.data)

      entries.push({
        slug: entry.id.replace(/\.mdx?$/, ''),
        title: extracted.title,
        url: extracted.url,
        persona,
        quality,
        gap,
        voice,
        seo,
        eeat,
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
      entryCount: entriesToScore.length,
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
// STATIC PAGE SCAN — fetch rendered HTML, extract text, run quality + vectors
// =============================================================================

async function scanStaticPage(route: string, staticUrl: string, request: Request) {
  const startTime = Date.now()

  try {
    // Build absolute URL from the request origin
    const origin = new URL(request.url).origin
    const fetchUrl = new URL(staticUrl, origin).toString()

    const res = await fetch(fetchUrl, {
      headers: { Accept: 'text/html' },
    })

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          route,
          error: true,
          message: `Failed to fetch ${staticUrl}: ${res.status}`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const html = await res.text()

    // Extract text content from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''

    // Extract meta description
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i)
    const description = metaDescMatch ? metaDescMatch[1] : ''

    // Strip HTML tags to get body text
    const bodyMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
      || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const rawBody = bodyMatch ? bodyMatch[1] : html
    const bodyText = rawBody
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Count headings from HTML
    const h1Count = (html.match(/<h1[\s>]/gi) || []).length
    const h2Count = (html.match(/<h2[\s>]/gi) || []).length
    const h3Count = (html.match(/<h3[\s>]/gi) || []).length

    // Count images and alt text
    const imgMatches = html.match(/<img\s[^>]*>/gi) || []
    let totalImages = imgMatches.length
    let imagesWithAlt = 0
    for (const img of imgMatches) {
      const altMatch = img.match(/alt=["']([^"']+)["']/i)
      if (altMatch && altMatch[1].trim().length > 0) imagesWithAlt++
    }

    // Check for OG tags
    const hasOgTitle = /<meta\s[^>]*property=["']og:title["']/i.test(html)
    const hasOgImage = /<meta\s[^>]*property=["']og:image["']/i.test(html)
    const hasOgDesc = /<meta\s[^>]*property=["']og:description["']/i.test(html)

    // Check canonical
    const hasCanonical = /<link\s[^>]*rel=["']canonical["']/i.test(html)

    // Check schema markup
    const schemaTypes: string[] = []
    const ldJsonMatches = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
    for (const ldJson of ldJsonMatches) {
      const content = ldJson.replace(/<[^>]+>/g, '')
      try {
        const parsed = JSON.parse(content)
        if (parsed['@type']) schemaTypes.push(parsed['@type'])
      } catch { /* ignore malformed JSON-LD */ }
    }

    // Count links
    const linkMatches = html.match(/<a\s[^>]*href=["']([^"']+)["']/gi) || []
    let internalLinks = 0
    let externalLinks = 0
    for (const link of linkMatches) {
      const hrefMatch = link.match(/href=["']([^"']+)["']/i)
      if (hrefMatch) {
        const href = hrefMatch[1]
        if (href.startsWith('http') && !href.includes('southlandorganics.com')) externalLinks++
        else if (href.startsWith('/') || href.includes('southlandorganics.com')) internalLinks++
      }
    }

    const wordCount = bodyText.split(/\s+/).filter(Boolean).length

    // Build quality result
    const quality: QualityResult = {
      wordCount,
      hasMetaDescription: Boolean(description),
      metaDescOptimal: description.length >= 120 && description.length <= 160,
      internalLinks,
      externalLinks,
      stubbed: wordCount < 150,
      headings: {
        h1: h1Count,
        h2: h2Count,
        h3: h3Count,
        properStructure: h1Count <= 1 && h2Count > 0,
      },
      readability: {
        fleschKincaid: 0,
        gradeLevel: 'unknown',
      },
    }

    const seo: SEOResult = {
      titleTag: { present: Boolean(title), length: title.length, optimal: title.length >= 30 && title.length <= 60 },
      ogTags: { title: hasOgTitle, image: hasOgImage, description: hasOgDesc },
      canonical: hasCanonical,
      imageAltCoverage: totalImages > 0 ? Math.round((imagesWithAlt / totalImages) * 100) : 100,
      schemaTypes,
    }

    // Run persona + voice scoring on body text (if substantial)
    let persona: PersonaResult | null = null
    let voice: BrandVoiceScore | null = null

    if (wordCount > 50) {
      const contentText = `${title}\n\n${bodyText.slice(0, 8000)}`
      const [personaRaw, voiceResult] = await Promise.all([
        scorePersonas(contentText),
        scoreBrandVoice(contentText),
      ])
      persona = personaRaw ? mapPersona(personaRaw) : null
      voice = voiceResult
    }

    const entry: EntryResult = {
      slug: route.replace(/\//g, '_').replace(/^_|_$/g, '') || 'index',
      title: title || route,
      url: route,
      persona,
      quality,
      gap: null,
      voice,
      seo,
      eeat: { hasAuthor: false, authorSlug: null, hasUpdatedDate: false, updatedDate: null },
    }

    const duration = Date.now() - startTime
    console.log(`[site-audit] static scan ${route}: ${wordCount} words, ${h2Count} h2s (${duration}ms)`)

    return new Response(
      JSON.stringify({
        route,
        scannedAt: new Date().toISOString(),
        scanVersion: SCAN_VERSION,
        entryCount: 1,
        scoredCount: 1,
        entries: [entry],
        aggregate: {
          persona: persona
            ? { primaryAudience: persona.audience, avgAlignment: persona.alignment, unclearCount: persona.unclear ? 1 : 0 }
            : null,
          quality: {
            avgWordCount: wordCount,
            missingMeta: description ? 0 : 1,
            noInternalLinks: internalLinks === 0 ? 1 : 0,
            stubbedCount: wordCount < 150 ? 1 : 0,
            avgReadability: 0,
            badHeadingsCount: quality.headings.properStructure ? 0 : 1,
          },
          gap: null,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[site-audit] static scan error:', err)
    return new Response(
      JSON.stringify({ error: true, message: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
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
