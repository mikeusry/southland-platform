/**
 * Go-Live Compare API
 *
 * POST /api/go-live/compare
 * Body: { livePath: "/collections/poultry-broilers/" }
 *
 * Compares a live Shopify page against its new Astro equivalent.
 */
import type { APIRoute } from 'astro'
import {
  fetchLivePageData,
  fetchNewPageData,
  computeDelta,
  computeVerdict,
  resolveNewPath,
} from '../../../lib/services/compare-pages'

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()

  try {
    const { livePath } = (await request.json()) as { livePath: string }

    if (!livePath) {
      return new Response(
        JSON.stringify({ error: true, message: 'Missing livePath' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const origin = new URL(request.url).origin
    const newPath = resolveNewPath(livePath)

    // Fetch both pages
    const [live, new_] = await Promise.all([
      fetchLivePageData(livePath),
      fetchNewPageData(newPath, origin),
    ])

    // Compute delta if both exist
    const delta = live && new_ ? computeDelta(live, new_) : null

    // Compute verdict
    const verdict = computeVerdict(live, new_, delta)

    const duration = Date.now() - startTime
    console.log(`[go-live] compared ${livePath} → ${newPath}: score=${verdict.score} (${verdict.status}) in ${duration}ms`)

    return new Response(
      JSON.stringify({
        livePath,
        newPath,
        live,
        new_,
        delta,
        verdict,
        comparedAt: new Date().toISOString(),
        duration,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[go-live] compare error:', err)
    return new Response(
      JSON.stringify({ error: true, message: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
