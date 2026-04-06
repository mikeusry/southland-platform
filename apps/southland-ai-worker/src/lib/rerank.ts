import type { Env } from '../types'

// ─── Cohere Rerank ─────────────────────────────────────────────────────────
// Two-stage retrieval: over-fetch from Vectorize → rerank with cross-encoder.
// Cohere Rerank v3.5 gives dramatically better relevance than embedding
// similarity alone, especially for product names, dosages, and policy text.
//
// Cost: $2/1K searches on rerank-v3.5 (at 200 chats/day ≈ $12/month)
// Latency: ~100-200ms (non-blocking, runs after Vectorize)

const COHERE_RERANK_URL = 'https://api.cohere.com/v2/rerank'

export interface RerankCandidate {
  id: string
  text: string
  title: string
  score: number // original Vectorize score
  url: string
  doc_type: string
  business_unit: string
}

export interface RerankResult {
  id: string
  text: string
  title: string
  relevance_score: number // Cohere rerank score (0-1)
  original_score: number
  url: string
  doc_type: string
  business_unit: string
}

/**
 * Rerank candidates using Cohere Rerank API.
 * Returns top_n most relevant results ordered by rerank score.
 *
 * Falls back to original Vectorize ordering if Cohere is unavailable.
 */
export async function rerank(
  env: Env,
  query: string,
  candidates: RerankCandidate[],
  topN = 6
): Promise<RerankResult[]> {
  if (!env.COHERE_API_KEY || candidates.length === 0) {
    // No reranker configured — return original order
    return candidates.slice(0, topN).map((c) => ({
      ...c,
      relevance_score: c.score,
      original_score: c.score,
    }))
  }

  try {
    const start = Date.now()

    const res = await fetch(COHERE_RERANK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.COHERE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'rerank-v3.5',
        query,
        documents: candidates.map((c) => c.text || c.title),
        top_n: topN,
        return_documents: false,
      }),
    })

    if (!res.ok) {
      console.error(`Cohere rerank failed: ${res.status}`)
      // Fallback to original order
      return candidates.slice(0, topN).map((c) => ({
        ...c,
        relevance_score: c.score,
        original_score: c.score,
      }))
    }

    const data = (await res.json()) as {
      results: Array<{ index: number; relevance_score: number }>
    }

    const latency = Date.now() - start
    console.log(`Rerank: ${candidates.length} → ${data.results.length} in ${latency}ms`)

    return data.results.map((r) => {
      const candidate = candidates[r.index]
      return {
        id: candidate.id,
        text: candidate.text,
        title: candidate.title,
        relevance_score: r.relevance_score,
        original_score: candidate.score,
        url: candidate.url,
        doc_type: candidate.doc_type,
        business_unit: candidate.business_unit,
      }
    })
  } catch (err) {
    console.error('Cohere rerank error (falling back):', err)
    return candidates.slice(0, topN).map((c) => ({
      ...c,
      relevance_score: c.score,
      original_score: c.score,
    }))
  }
}
