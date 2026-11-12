/**
 * POST /api/pd-gclick — uncached Set-Cookie for the 90-day Google click bag.
 *
 * The landing client writes _pd_gclick to localStorage, then beacons the same
 * bag here so Safari can keep a first-party HTTP cookie (document.cookie is
 * capped at ~7 days). Domain is the first-party apex so shop. can read it.
 * The cookie is not HttpOnly: the unpublished theme snippet has to read it.
 *
 * Never set this cookie from cached HTML middleware. Do not log the body.
 * Newest click wins against the cookie already on the request. Same-site
 * Origin (or Referer if Origin is absent) is required. Empty `{}` bodies
 * do not clear the cookie; only expiry may drop it.
 *
 * Rate limit: this path is under `/api/`, so it already shares the
 * middleware per-IP limiter (60 requests per minute, `cf-connecting-ip`).
 * This file does not add a second limiter.
 *
 * Guarantees: Set-Cookie is only `_pd_gclick` (via googleClickSetCookieHeader);
 * IDs must match GOOGLE_CLICK_ID_RE and GOOGLE_CLICK_ID_MAX_LEN (200);
 * the body is empty; nothing else is set.
 */
import type { APIRoute } from 'astro'
import {
  googleClickSetCookieHeader,
  isSameSitePdGclickRequest,
  parseGoogleClickCookieBag,
  readGoogleClickCookieBag,
} from '../../lib/attribution-storage'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const now = Date.now()
  const headers = new Headers({ 'Cache-Control': 'no-store' })
  try {
    if (!isSameSitePdGclickRequest(request.headers)) {
      return new Response(null, { status: 204, headers })
    }
    const text = await request.text()
    const raw: unknown = text ? JSON.parse(text) : {}
    const bag = parseGoogleClickCookieBag(raw, now)
    if (!bag) {
      // Malformed, expired, future, or `{}`: do not clobber an existing cookie.
      return new Response(null, { status: 204, headers })
    }
    const existing = readGoogleClickCookieBag(request.headers.get('cookie') ?? '', now)
    if (existing && bag.ts < existing.ts) {
      return new Response(null, { status: 204, headers })
    }
    headers.set('Set-Cookie', googleClickSetCookieHeader(bag, now))
  } catch {
    // Malformed body: do not clobber an existing cookie.
  }
  return new Response(null, {
    status: 204,
    headers,
  })
}
