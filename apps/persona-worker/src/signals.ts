/**
 * Signal Processing
 *
 * Extracts behavioral signals from pixel events and converts
 * them into a standardized format for persona scoring.
 */

import type { PixelEvent, Signal, SignalType, PersonaId } from './types'
import { ALL_PERSONA_IDS } from './types'

// =============================================================================
// PERSONA KEYWORDS — config-driven, keyed by PersonaId
// =============================================================================

/**
 * Keywords that indicate persona affinity.
 * Adding a new persona = add one entry here. Scoring loops over keys automatically.
 */
const PERSONA_KEYWORDS: Partial<Record<PersonaId, string[]>> = {
  bill: [
    'commercial',
    'bulk',
    'fcr',
    'feed conversion',
    'mortality',
    'broiler',
    'integrator',
    'house',
    'flock size',
    'contract grower',
    'grow out',
    'litter',
    'big ole bird',
    'settlement',
    'house ranking',
    'cents per bird',
  ],
  betty: [
    'backyard',
    'hobby',
    'small flock',
    'hen',
    'eggs',
    'coop',
    'chicken keeping',
    'beginner',
    'pet chickens',
    'laying hens',
    'hen helper',
    'chicken mom',
  ],
  bob: [
    'breeder',
    'hatching eggs',
    'hatchability',
    'pullet',
    'parent stock',
    'hatch rate',
    'settable eggs',
    'breeder flock',
    'egg quality',
    'lay cycle',
  ],
  tom: [
    'turkey',
    'poult',
    'turkey house',
    'clostridial',
    'butterball',
    'processing weight',
    'turkey grower',
    'tom',
    'necrotic enteritis',
  ],
  greg: [
    'game bird',
    'quail',
    'pheasant',
    'chukar',
    'flight pen',
    'preserve',
    'hunting',
    'bobwhite',
    'ulcerative enteritis',
    'hatchery',
  ],
  taylor: [
    'turf management',
    'sports turf',
    'application rate',
    'athletic field',
    'professional lawn',
    'turf program',
    'warm-season',
    'transition zone',
    'soil biology',
  ],
  gary: [
    'fairway',
    'greens',
    'superintendent',
    'bermuda',
    'zoysia',
    'cec',
    'infiltration',
    'golf course',
    'tee box',
    'gcsaa',
  ],
  hannah: [
    'homeowner',
    'yard',
    'kids',
    'pets',
    'organic lawn',
    'diy',
    'brown spots',
    'fire ants',
    'safe for family',
    'weed killer',
  ],
  maggie: [
    'market garden',
    'raised bed',
    'compost tea',
    'csa',
    'farmers market',
    'no-till',
    'regenerative',
    'cover crop',
    'living soil',
    'intensive',
  ],
  sam: [
    'septic',
    'holding tank',
    'grease trap',
    'sewage',
    'drain field',
    'vault toilet',
    'odor',
    'port',
    'waste treatment',
    'bio-surfactant',
  ],
  // general has no keywords — it's the fallback
}

// =============================================================================
// URL PATTERNS — config-driven, keyed by regex → PersonaId
// =============================================================================

/**
 * URL patterns that indicate persona.
 * Adding a new persona = add patterns here.
 */
const URL_PERSONA_PATTERNS: Array<{ pattern: RegExp; persona: PersonaId }> = [
  // Poultry personas
  { pattern: /\/poultry\/backyard/i, persona: 'betty' },
  { pattern: /\/poultry\/commercial/i, persona: 'bill' },
  { pattern: /\/poultry\/breeders/i, persona: 'bob' },
  { pattern: /\/poultry\/turkey/i, persona: 'tom' },
  { pattern: /\/poultry\/game-birds/i, persona: 'greg' },

  // Turf & Soil personas
  { pattern: /\/lawn\/golf/i, persona: 'gary' },
  { pattern: /\/lawn\/homeowner/i, persona: 'hannah' },
  { pattern: /\/garden\//i, persona: 'maggie' },
  { pattern: /\/lawn/i, persona: 'taylor' }, // catch-all turf after specific sub-pages

  // Waste
  { pattern: /\/waste/i, persona: 'sam' },
  { pattern: /\/septic/i, persona: 'sam' },

  // Legacy shop URLs
  { pattern: /\/shop\/poultry\/backyard/i, persona: 'betty' },
  { pattern: /\/shop\/poultry\/commercial/i, persona: 'bill' },
  { pattern: /\/shop\/lawn/i, persona: 'taylor' },

  // Product size hints (bulk = commercial poultry)
  { pattern: /\/products\/.*gallon/i, persona: 'bill' },
  { pattern: /\/products\/.*bulk/i, persona: 'bill' },
]

// =============================================================================
// SIGNAL EXTRACTION
// =============================================================================

/**
 * Extract signals from a pixel event
 */
export function extractSignals(event: PixelEvent): Signal[] {
  const signals: Signal[] = []
  const timestamp = event.timestamp || new Date().toISOString()

  // Page view signal with persona detection
  if (event.page_url) {
    const pageSignal = processPageView(event.page_url, event.page_title, timestamp)
    if (pageSignal) signals.push(pageSignal)
  }

  // Search query signal
  if (event.event === 'search_performed' && event.properties?.query) {
    signals.push({
      type: 'search_query',
      value: String(event.properties.query),
      timestamp,
      metadata: { results_count: event.properties.results_count },
    })
  }

  // Product view signal
  if (event.event === 'product_viewed' && event.properties?.product_handle) {
    signals.push({
      type: 'product_view',
      value: String(event.properties.product_handle),
      timestamp,
      metadata: {
        product_title: event.properties.product_title,
        price: event.properties.price,
      },
    })
  }

  // Add to cart signal
  if (event.event === 'add_to_cart' && event.properties?.product_handle) {
    signals.push({
      type: 'add_to_cart',
      value: String(event.properties.product_handle),
      timestamp,
      metadata: {
        quantity: event.properties.quantity,
        variant: event.properties.variant_title,
      },
    })
  }

  // Purchase signal
  if (event.event === 'purchase' || event.event === 'order_completed') {
    signals.push({
      type: 'purchase',
      value: String(event.properties?.order_id || 'unknown'),
      timestamp,
      metadata: {
        total: event.properties?.total,
        products: event.properties?.products,
      },
    })
  }

  // Decision Engine selection (persona or segment)
  if (event.event === 'persona_selected' && event.properties?.persona) {
    signals.push({
      type: 'decision_engine',
      value: String(event.properties.persona),
      timestamp,
      metadata: { source: 'decision_engine' },
    })
  }

  // Segment selection (homepage)
  if (event.event === 'segment_path_selected' && event.properties?.segment_id) {
    signals.push({
      type: 'decision_engine',
      value: String(event.properties.segment_id),
      timestamp,
      metadata: { source: 'segment_selector', segment_id: event.properties.segment_id },
    })
  }

  // Email signup
  if (event.event === 'email_signup' || event.event === 'newsletter_signup') {
    signals.push({
      type: 'email_signup',
      value: event.properties?.list_id ? String(event.properties.list_id) : 'general',
      timestamp,
    })
  }

  // Content engagement (blog, podcast, etc.)
  if (event.event === 'content_engaged') {
    signals.push({
      type: 'content_engagement',
      value: String(event.properties?.content_type || event.page_url),
      timestamp,
      metadata: {
        engagement_type: event.properties?.engagement_type,
        time_on_page: event.properties?.time_on_page,
      },
    })
  }

  return signals
}

/**
 * Process page view and detect persona signals from URL
 */
function processPageView(url: string, title: string, timestamp: string): Signal | null {
  // Check URL patterns for persona indicators
  for (const { pattern, persona } of URL_PERSONA_PATTERNS) {
    if (pattern.test(url)) {
      return {
        type: 'page_view',
        value: url,
        timestamp,
        metadata: {
          title,
          detected_persona: persona,
        },
      }
    }
  }

  // Generic page view (less signal value)
  return {
    type: 'page_view',
    value: url,
    timestamp,
    metadata: { title },
  }
}

/**
 * Detect persona from text content (search query, page title, etc.)
 */
export function detectPersonaFromText(text: string): PersonaId | null {
  const lowerText = text.toLowerCase()

  let bestMatch: PersonaId | null = null
  let bestScore = 0

  for (const personaId of ALL_PERSONA_IDS) {
    if (personaId === 'general') continue

    const keywords = PERSONA_KEYWORDS[personaId]
    if (!keywords) continue

    const matchCount = keywords.filter((kw) => lowerText.includes(kw)).length
    if (matchCount > bestScore) {
      bestScore = matchCount
      bestMatch = personaId
    }
  }

  return bestMatch
}

/**
 * Calculate signal weight for persona scoring
 */
export function getSignalWeight(signal: Signal): number {
  const weights: Record<SignalType, number> = {
    decision_engine: 10, // Explicit choice is strongest
    purchase: 8,
    add_to_cart: 6,
    product_view: 4,
    search_query: 5,
    collection_view: 3,
    content_engagement: 3,
    email_signup: 2,
    phone_call: 7,
    survey_response: 6,
    page_view: 1,
    return_visit: 2,
  }

  return weights[signal.type] || 1
}

/**
 * Extract persona hint from a signal
 */
export function getSignalPersonaHint(signal: Signal): PersonaId | null {
  // Decision engine is explicit
  if (signal.type === 'decision_engine') {
    const persona = signal.value as PersonaId
    if (ALL_PERSONA_IDS.includes(persona)) {
      return persona
    }
  }

  // Check metadata for detected persona
  if (signal.metadata?.detected_persona) {
    return signal.metadata.detected_persona as PersonaId
  }

  // Try to detect from value text
  return detectPersonaFromText(signal.value)
}
