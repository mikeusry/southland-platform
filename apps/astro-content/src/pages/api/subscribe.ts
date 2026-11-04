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
 *
 * Bot defenses are the honeypot, the per-IP limit, and the MX check. The origin
 * allowlist is separate. The IP limit runs before any DNS lookup. See
 * `subscribe-guard.ts`.
 */

import type { APIRoute } from 'astro'
import { getServerEnv } from '../../lib/server-env'
import { mintNewsletterViaNexus } from '../../lib/subscribe-nexus'
import {
  clientIp,
  collectSignupUtm,
  consumeIpBudget,
  domainHasMx,
  isAllowedSubscribeOrigin,
  isHoneypotFilled,
  recordSuccessfulSignup,
  resolveSignupPage,
  resolveSignupSignal,
  resolveSignupSource,
  successfulSignupLimited,
  validateSubscribeEmail,
} from '../../lib/subscribe-guard'

const CIO_TRACK_API = 'https://track.customer.io/api/v1'

interface SubscribePayload {
  email?: string
  first_name?: string
  source?: string
  signupPage?: string
  episodeSlug?: string
  /** Honeypot. Password managers do not know this name. */
  hp_fax_2?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}

export const POST: APIRoute = async (context) => {
  const { request, locals } = context
  const json = (body: unknown, status: number, extraHeaders?: Record<string, string>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
    })

  let payload: SubscribePayload
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Invalid request body.' }, 400)
  }

  if (!isAllowedSubscribeOrigin(request, locals)) {
    return json({ error: 'Forbidden.' }, 403)
  }

  // Filled honeypot: look like success and do not subscribe. Do not log the address.
  if (isHoneypotFilled(payload.hp_fax_2)) {
    console.warn('[subscribe] honeypot filled')
    return json({ success: true }, 200)
  }

  const emailInput = typeof payload.email === 'string' ? payload.email : ''
  const verdict = validateSubscribeEmail(emailInput)
  if (!verdict.ok) {
    return json({ error: 'A valid email address is required.' }, 400)
  }

  let clientAddress = ''
  try {
    clientAddress = context.clientAddress
  } catch {
    clientAddress = ''
  }
  const ip = clientIp(request, clientAddress)
  if (ip) {
    const ipLimit = consumeIpBudget(ip)
    if (ipLimit.limited) {
      return json({ error: 'Too many requests.' }, 429, {
        'Retry-After': String(ipLimit.retryAfter),
      })
    }
  }

  if (!(await domainHasMx(verdict.domain))) {
    return json({ error: 'A valid email address is required.' }, 400)
  }

  const email = verdict.email
  const emailLimit = successfulSignupLimited(email)
  if (emailLimit.limited) {
    return json({ error: 'Too many requests.' }, 429, {
      'Retry-After': String(emailLimit.retryAfter),
    })
  }

  const signal = resolveSignupSignal(payload.signupPage, request, locals)
  const page = resolveSignupPage(payload.signupPage, request, locals)
  const source = resolveSignupSource(payload.source, page)
  const utm = collectSignupUtm(payload, signal)

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
    signup_page: page,
    // Customer.io expects unix seconds here, not an ISO string.
    created_at: Math.floor(Date.now() / 1000),
    ...utm,
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

    recordSuccessfulSignup(email)

    const firstName = typeof payload.first_name === 'string' ? payload.first_name.trim() : undefined

    // Nexus mints a one-time welcome code and emits newsletter_subscribed in Customer.io.
    // Non-fatal: CIO profile is already saved; order is PUT → Nexus → signup event.
    await mintNewsletterViaNexus(locals, {
      email,
      source,
      ...(firstName ? { first_name: firstName } : {}),
    })

    // A separate event so Customer.io campaigns can trigger on the signup
    // itself, not just on the attribute flipping true.
    await fetch(`${CIO_TRACK_API}/customers/${encodeURIComponent(email)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        name: 'newsletter_signup',
        data: { source, signup_page: page, podcast: isPodcast, ...utm },
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
