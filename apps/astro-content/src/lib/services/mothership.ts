/**
 * Mothership Service
 * Persona scoring and content gap analysis via point.dog Supabase
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { PersonaScores, GapStatus, BuyerStage } from '../content-score.types'

// Initialize Supabase client
let supabaseClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient

  const url = import.meta.env.MOTHERSHIP_SUPABASE_URL
  const key = import.meta.env.MOTHERSHIP_SUPABASE_SERVICE_KEY

  if (!url || !key) {
    console.warn('Mothership credentials not configured')
    return null
  }

  supabaseClient = createClient(url, key)
  return supabaseClient
}

// OpenAI client for generating embeddings
async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = import.meta.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('OpenAI API key not configured')
    return null
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // Limit input length
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI embedding error:', error)
      return null
    }

    const data = await response.json()
    return data.data[0].embedding
  } catch (error) {
    console.error('Failed to generate embedding:', error)
    return null
  }
}

/**
 * Score content against personas using vector similarity
 */
export async function scorePersonas(
  content: string,
  segment?: string,
  brandSlug: string = 'southland-organics'
): Promise<PersonaScores> {
  const supabase = getSupabaseClient()

  // Fallback if Mothership not available
  if (!supabase || !import.meta.env.ENABLE_MOTHERSHIP) {
    return getFallbackPersonaScores(segment)
  }

  try {
    // Generate embedding for content
    const embedding = await generateEmbedding(content)
    if (!embedding) {
      return getFallbackPersonaScores(segment)
    }

    // Query personas with vector similarity
    const { data: personas, error } = await supabase.rpc('match_personas', {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 5,
      p_brand_slug: brandSlug,
    })

    if (error) {
      console.error('Persona match error:', error)
      return getFallbackPersonaScores(segment)
    }

    if (!personas || personas.length === 0) {
      return getFallbackPersonaScores(segment)
    }

    // Map results to our persona structure
    const scores: Record<string, number> = {
      broilerBill: 0,
      backyardBetty: 0,
      turfTaylor: 0,
    }

    const nameMap: Record<string, string> = {
      'broiler-bill': 'broilerBill',
      commercial: 'broilerBill',
      'backyard-betty': 'backyardBetty',
      backyard: 'backyardBetty',
      'turf-taylor': 'turfTaylor',
      lawn: 'turfTaylor',
    }

    for (const persona of personas) {
      const key = nameMap[persona.slug] || nameMap[persona.name?.toLowerCase()]
      if (key) {
        scores[key] = Math.max(scores[key], persona.similarity)
      }
    }

    // Find primary persona
    const entries = Object.entries(scores) as [string, number][]
    const [primaryKey, primaryScore] = entries.reduce((a, b) => (a[1] > b[1] ? a : b))

    const displayNames: Record<string, PersonaScores['primary']['name']> = {
      broilerBill: 'Broiler Bill',
      backyardBetty: 'Backyard Betty',
      turfTaylor: 'Turf Taylor',
    }

    return {
      primary: {
        name: displayNames[primaryKey] || 'Unknown',
        slug: primaryKey.replace(/([A-Z])/g, '-$1').toLowerCase(),
        score: primaryScore,
      },
      scores: scores as PersonaScores['scores'],
      aligned: primaryScore >= 0.6,
      recommendation:
        primaryScore < 0.6
          ? 'Content does not strongly align with any persona. Consider focusing on specific pain points for one audience.'
          : undefined,
    }
  } catch (error) {
    console.error('Persona scoring failed:', error)
    return getFallbackPersonaScores(segment)
  }
}

/**
 * Fallback persona scores when Mothership is unavailable
 */
function getFallbackPersonaScores(segment?: string): PersonaScores {
  const scores = {
    broilerBill: 0.3,
    backyardBetty: 0.4,
    turfTaylor: 0.2,
  }

  // Adjust based on segment hint
  if (segment === 'poultry') {
    scores.broilerBill = 0.65
    scores.backyardBetty = 0.55
    scores.turfTaylor = 0.1
  } else if (segment === 'turf') {
    scores.turfTaylor = 0.7
    scores.broilerBill = 0.1
    scores.backyardBetty = 0.15
  } else if (segment === 'agriculture') {
    scores.broilerBill = 0.5
    scores.backyardBetty = 0.4
    scores.turfTaylor = 0.3
  }

  const entries = Object.entries(scores) as [keyof typeof scores, number][]
  const [primaryKey, primaryScore] = entries.reduce((a, b) => (a[1] > b[1] ? a : b))

  const nameMap: Record<string, PersonaScores['primary']['name']> = {
    broilerBill: 'Broiler Bill',
    backyardBetty: 'Backyard Betty',
    turfTaylor: 'Turf Taylor',
  }

  return {
    primary: {
      name: nameMap[primaryKey],
      slug: primaryKey.replace(/([A-Z])/g, '-$1').toLowerCase(),
      score: primaryScore,
    },
    scores,
    aligned: primaryScore >= 0.6,
    recommendation:
      primaryScore < 0.6
        ? 'Content does not strongly align with any persona. (Fallback scoring - Mothership unavailable)'
        : '(Fallback scoring - Mothership unavailable)',
  }
}

/**
 * Analyze content for gap status
 */
export async function analyzeContentGap(
  title: string,
  content: string,
  url?: string,
  brandSlug: string = 'southland-organics'
): Promise<GapStatus> {
  const supabase = getSupabaseClient()

  // Fallback if Mothership not available
  if (!supabase || !import.meta.env.ENABLE_MOTHERSHIP) {
    return {
      status: 'OK',
      message: 'Content gap analysis unavailable (Mothership not configured)',
      stage: 'aware',
    }
  }

  try {
    // Generate embedding for content
    const embedding = await generateEmbedding(`${title}\n\n${content.slice(0, 4000)}`)
    if (!embedding) {
      return {
        status: 'OK',
        message: 'Could not generate embedding for gap analysis',
        stage: 'aware',
      }
    }

    // Find similar existing content
    const { data: similar, error } = await supabase.rpc('match_content', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5,
      p_brand_slug: brandSlug,
    })

    if (error) {
      console.error('Content gap analysis error:', error)
      return {
        status: 'OK',
        message: 'Gap analysis query failed',
        stage: 'aware',
      }
    }

    // Analyze results
    if (!similar || similar.length === 0) {
      return {
        status: 'ORPHAN',
        message:
          'No similar content found. This may be filling a gap or unrelated to existing topics.',
        stage: inferBuyerStage(content),
      }
    }

    const highSimilarity = similar.filter((s: any) => s.similarity > 0.85)
    if (highSimilarity.length > 0) {
      return {
        status: 'CONFUSED',
        message: `Content is very similar to existing page: "${highSimilarity[0].title}"`,
        stage: inferBuyerStage(content),
        existingContent: highSimilarity.slice(0, 3).map((s: any) => ({
          url: s.url,
          title: s.title,
          similarity: s.similarity,
        })),
      }
    }

    if (similar.length > 0 && similar[0].similarity > 0.7) {
      return {
        status: 'WEAK',
        message: 'Content overlaps with existing pages. Consider linking to related content.',
        stage: inferBuyerStage(content),
        existingContent: similar.slice(0, 3).map((s: any) => ({
          url: s.url,
          title: s.title,
          similarity: s.similarity,
        })),
      }
    }

    return {
      status: 'OK',
      message: 'Content fills an identified gap in the content strategy.',
      stage: inferBuyerStage(content),
    }
  } catch (error) {
    console.error('Content gap analysis failed:', error)
    return {
      status: 'OK',
      message: 'Gap analysis failed',
      stage: 'aware',
    }
  }
}

/**
 * Infer buyer journey stage from content
 */
function inferBuyerStage(content: string): BuyerStage {
  const lowerContent = content.toLowerCase()

  // Simple keyword-based inference
  if (
    lowerContent.includes('buy') ||
    lowerContent.includes('order') ||
    lowerContent.includes('price')
  ) {
    return 'zmot'
  }
  if (
    lowerContent.includes('compare') ||
    lowerContent.includes('vs') ||
    lowerContent.includes('alternative')
  ) {
    return 'objections'
  }
  if (
    lowerContent.includes('how to') ||
    lowerContent.includes('guide') ||
    lowerContent.includes('step')
  ) {
    return 'receptive'
  }
  if (
    lowerContent.includes('what is') ||
    lowerContent.includes('introduction') ||
    lowerContent.includes('basics')
  ) {
    return 'aware'
  }
  if (
    lowerContent.includes('review') ||
    lowerContent.includes('results') ||
    lowerContent.includes('success')
  ) {
    return 'success'
  }

  return 'aware'
}
