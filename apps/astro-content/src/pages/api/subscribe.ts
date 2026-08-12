/**
 * Newsletter Subscribe API Endpoint
 *
 * POST /api/subscribe
 *
 * Replaces the browser's direct call to Klaviyo's client API. Klaviyo was
 * retired as ESP in Jul 2026 and the Nexus emitters were removed 2026-08-11,
 * but every signup form on this site kept posting to
 * `a.klaviyo.com/client/subscriptions/` — which still answers 202. Subscribers
 * saw "You're in!" and landed in an ESP nobody sends from.
 *
 * Customer.io's Track API uses Basic auth with a site id + secret key, which
 * cannot ship to the browser the way Klaviyo's public company id could. So the
 * call moves server-side, to a Cloudflare Pages function — same shape as
 * `/api/form/submit`, which already proxies SendGrid for the contact forms.
 *
 * Mirrors `identifyCustomerIOProfile` in southland-inventory (`src/lib/customerio.ts`):
 * PUT to /api/v1/customers/{email}, Basic auth, attributes in the body. Kept
 * deliberately close to it so the two do not drift.
 */

import type { APIRoute } from 'astro'
import { getServerEnv } from '../../lib/server-env'

const CIO_TRACK_API = 'https://track.customer.io/api/v1'

/** The audiences a visitor can subscribe from. Maps to a Customer.io segment attribute. */
const VALID_SOURCES = new Set([
  'website',
  'episode_page',
  'hub',
  'footer',
  'blog',
  'biosecurity',
  'lawn',
  'case-study',
])

interface SubscribePayload {
  email?: string
  source?: string
  signupPage?: string
  episodeSlug?: string
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export const POST: APIRoute = async ({ request, locals }) => {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  let payload: SubscribePayload
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  if (!email || !isValidEmail(email)) {
    return json({ error: 'A valid email address is required.' }, 400)
  }

  const source = payload.source && VALID_SOURCES.has(payload.source) ? payload.source : 'website'

  const siteId = getServerEnv(locals, 'CUSTOMERIO_SITE_ID')
  const trackKey = getServerEnv(locals, 'CUSTOMERIO_TRACK_API_KEY')

  // Fail loudly rather than returning a success the subscriber will believe.
  // Silently accepting the address is exactly the failure being fixed here.
  if (!siteId || !trackKey) {
    console.error('[subscribe] CUSTOMERIO_SITE_ID / CUSTOMERIO_TRACK_API_KEY not configured')
    return json({ error: 'Subscriptions are temporarily unavailable.' }, 503)
  }

  const isPodcast = ['episode_page', 'hub', 'footer'].includes(source)
  const now = new Date().toISOString()

  const attributes: Record<string, unknown> = {
    email,
    newsletter_subscriber: true,
    newsletter_subscribed_at: now,
    newsletter_signup_source: source,
    signup_page: payload.signupPage || '',
    // Customer.io expects unix seconds here, not an ISO string.
    created_at: Math.floor(Date.now() / 1000),
  }

  if (isPodcast) {
    attributes.podcast_subscriber = true
    attributes.podcast_subscribed_at = now
    attributes.podcast_signup_source = source
    if (payload.episodeSlug) attributes.podcast_signup_episode = payload.episodeSlug
  }

  const auth = btoa(`${siteId}:${trackKey}`)

  try {
    const res = await fetch(`${CIO_TRACK_API}/customers/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(attributes),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error(`[subscribe] Customer.io identify failed: ${res.status} ${detail}`)
      return json({ error: 'Could not complete signup. Please try again.' }, 502)
    }

    // A separate event so Customer.io campaigns can trigger on the signup
    // itself, not just on the attribute flipping true.
    await fetch(`${CIO_TRACK_API}/customers/${encodeURIComponent(email)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        name: 'newsletter_signup',
        data: { source, signup_page: payload.signupPage || '', podcast: isPodcast },
      }),
    }).catch((err) => {
      // Non-fatal: the profile already exists, which is the part that matters.
      console.warn('[subscribe] event post failed (profile was created):', err)
    })

    return json({ success: true }, 200)
  } catch (err) {
    console.error('[subscribe] error:', err)
    return json({ error: 'Could not complete signup. Please try again.' }, 500)
  }
}
