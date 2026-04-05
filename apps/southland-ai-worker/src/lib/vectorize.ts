import type { Env, ChunkMetadata, SearchResult } from '../types'

// ─── Query Vectorize ────────────────────────────────────────────────────────
// Metadata filter is applied BEFORE topK (confirmed by CF docs).
// Max 10 metadata indexes per index. Indexed strings truncate at 64 bytes.

export interface VectorizeQueryOptions {
  vector: number[]
  topK?: number
  filter?: Partial<Pick<ChunkMetadata, 'doc_type' | 'business_unit' | 'tenant' | 'support_relevant' | 'category'>>
}

export async function queryVectorize(
  env: Env,
  options: VectorizeQueryOptions
): Promise<SearchResult[]> {
  const { vector, topK = 10, filter } = options

  // Build metadata filter object
  const metadataFilter: VectorizeVectorMetadataFilter = {}
  if (filter?.doc_type) metadataFilter.doc_type = filter.doc_type
  if (filter?.business_unit) metadataFilter.business_unit = filter.business_unit
  if (filter?.tenant) metadataFilter.tenant = filter.tenant
  if (filter?.support_relevant !== undefined) metadataFilter.support_relevant = filter.support_relevant
  if (filter?.category) metadataFilter.category = filter.category

  const hasFilter = Object.keys(metadataFilter).length > 0

  const results = await env.KNOWLEDGE_INDEX.query(vector, {
    topK,
    filter: hasFilter ? metadataFilter : undefined,
    returnMetadata: 'all',
    returnValues: false,
  })

  return results.matches.map((match) => {
    const meta = (match.metadata || {}) as Record<string, unknown>
    return {
      id: match.id,
      score: match.score,
      title: String(meta.title || ''),
      url: String(meta.url || ''),
      doc_type: String(meta.doc_type || ''),
      snippet: '', // Chunks stored externally — populate from D1 if needed
      business_unit: String(meta.business_unit || ''),
    }
  })
}

// ─── Upsert Vectors ─────────────────────────────────────────────────────────
// Stable IDs: product:SKU:0, blog:slug:3, sop:slug:1

export interface VectorRecord {
  id: string
  values: number[]
  metadata: ChunkMetadata
}

export async function upsertVectors(
  env: Env,
  vectors: VectorRecord[]
): Promise<{ count: number }> {
  if (vectors.length === 0) return { count: 0 }

  const result = await env.KNOWLEDGE_INDEX.upsert(
    vectors.map((v) => ({
      id: v.id,
      values: v.values,
      metadata: v.metadata as unknown as Record<string, VectorizeVectorMetadata>,
    }))
  )

  return { count: result.count }
}

// ─── Delete Vectors ─────────────────────────────────────────────────────────
// Delete by IDs (for chunk cleanup when document changes)

export async function deleteVectors(
  env: Env,
  ids: string[]
): Promise<{ count: number }> {
  if (ids.length === 0) return { count: 0 }
  const result = await env.KNOWLEDGE_INDEX.deleteByIds(ids)
  return { count: result.count }
}
