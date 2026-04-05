import type { Env, SearchRequest, SearchResponse } from './types'
import { embedQuery } from './lib/embeddings'
import { queryVectorize } from './lib/vectorize'

// ─── Search Handler ─────────────────────────────────────────────────────────
// Layer 3: Semantic site search
// Flow: exact-match check → embed query → Vectorize → return results

export async function handleSearch(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  const start = Date.now()
  const url = new URL(request.url)

  // Parse query params
  const q = url.searchParams.get('q')?.trim()
  if (!q) {
    return json({ error: 'Missing ?q= parameter' }, env, origin, 400)
  }

  const params: SearchRequest = {
    q,
    limit: Math.min(parseInt(url.searchParams.get('limit') || '10'), 50),
    type: url.searchParams.get('type') as SearchRequest['type'] | undefined,
    business_unit: url.searchParams.get('business_unit') || undefined,
    tenant: url.searchParams.get('tenant') || 'southland',
  }

  // Step 1: Check exact-match aliases (SKU, product title)
  const exactMatch = await checkExactMatch(env, params.q)
  if (exactMatch) {
    const response: SearchResponse = {
      results: [exactMatch],
      query: params.q,
      total: 1,
      latency_ms: Date.now() - start,
      model: 'exact-match',
      exact_match: true,
    }

    // Log search event async (don't block response)
    ctx.waitUntil(logSearchEvent(env, params.q, response))

    return json(response, env, origin)
  }

  // Step 2: Embed query
  const { vector, model } = await embedQuery(params.q, env)

  // Step 3: Query Vectorize with metadata filters
  const results = await queryVectorize(env, {
    vector,
    topK: params.limit,
    filter: {
      ...(params.type ? { doc_type: params.type } : {}),
      ...(params.business_unit ? { business_unit: params.business_unit } : {}),
      ...(params.tenant ? { tenant: params.tenant } : {}),
    },
  })

  const response: SearchResponse = {
    results,
    query: params.q,
    total: results.length,
    latency_ms: Date.now() - start,
    model,
    exact_match: false,
  }

  // Log search event async
  ctx.waitUntil(logSearchEvent(env, params.q, response))

  return json(response, env, origin)
}

// ─── Exact Match ────────────────────────────────────────────────────────────
// Check D1 alias table for SKU/title matches before running embeddings

async function checkExactMatch(
  env: Env,
  query: string
): Promise<SearchResponse['results'][0] | null> {
  const normalized = query.trim().toUpperCase()

  try {
    const row = await env.DB.prepare(
      'SELECT source_id, title, url, doc_type, business_unit FROM product_aliases WHERE alias_upper = ? LIMIT 1'
    )
      .bind(normalized)
      .first()

    if (!row) return null

    return {
      id: String(row.source_id),
      score: 1.0,
      title: String(row.title),
      url: String(row.url),
      doc_type: String(row.doc_type),
      snippet: '',
      business_unit: String(row.business_unit),
    }
  } catch {
    // D1 not set up yet or table doesn't exist — skip exact match
    return null
  }
}

// ─── Analytics Logging ──────────────────────────────────────────────────────

async function logSearchEvent(
  env: Env,
  query: string,
  response: SearchResponse
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO search_events (query, results_count, latency_ms, model, exact_match, top_result_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        query,
        response.total,
        response.latency_ms,
        response.model,
        response.exact_match ? 1 : 0,
        response.results[0]?.doc_type || null
      )
      .run()
  } catch {
    // Don't fail the response if logging fails
    console.error('Failed to log search event')
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function json(data: unknown, env: Env, origin: string | null, status = 200): Response {
  const allowed = env.ALLOWED_ORIGINS.split(',')
  const isAllowed = origin && allowed.includes(origin)
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': isAllowed ? origin! : '',
    },
  })
}
