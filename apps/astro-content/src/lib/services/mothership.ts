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
    console.error(
      '[mothership] MISSING ENV VARS:',
      'MOTHERSHIP_SUPABASE_URL=',
      url ? 'SET' : 'MISSING',
      'MOTHERSHIP_SUPABASE_SERVICE_KEY=',
      key ? 'SET' : 'MISSING'
    )
    return null
  }

  supabaseClient = createClient(url, key)
  return supabaseClient
}

// OpenAI client for generating embeddings
async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = import.meta.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[mothership] MISSING OPENAI_API_KEY env var')
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
      const errorBody = await response.text()
      console.error('[mothership] OpenAI embedding HTTP error:', response.status, errorBody)
      return null
    }

    const data = await response.json()
    return data.data[0].embedding
  } catch (error) {
    console.error('[mothership] OpenAI embedding exception:', error)
    return null
  }
}

/**
 * Score content against personas using vector similarity.
 * Returns null if scoring fails — caller must handle.
 */
export async function scorePersonas(
  content: string,
  segment?: string,
  brandSlug: string = 'southland-organics'
): Promise<PersonaScores | null> {
  const supabase = getSupabaseClient()

  if (!supabase) {
    console.error('[mothership] scorePersonas: Supabase client is null (env vars missing)')
    return null
  }

  if (!import.meta.env.ENABLE_MOTHERSHIP) {
    console.error(
      '[mothership] scorePersonas: ENABLE_MOTHERSHIP is falsy:',
      import.meta.env.ENABLE_MOTHERSHIP
    )
    return null
  }

  try {
    // Generate embedding for content
    const embedding = await generateEmbedding(content)
    if (!embedding) {
      console.error('[mothership] scorePersonas: embedding generation failed (see above)')
      return null
    }

    // Query personas with vector similarity
    const { data: personas, error } = await supabase.rpc('match_personas', {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 5,
      p_brand_slug: brandSlug,
    })

    if (error) {
      console.error('[mothership] match_personas RPC error:', error)
      return null
    }

    if (!personas || personas.length === 0) {
      console.error(
        '[mothership] match_personas returned 0 results for brand:',
        brandSlug,
        '— personas may not be seeded'
      )
      return null
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
    console.error('[mothership] scorePersonas exception:', error)
    return null
  }
}

/**
 * Analyze content for gap status.
 * Returns null if analysis fails — caller must handle.
 */
export async function analyzeContentGap(
  title: string,
  content: string,
  url?: string,
  brandSlug: string = 'southland-organics'
): Promise<GapStatus | null> {
  const supabase = getSupabaseClient()

  if (!supabase) {
    console.error('[mothership] analyzeContentGap: Supabase client is null')
    return null
  }

  if (!import.meta.env.ENABLE_MOTHERSHIP) {
    console.error('[mothership] analyzeContentGap: ENABLE_MOTHERSHIP is falsy')
    return null
  }

  try {
    // Generate embedding for content
    const embedding = await generateEmbedding(`${title}\n\n${content.slice(0, 4000)}`)
    if (!embedding) {
      console.error('[mothership] analyzeContentGap: embedding generation failed')
      return null
    }

    // Find similar existing content
    const { data: similar, error } = await supabase.rpc('match_content', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5,
      p_brand_slug: brandSlug,
    })

    if (error) {
      console.error('[mothership] match_content RPC error:', error)
      return null
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
    console.error('[mothership] analyzeContentGap exception:', error)
    return null
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
