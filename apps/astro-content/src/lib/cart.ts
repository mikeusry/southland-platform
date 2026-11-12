/**
 * Cart State Management
 *
 * Client-side cart utilities for Storefront API integration.
 * Follows the same localStorage + cookie + CustomEvent pattern as persona.ts.
 *
 * Cart ID persists across page navigations. The actual cart lives on Shopify's
 * servers — we only store the ID locally.
 */

import {
  createClient,
  createCart as sfCreateCart,
  addToCart as sfAddToCart,
  getCart as sfGetCart,
  removeFromCart as sfRemoveFromCart,
  updateCartLines as sfUpdateCartLines,
  updateCartAttributes as sfUpdateCartAttributes,
  applyDiscountCode as sfApplyDiscount,
} from '@southland/shopify-storefront'
import type {
  Cart,
  CartLineAttribute,
  CartLineInput,
  CartLineUpdateInput,
  StorefrontClient,
} from '@southland/shopify-storefront'
import {
  applyStoredGoogleClick,
  ATTRIBUTION_SESSION_MS,
  CART_LAST_TOUCH_CLEAR_ON_IDENTITY_CHANGE,
  coalesceLastTouchBag,
  filterLastTouchAttribution,
  GOOGLE_CLICK_MS,
  GOOGLE_CLICK_PARAMS,
  GOOGLE_CLICK_STORE_KEY,
  googleClickSnapshotFromPairs,
  incomingPaidNetwork,
  lastTouchIdentityChangedOnCart,
  loadGoogleClickStore,
} from './attribution-storage'

export {
  ATTRIBUTION_SESSION_MS,
  CART_LAST_TOUCH_CLEAR_ON_IDENTITY_CHANGE,
  filterLastTouchAttribution,
  GOOGLE_CLICK_MS,
  GOOGLE_CLICK_PARAMS,
  googleClickSnapshotFromPairs,
  lastTouchIdentityChangedOnCart,
} from './attribution-storage'

// Re-export for convenience
export type { Cart, CartLineInput }

// ─── Sentry helper ──────────────────────────────────────────────────────────

function captureCartException(err: Error, context: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    const Sentry = (window as any).Sentry
    Sentry.withScope((scope: any) => {
      scope.setTag('feature', 'case-builder')
      scope.setTag('stage', String(context.stage || 'unknown'))
      scope.setLevel('error')
      scope.setContext('case_builder', context)
      Sentry.captureException(err)
    })
  }
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const CART_ID_KEY = 'southland_cart_id'
const CART_COOKIE_NAME = 'sl_cart'
const CART_COOKIE_DAYS = 14 // Shopify carts expire after ~10 days
const NEXUS_CID_KEY = '_nexus_cid'

// ─── Identity Resolution ────────────────────────────────────────────────────

/**
 * Get or create a persistent Nexus customer ID for identity resolution.
 * Stored in localStorage, stamped on every cart line as an attribute.
 * Nexus reads this from carrier service callbacks and order webhooks
 * for deterministic matching (match_method = nexus_cid, confidence = high).
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for older browsers (Safari < 15.4, etc.)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function getNexusCid(): string {
  if (typeof window === 'undefined') return generateUUID()
  let cid = localStorage.getItem(NEXUS_CID_KEY)
  if (!cid) {
    cid = generateUUID()
    localStorage.setItem(NEXUS_CID_KEY, cid)
  }
  return cid
}

// ─── Attribution (Self-Owned) ───────────��───────────────────────────────────

const PD_ATTRIBUTION_KEY = '_pd_attribution'
const PD_FIRST_TOUCH_KEY = '_pd_first_touch'

const UTM_ATTR_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const

const LAST_TOUCH_ATTR_PARAMS = [
  ...UTM_ATTR_PARAMS,
  ...GOOGLE_CLICK_PARAMS,
  'gclid_ts',
  'gbraid_ts',
  'wbraid_ts',
  'fbclid',
  'fbp',
  'fbc',
  'msclid',
  'ttclid',
  'srsltid',
  'oppref',
] as const

const GOOGLE_CLICK_ATTR_KEYS = [
  '_pd_gclid',
  '_pd_gbraid',
  '_pd_wbraid',
  '_pd_gclid_ts',
  '_pd_gbraid_ts',
  '_pd_wbraid_ts',
] as const

/** UTMs and context that must move with the winning Google click on the cart. */
const CLICK_PAIRED_CART_KEYS = [
  '_pd_utm_source',
  '_pd_utm_medium',
  '_pd_utm_campaign',
  '_pd_utm_content',
  '_pd_utm_term',
  '_pd_srsltid',
  '_pd_landing_page',
  '_pd_referrer',
] as const

/**
 * A utm_campaign value that downstream attribution can actually join on.
 *
 * The Pulse joins orders to ad spend by slugifying the Google Ads campaign name
 * and matching it against orders.utm_campaign. That only works if the value we
 * stamp IS a slug. Measured on live orders 2026-07-28 (90d, gclid orders), five
 * distinct shapes were arriving in this one field:
 *
 *   bb-backyard-betty-pmax                          ✅ correct slug
 *   Catalyst - PMax (Feed-Only)                     ❌ raw campaign name
 *   Metapneumovirus (01KXNTEYRTKP4Q3BGVKSMT3E6C)    ❌ Klaviyo campaign ID
 *   actual_campaign_name_hardcoded                  ❌ tracking-template placeholder
 *   [D2-P0] Intent Search — Alpet + Food-Contact    ❌ another brand's campaign
 *
 * A raw name can't join because slugify(name) != name. A Klaviyo ID is email
 * traffic that happened to carry a click id. A placeholder is a template that
 * was never wired. None of these are recoverable downstream — by the time the
 * Pulse sees them the campaign is unknowable — so reject them at write time.
 *
 * Deliberately permissive: this is a shape check, not an allowlist. An allowlist
 * of campaign names is exactly what rotted three times (2026-04-30, 06-15,
 * 06-21) — every new campaign broke it until someone hand-edited a CASE
 * statement. Any lowercase slug passes; new campaigns need no change here.
 */
const UTM_CAMPAIGN_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Known-bad values that are the right SHAPE but still can't be attribution. */
const UTM_CAMPAIGN_PLACEHOLDERS = new Set([
  'actual_campaign_name_hardcoded',
  'actual-campaign-name-hardcoded',
  'campaign_name_here',
  'campaign-name-here',
  'your_campaign',
  'your-campaign',
  'placeholder',
  'todo',
  'test',
  'undefined',
  'null',
  'none',
])

/**
 * Returns true when `value` is safe to stamp as utm_campaign.
 *
 * NOTE ON SCOPE: a passing value is well-formed, NOT verified to exist. Only the
 * Google Ads API can confirm a gclid's real campaign, and that resolution has to
 * happen server-side at order import. This guard stops garbage from entering the
 * field; it cannot fill the field in when the click arrived without one.
 */
export function isValidUtmCampaign(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const v = value.trim()
  if (!v || v.length > 100) return false
  if (UTM_CAMPAIGN_PLACEHOLDERS.has(v.toLowerCase())) return false
  return UTM_CAMPAIGN_SLUG.test(v)
}

/**
 * Drop utm_campaign from an attribution bag when it isn't joinable.
 *
 * Dropping beats stamping garbage: a missing utm_campaign reads downstream as
 * "unknown campaign" (already handled — the Pulse prints a — and warns), whereas
 * a bogus value reads as a CONFIDENT WRONG ANSWER and silently misattributes
 * revenue to whichever campaign it collides with. The 2026-04 L&G incident
 * misattributed $3,616 exactly this way.
 *
 * Only applies to Google Ads clicks (a gclid, gbraid, or wbraid is present) — the
 * only traffic the Pulse joins to spend by slug. Email (Klaviyo, Customer.io), Meta, and social
 * stamps use names like "Welcome Series, Email #1 (YfNzYt)", "Torched Sales",
 * "link_in_bio" that fail the slug shape but ARE the attribution for those
 * channels. Checked against every order 2026-01-17 → 2026-10-02: 169 stamps fail
 * the shape, 45 with a gclid (the garbage above), 124 without (all legitimate).
 *
 * Other _pd_ params are left untouched: the click id is ground truth and is what the
 * server-side resolver will use to recover the campaign properly.
 */
function withValidatedCampaign(
  attrs: Array<{ key: string; value: string }>,
  campaignKey: string,
  clickPrefix: '_pd_' | '_pd_ft_'
): Array<{ key: string; value: string }> {
  const hasGoogleClick = GOOGLE_CLICK_PARAMS.some((id) =>
    attrs.some((attr) => attr.key === `${clickPrefix}${id}`)
  )
  if (!hasGoogleClick) return attrs
  return attrs.filter((a) => a.key !== campaignKey || isValidUtmCampaign(a.value))
}

/**
 * Read attribution data from localStorage (captured on landing page).
 * Returns key/value pairs prefixed with _pd_ for Nexus extraction.
 *
 * This replaces the old Shopify /cart/update.js approach — attribution now
 * flows via cart line item properties, making it checkout-backend-agnostic.
 * Works with Shopify, Medusa, or any self-hosted checkout.
 */
export function getAttributionAttrs(): Array<{ key: string; value: string }> {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PD_ATTRIBUTION_KEY)
    let data: Record<string, string> = {}
    if (raw) {
      try {
        data = JSON.parse(raw) as Record<string, string>
      } catch {
        data = {}
      }
    }
    // Enforce the 30-minute UTM session at read time (visitors with no new params
    // never hit BaseLayout's write path). Google click IDs survive up to 90 days
    // in `_pd_gclick` even when this bag no longer has them.
    const now = Date.now()
    const filtered = raw ? filterLastTouchAttribution(data, now) : null
    const sessionBag = filtered ?? {}
    const otherNetwork = incomingPaidNetwork(sessionBag)
    if (otherNetwork && otherNetwork !== 'google') {
      try {
        localStorage.removeItem(GOOGLE_CLICK_STORE_KEY)
      } catch {
        /* private mode */
      }
    }
    const overlaid = applyStoredGoogleClick(sessionBag, loadGoogleClickStore(now), now)
    if (Object.keys(overlaid).length === 0) {
      if (raw) localStorage.removeItem(PD_ATTRIBUTION_KEY)
      return []
    }
    const coalesced = coalesceLastTouchBag(overlaid)
    try {
      const next = JSON.stringify(coalesced)
      if (next !== raw) {
        localStorage.setItem(PD_ATTRIBUTION_KEY, next)
      }
    } catch {
      /* private mode */
    }
    const attrs: Array<{ key: string; value: string }> = []
    for (const param of LAST_TOUCH_ATTR_PARAMS) {
      if (coalesced[param]) {
        attrs.push({ key: `_pd_${param}`, value: String(coalesced[param]) })
      }
    }
    if (coalesced._landing_page)
      attrs.push({ key: '_pd_landing_page', value: coalesced._landing_page })
    if (coalesced._referrer) attrs.push({ key: '_pd_referrer', value: coalesced._referrer })
    return withValidatedCampaign(attrs, '_pd_utm_campaign', '_pd_')
  } catch {
    return []
  }
}

/**
 * Read first-touch attribution from localStorage (set once on first visit, never overwritten).
 * Returns key/value pairs prefixed with _pd_ft_ for Nexus extraction.
 *
 * Nexus reads these via extractAttribution() → getFtAttr() to populate ft_* columns
 * on the orders table, giving us first-touch vs last-touch attribution on every order.
 */
export function getFirstTouchAttrs(): Array<{ key: string; value: string }> {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PD_FIRST_TOUCH_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as Record<string, string>
    const attrs: Array<{ key: string; value: string }> = []
    const PARAMS = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'gclid',
      'gbraid',
      'wbraid',
      'gclid_ts',
      'gbraid_ts',
      'wbraid_ts',
      'fbclid',
      'fbp',
      'fbc',
      'msclid',
      'ttclid',
      'oppref',
    ]
    for (const param of PARAMS) {
      if (data[param]) {
        attrs.push({ key: `_pd_ft_${param}`, value: String(data[param]) })
      }
    }
    if (data._landing_page) attrs.push({ key: '_pd_ft_landing_page', value: data._landing_page })
    if (data._referrer) attrs.push({ key: '_pd_ft_referrer', value: data._referrer })
    if (data._timestamp) attrs.push({ key: '_pd_ft_timestamp', value: String(data._timestamp) })
    return withValidatedCampaign(attrs, '_pd_ft_utm_campaign', '_pd_ft_')
  } catch {
    return []
  }
}

/**
 * Build CART-LEVEL attribute list (not per-line) for the Shopify Web Pixel
 * cross-origin recovery (v2.3+).
 *
 * Why this is needed in addition to stampLines():
 *   Per-line attributes (set by stampLines) end up on order.line_items[].properties
 *   — which the Nexus order-created webhook reads via extractAttribution(). That
 *   path works fine for our internal attribution table.
 *
 *   But the Shopify Web Pixel sandbox runs on the CHECKOUT origin
 *   (southland-organics.myshopify.com), not the storefront origin
 *   (southlandorganics.com). browser.sessionStorage and per-line properties
 *   are NOT accessible cross-origin. checkout.attributes (Shopify
 *   note_attributes set at CART level) IS the only cross-origin-safe channel.
 *
 *   Without cart-level attributes, 100% of pixel_events purchase rows arrive
 *   with fbclid/gclid/utm_source = NULL — costing us Meta CAPI signal and
 *   Customer Match audience hygiene. (See:
 *   docs/pixel/southland-attribution-carryover-2026-05-31.md)
 *
 * Returns the same _pd_* keys that stampLines() emits, so the pixel can
 * read either with no schema split.
 */
function getCartLevelAttributionAttrs(): Array<{ key: string; value: string }> {
  const attrs: Array<{ key: string; value: string }> = []
  if (typeof window === 'undefined') return attrs

  // Mirror the line-level attribution payload
  attrs.push(...getAttributionAttrs())
  attrs.push(...getFirstTouchAttrs())

  // 🛑 WHICH STOREFRONT. southlandorganics.com and jockshockspray.com share ONE
  // Shopify backend, so nothing in the checkout payload reliably says which site
  // the shopper was on. Without this the Customer.io abandoned-cart flow cannot
  // tell them apart and would send Southland copy to a JockShock shopper.
  //
  // Unconditional, unlike the attribution keys above — those appear only when a
  // click id was captured; brand must be on EVERY cart or the flow can't gate.
  //
  // Measured 2026-08-01 over 300 checkouts — why nothing in the payload works:
  //   referring_site     absent on 79/300 (direct visits, search, shop.app)
  //   full_landing_site  the headless /cart/c/ path on 210/300, both brands
  //   line item SKU      JockShock SKUs also sell HERE, and that is a Southland
  //                      sale that should get Southland email — attribute on the
  //                      SITE, not the product.
  attrs.push({ key: '_pd_brand', value: 'southland' })

  // Add session_id + user_id so the pixel can correlate cart → purchase
  try {
    const cid = getNexusCid()
    if (cid) attrs.push({ key: NEXUS_CID_KEY, value: cid })
  } catch (_err) {
    /* localStorage may be unavailable */
  }
  try {
    const uid = localStorage.getItem('_pd_uid')
    if (uid) attrs.push({ key: '_pd_user_id', value: uid })
  } catch (_err) {
    /* noop */
  }
  try {
    const sessionData = localStorage.getItem('pd_session') || sessionStorage.getItem('pd_session')
    if (sessionData) {
      const parsed = JSON.parse(sessionData)
      if (parsed?.id) attrs.push({ key: '_pd_session_id', value: parsed.id })
    }
  } catch (_err) {
    /* noop */
  }

  // Persona — useful for downstream pixel reporting splits
  try {
    const raw = localStorage.getItem('southland_persona')
    if (raw) {
      const data = JSON.parse(raw)
      if (data?.id) attrs.push({ key: '_pd_persona', value: data.id })
    }
  } catch (_err) {
    /* noop */
  }

  return attrs
}

/**
 * Attribution + identity keys stamped on every cart line. Nexus still reads
 * line_items[0].properties first, so we restamp existing lines when the winning
 * click bundle changes (not only lines added in the latest add-to-cart).
 */
function getLineAttributionStamp(): CartLineAttribute[] {
  const cid = getNexusCid()
  const attrAttrs = getAttributionAttrs()
  const ftAttrs = getFirstTouchAttrs()

  let personaAttr: { key: string; value: string } | null = null
  try {
    const raw = localStorage.getItem('southland_persona')
    if (raw) {
      const data = JSON.parse(raw)
      if (data?.id) personaAttr = { key: '_pd_persona', value: data.id }
    }
  } catch (_err) {
    /* localStorage may be unavailable */
  }

  return [
    { key: NEXUS_CID_KEY, value: cid },
    ...attrAttrs,
    ...ftAttrs,
    ...(personaAttr ? [personaAttr] : []),
  ]
}

function stampLines(lines: CartLineInput[]): CartLineInput[] {
  const stamp = getLineAttributionStamp()
  const stampKeys = new Set(stamp.map((a) => a.key))

  return lines.map((line) => ({
    ...line,
    attributes: [...(line.attributes || []).filter((a) => !stampKeys.has(a.key)), ...stamp],
  }))
}

/** Re-stamp cart line properties and drop stale attribution keys on identity change. */
export function restampCartLineAttributes(
  existing: CartLineAttribute[],
  stamp: CartLineAttribute[],
  identityChanged: boolean
): CartLineAttribute[] {
  const stampKeys = new Set(stamp.map((s) => s.key))
  const clearKeys = new Set<string>(CART_LAST_TOUCH_CLEAR_ON_IDENTITY_CHANGE)
  const stampMap = new Map(stamp.map((s) => [s.key, s.value]))
  const dropClearStale =
    identityChanged ||
    (existing ?? []).some((a) => a.key && clearKeys.has(a.key) && !stampMap.has(a.key))

  return [
    ...(existing ?? []).filter((a) => {
      if (!a.key) return true
      if (stampKeys.has(a.key)) return false
      if (dropClearStale && clearKeys.has(a.key)) return false
      return true
    }),
    ...stamp,
  ]
}

function lineAttributionNeedsResync(
  line: Cart['lines'][number],
  stamp: CartLineAttribute[],
  identityChanged: boolean
): boolean {
  const stampMap = new Map(stamp.map((s) => [s.key, s.value]))
  const clearKeys = new Set<string>(CART_LAST_TOUCH_CLEAR_ON_IDENTITY_CHANGE)
  for (const a of line.attributes ?? []) {
    if (!a.key) continue
    if (clearKeys.has(a.key) && !stampMap.has(a.key)) return true
    const expected = stampMap.get(a.key)
    if (expected !== undefined && a.value !== expected) return true
  }
  return identityChanged
}

function attributionBagFromPdAttrs(
  attrs: Array<{ key: string; value: string }>
): Record<string, string> {
  const bag: Record<string, string> = {}
  for (const a of attrs) {
    if (!a.key?.startsWith('_pd_') || a.key.startsWith('_pd_ft_')) continue
    const tail = a.key.slice(4)
    if (tail === 'landing_page') bag._landing_page = a.value
    else if (tail === 'referrer') bag._referrer = a.value
    else if ((LAST_TOUCH_ATTR_PARAMS as readonly string[]).includes(tail)) {
      bag[tail] = a.value
    }
  }
  return bag
}

/** Align `_pd_attribution` localStorage with a cart merge after paid identity changes. */
export function syncAttributionLocalStorageAfterIdentityChange(
  mergedPdAttrs: Array<{ key: string; value: string }>
): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(PD_ATTRIBUTION_KEY)
    const prev = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    const fromCart = attributionBagFromPdAttrs(mergedPdAttrs)
    const bag = { ...prev }
    for (const key of CART_LAST_TOUCH_CLEAR_ON_IDENTITY_CHANGE) {
      const tail = key.startsWith('_pd_') ? key.slice(4) : key
      if (tail === 'landing_page') delete bag._landing_page
      else if (tail === 'referrer') delete bag._referrer
      else delete bag[tail]
    }
    Object.assign(bag, fromCart)
    const filtered = filterLastTouchAttribution(bag)
    if (!filtered) {
      localStorage.removeItem(PD_ATTRIBUTION_KEY)
      return
    }
    if (prev._timestamp) filtered._timestamp = prev._timestamp
    localStorage.setItem(PD_ATTRIBUTION_KEY, JSON.stringify(coalesceLastTouchBag(filtered)))
  } catch {
    /* private mode */
  }
}

async function syncCartLineAttribution(
  client: StorefrontClient,
  cart: Cart,
  identityChanged: boolean
): Promise<Cart> {
  const stamp = getLineAttributionStamp()
  if (stamp.length === 0) return cart

  const updates: CartLineUpdateInput[] = []

  for (const line of cart.lines) {
    if (!lineAttributionNeedsResync(line, stamp, identityChanged)) continue

    updates.push({
      id: line.id,
      attributes: restampCartLineAttributes(line.attributes ?? [], stamp, identityChanged),
    })
  }

  if (updates.length === 0) return cart
  const updated = await sfUpdateCartLines(client, cart.id, updates)
  return updated ?? cart
}

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  const domain = window.location.hostname.replace(/^www\./, '')
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; domain=.${domain}; SameSite=Lax`
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop()!.split(';').shift()!)
  }
  return null
}

export function getCartId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CART_ID_KEY) ?? getCookie(CART_COOKIE_NAME)
}

export function setCartId(cartId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CART_ID_KEY, cartId)
  setCookie(CART_COOKIE_NAME, cartId, CART_COOKIE_DAYS)
}

export function clearCartId(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CART_ID_KEY)
  setCookie(CART_COOKIE_NAME, '', -1)
}

// ─── Events ──────────────────────────────────────────────────────────────────

function dispatchCartEvent(cart: Cart | null): void {
  if (typeof window === 'undefined') return
  // Persist count for Header badge (read on next page load)
  try {
    localStorage.setItem('southland_cart_count', String(cart?.totalQuantity ?? 0))
  } catch {
    /* SSR or private browsing */
  }
  window.dispatchEvent(new CustomEvent('cart-changed', { detail: cart }))
}

// ─── Client singleton per page lifecycle ─────────────────────────────────────

let _client: StorefrontClient | null = null

function getClient(): StorefrontClient {
  if (!_client) {
    const env = import.meta.env
    _client = createClient({
      storeDomain: env?.PUBLIC_SHOPIFY_STORE_DOMAIN,
      publicAccessToken: env?.PUBLIC_SHOPIFY_STOREFRONT_TOKEN,
    })
  }
  return _client
}

// ─── Cart operations ─────────────────────────────────────────────────────────

/**
 * Get the current cart. Returns null if no cart exists or it has expired.
 */
export async function getCart(): Promise<Cart | null> {
  const cartId = getCartId()
  if (!cartId) return null

  const cart = await sfGetCart(getClient(), cartId)
  if (!cart) {
    // Cart expired or completed — clear the stored ID
    clearCartId()
    return null
  }

  return cart
}

export function googleClickBundleChangedOnCart(
  existing: Array<{ key: string; value: string }>,
  fresh: Array<{ key: string; value: string }>
): boolean {
  const freshSnap = googleClickSnapshotFromPairs(fresh)
  if (!freshSnap) return false
  return freshSnap !== googleClickSnapshotFromPairs(existing)
}

/**
 * Merge freshly-read attribution over a cart's existing cart-level attributes.
 *
 * Existing values win for most keys so a second add-to-cart after the UTM
 * session window does not erase a gclid already on the cart. Google click IDs
 * always take the fresh read; when that bundle changes, matching UTMs/landing
 * context move with it so we never pair a new click id with an old campaign.
 */
export function mergeCartAttributes(
  existing: Array<{ key: string; value: string }>,
  fresh: Array<{ key: string; value: string }>
): Array<{ key: string; value: string }> {
  const REFRESHABLE = new Set(['_pd_user_id', '_pd_session_id'])
  const FRESH_WINS = new Set<string>(GOOGLE_CLICK_ATTR_KEYS)
  const PAIRED_WINS = new Set<string>(CLICK_PAIRED_CART_KEYS)
  const identityChanged = lastTouchIdentityChangedOnCart(existing, fresh)

  const merged = new Map<string, string>()
  for (const a of existing) {
    if (a.key && a.value) merged.set(a.key, a.value)
  }

  if (identityChanged) {
    for (const key of CART_LAST_TOUCH_CLEAR_ON_IDENTITY_CHANGE) {
      merged.delete(key)
    }
  }

  for (const a of fresh) {
    if (!a.key || !a.value) continue
    if (FRESH_WINS.has(a.key)) {
      merged.set(a.key, a.value)
      continue
    }
    if (identityChanged && PAIRED_WINS.has(a.key)) {
      merged.set(a.key, a.value)
      continue
    }
    if (
      identityChanged &&
      (CART_LAST_TOUCH_CLEAR_ON_IDENTITY_CHANGE as readonly string[]).includes(a.key)
    ) {
      merged.set(a.key, a.value)
      continue
    }
    if (!merged.has(a.key) || REFRESHABLE.has(a.key)) merged.set(a.key, a.value)
  }
  return Array.from(merged, ([key, value]) => ({ key, value }))
}

function attributionAttrsEqual(
  left: Array<{ key: string; value: string }>,
  right: Array<{ key: string; value: string }>
): boolean {
  const a = left.filter((item) => item.key && item.value)
  const b = right.filter((item) => item.key && item.value)
  if (a.length !== b.length) return false
  const map = new Map(a.map((item) => [item.key, item.value]))
  return b.every((item) => map.get(item.key) === item.value)
}

function googleClickAttrsOnly(
  stamp: Array<{ key: string; value: string }>
): Array<{ key: string; value: string }> {
  const wanted = new Set<string>(GOOGLE_CLICK_ATTR_KEYS)
  return stamp.filter((item) => Boolean(item.key && item.value && wanted.has(item.key)))
}

/** True when the line is missing the current click or still has a different one. */
function lineNeedsGoogleClickWrite(
  attributes: Array<{ key: string; value: string }> | undefined,
  clickAttrs: Array<{ key: string; value: string }>
): boolean {
  if (clickAttrs.length === 0) return false
  const have = new Map(
    (attributes ?? []).filter((item) => item.key).map((item) => [item.key, item.value])
  )
  const expected = new Set(clickAttrs.map((item) => item.key))
  for (const item of clickAttrs) {
    if (have.get(item.key) !== item.value) return true
  }
  for (const key of GOOGLE_CLICK_ATTR_KEYS) {
    if (!expected.has(key) && have.has(key)) return true
  }
  return false
}

/** Add or replace only the Google click keys. Every other line property stays. */
function patchLineGoogleClick(
  existing: CartLineAttribute[] | undefined,
  clickAttrs: Array<{ key: string; value: string }>
): CartLineAttribute[] {
  const clickKeys = new Set<string>(GOOGLE_CLICK_ATTR_KEYS)
  const kept = (existing ?? []).filter((item) => item.key && !clickKeys.has(item.key))
  return [...kept, ...clickAttrs]
}

/**
 * Attributes and line updates that put the stored Google click on an existing
 * cart. cartAttributesUpdate replaces the whole list, so `attributes` is the
 * merged set. The cart id is the caller's — this does not create a cart.
 */
export function planGoogleClickCheckoutStamp(
  cart: Pick<Cart, 'id' | 'checkoutUrl' | 'attributes' | 'lines'>,
  freshCartAttrs: Array<{ key: string; value: string }>,
  lineStamp: CartLineAttribute[]
): {
  cartId: string
  checkoutUrl: string
  needsAttributeUpdate: boolean
  attributes: Array<{ key: string; value: string }>
  lineUpdates: CartLineUpdateInput[]
} {
  const existing = cart.attributes ?? []
  const attributes = mergeCartAttributes(existing, freshCartAttrs)
  const clickAttrs = googleClickAttrsOnly(lineStamp)
  const lineUpdates: CartLineUpdateInput[] = []
  for (const line of cart.lines) {
    if (!lineNeedsGoogleClickWrite(line.attributes, clickAttrs)) continue
    lineUpdates.push({
      id: line.id,
      attributes: patchLineGoogleClick(line.attributes, clickAttrs),
    })
  }
  return {
    cartId: cart.id,
    checkoutUrl: cart.checkoutUrl,
    needsAttributeUpdate: !attributionAttrsEqual(attributes, existing),
    attributes,
    lineUpdates,
  }
}

/** Write the stored click onto this cart id. Does not call cartCreate. */
export async function ensureGoogleClickStamped(cart: Cart): Promise<Cart> {
  const fresh = getCartLevelAttributionAttrs()
  const lineStamp = getLineAttributionStamp()
  const plan = planGoogleClickCheckoutStamp(cart, fresh, lineStamp)
  if (!plan.needsAttributeUpdate && plan.lineUpdates.length === 0) return cart

  let client: StorefrontClient
  try {
    client = getClient()
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('[cart] google click stamp failed:', error)
    captureCartException(error, { stage: 'google-click-client', cartId: cart.id })
    return cart
  }

  let next = cart
  try {
    if (plan.needsAttributeUpdate) {
      next = await updateCartAttributesWithRetry(client, cart.id, plan.attributes)
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('[cart] google click attribute stamp failed:', error)
    captureCartException(error, { stage: 'google-click-attributes', cartId: cart.id })
    return cart
  }

  if (plan.lineUpdates.length === 0) return next
  try {
    const updated = await sfUpdateCartLines(client, cart.id, plan.lineUpdates)
    return updated ?? next
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('[cart] google click line stamp failed:', error)
    captureCartException(error, { stage: 'google-click-lines', cartId: cart.id })
    return next
  }
}

/** Pre-checkout read plus stamp. After this, checkout navigation does not wait. */
export const CHECKOUT_STAMP_DEADLINE_MS = 1500

/**
 * Stamp the stored click, then navigate. The read and the stamp share one
 * deadline so a hung Storefront call cannot trap the shopper on the cart page.
 * A timeout leaves with the checkout URL already in hand. Any error leaves
 * with the link the shopper clicked.
 */
export async function goToCheckoutAfterStamp(
  fallbackUrl: string,
  navigate: (url: string) => void,
  cart?: Cart | null,
  stamp: (cart: Cart) => Promise<Cart> = ensureGoogleClickStamped
): Promise<void> {
  let current: Cart | null = cart ?? null
  let failed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), CHECKOUT_STAMP_DEADLINE_MS)
  })
  const work = (async () => {
    try {
      if (!current) current = await getCart()
      if (current) current = await stamp(current)
    } catch (err) {
      failed = true
      console.error('[cart] checkout click-id stamp failed:', err)
    }
  })()

  const winner = await Promise.race([work.then(() => 'done' as const), deadline])
  if (timer) clearTimeout(timer)
  if (winner === 'timeout') {
    navigate(current?.checkoutUrl || fallbackUrl)
    return
  }
  if (failed) {
    navigate(fallbackUrl)
    return
  }
  navigate(current?.checkoutUrl || fallbackUrl)
}

export async function retryTwice<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
    }
  }
  const err = lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  throw err
}

export async function updateCartAttributesWithRetry(
  client: StorefrontClient,
  cartId: string,
  attributes: Array<{ key: string; value: string }>
): Promise<Cart> {
  return retryTwice(() => sfUpdateCartAttributes(client, cartId, attributes))
}

/**
 * Add lines to cart. Creates a new cart if none exists.
 *
 * Cart-level attributes are required for the Shopify Web Pixel v2.3
 * cross-origin attribution recovery — they are the ONLY channel the pixel
 * sandbox can read from the checkout origin. See
 * getCartLevelAttributionAttrs() for the full rationale.
 *
 * NEW carts get them via cartCreate. EXISTING carts get them via a follow-up
 * cartAttributesUpdate: verified 2026-08-09 against the live 2026-01 API,
 * cartLinesAdd PRESERVES cart attributes but cannot SET them, so a cart first
 * created without attribution (direct visit, or a click outside the 30-min
 * window) could previously never acquire identity for the rest of its life.
 * That is the 222/224 no-uid gap in the attribution handoff.
 */
export async function addToCart(lines: CartLineInput[]): Promise<Cart> {
  const client = getClient()
  const cartId = getCartId()
  const stamped = stampLines(lines)
  const cartAttrs = getCartLevelAttributionAttrs()

  let cart: Cart

  if (cartId) {
    // Try adding to existing cart
    try {
      cart = await sfAddToCart(client, cartId, stamped)
      const preMergeAttrs = cart.attributes ?? []

      // cartLinesAdd preserves existing cart attributes but never sets them.
      // Reconcile so identity/attribution reaches checkout on repeat adds too.
      const merged = mergeCartAttributes(preMergeAttrs, cartAttrs)
      const changed =
        merged.length !== (cart.attributes?.length ?? 0) ||
        merged.some((m) => !cart.attributes?.some((e) => e.key === m.key && e.value === m.value))

      if (changed && merged.length > 0) {
        try {
          cart = await updateCartAttributesWithRetry(client, cart.id, merged)
        } catch (attrErr) {
          const err = attrErr instanceof Error ? attrErr : new Error(String(attrErr))
          console.error('[cart] cart attribute sync failed after retry:', err)
          captureCartException(err, {
            stage: 'cart-attributes-sync',
            cartId: cart.id,
          })
        }
      }

      const identityChanged = lastTouchIdentityChangedOnCart(preMergeAttrs, cartAttrs)
      if (identityChanged) {
        syncAttributionLocalStorageAfterIdentityChange(
          merged.filter((a) => a.key.startsWith('_pd_') && !a.key.startsWith('_pd_ft_'))
        )
        try {
          cart = await syncCartLineAttribution(client, cart, true)
        } catch (lineErr) {
          const err = lineErr instanceof Error ? lineErr : new Error(String(lineErr))
          console.error('[cart] cart line attribution restamp failed:', err)
          captureCartException(err, {
            stage: 'cart-line-attribution-sync',
            cartId: cart.id,
          })
        }
      }
    } catch (addErr) {
      // Cart may have expired — clear stale ID and create a new one
      console.warn('[cart] addToCart failed, creating new cart:', addErr)
      clearCartId()
      cart = await sfCreateCart(client, stamped, cartAttrs)
    }
  } else {
    cart = await sfCreateCart(client, stamped, cartAttrs)
  }

  cart = await ensureGoogleClickStamped(cart)
  setCartId(cart.id)
  dispatchCartEvent(cart)
  return cart
}

/**
 * Update existing cart lines (quantity changes, etc.)
 */
export async function updateCartLines(lines: CartLineUpdateInput[]): Promise<Cart | null> {
  const cartId = getCartId()
  if (!cartId) return null

  const cart = await sfUpdateCartLines(getClient(), cartId, lines)
  const stamped = await ensureGoogleClickStamped(cart)
  dispatchCartEvent(stamped)
  return stamped
}

/**
 * Remove lines from cart by line ID.
 */
export async function removeFromCart(lineIds: string[]): Promise<Cart | null> {
  const cartId = getCartId()
  if (!cartId) return null

  const cart = await sfRemoveFromCart(getClient(), cartId, lineIds)
  const stamped = await ensureGoogleClickStamped(cart)
  dispatchCartEvent(stamped)
  return stamped
}

/**
 * Apply a discount code to the current cart.
 */
export async function applyDiscount(code: string): Promise<Cart | null> {
  const cartId = getCartId()
  if (!cartId) {
    captureCartException(new Error('applyDiscount called with no cart ID'), {
      stage: 'apply-discount',
      discountCode: code,
    })
    return null
  }

  try {
    const cart = await sfApplyDiscount(getClient(), cartId, [code])
    dispatchCartEvent(cart)
    return cart
  } catch (err) {
    captureCartException(err instanceof Error ? err : new Error(String(err)), {
      stage: 'apply-discount',
      discountCode: code,
      cartId,
    })
    throw err // re-throw so CaseBuilder still shows the error banner
  }
}

/**
 * Fetch a single-use case discount code from Nexus.
 * Returns the code string, or null on failure.
 */
export async function fetchCaseDiscountCode(bundleId: string): Promise<string | null> {
  try {
    const res = await fetch('https://nexus.southlandorganics.com/api/case-discount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundleId }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      const err = new Error(`Case discount API returned ${res.status}: ${body}`)
      captureCartException(err, {
        stage: 'fetch-discount-code',
        bundleId,
        httpStatus: res.status,
      })
      return null
    }
    const data = await res.json()
    if (!data.code) {
      captureCartException(new Error('Case discount API returned no code'), {
        stage: 'fetch-discount-code',
        bundleId,
        responseBody: JSON.stringify(data),
      })
    }
    return data.code || null
  } catch (err) {
    captureCartException(err instanceof Error ? err : new Error(String(err)), {
      stage: 'fetch-discount-code',
      bundleId,
    })
    console.warn('[cart] Failed to fetch case discount code:', err)
    return null
  }
}

// ─── Bundle helpers ──────────────────────────────────────────────────────────

const CASE_SIZE = 4

/**
 * Build cart line inputs for a gallon case bundle.
 *
 * Takes a map of variantId → quantity (must total 4) and returns
 * CartLineInput[] with bundle attributes. Shopify will merge lines
 * with identical merchandiseId + attributes.
 */
export function buildCaseLines(selections: Map<string, number>, bundleId: string): CartLineInput[] {
  return Array.from(selections.entries()).map(([variantId, quantity]) => ({
    merchandiseId: variantId,
    quantity,
    attributes: [
      { key: '_bundle_id', value: bundleId },
      { key: '_bundle_type', value: 'gallon-case' },
      { key: 'Case Bundle', value: 'Gallon Case' },
    ],
  }))
}

/**
 * Generate a unique bundle ID for a new case.
 */
export function generateBundleId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `gallon-case-${ts}-${rand}`
}

/**
 * Count gallon items in a cart (items with _bundle_type = "gallon-case").
 */
export function countGallonItems(cart: Cart): number {
  return cart.lines
    .filter((line) =>
      line.attributes.some((a) => a.key === '_bundle_type' && a.value === 'gallon-case')
    )
    .reduce((sum, line) => sum + line.quantity, 0)
}

/**
 * Get case completion nudge info.
 * Returns null if no nudge is needed (0 gallon items, or exactly on a case boundary).
 */
export function getCaseNudge(gallonCount: number): { needed: number; caseNumber: number } | null {
  if (gallonCount === 0) return null
  const remainder = gallonCount % CASE_SIZE
  if (remainder === 0) return null
  return {
    needed: CASE_SIZE - remainder,
    caseNumber: Math.floor(gallonCount / CASE_SIZE) + 1,
  }
}
