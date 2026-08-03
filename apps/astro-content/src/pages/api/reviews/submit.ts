/**
 * POST /api/reviews/submit — storefront proxy for review submission.
 *
 * The browser posts here, not to Nexus. Two reasons:
 *   - the customer's IP reaches Nexus as the forwarded header rather than
 *     Cloudflare's edge, so rate limiting counts real people;
 *   - the storefront keeps one origin, so no CORS preflight on the hot path.
 *
 * Everything this forwards lands as `pending` in Nexus. Nothing published here.
 */

import type { APIRoute } from 'astro'

export const prerender = false

const NEXUS_BASE = import.meta.env.NEXUS_API_BASE || 'https://nexus.southlandorganics.com'

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const res = await fetch(`${NEXUS_BASE}/api/public/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass the real client IP so Nexus rate-limits the person, not the edge.
        'x-forwarded-for': clientAddress ?? '',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })

    const json = await res.json().catch(() => ({}))
    return new Response(JSON.stringify(json), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[reviews/submit] proxy failed:', err)
    return new Response(
      JSON.stringify({ error: 'Could not submit right now. Please try again shortly.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
