import type { Env } from '../types'
import { generate } from './llm'
import { parseJSON } from './llm'

// ─── Query Rewriter ────────────────────────────────────────────────────────
// Decomposes complex questions into 2-4 sub-queries for better retrieval.
// Only fires for comparisons, troubleshooting, and multi-part questions.
// Simple factual questions pass through unchanged.
//
// Cost: 1 fast LLM call (~20 tokens output) on Workers AI 8B.
// Latency: ~200-400ms (parallel with alias search, before Vectorize).

const REWRITE_PROMPT = `You classify customer questions about agricultural products.

Given a customer question, determine if it needs decomposition:
- "simple": Single clear intent, one product or topic. No rewriting needed.
- "comparison": Comparing two or more products/approaches. Decompose into per-product queries.
- "troubleshooting": Describing a problem that needs diagnosis. Decompose into symptom + cause + solution queries.
- "multi_part": Multiple distinct questions in one message. Decompose into individual queries.

Respond with JSON only:
{"type": "simple"} or {"type": "comparison"|"troubleshooting"|"multi_part", "queries": ["query1", "query2", ...]}

Keep decomposed queries short (under 15 words each). Max 4 sub-queries.`

export interface RewriteResult {
  type: 'simple' | 'comparison' | 'troubleshooting' | 'multi_part'
  queries: string[] // Original query for simple, sub-queries for complex
}

/**
 * Classify and optionally decompose a query.
 * Returns the original query for simple questions, or 2-4 sub-queries for complex ones.
 */
export async function rewriteQuery(
  env: Env,
  query: string
): Promise<RewriteResult> {
  // Skip rewriting for very short or obviously simple queries
  const wordCount = query.trim().split(/\s+/).length
  if (wordCount <= 5) {
    return { type: 'simple', queries: [query] }
  }

  // Quick heuristic check — only call LLM if query looks complex
  const lower = query.toLowerCase()
  const isLikelyComplex =
    lower.includes(' vs ') ||
    lower.includes(' or ') ||
    lower.includes('difference between') ||
    lower.includes('compare') ||
    lower.includes('which ') ||
    lower.includes('not working') ||
    lower.includes('problem') ||
    lower.includes('issue') ||
    lower.includes('wrong') ||
    lower.includes(' and ') ||
    lower.includes('also') ||
    lower.includes('?') && lower.includes('?') // Multiple question marks

  if (!isLikelyComplex) {
    return { type: 'simple', queries: [query] }
  }

  try {
    const { text } = await generate(env, REWRITE_PROMPT, query, {
      model: 'fast',
      temperature: 0.0,
      max_tokens: 150,
      provider: 'workers-ai', // Fast, cheap — just classification + decomposition
    })

    const result = parseJSON<{ type: string; queries?: string[] }>(text)
    if (!result) {
      return { type: 'simple', queries: [query] }
    }

    if (result.type === 'simple' || !result.queries?.length) {
      return { type: 'simple', queries: [query] }
    }

    // Validate queries are reasonable
    const validQueries = result.queries
      .filter((q) => q && q.length > 3 && q.length < 200)
      .slice(0, 4)

    if (validQueries.length === 0) {
      return { type: 'simple', queries: [query] }
    }

    return {
      type: result.type as RewriteResult['type'],
      queries: validQueries,
    }
  } catch (err) {
    console.error('Query rewrite error (non-blocking):', err)
    return { type: 'simple', queries: [query] }
  }
}
