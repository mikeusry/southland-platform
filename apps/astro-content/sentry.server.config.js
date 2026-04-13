/**
 * Sentry Server-Side Configuration — Southland Website (Cloudflare Workers)
 *
 * Captures SSR errors in Astro server routes running on Cloudflare Pages.
 * Most value comes from the client config (cart/checkout errors are client-side).
 */

import * as Sentry from '@sentry/astro'

Sentry.init({
  dsn: 'https://2cd735876d8ac86479ca9b7ea11b6960@o4510754307178496.ingest.us.sentry.io/4511174165856256',

  environment: import.meta.env.MODE || 'production',

  // Lower sample rate for server — most pages are static/cached
  tracesSampleRate: 0.1,
})
