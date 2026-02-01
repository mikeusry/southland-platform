/**
 * Signal Processing
 *
 * Extracts behavioral signals from pixel events and converts
 * them into a standardized format for persona scoring.
 */

import type { PixelEvent, Signal, SignalType, PersonaId } from './types';

// Keywords that indicate persona affinity
const PERSONA_KEYWORDS: Record<PersonaId, string[]> = {
  backyard: [
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
  ],
  commercial: [
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
  ],
  lawn: [
    'lawn',
    'turf',
    'grass',
    'fire ant',
    'garden',
    'fertilizer',
    'soil',
    'landscape',
    'organic lawn',
    'humate',
  ],
  general: [],
};

// URL patterns that indicate persona
const URL_PERSONA_PATTERNS: Array<{ pattern: RegExp; persona: PersonaId }> = [
  { pattern: /\/poultry\/backyard/i, persona: 'backyard' },
  { pattern: /\/poultry\/commercial/i, persona: 'commercial' },
  { pattern: /\/lawn/i, persona: 'lawn' },
  { pattern: /\/shop\/poultry\/backyard/i, persona: 'backyard' },
  { pattern: /\/shop\/poultry\/commercial/i, persona: 'commercial' },
  { pattern: /\/shop\/lawn/i, persona: 'lawn' },
  { pattern: /\/collections\/backyard/i, persona: 'backyard' },
  { pattern: /\/collections\/commercial/i, persona: 'commercial' },
  { pattern: /\/products\/.*gallon/i, persona: 'commercial' }, // Bulk sizes
  { pattern: /\/products\/.*bulk/i, persona: 'commercial' },
];

/**
 * Extract signals from a pixel event
 */
export function extractSignals(event: PixelEvent): Signal[] {
  const signals: Signal[] = [];
  const timestamp = event.timestamp || new Date().toISOString();

  // Page view signal with persona detection
  if (event.page_url) {
    const pageSignal = processPageView(event.page_url, event.page_title, timestamp);
    if (pageSignal) signals.push(pageSignal);
  }

  // Search query signal
  if (event.event === 'search_performed' && event.properties?.query) {
    signals.push({
      type: 'search_query',
      value: String(event.properties.query),
      timestamp,
      metadata: { results_count: event.properties.results_count },
    });
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
    });
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
    });
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
    });
  }

  // Decision Engine selection
  if (event.event === 'persona_selected' && event.properties?.persona) {
    signals.push({
      type: 'decision_engine',
      value: String(event.properties.persona),
      timestamp,
      metadata: { source: 'decision_engine' },
    });
  }

  // Email signup
  if (event.event === 'email_signup' || event.event === 'newsletter_signup') {
    signals.push({
      type: 'email_signup',
      value: event.properties?.list_id ? String(event.properties.list_id) : 'general',
      timestamp,
    });
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
    });
  }

  return signals;
}

/**
 * Process page view and detect persona signals from URL
 */
function processPageView(
  url: string,
  title: string,
  timestamp: string
): Signal | null {
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
      };
    }
  }

  // Generic page view (less signal value)
  return {
    type: 'page_view',
    value: url,
    timestamp,
    metadata: { title },
  };
}

/**
 * Detect persona from text content (search query, page title, etc.)
 */
export function detectPersonaFromText(text: string): PersonaId | null {
  const lowerText = text.toLowerCase();

  let bestMatch: PersonaId | null = null;
  let bestScore = 0;

  for (const [persona, keywords] of Object.entries(PERSONA_KEYWORDS)) {
    if (persona === 'general') continue;

    const matchCount = keywords.filter((kw) => lowerText.includes(kw)).length;
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestMatch = persona as PersonaId;
    }
  }

  return bestMatch;
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
  };

  return weights[signal.type] || 1;
}

/**
 * Extract persona hint from a signal
 */
export function getSignalPersonaHint(signal: Signal): PersonaId | null {
  // Decision engine is explicit
  if (signal.type === 'decision_engine') {
    const persona = signal.value as PersonaId;
    if (['backyard', 'commercial', 'lawn', 'general'].includes(persona)) {
      return persona;
    }
  }

  // Check metadata for detected persona
  if (signal.metadata?.detected_persona) {
    return signal.metadata.detected_persona as PersonaId;
  }

  // Try to detect from value text
  return detectPersonaFromText(signal.value);
}
