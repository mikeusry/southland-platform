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
    // DuckDuckGo mobile / content-blocker postMessage origin checks —
    // thrown from injected code with no stack, not from our code.
    'invalid origin',
    // Google Maps module load failures — usually ad blockers or flaky
    // networks blocking maps.googleapis.com. Store locator has a
    // fallback UI that handles this gracefully, so these are noise.
    /^Could not load "(marker|places_impl|geocoder|util|map|drawing|visualization)"/,
    // Safari content extractor (Spotlight / Reader / Look Up) runs its own
    // JSON-LD parser against our pages and throws on @context handling.
    // Zero affected users, zero usable stack — it's not our code.
    /r\["@context"\]\.toLowerCase/,
    // Browser extension noise (Chrome message bus, Android WebView GC,
    // cross-origin iframes from chat widgets/Shopify Buy Button)
    'runtime.sendMessage',
    'Java object is gone',
    /Blocked a frame with origin .* from accessing a cross-origin frame/,
    // Safari/Firefox throw this when a <script src> from another origin
    // loads without CORS headers — almost always third-party pixels, chat
    // widgets, or ad tags we don't control. No stack into our code.
    /Cross-origin script load denied by Cross-Origin Resource Sharing policy/,
    // iOS in-app WebViews (Instagram, Facebook, TikTok, etc.) inject code
    // that probes window.webkit.messageHandlers. When it's not present,
    // the host app's injected script throws. Not from our bundle.
    /window\.webkit\.messageHandlers/,
    // Single-fire syntax errors that only come from injected/eval'd code
    'missing ) after argument list',
    'Unexpected end of input',
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
    const url = event.request?.url || ''

    // Drop errors fired from Google Translate proxy frames — the page URL
    // ends in translate.goog but the stack frames point at our bundle, so
    // denyUrls (which matches stack URLs) doesn't catch them.
    if (url.includes('translate.goog')) {
      return null
    }

    if (msg.includes('cart') || msg.includes('Cart') || msg.includes('add to cart')) {
      event.tags = { ...event.tags, feature: 'cart' }
    }
    if (msg.includes('Storefront') || msg.includes('GraphQL')) {
      event.tags = { ...event.tags, feature: 'storefront-api' }
    }
    // Case builder errors are revenue-critical — tag for dedicated alert rule
    if (msg.includes('discount') || msg.includes('case') || msg.includes('bundle')) {
      event.tags = { ...event.tags, feature: 'case-builder' }
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
