/**
 * Visitor Data Client
 *
 * Client-side utilities for fetching visitor persona/stage data
 * from the Persona Scoring Worker.
 *
 * Uses the anonymous_id from the point.dog pixel as the visitor identifier.
 */

export interface PersonaScores {
  backyard: number
  commercial: number
  lawn: number
  general: number
}

export type JourneyStage =
  | 'unaware'
  | 'aware'
  | 'receptive'
  | 'zmot'
  | 'objections'
  | 'test_prep'
  | 'challenge'
  | 'success'
  | 'commitment'
  | 'evangelist'

export interface VisitorData {
  anonymous_id: string
  customer_id?: string
  persona_scores: PersonaScores
  predicted_persona: 'backyard' | 'commercial' | 'lawn' | 'general'
  persona_confidence: number
  explicit_persona?: 'backyard' | 'commercial' | 'lawn' | 'general'
  current_stage: JourneyStage
  stage_confidence: number
  session_count: number
  first_seen: string
  last_updated: string
}

// Worker endpoint (configure via env)
const WORKER_URL =
  import.meta.env.PUBLIC_PERSONA_WORKER_URL ||
  'https://southland-persona-worker.point-dog-digital.workers.dev'

/**
 * Get the visitor's anonymous ID from the pixel cookie
 */
export function getAnonymousId(): string | null {
  if (typeof document === 'undefined') return null

  // Check for pd_pixel anonymous_id cookie
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === 'pd_anonymous_id' || name === '_pd_id') {
      return decodeURIComponent(value)
    }
  }

  // Fallback: check localStorage
  try {
    const pdData = localStorage.getItem('pd_pixel')
    if (pdData) {
      const parsed = JSON.parse(pdData)
      return parsed.anonymous_id || null
    }
  } catch {
    // Ignore
  }

  return null
}

/**
 * Fetch visitor data from the Persona Worker
 */
export async function fetchVisitorData(): Promise<VisitorData | null> {
  const anonymousId = getAnonymousId()
  if (!anonymousId) return null

  try {
    const response = await fetch(`${WORKER_URL}/visitor/${encodeURIComponent(anonymousId)}`)

    if (!response.ok) {
      if (response.status === 404) {
        return null // Visitor not tracked yet
      }
      throw new Error(`Failed to fetch visitor: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to fetch visitor data:', error)
    return null
  }
}

/**
 * Get the effective persona (explicit choice or predicted)
 */
export function getEffectivePersona(visitor: VisitorData): VisitorData['predicted_persona'] {
  return visitor.explicit_persona || visitor.predicted_persona
}

/**
 * Check if visitor has high confidence persona
 */
export function hasConfidentPersona(visitor: VisitorData, threshold = 0.6): boolean {
  return visitor.persona_confidence >= threshold || Boolean(visitor.explicit_persona)
}

/**
 * Get journey stage display name
 */
export function getStageDisplayName(stage: JourneyStage): string {
  const names: Record<JourneyStage, string> = {
    unaware: 'New Visitor',
    aware: 'Problem Aware',
    receptive: 'Learning',
    zmot: 'Researching',
    objections: 'Has Questions',
    test_prep: 'Ready to Try',
    challenge: 'New Customer',
    success: 'Seeing Results',
    commitment: 'Loyal Customer',
    evangelist: 'Advocate',
  }
  return names[stage]
}

/**
 * Get suggested CTA based on stage
 */
export function getStageCTA(stage: JourneyStage): { text: string; action: string } {
  const ctas: Record<JourneyStage, { text: string; action: string }> = {
    unaware: { text: 'Learn More', action: '/learn/' },
    aware: { text: 'Explore Solutions', action: '/shop/' },
    receptive: { text: 'See How It Works', action: '/resources/' },
    zmot: { text: 'Compare Products', action: '/collections/' },
    objections: { text: 'Get Answers', action: '/faq/' },
    test_prep: { text: 'Start Your Trial', action: '/shop/' },
    challenge: { text: 'Get Support', action: '/support/' },
    success: { text: 'Reorder', action: '/account/' },
    commitment: { text: 'Subscribe & Save', action: '/subscriptions/' },
    evangelist: { text: 'Refer a Friend', action: '/referral/' },
  }
  return ctas[stage]
}

/**
 * Subscribe to visitor data updates
 * Polls the worker at intervals for fresh data
 */
export function subscribeToVisitorUpdates(
  callback: (visitor: VisitorData | null) => void,
  intervalMs = 30000
): () => void {
  let active = true

  const poll = async () => {
    if (!active) return
    const visitor = await fetchVisitorData()
    callback(visitor)
  }

  // Initial fetch
  poll()

  // Set up interval
  const interval = window.setInterval(poll, intervalMs)

  // Return unsubscribe function
  return () => {
    active = false
    window.clearInterval(interval)
  }
}
