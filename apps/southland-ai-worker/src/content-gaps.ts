import type { Env } from './types'

// ─── Content Gap Mining (Layer 3.3) ─────────────────────────────────────────
// Analyzes search query logs to find:
// 1. Zero-result queries (content doesn't exist)
// 2. Low-score queries (content exists but doesn't answer well)
// 3. High-frequency queries (popular demand)
//
// GET /content-gaps?days=30

interface ContentGap {
  query: string
  count: number
  avg_results: number
  category: 'zero_result' | 'low_relevance' | 'high_demand'
}

export async function handleContentGaps(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  const url = new URL(request.url)
  const days = Math.min(parseInt(url.searchParams.get('days') || '30'), 90)

  try {
    // Zero-result queries
    const { results: zeroResults } = await env.DB.prepare(
      `SELECT query, COUNT(*) as count
       FROM search_events
       WHERE results_count = 0
         AND created_at >= datetime('now', '-${days} days')
       GROUP BY LOWER(query)
       ORDER BY count DESC
       LIMIT 20`
    ).all()

    // Low-relevance queries (had results but low quality — top result type might indicate mismatch)
    const { results: lowRelevance } = await env.DB.prepare(
      `SELECT query, COUNT(*) as count, AVG(results_count) as avg_results
       FROM search_events
       WHERE results_count > 0 AND results_count <= 3
         AND created_at >= datetime('now', '-${days} days')
       GROUP BY LOWER(query)
       HAVING count >= 2
       ORDER BY count DESC
       LIMIT 20`
    ).all()

    // Most searched queries (high demand)
    const { results: topQueries } = await env.DB.prepare(
      `SELECT query, COUNT(*) as count, AVG(results_count) as avg_results
       FROM search_events
       WHERE created_at >= datetime('now', '-${days} days')
       GROUP BY LOWER(query)
       ORDER BY count DESC
       LIMIT 30`
    ).all()

    // Total search volume
    const { results: volume } = await env.DB.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN results_count = 0 THEN 1 ELSE 0 END) as zero_results,
              AVG(latency_ms) as avg_latency
       FROM search_events
       WHERE created_at >= datetime('now', '-${days} days')`
    ).all()

    const stats = volume[0] as Record<string, number> || {}

    const gaps: ContentGap[] = [
      ...(zeroResults || []).map((r: Record<string, unknown>) => ({
        query: String(r.query),
        count: Number(r.count),
        avg_results: 0,
        category: 'zero_result' as const,
      })),
      ...(lowRelevance || []).map((r: Record<string, unknown>) => ({
        query: String(r.query),
        count: Number(r.count),
        avg_results: Number(r.avg_results || 0),
        category: 'low_relevance' as const,
      })),
    ]

    return json(
      {
        period_days: days,
        stats: {
          total_searches: stats.total || 0,
          zero_result_searches: stats.zero_results || 0,
          zero_result_rate: stats.total ? ((stats.zero_results || 0) / stats.total * 100).toFixed(1) + '%' : '0%',
          avg_latency_ms: Math.round(stats.avg_latency || 0),
        },
        gaps,
        top_queries: (topQueries || []).map((r: Record<string, unknown>) => ({
          query: String(r.query),
          count: Number(r.count),
          avg_results: Number(r.avg_results || 0),
        })),
        timestamp: new Date().toISOString(),
      },
      env,
      origin
    )
  } catch (err) {
    console.error('Content gaps error:', err)
    return json({ error: 'Failed to query search analytics' }, env, origin, 500)
  }
}

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
