/**
 * Persona Scoring Algorithm
 *
 * Computes persona probabilities based on behavioral signals.
 * Uses weighted signal accumulation with recency decay.
 */

import type { Signal, PersonaScores, PersonaId, VisitorData } from './types';
import { getSignalWeight, getSignalPersonaHint } from './signals';

// Minimum signals required for confident scoring
const MIN_SIGNALS_FOR_SCORING = 3;

// Recency decay factor (signals older than this many hours decay)
const RECENCY_HOURS = 72;

// Default scores when no signals (uniform distribution)
const DEFAULT_SCORES: PersonaScores = {
  backyard: 0.25,
  commercial: 0.25,
  lawn: 0.25,
  general: 0.25,
};

/**
 * Compute persona scores from visitor signals
 */
export function computePersonaScores(visitor: VisitorData): PersonaScores {
  const signals = visitor.signals;

  // Not enough signals - return default or explicit choice weighted
  if (signals.length < MIN_SIGNALS_FOR_SCORING) {
    if (visitor.explicit_persona) {
      return createExplicitScores(visitor.explicit_persona);
    }
    return { ...DEFAULT_SCORES };
  }

  // Accumulate weighted scores per persona
  const rawScores: PersonaScores = {
    backyard: 0,
    commercial: 0,
    lawn: 0,
    general: 0,
  };

  const now = Date.now();

  for (const signal of signals) {
    const personaHint = getSignalPersonaHint(signal);
    if (!personaHint) continue;

    const baseWeight = getSignalWeight(signal);
    const recencyMultiplier = calculateRecencyMultiplier(signal.timestamp, now);
    const weight = baseWeight * recencyMultiplier;

    rawScores[personaHint] += weight;
  }

  // Apply explicit choice boost (if set)
  if (visitor.explicit_persona && visitor.explicit_persona !== 'general') {
    rawScores[visitor.explicit_persona] *= 2;
  }

  // Normalize to probabilities
  return normalizeScores(rawScores);
}

/**
 * Calculate recency multiplier (recent signals weighted more)
 */
function calculateRecencyMultiplier(timestamp: string, now: number): number {
  const signalTime = new Date(timestamp).getTime();
  const hoursAgo = (now - signalTime) / (1000 * 60 * 60);

  if (hoursAgo <= 1) return 1.5; // Very recent boost
  if (hoursAgo <= 24) return 1.0; // Same day
  if (hoursAgo <= RECENCY_HOURS) return 0.7; // Recent
  return 0.3; // Older signal decay
}

/**
 * Normalize raw scores to probabilities (sum to 1)
 */
function normalizeScores(raw: PersonaScores): PersonaScores {
  const total = raw.backyard + raw.commercial + raw.lawn + raw.general;

  if (total === 0) {
    return { ...DEFAULT_SCORES };
  }

  return {
    backyard: raw.backyard / total,
    commercial: raw.commercial / total,
    lawn: raw.lawn / total,
    general: raw.general / total,
  };
}

/**
 * Create scores heavily weighted toward explicit choice
 */
function createExplicitScores(persona: PersonaId): PersonaScores {
  const scores: PersonaScores = {
    backyard: 0.1,
    commercial: 0.1,
    lawn: 0.1,
    general: 0.1,
  };

  if (persona !== 'general') {
    scores[persona] = 0.7;
  }

  // Normalize
  const total = scores.backyard + scores.commercial + scores.lawn + scores.general;
  return {
    backyard: scores.backyard / total,
    commercial: scores.commercial / total,
    lawn: scores.lawn / total,
    general: scores.general / total,
  };
}

/**
 * Get predicted persona from scores
 */
export function getPredictedPersona(scores: PersonaScores): PersonaId {
  const entries = Object.entries(scores) as Array<[PersonaId, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * Calculate confidence based on score distribution
 * Higher confidence when one persona dominates
 */
export function calculateConfidence(scores: PersonaScores): number {
  const values = Object.values(scores);
  const max = Math.max(...values);
  const secondMax = values.filter((v) => v !== max).sort((a, b) => b - a)[0] || 0;

  // Confidence based on margin between top two
  const margin = max - secondMax;

  // Also factor in the absolute max score
  const confidence = (margin * 0.6 + max * 0.4);

  // Clamp between 0 and 1
  return Math.min(1, Math.max(0, confidence));
}

/**
 * Determine if we should override with explicit choice
 */
export function shouldUseExplicitChoice(
  visitor: VisitorData
): boolean {
  // Explicit choice always wins if set
  return Boolean(visitor.explicit_persona);
}

/**
 * Get effective persona (considering explicit choice)
 */
export function getEffectivePersona(visitor: VisitorData): PersonaId {
  if (visitor.explicit_persona) {
    return visitor.explicit_persona;
  }
  return visitor.predicted_persona;
}
