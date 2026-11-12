/**
 * POST /api/pd-gclick — uncached Set-Cookie for the 90-day Google click bag.
 *
 * The landing client writes _pd_gclick to localStorage, then beacons the same
 * bag here so Safari can keep a first-party HTTP cookie (document.cookie is
 * capped at ~7 days). Domain=.southlandorganics.com so shop. can read it.
 * The cookie is not HttpOnly: the unpublished theme snippet has to read it.
 *
 * Never set this cookie from cached HTML middleware. Do not log the body.
 */
import type { APIRoute } from 'astro'
import {
  googleClickSetCookieHeader,
  parseGoogleClickCookieBag,
} from '../../lib/attribution-storage'

export const prerender = false

function isExplicitClear(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true
  if (typeof raw !== 'object' || Array.isArray(raw)) return false
  return Object.keys(raw as object).length === 0
}

export const POST: APIRoute = async ({ request }) => {
  const now = Date.now()
  const headers = new Headers({ 'Cache-Control': 'no-store' })
  try {
    const text = await request.text()
    const raw: unknown = text ? JSON.parse(text) : {}
    const bag = parseGoogleClickCookieBag(raw, now)
    if (bag) {
      headers.set('Set-Cookie', googleClickSetCookieHeader(bag, now))
    } else if (isExplicitClear(raw)) {
      headers.set('Set-Cookie', googleClickSetCookieHeader(null, now))
    }
  } catch {
    // Malformed body: do not clobber an existing cookie.
  }
  return new Response(null, {
    status: 204,
    headers,
  })
}
