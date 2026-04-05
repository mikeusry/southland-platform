/**
 * Search API — proxies to Southland AI Worker
 *
 * GET /api/search?q=query
 * POST /api/search { query: string }
 *
 * Returns semantic search results from the AI Worker (Vectorize + BGE embeddings).
 */

import type { APIRoute } from 'astro'

const AI_WORKER_URL =
  import.meta.env.AI_WORKER_URL || 'https://southland-ai-worker.point-dog-digital.workers.dev'

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q')?.trim()
  if (!query) {
    return new Response(JSON.stringify({ error: 'Query parameter "q" is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return proxySearch(query, url.searchParams)
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const query = body.query?.trim()
    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const params = new URLSearchParams()
    if (body.options?.type) params.set('type', body.options.type)
    if (body.options?.business_unit) params.set('business_unit', body.options.business_unit)
    if (body.options?.limit) params.set('limit', String(body.options.limit))

    return proxySearch(query, params)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function proxySearch(query: string, params: URLSearchParams): Promise<Response> {
  const limit = params.get('limit') || '20'
  const type = params.get('type') || ''
  const bu = params.get('business_unit') || ''

  const workerUrl = new URL(`${AI_WORKER_URL}/search`)
  workerUrl.searchParams.set('q', query)
  workerUrl.searchParams.set('limit', limit)
  if (type) workerUrl.searchParams.set('type', type)
  if (bu) workerUrl.searchParams.set('business_unit', bu)

  try {
    const res = await fetch(workerUrl.toString())
    const data = await res.json()

    // Log to BigQuery (non-blocking)
    logSearchEvent(query, data.total || 0).catch(console.error)

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('AI Worker search error:', err)
    return new Response(JSON.stringify({ error: 'Search service unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function logSearchEvent(query: string, resultsCount: number): Promise<void> {
  const webhookUrl = import.meta.env.BIGQUERY_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'search_events',
        row: {
          query,
          results_count: resultsCount,
          timestamp: new Date().toISOString(),
          source: 'website_ai',
        },
      }),
    })
  } catch (err) {
    console.error('Failed to log search event:', err)
  }
}
