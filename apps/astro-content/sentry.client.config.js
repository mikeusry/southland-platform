/**
 * Sentry Client-Side Configuration — Southland Website (Astro storefront)
 *
 * Captures browser JS errors, cart failures, and checkout funnel issues.
 * Separate Sentry project from Nexus (sentry-green-mountain).
 *
 * Dashboard: https://sentry.io/organizations/inventorysouthland/projects/southland-website/
 */

import * as Sentry from '@sentry/astro'

Sentry.init({
  dsn: 'https://2cd735876d8ac86479ca9b7ea11b6960@o4510754307178496.ingest.us.sentry.io/4511174165856256',

  environment: import.meta.env.MODE || 'production',

  // Performance: 30% of page loads (storefront is high-traffic, keep cost down)
  tracesSampleRate: 0.3,

  // Session Replay: 5% normal, 100% on error (the money feature for cart bugs)
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  // Only propagate traces to our own origin — NOT to Shopify.
  // Shopify's CORS rejects sentry-trace/baggage headers, which
  // kills all Storefront API calls (cart, product fetch).
  tracePropagationTargets: [/^https:\/\/southlandorganics\.com/],

  // Filter non-actionable noise
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    // Network flakiness (retried by GraphQL client)
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'Load failed',
    // ResizeObserver (browser noise)
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // User abort (back button during fetch)
    'AbortError',
    'The operation was aborted',
    // Module import failures (ad blockers, old browsers)
    'Importing a module script failed',
    // Hydration mismatches (React SSR, usually harmless)
    'Hydration failed',
    'Text content does not match',
    // Chromium iOS WebView internal recursion (Google app in-app browser)
    'findTopmostVisibleElement',
    'Maximum call stack size exceeded',
  ],

  // Ignore extension URLs and Google Translate proxy
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /translate\.goog/i,
  ],

  // Tag cart-related errors for easy filtering
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value || ''
    if (msg.includes('cart') || msg.includes('Cart') || msg.includes('add to cart')) {
      event.tags = { ...event.tags, feature: 'cart' }
    }
    if (msg.includes('Storefront') || msg.includes('GraphQL')) {
      event.tags = { ...event.tags, feature: 'storefront-api' }
    }
    return event
  },

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
})
