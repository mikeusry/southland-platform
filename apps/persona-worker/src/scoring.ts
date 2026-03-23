/**
 * Persona Scoring Algorithm
 *
 * Two-tier scoring: PersonaScores (11 keys) + SegmentScores (4 keys).
 * Uses weighted signal accumulation with recency decay.
 */

import type {
  Signal,
  PersonaScores,
  SegmentScores,
  PersonaId,
  SegmentId,
  VisitorData,
} from './types'
import { ALL_PERSONA_IDS, ALL_SEGMENT_IDS, PERSONA_TO_SEGMENT } from './types'
import { getSignalWeight, getSignalPersonaHint } from './signals'

// Minimum signals required for confident scoring
const MIN_SIGNALS_FOR_SCORING = 3

// Recency decay factor (signals older than this many hours decay)
const RECENCY_HOURS = 72

// Default scores anchored to observed distribution (not flat)
// Bill ~0.15, Betty ~0.12, Taylor ~0.08, others ~0.05-0.06
const DEFAULT_PERSONA_SCORES: PersonaScores = {
  bill: 0.15,
  betty: 0.12,
  bob: 0.05,
  tom: 0.05,
  greg: 0.04,
  taylor: 0.08,
  gary: 0.05,
  hannah: 0.06,
  maggie: 0.04,
  sam: 0.06,
  general: 0.30,
}

const DEFAULT_SEGMENT_SCORES: SegmentScores = {
  poultry: 0.45,
  turf: 0.25,
  waste: 0.15,
  general: 0.15,
}

// =============================================================================
// GENERIC NORMALIZE — works on any Record<string, number>
// =============================================================================

function normalizeRecord<T extends string>(raw: Record<T, number>): Record<T, number> {
  const total = Object.values<number>(raw).reduce((s, v) => s + v, 0)
  if (total === 0) return { ...raw }

  const result = {} as Record<T, number>
  for (const key of Object.keys(raw) as T[]) {
    result[key] = raw[key] / total
  }
  return result
}

// =============================================================================
// PERSONA SCORING
// =============================================================================

/**
 * Compute persona scores from visitor signals
 */
export function computePersonaScores(visitor: VisitorData): PersonaScores {
  const signals = visitor.signals

  // Not enough signals — return default or explicit choice weighted
  if (signals.length < MIN_SIGNALS_FOR_SCORING) {
    if (visitor.explicit_persona) {
      return createExplicitScores(visitor.explicit_persona)
    }
    return { ...DEFAULT_PERSONA_SCORES }
  }

  // Accumulate weighted scores per persona
  const rawScores: PersonaScores = {} as PersonaScores
  for (const id of ALL_PERSONA_IDS) rawScores[id] = 0

  const now = Date.now()
  const signalCountByPersona: Record<string, number> = {}

  for (const signal of signals) {
    const personaHint = getSignalPersonaHint(signal)
    if (!personaHint) continue

    const baseWeight = getSignalWeight(signal)
    const recencyMultiplier = calculateRecencyMultiplier(signal.timestamp, now)
    const weight = baseWeight * recencyMultiplier

    rawScores[personaHint] += weight
    signalCountByPersona[personaHint] = (signalCountByPersona[personaHint] || 0) + 1
  }

  // Signal suppression: if a persona has only 1 signal but another persona
  // in the same segment has 3+, halve the lone signal's contribution
  for (const personaId of ALL_PERSONA_IDS) {
    if (personaId === 'general') continue
    if ((signalCountByPersona[personaId] || 0) !== 1) continue

    const segment = PERSONA_TO_SEGMENT[personaId]
    const sameSegmentPersonas = ALL_PERSONA_IDS.filter(
      (p) => p !== personaId && p !== 'general' && PERSONA_TO_SEGMENT[p] === segment,
    )
    const hasStrongerCompetitor = sameSegmentPersonas.some(
      (p) => (signalCountByPersona[p] || 0) >= 3,
    )
    if (hasStrongerCompetitor) {
      rawScores[personaId] *= 0.5
    }
  }

  // Apply explicit choice boost (if set)
  if (visitor.explicit_persona && visitor.explicit_persona !== 'general') {
    rawScores[visitor.explicit_persona] *= 2
  }

  // Normalize to probabilities
  return normalizeRecord(rawScores)
}

/**
 * Compute segment scores by rolling up persona scores
 */
export function computeSegmentScores(personaScores: PersonaScores): SegmentScores {
  const raw: SegmentScores = {} as SegmentScores
  for (const id of ALL_SEGMENT_IDS) raw[id] = 0

  for (const personaId of ALL_PERSONA_IDS) {
    const segment = PERSONA_TO_SEGMENT[personaId]
    raw[segment] += personaScores[personaId]
  }

  return normalizeRecord(raw)
}

// =============================================================================
// RECENCY
// =============================================================================

/**
 * Calculate recency multiplier (recent signals weighted more)
 */
function calculateRecencyMultiplier(timestamp: string, now: number): number {
  const signalTime = new Date(timestamp).getTime()
  const hoursAgo = (now - signalTime) / (1000 * 60 * 60)

  if (hoursAgo <= 1) return 1.5 // Very recent boost
  if (hoursAgo <= 24) return 1.0 // Same day
  if (hoursAgo <= RECENCY_HOURS) return 0.7 // Recent
  return 0.3 // Older signal decay
}

// =============================================================================
// EXPLICIT CHOICE
// =============================================================================

/**
 * Create scores heavily weighted toward explicit choice
 */
function createExplicitScores(persona: PersonaId): PersonaScores {
  const scores: PersonaScores = {} as PersonaScores
  for (const id of ALL_PERSONA_IDS) scores[id] = 0.03

  if (persona !== 'general') {
    scores[persona] = 0.7
  }

  return normalizeRecord(scores)
}

// =============================================================================
// PREDICTIONS
// =============================================================================

/**
 * Get predicted persona from scores
 */
export function getPredictedPersona(scores: PersonaScores): PersonaId {
  let best: PersonaId = 'general'
  let bestScore = -1

  for (const id of ALL_PERSONA_IDS) {
    if (scores[id] > bestScore) {
      bestScore = scores[id]
      best = id
    }
  }

  return best
}

/**
 * Get predicted segment from segment scores
 */
export function getPredictedSegment(scores: SegmentScores): SegmentId {
  let best: SegmentId = 'general'
  let bestScore = -1

  for (const id of ALL_SEGMENT_IDS) {
    if (scores[id] > bestScore) {
      bestScore = scores[id]
      best = id
    }
  }

  return best
}

/**
 * Calculate confidence based on score distribution
 * Higher confidence when one persona dominates
 */
export function calculateConfidence(scores: PersonaScores | SegmentScores): number {
  const values = Object.values(scores) as number[]
  const max = Math.max(...values)
  const sorted = [...values].sort((a, b) => b - a)
  const secondMax = sorted[1] || 0

  // Confidence based on margin between top two
  const margin = max - secondMax

  // Also factor in the absolute max score
  const confidence = margin * 0.6 + max * 0.4

  // Clamp between 0 and 1
  return Math.min(1, Math.max(0, confidence))
}

/**
 * Determine if we should override with explicit choice
 */
export function shouldUseExplicitChoice(visitor: VisitorData): boolean {
  return Boolean(visitor.explicit_persona)
}

/**
 * Get effective persona (considering explicit choice)
 */
export function getEffectivePersona(visitor: VisitorData): PersonaId {
  if (visitor.explicit_persona) {
    return visitor.explicit_persona
  }
  return visitor.predicted_persona
}

/**
 * Get effective segment (considering explicit segment choice)
 */
export function getEffectiveSegment(visitor: VisitorData): SegmentId {
  if (visitor.explicit_segment) {
    return visitor.explicit_segment
  }
  return visitor.predicted_segment
}
