import type { Env } from '../types'

// ─── Embedding Models ───────────────────────────────────────────────────────
// Feature flag: switch between base (768d) and small (384d)
// Decision gate: if bge-base P99 > 500ms in benchmark, fall back to bge-small

export const EMBEDDING_MODELS = {
  base: '@cf/baai/bge-base-en-v1.5' as const,
  small: '@cf/baai/bge-small-en-v1.5' as const,
}

export const ACTIVE_MODEL = EMBEDDING_MODELS.base
export const VECTOR_DIMENSIONS = 768 // Change to 384 if switching to small

// ─── Embed Text ─────────────────────────────────────────────────────────────

export async function embedText(
  text: string | string[],
  env: Env
): Promise<{ vectors: number[][]; model: string; latency_ms: number }> {
  const start = Date.now()
  const input = Array.isArray(text) ? text : [text]

  // AI Gateway routing — disabled until gateway is created in CF dashboard.
  // To enable: create gateway "southland-ai" in CF dashboard, then set
  // AI_GATEWAY_ENABLED=true in wrangler.toml vars.
  const useGateway = env.AI_GATEWAY_SLUG && env.ENVIRONMENT !== 'gateway-disabled'
  const gatewayOpts = useGateway
    ? { gateway: { id: env.AI_GATEWAY_SLUG, skipCache: false, cacheTtl: 300 } }
    : undefined

  const result = await env.AI.run(ACTIVE_MODEL, { text: input }, gatewayOpts) as { data: number[][] }

  return {
    vectors: result.data,
    model: ACTIVE_MODEL,
    latency_ms: Date.now() - start,
  }
}

// ─── Embed Single Query ─────────────────────────────────────────────────────
// Convenience for search queries (single string → single vector)

export async function embedQuery(
  query: string,
  env: Env
): Promise<{ vector: number[]; model: string; latency_ms: number }> {
  const result = await embedText(query, env)
  return {
    vector: result.vectors[0],
    model: result.model,
    latency_ms: result.latency_ms,
  }
}
