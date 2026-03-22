/**
 * Persona Inference — Centralized Module
 *
 * Single source of truth for inferring persona from content metadata.
 * Used by: persona pages, site audit, future campaign tools, CDP segments.
 *
 * Heuristic v1: tag-based with explicit precedence order.
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
 * "Backyard Poultry" is checked before "Poultry" so a post tagged with both
 * goes to Betty, not Bill. No duplicates across personas.
 */
const TAG_PRECEDENCE: [string, string][] = [
  ['Backyard Poultry', 'betty'],
  ['Poultry', 'bill'],
  ['Turf', 'taylor'],
  ['Plants & Crops', 'taylor'],
]

const SEGMENT_MAP: Record<string, string> = {
  poultry: 'bill',
  turf: 'taylor',
}

// =============================================================================
// INFERENCE FUNCTIONS
// =============================================================================

/**
 * Infer persona from blog post tags and segment.
 * Returns null if no persona can be determined (post needs tagging).
 */
export function inferPersonaFromBlog(
  tags: string[],
  segment: string,
): PersonaMatch | null {
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
  'lawn-garden': 'taylor',
}

export function inferPersonaFromVideoSubject(subject: string): PersonaMatch | null {
  const persona = VIDEO_SUBJECT_PERSONA[subject]
  if (persona) {
    return { persona, confidence: 'medium', source: 'manual' }
  }
  return null
}
