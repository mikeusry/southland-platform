/**
 * Content Score API Endpoint
 *
 * POST /api/content-score
 *
 * Two scan modes:
 * - LIGHT: Mothership persona/gap + local quality (fast, cheap, auto-debounced)
 * - FULL: Light + Originality.ai + DataForSEO (manual trigger or pre-publish)
 *
 * See: docs/MOTHERSHIP-INTEGRATION.md
 */
import type { APIRoute } from 'astro'
import type {
  ContentScoreRequest,
  ContentScoreResponse,
  ContentScoreError,
  QualityMetrics,
  SCORE_THRESHOLDS,
} from '../../lib/content-score.types'
import { scorePersonas, analyzeContentGap } from '../../lib/services/mothership'
import { checkOriginality } from '../../lib/services/originality'
import { analyzeContentSEO, computeLocalSEOMetrics } from '../../lib/services/dataforseo'

// Extended request type with mode
interface ContentScoreRequestWithMode extends ContentScoreRequest {
  mode?: 'light' | 'full'
  brandSlug?: string
}

// Generate unique request ID
function generateRequestId(): string {
  return `cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// Generate content hash for caching
function generateContentHash(title: string, body: string): string {
  const content = `${title}::${body}`
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// Count words in text
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// Extract links from MDX content
function extractLinks(body: string): { internal: number; external: number } {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let internal = 0
  let external = 0
  let match

  while ((match = linkRegex.exec(body)) !== null) {
    const url = match[2]
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (url.includes('southlandorganics.com')) {
        internal++
      } else {
        external++
      }
    } else {
      internal++ // Relative links are internal
    }
  }

  return { internal, external }
}

// Compute local quality metrics
function computeQualityMetrics(
  body: string,
  description?: string,
  featuredImage?: string
): QualityMetrics {
  const wordCount = countWords(body)
  const links = extractLinks(body)
  const descLength = description?.length || 0

  return {
    wordCount,
    readingTime: Math.ceil(wordCount / 200),
    hasFeaturedImage: Boolean(featuredImage),
    hasMetaDescription: Boolean(description),
    metaDescriptionOptimal: descLength >= 120 && descLength <= 160,
    hasInternalLinks: links.internal > 0,
    hasExternalLinks: links.external > 0,
    linkCount: links,
  }
}

// Calculate overall score and determine blockers
function calculateOverallScore(
  response: Partial<ContentScoreResponse>,
  quality: QualityMetrics
): { score: number; publishable: boolean; blockers: string[]; warnings: string[] } {
  const blockers: string[] = []
  const warnings: string[] = []

  // === HARD BLOCKERS (from MOTHERSHIP-INTEGRATION.md) ===

  // 1. No persona alignment at all (<40%)
  if (response.persona && response.persona.primary.score < 0.4) {
    blockers.push('Content does not align with any target persona (score < 40%)')
  }

  // 2. Orphan + no links + no metadata (triple fail)
  if (
    response.gap?.status === 'ORPHAN' &&
    !quality.hasInternalLinks &&
    !quality.hasMetaDescription
  ) {
    blockers.push('Orphan content: add internal links and meta description')
  }

  // 3. Title or body missing/too short
  if (quality.wordCount < 100) {
    blockers.push('Content too short (minimum 100 characters)')
  }

  // === WARNINGS (advisory only) ===

  // Originality
  if (response.originality && !response.originality.skipped && response.originality.score < 90) {
    warnings.push(`Originality score ${response.originality.score}% (target: 90%+)`)
  }

  // AI detection - ADVISORY ONLY per policy
  if (
    response.aiDetection &&
    !response.aiDetection.skipped &&
    response.aiDetection.aiProbability > 50
  ) {
    warnings.push(
      `AI probability ${response.aiDetection.aiProbability}% (target: <50%) - advisory only`
    )
  }

  // SEO
  if (response.seo && response.seo.score < 60) {
    warnings.push(`SEO score ${response.seo.score}% (target: 60%+)`)
  }

  // Weak/Confused gap status
  if (response.gap?.status === 'WEAK') {
    warnings.push('Content may overlap with existing pages - consider linking')
  }
  if (response.gap?.status === 'CONFUSED') {
    warnings.push(
      `Content similar to: ${response.gap.existingContent?.[0]?.title || 'existing page'}`
    )
  }

  // Persona alignment (40-60% is warning)
  if (
    response.persona &&
    response.persona.primary.score >= 0.4 &&
    response.persona.primary.score < 0.6
  ) {
    warnings.push(
      `Weak persona alignment (${Math.round(response.persona.primary.score * 100)}%) - consider focusing content`
    )
  }

  // Quality warnings
  if (!quality.hasMetaDescription) {
    warnings.push('Missing meta description')
  }
  if (!quality.hasInternalLinks) {
    warnings.push('No internal links found')
  }
  if (!quality.hasFeaturedImage) {
    warnings.push('No featured image')
  }
  if (quality.wordCount < 300) {
    warnings.push(`Short content (${quality.wordCount} words) - aim for 300+`)
  }

  // Calculate weighted score
  let score = 70 // Base score

  // Persona contribution (20%)
  if (response.persona) {
    score += (response.persona.primary.score * 100 - 50) * 0.2
  }

  // Originality contribution (15%)
  if (response.originality && !response.originality.skipped) {
    score += (response.originality.score - 70) * 0.15
  }

  // SEO contribution (25%)
  if (response.seo) {
    score += (response.seo.score - 70) * 0.25
  }

  // Quality contribution (15%)
  let qualityScore = 0
  if (quality.hasMetaDescription) qualityScore += 25
  if (quality.metaDescriptionOptimal) qualityScore += 10
  if (quality.hasInternalLinks) qualityScore += 25
  if (quality.hasExternalLinks) qualityScore += 10
  if (quality.wordCount >= 300) qualityScore += 15
  if (quality.wordCount >= 600) qualityScore += 15
  score += (qualityScore - 50) * 0.15

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    publishable: blockers.length === 0,
    blockers,
    warnings,
  }
}

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()

  try {
    const body = (await request.json()) as ContentScoreRequestWithMode

    // Validate required fields
    if (!body.title || !body.body) {
      const error: ContentScoreError = {
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields: title and body are required',
      }
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const requestId = generateRequestId()
    const contentHash = generateContentHash(body.title, body.body)
    const mode = body.mode || 'light'
    const brandSlug = body.brandSlug || import.meta.env.DEFAULT_BRAND_SLUG || 'southland-organics'

    // Compute local quality metrics (always done)
    const quality = computeQualityMetrics(body.body, body.description)

    // Build response object
    const response: Partial<ContentScoreResponse> = {
      requestId,
      analyzedAt: new Date().toISOString(),
      contentHash,
      mode,
    }

    // === LIGHT MODE: Mothership + local SEO ===
    // Always run these (fast, cheap)

    // 1. Persona scoring via Mothership
    const personaResult = await scorePersonas(`${body.title}\n\n${body.body}`, body.segment, brandSlug)
    if (personaResult) {
      response.persona = personaResult
    } else {
      // Persona scoring failed — don't fake it
      response.persona = {
        primary: { name: 'Unknown', slug: 'unknown', score: 0 },
        scores: { broilerBill: 0, backyardBetty: 0, turfTaylor: 0 },
        aligned: false,
        recommendation: 'Persona scoring unavailable — check Mothership connection',
      }
    }

    // 2. Content gap analysis via Mothership
    const gapResult = await analyzeContentGap(body.title, body.body, body.url, brandSlug)
    if (gapResult) {
      response.gap = gapResult
    } else {
      response.gap = {
        status: 'OK',
        message: 'Gap analysis unavailable — check Mothership connection',
        stage: 'aware',
      }
    }

    // 3. Local SEO metrics (always computed, fast)
    if (mode === 'light') {
      response.seo = computeLocalSEOMetrics(body.body, body.targetKeyword)
    }

    // === FULL MODE: Add external APIs ===
    if (mode === 'full') {
      // 4. Originality.ai (plagiarism + AI detection)
      const originalityResult = await checkOriginality(body.body)
      response.originality = originalityResult.originality
      response.aiDetection = originalityResult.aiDetection

      // 5. DataForSEO (content analysis)
      response.seo = await analyzeContentSEO(body.body, body.targetKeyword)

      // Record full scan timestamp
      response.fullScanAt = new Date().toISOString()
    } else {
      // Light mode: skip expensive APIs
      response.originality = {
        score: 100,
        passed: true,
        skipped: true,
        skipReason: 'Originality check only runs in full scan mode',
      }
      response.aiDetection = {
        aiProbability: 0,
        humanProbability: 100,
        classification: 'human',
        passed: true,
        skipped: true,
        skipReason: 'AI detection only runs in full scan mode',
      }
    }

    // Record light scan timestamp
    response.lightScanAt = new Date().toISOString()

    // Add quality metrics
    response.quality = quality

    // Calculate overall score and blockers
    const { score, publishable, blockers, warnings } = calculateOverallScore(response, quality)
    response.overallScore = score
    response.publishable = publishable
    response.blockers = blockers
    response.warnings = warnings

    // Log performance
    const duration = Date.now() - startTime
    console.log(`[content-score] ${mode} scan completed in ${duration}ms (score: ${score})`)

    return new Response(JSON.stringify(response as ContentScoreResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[content-score] Error:', err)
    const error: ContentScoreError = {
      error: true,
      code: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error occurred',
    }
    return new Response(JSON.stringify(error), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// GET endpoint for documentation
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      endpoint: '/api/content-score',
      method: 'POST',
      description: 'Analyze content for quality scoring',
      modes: {
        light: 'Mothership (persona + gap) + local SEO. Fast, cheap, auto-debounce friendly.',
        full: 'Light + Originality.ai + DataForSEO. Manual trigger or pre-publish.',
      },
      requiredFields: ['title', 'body'],
      optionalFields: [
        'url',
        'description',
        'tags',
        'segment',
        'targetKeyword',
        'mode',
        'brandSlug',
      ],
      blockers: [
        'Persona score < 40%',
        'Orphan content with no links and no meta',
        'Content too short (<100 words)',
      ],
      warnings: [
        'Originality < 90%',
        'AI probability > 50% (advisory only)',
        'SEO score < 60%',
        'Weak persona alignment (40-60%)',
        'Missing meta description',
        'No internal links',
      ],
      example: {
        title: 'How to Improve Chicken Health Naturally',
        body: '# Introduction\n\nYour chickens deserve the best care...',
        segment: 'poultry',
        targetKeyword: 'chicken health',
        mode: 'light',
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
