/**
 * Persona Inference — Centralized Module
 *
 * Single source of truth for inferring persona from content metadata.
 * Used by: persona pages, site audit, future campaign tools, CDP segments.
 *
 * Heuristic v2: tag-based with explicit precedence order, 10 personas + 3 segments.
 * Phase 2 will layer vector scoring on top (scorePersonas from Mothership).
 */

// =============================================================================
// TYPES
// =============================================================================

export type InferenceSource = 'tag' | 'segment' | 'vector' | 'manual'
export type Confidence = 'high' | 'medium' | 'low'

export interface PersonaMatch {
  persona: string
  confidence: Confidence
  source: InferenceSource
}

// =============================================================================
// PRECEDENCE RULES
// =============================================================================

/**
 * Tag → persona mapping, ordered by specificity (most specific first).
 * More specific tags are checked before general ones so a post tagged
 * "Backyard Poultry" goes to Betty, not Bill.
 *
 * No duplicates across personas — each tag maps to exactly one persona.
 */
const TAG_PRECEDENCE: [string, string][] = [
  // Poultry — specific sub-personas before catch-all
  ['Backyard Poultry', 'betty'],
  ['Turkey', 'tom'],
  ['Game Bird', 'greg'],
  ['Breeder', 'bob'],
  ['Poultry', 'bill'], // catch-all poultry → Bill

  // Turf & Soil — specific before catch-all
  ['Golf Course', 'gary'],
  ['Market Garden', 'maggie'],
  ['Lawn Care', 'hannah'],
  ['Turf', 'taylor'], // catch-all turf → Taylor
  ['Plants & Crops', 'maggie'],
  ['Soil', 'taylor'],

  // Waste
  ['Septic', 'sam'],
  ['Waste', 'sam'],
  ['Holding Tank', 'sam'],
  ['Odor Control', 'sam'],
]

/**
 * Segment → default persona fallback.
 * Used when content has a segment tag but no specific persona tag.
 */
const SEGMENT_MAP: Record<string, string> = {
  poultry: 'bill',
  turf: 'taylor',
  waste: 'sam',
}

// =============================================================================
// INFERENCE FUNCTIONS
// =============================================================================

/**
 * Infer persona from blog post tags and segment.
 * Returns null if no persona can be determined (post needs tagging).
 */
export function inferPersonaFromBlog(tags: string[], segment: string): PersonaMatch | null {
  // Tags first — more specific, medium confidence
  for (const [tag, persona] of TAG_PRECEDENCE) {
    if (tags.includes(tag)) {
      return { persona, confidence: 'medium', source: 'tag' }
    }
  }

  // Segment fallback — medium confidence
  const segmentPersona = SEGMENT_MAP[segment]
  if (segmentPersona) {
    return { persona: segmentPersona, confidence: 'medium', source: 'segment' }
  }

  return null
}

/**
 * Check if a blog post has any tags at all.
 * Posts with no tags are a "needs tagging" backlog.
 */
export function isUntagged(tags: string[]): boolean {
  return !tags || tags.length === 0
}

/**
 * Video subject → persona mapping (for Mothership video_subject_mappings).
 */
const VIDEO_SUBJECT_PERSONA: Record<string, string> = {
  'commercial-poultry': 'bill',
  'backyard-poultry': 'betty',
  'breeder-poultry': 'bob',
  'turkey-poultry': 'tom',
  'game-bird-poultry': 'greg',
  'lawn-garden': 'taylor',
  'golf-course': 'gary',
  'homeowner-lawn': 'hannah',
  'market-garden': 'maggie',
  'septic-waste': 'sam',
}

export function inferPersonaFromVideoSubject(subject: string): PersonaMatch | null {
  const persona = VIDEO_SUBJECT_PERSONA[subject]
  if (persona) {
    return { persona, confidence: 'medium', source: 'manual' }
  }
  return null
}
