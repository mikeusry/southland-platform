import type { Env } from '../types'
import { generate } from './llm'
import { parseJSON } from './llm'

// ─── Anti-Hallucination Pipeline ────────────────────────────────────────────
// 4-layer verification for RAG answers. Runs post-generation.
//
// Layer 1: Answerability — is the question answerable from the context?
// Layer 2: Entity lock — do entities in the answer exist in the source context?
// Layer 3: Citation check — does the answer reference its sources?
// Layer 4: Faithfulness — does the answer contradict the source material?
//
// Each layer returns pass/fail + reason. If any layer fails, the answer
// is downgraded or replaced with a safe refusal.

export interface VerifyResult {
  passed: boolean
  answer: string // Original or replaced with refusal
  confidence: 'high' | 'medium' | 'low'
  checks: {
    answerable: boolean
    entities_valid: boolean
    has_citations: boolean
    faithful: boolean
  }
  reason?: string
  latency_ms: number
}

const REFUSAL_CUSTOMER = "I don't have specific information about that. Would you like me to connect you with our team? You can call us at (706) 800-4001 or email success@southlandorganics.com."
const REFUSAL_STAFF = "I couldn't find that in our documentation. You may want to check with the relevant department or search the SOPs directly."

// ─── Main Verify Function ───────────────────────────────────────────────────

export async function verifyAnswer(
  env: Env,
  query: string,
  answer: string,
  contextChunks: string[],
  context: 'support_draft' | 'staff' | 'chat' | 'customer'
): Promise<VerifyResult> {
  const start = Date.now()
  const sourceText = contextChunks.join('\n\n')

  // Layer 1: Answerability — quick check via the fast model
  const answerable = await checkAnswerability(env, query, sourceText)

  if (!answerable) {
    const refusal = context === 'staff' ? REFUSAL_STAFF : REFUSAL_CUSTOMER
    return {
      passed: false,
      answer: refusal,
      confidence: 'low',
      checks: { answerable: false, entities_valid: true, has_citations: true, faithful: true },
      reason: 'Question not answerable from available context',
      latency_ms: Date.now() - start,
    }
  }

  // Layer 2: Entity lock — extract product names, dosages, numbers from answer
  // and verify they appear in the source context
  const entitiesValid = checkEntities(answer, sourceText)

  // Layer 3: Citation check — does the answer reference source material?
  const hasCitations = checkCitations(answer)

  // Layer 4: Faithfulness — check for contradictions (only on high-stakes answers)
  // Only run if entities failed or answer mentions dosages/rates/safety
  const needsFaithfulness = !entitiesValid || hasHighStakesClaims(answer)
  let faithful = true
  if (needsFaithfulness) {
    faithful = await checkFaithfulness(env, answer, sourceText)
  }

  // Determine outcome
  const allPassed = answerable && entitiesValid && hasCitations && faithful

  let confidence: VerifyResult['confidence'] = 'high'
  if (!allPassed) confidence = 'low'
  else if (!hasCitations) confidence = 'medium'

  let finalAnswer = answer
  let reason: string | undefined

  if (!entitiesValid || !faithful) {
    // Hard fail — replace with refusal
    finalAnswer = context === 'staff' ? REFUSAL_STAFF : REFUSAL_CUSTOMER
    reason = !entitiesValid
      ? 'Answer contains entities not found in source context'
      : 'Answer contradicts source material'
  }

  return {
    passed: allPassed,
    answer: finalAnswer,
    confidence,
    checks: {
      answerable,
      entities_valid: entitiesValid,
      has_citations: hasCitations,
      faithful,
    },
    reason,
    latency_ms: Date.now() - start,
  }
}

// ─── Layer 1: Answerability ─────────────────────────────────────────────────
// Uses the fast model to judge if the context contains an answer.

async function checkAnswerability(env: Env, query: string, sourceText: string): Promise<boolean> {
  // Short-circuit: if no source text, definitely not answerable
  if (!sourceText.trim()) return false

  const { text } = await generate(env,
    'You are a factual judge. Given a question and source text, determine if the source text contains enough information to answer the question. Respond with ONLY a JSON object: {"answerable": true} or {"answerable": false}. Nothing else.',
    `SOURCE TEXT:\n${sourceText.slice(0, 2000)}\n\nQUESTION: ${query}`,
    { model: 'fast', temperature: 0, max_tokens: 30 }
  )

  const parsed = parseJSON<{ answerable: boolean }>(text)
  return parsed?.answerable ?? true // Default to true if parse fails (don't over-block)
}

// ─── Layer 2: Entity Lock ───────────────────────────────────────────────────
// Extract key entities from answer and verify they exist in source context.
// Catches: fabricated product names, invented dosages, made-up SKUs.

function checkEntities(answer: string, sourceText: string): boolean {
  const sourceLower = sourceText.toLowerCase()

  // Extract product-like entities: capitalized multi-word phrases
  const productPattern = /(?:Litter Life|Big Ole Bird|Pour The Port|ZeroPoint|Torched|South40|Catalyst|D2|HOCL|Lawnmunition|TurfEffect|GOgreen|WaterClean|BioGreen|OrganiBliss)/gi
  const mentionedProducts = answer.match(productPattern) || []

  for (const product of mentionedProducts) {
    if (!sourceLower.includes(product.toLowerCase())) {
      return false // Product mentioned in answer but not in source
    }
  }

  // Extract numeric dosages/rates (e.g., "1 pint per gallon", "5 lbs per acre")
  const dosagePattern = /(\d+(?:\.\d+)?)\s*(pint|gallon|oz|lb|lbs|acre|sq\s*ft|per|ml|gram|kg)/gi
  const dosages = answer.match(dosagePattern) || []

  for (const dosage of dosages) {
    // Check if the number + unit combo appears in source
    const numMatch = dosage.match(/(\d+(?:\.\d+)?)/)
    if (numMatch && !sourceLower.includes(numMatch[1])) {
      return false // Numeric claim not found in source
    }
  }

  return true
}

// ─── Layer 3: Citation Check ────────────────────────────────────────────────
// Answers should reference their sources. Not a hard fail, but lowers confidence.

function checkCitations(answer: string): boolean {
  // Check for source references like [Source: ...] or "according to..."
  return (
    answer.includes('[Source') ||
    answer.includes('according to') ||
    answer.includes('Based on') ||
    answer.includes('our documentation') ||
    answer.includes('our records') ||
    answer.length < 100 // Short factual answers don't need citations
  )
}

// ─── Layer 4: Faithfulness ──────────────────────────────────────────────────
// LLM-based check: does the answer contradict the source material?
// Only runs for high-stakes claims (dosages, safety, rates).

async function checkFaithfulness(
  env: Env,
  answer: string,
  sourceText: string
): Promise<boolean> {
  const { text } = await generate(env,
    'You are a factual accuracy judge. Compare the ANSWER against the SOURCE TEXT. Does the answer contain any claims that contradict or are not supported by the source text? Respond with ONLY a JSON object: {"faithful": true} if all claims are supported, or {"faithful": false, "issue": "brief description"} if any claim contradicts the source.',
    `SOURCE TEXT:\n${sourceText.slice(0, 2000)}\n\nANSWER:\n${answer}`,
    { model: 'fast', temperature: 0, max_tokens: 50 }
  )

  const parsed = parseJSON<{ faithful: boolean; issue?: string }>(text)
  return parsed?.faithful ?? true // Default true if parse fails
}

// ─── High-Stakes Detection ──────────────────────────────────────────────────
// Answers about dosages, safety, and application rates get extra scrutiny.

function hasHighStakesClaims(answer: string): boolean {
  const patterns = [
    /\d+\s*(pint|gallon|oz|lb|lbs|acre|sq\s*ft|ml|gram|kg)/i,
    /application\s*rate/i,
    /safety\s*data/i,
    /SDS|MSDS/i,
    /hazard|toxic|danger|warning/i,
    /mix\s*with|dilut/i,
  ]
  return patterns.some((p) => p.test(answer))
}
