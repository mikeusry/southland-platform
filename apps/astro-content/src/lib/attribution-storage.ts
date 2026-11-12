/**
 * Attribution rules shared between landing capture and cart read.
 * Keep BaseLayout capture and cart.ts in sync by changing this module only.
 */

export const ATTRIBUTION_SESSION_MS = 30 * 60 * 1000
export const GOOGLE_CLICK_MS = 90 * 24 * 60 * 60 * 1000

export const GOOGLE_CLICK_PARAMS = ['gclid', 'gbraid', 'wbraid'] as const
export type GoogleClickParam = (typeof GOOGLE_CLICK_PARAMS)[number]

export const UTM_FIELD_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const

export type AttributionBag = Record<string, string>

export type PaidClickNetwork = 'google' | 'meta' | 'microsoft' | 'tiktok' | 'chatgpt'

export function isChatGptUtmSource(source: string | undefined): boolean {
  if (!source) return false
  const s = source.toLowerCase()
  return s === 'chatgpt' || s === 'chatgpt.com' || s.includes('chatgpt')
}

export type OpprefTouchContext = {
  urlOppref?: string
  utmSource?: string
  referrer?: string
  now?: number
}

export function hasChatGptLandingSignal(ctx: OpprefTouchContext): boolean {
  if (isChatGptUtmSource(ctx.utmSource)) return true
  const ref = (ctx.referrer || '').toLowerCase()
  return ref.includes('chatgpt') || ref.includes('chat.openai') || ref.includes('openai.com')
}

/**
 * The __oppref cookie persists across pageviews. Only treat it as a new ChatGPT
 * paid touch when the URL carried oppref, the cookie value changed, or (first
 * capture) there is a ChatGPT landing signal — never on a plain repeat load.
 */
export function opprefCountsAsNewPaidTouch(
  stored: AttributionBag,
  oppref: string,
  ctx: OpprefTouchContext
): boolean {
  if (ctx.urlOppref && ctx.urlOppref === oppref) return true
  if (stored.oppref === oppref) return false

  return hasChatGptLandingSignal(ctx) || Boolean(ctx.urlOppref)
}

export function applyChatGptUtmIfNeeded(bag: AttributionBag): void {
  if (bag.oppref && !bag.utm_source) {
    bag.utm_source = 'chatgpt'
    bag.utm_medium = bag.utm_medium || 'ppc'
  }
}

/** First-touch is write-once; apply ChatGPT UTM rules before persisting. */
export function prepareFirstTouchBagForStorage(bag: AttributionBag): AttributionBag {
  applyChatGptUtmIfNeeded(bag)
  return bag
}

export const UTM_CLEAR_ON_SAME_NETWORK_NEW_CLICK = [...UTM_FIELD_KEYS, 'srsltid'] as const

function paidClickIdForNetwork(bag: AttributionBag, network: PaidClickNetwork): string | null {
  switch (network) {
    case 'google': {
      const key = activeGoogleClickKey(bag)
      return key ? (bag[key] ?? null) : null
    }
    case 'meta':
      return bag.fbclid ?? null
    case 'microsoft':
      return bag.msclid ?? null
    case 'tiktok':
      return bag.ttclid ?? null
    case 'chatgpt':
      return bag.oppref ?? null
    default: {
      const unexpected: never = network
      return unexpected
    }
  }
}

/** Same paid network, new click id value (e.g. a second Meta ad click). */
export function sameNetworkPaidClickValueChanged(
  stored: AttributionBag,
  incoming: AttributionBag
): boolean {
  const existing = incomingPaidNetwork(stored)
  const fresh = incomingPaidNetwork(incoming)
  if (!existing || !fresh || existing !== fresh) return false
  const prev = paidClickIdForNetwork(stored, existing)
  const next = paidClickIdForNetwork(incoming, fresh)
  if (!prev || !next) return false
  return prev !== next
}

export function stripRepeatOpprefCookie(
  stored: AttributionBag,
  incoming: AttributionBag,
  ctx: OpprefTouchContext
): AttributionBag {
  const out = { ...incoming }
  if (!out.oppref) return out
  if (opprefCountsAsNewPaidTouch(stored, out.oppref, ctx)) {
    applyChatGptUtmIfNeeded(out)
    return out
  }
  delete out.oppref
  return out
}

export const BAG_CLEAR_ON_IDENTITY_CHANGE = [
  ...GOOGLE_CLICK_PARAMS,
  'gclid_ts',
  'gbraid_ts',
  'wbraid_ts',
  ...UTM_FIELD_KEYS,
  'srsltid',
  'fbclid',
  'fbc',
  'msclid',
  'ttclid',
  'oppref',
] as const

function bagGoogleSnapshot(bag: AttributionBag): string | null {
  const key = activeGoogleClickKey(bag)
  if (!key) return null
  return `${key}=${bag[key]}`
}

export function lastTouchIdentityChangedInBag(
  stored: AttributionBag,
  incoming: AttributionBag
): boolean {
  const inGoogle = bagGoogleSnapshot(incoming)
  if (!inGoogle && !incomingPaidNetwork(incoming)) return false

  const storedGoogle = bagGoogleSnapshot(stored)
  if (inGoogle && inGoogle !== storedGoogle) return true

  const ew = incomingPaidNetwork(stored)
  const fw = incomingPaidNetwork(incoming)
  if (fw && ew !== fw) return true

  return false
}

/** One Google click type per bag (read-time hygiene). */
export function coalesceLastTouchBag(bag: AttributionBag): AttributionBag {
  const out = { ...bag }
  const active = activeGoogleClickKey(out)
  if (active) pruneToSingleGoogleClick(out, active)
  return out
}

/** Epoch ms used to decide whether a Google click id is still within the 90-day window. */
export function googleClickEpochMs(
  bag: AttributionBag,
  key: GoogleClickParam,
  fallbackSessionTs?: number
): number {
  const perClick = Number(bag[`${key}_ts`]) || 0
  if (perClick > 0) return perClick
  const sessionTs = Number(bag._timestamp) || fallbackSessionTs || 0
  return sessionTs
}

/** Future timestamps are not live. A date ahead of now would never expire. */
function googleClickTsIsLive(ts: number, now: number): boolean {
  return ts > 0 && ts <= now && now - ts <= GOOGLE_CLICK_MS
}

/** Drop Google click ids older than 90 days (active session or not). */
export function expireGoogleClicksPast90Days(
  bag: AttributionBag,
  now = Date.now()
): AttributionBag {
  const out: AttributionBag = { ...bag }
  const sessionTs = Number(out._timestamp) || 0
  for (const key of GOOGLE_CLICK_PARAMS) {
    if (!out[key]) continue
    const clickTs = googleClickEpochMs(out, key, sessionTs)
    if (!googleClickTsIsLive(clickTs, now)) {
      delete out[key]
      delete out[`${key}_ts`]
    }
  }
  return out
}

/**
 * Normalize stored last-touch before merge: enforce 90-day expiry, then apply
 * the 30-minute UTM session strip when needed.
 */
export function normalizeStoredLastTouch(store: AttributionBag, now = Date.now()): AttributionBag {
  const bag = expireGoogleClicksPast90Days(store, now)
  const lastTs = Number(bag._timestamp) || 0
  if (!(lastTs > 0 && now - lastTs > ATTRIBUTION_SESSION_MS)) {
    return bag
  }

  const kept: AttributionBag = {}
  for (const key of GOOGLE_CLICK_PARAMS) {
    if (!bag[key]) continue
    const clickTs = googleClickEpochMs(bag, key, lastTs)
    if (clickTs > 0 && now - clickTs <= GOOGLE_CLICK_MS) {
      kept[key] = bag[key]
      const storedTs = bag[`${key}_ts`]
      kept[`${key}_ts`] = storedTs ? String(storedTs) : String(clickTs)
    }
  }
  return kept
}

/**
 * Set first-seen timestamps on incoming click ids. Reloading the same id must not
 * move the capture time forward.
 */
export function applyGoogleClickFirstSeen(
  incoming: AttributionBag,
  stored: AttributionBag,
  now = Date.now()
): void {
  for (const key of GOOGLE_CLICK_PARAMS) {
    const value = incoming[key]
    if (!value) continue
    const tsKey = `${key}_ts` as const
    const prevValue = stored[key]
    const prevTs = stored[tsKey]
    if (prevValue === value && prevTs) {
      incoming[tsKey] = String(prevTs)
    } else if (prevValue !== value) {
      incoming[tsKey] = String(now)
    } else {
      const legacy = Number(stored._timestamp) || now
      incoming[tsKey] = String(legacy)
    }
  }
}

export function activeGoogleClickKey(bag: AttributionBag): GoogleClickParam | null {
  for (const key of GOOGLE_CLICK_PARAMS) {
    if (bag[key]) return key
  }
  return null
}

export function incomingPaidNetwork(incoming: AttributionBag): PaidClickNetwork | null {
  if (activeGoogleClickKey(incoming)) return 'google'
  if (incoming.fbclid) return 'meta'
  if (incoming.msclid) return 'microsoft'
  if (incoming.ttclid) return 'tiktok'
  if (incoming.oppref) return 'chatgpt'
  return null
}

const NETWORK_FIELD_KEYS: Record<PaidClickNetwork, string[]> = {
  google: [...GOOGLE_CLICK_PARAMS, 'gclid_ts', 'gbraid_ts', 'wbraid_ts', 'srsltid'],
  meta: ['fbclid', 'fbc'],
  microsoft: ['msclid'],
  tiktok: ['ttclid'],
  chatgpt: ['oppref'],
}

/** When a new paid network click lands, remove stale ids from other networks. */
export function pruneLosingPaidNetworks(merged: AttributionBag, incoming: AttributionBag): void {
  const winner = incomingPaidNetwork(incoming)
  if (!winner) return

  for (const network of Object.keys(NETWORK_FIELD_KEYS) as PaidClickNetwork[]) {
    if (network === winner) continue
    for (const field of NETWORK_FIELD_KEYS[network]) {
      delete merged[field]
    }
  }

  const active = activeGoogleClickKey(incoming)
  if (active) pruneToSingleGoogleClick(merged, active)
}

/** Google sends one click id type per ad click — drop the other types. */
export function pruneToSingleGoogleClick(bag: AttributionBag, active: GoogleClickParam): void {
  for (const key of GOOGLE_CLICK_PARAMS) {
    if (key === active) continue
    delete bag[key]
    delete bag[`${key}_ts`]
  }
}

/**
 * Merge a new landing capture into stored last-touch. Prunes conflicting Google ids
 * and other paid networks when this pageview carried a new click.
 */
export function mergeLastTouchCapture(
  stored: AttributionBag,
  incoming: AttributionBag,
  meta: { landingPage: string; referrer: string; now?: number; urlOppref?: string }
): AttributionBag {
  const now = meta.now ?? Date.now()
  const touchIncoming = stripRepeatOpprefCookie(stored, incoming, {
    urlOppref: meta.urlOppref,
    utmSource: incoming.utm_source,
    referrer: meta.referrer,
    now,
  })
  applyGoogleClickFirstSeen(touchIncoming, stored, now)

  const identityChanged = lastTouchIdentityChangedInBag(stored, touchIncoming)
  const merged: AttributionBag = { ...stored }
  if (identityChanged) {
    for (const key of BAG_CLEAR_ON_IDENTITY_CHANGE) {
      delete merged[key]
    }
  } else if (sameNetworkPaidClickValueChanged(stored, touchIncoming)) {
    for (const key of UTM_CLEAR_ON_SAME_NETWORK_NEW_CLICK) {
      delete merged[key]
    }
  }
  for (const [k, v] of Object.entries(touchIncoming)) {
    if (v) merged[k] = v
  }

  pruneLosingPaidNetworks(merged, touchIncoming)

  merged._timestamp = String(now)
  merged._landing_page = meta.landingPage
  merged._referrer = meta.referrer

  return expireGoogleClicksPast90Days(merged, now)
}

/**
 * Apply the 30-minute UTM session rule while keeping Google click IDs for up to 90 days.
 * Google ids past 90 days drop even inside an active session.
 */
export function filterLastTouchAttribution(
  data: AttributionBag,
  now = Date.now()
): AttributionBag | null {
  const bag = expireGoogleClicksPast90Days(data, now)
  const ts = Number(bag._timestamp) || 0
  const sessionExpired = ts > 0 && now - ts > ATTRIBUTION_SESSION_MS

  if (!sessionExpired) {
    return Object.keys(bag).length > 0 ? bag : null
  }

  const retained: AttributionBag = {}
  for (const key of GOOGLE_CLICK_PARAMS) {
    if (!bag[key]) continue
    const clickTs = googleClickEpochMs(bag, key, ts)
    if (googleClickTsIsLive(clickTs, now)) {
      retained[key] = bag[key]
      const storedTs = bag[`${key}_ts`]
      retained[`${key}_ts`] = storedTs ? String(storedTs) : String(clickTs)
    }
  }

  return Object.keys(retained).length > 0 ? retained : null
}

/** Cart/local snapshot of the active Google click (type + value). */
export function googleClickSnapshotFromPairs(
  attrs: Array<{ key: string; value: string }>,
  prefix = '_pd_'
): string | null {
  for (const key of GOOGLE_CLICK_PARAMS) {
    const attrKey = `${prefix}${key}`
    const value = attrs.find((a) => a.key === attrKey)?.value
    if (value) return `${attrKey}=${value}`
  }
  return null
}

export function winningPaidNetworkFromCartAttrs(
  attrs: Array<{ key: string; value: string }>
): PaidClickNetwork | null {
  const map = new Map(attrs.filter((a) => a.key).map((a) => [a.key, a.value]))
  if (map.get('_pd_gclid') || map.get('_pd_gbraid') || map.get('_pd_wbraid')) return 'google'
  if (map.get('_pd_fbclid')) return 'meta'
  if (map.get('_pd_msclid')) return 'microsoft'
  if (map.get('_pd_ttclid')) return 'tiktok'
  if (map.get('_pd_oppref')) return 'chatgpt'
  return null
}

export const CART_LAST_TOUCH_CLEAR_ON_IDENTITY_CHANGE = [
  '_pd_gclid',
  '_pd_gbraid',
  '_pd_wbraid',
  '_pd_gclid_ts',
  '_pd_gbraid_ts',
  '_pd_wbraid_ts',
  '_pd_utm_source',
  '_pd_utm_medium',
  '_pd_utm_campaign',
  '_pd_utm_content',
  '_pd_utm_term',
  '_pd_srsltid',
  '_pd_landing_page',
  '_pd_referrer',
  '_pd_fbclid',
  '_pd_fbc',
  '_pd_msclid',
  '_pd_ttclid',
  '_pd_oppref',
] as const

export function lastTouchIdentityChangedOnCart(
  existing: Array<{ key: string; value: string }>,
  fresh: Array<{ key: string; value: string }>
): boolean {
  const freshGoogle = googleClickSnapshotFromPairs(fresh)
  if (!freshGoogle && !winningPaidNetworkFromCartAttrs(fresh)) return false

  const existingGoogle = googleClickSnapshotFromPairs(existing)
  if (freshGoogle && freshGoogle !== existingGoogle) return true

  const ew = winningPaidNetworkFromCartAttrs(existing)
  const fw = winningPaidNetworkFromCartAttrs(fresh)
  if (fw && ew !== fw) return true

  return false
}

/** Latest gclid, gbraid, or wbraid. Not the session bag — srsltid must not clear it. */
export const GOOGLE_CLICK_STORE_KEY = '_pd_gclick'
export const GOOGLE_CLICK_COOKIE = GOOGLE_CLICK_STORE_KEY
export const GOOGLE_CLICK_COOKIE_DOMAIN = '.southlandorganics.com'
export const GOOGLE_CLICK_ID_RE = /^[A-Za-z0-9._:-]+$/

export const GOOGLE_CLICK_ID_MAX_LEN = 200
/** Registrable site from the cookie Domain, used for same-site Origin checks. */
export const GOOGLE_CLICK_COOKIE_SITE = GOOGLE_CLICK_COOKIE_DOMAIN.replace(/^\./, '')

export function isValidGoogleClickId(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= GOOGLE_CLICK_ID_MAX_LEN &&
    GOOGLE_CLICK_ID_RE.test(value)
  )
}

export type GoogleClickCookieBag = {
  key: GoogleClickParam
  value: string
  ts: number
}

export function remainingGoogleClickMaxAgeSec(ts: number, now: number): number {
  if (!googleClickTsIsLive(ts, now)) return 0
  const remainingMs = ts + GOOGLE_CLICK_MS - now
  return Math.max(0, Math.min(Math.floor(GOOGLE_CLICK_MS / 1000), Math.floor(remainingMs / 1000)))
}

export function parseGoogleClickCookieBag(
  raw: unknown,
  now = Date.now()
): GoogleClickCookieBag | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const input = raw as Record<string, unknown>
  const bag: AttributionBag = {}
  for (const key of GOOGLE_CLICK_PARAMS) {
    const value = input[key]
    const tsRaw = input[`${key}_ts`]
    if (typeof value === 'string' && isValidGoogleClickId(value)) {
      bag[key] = value
    }
    if (tsRaw !== undefined && tsRaw !== null && tsRaw !== '') {
      bag[`${key}_ts`] = String(tsRaw)
    }
  }
  const live = liveGoogleClick(bag, now)
  if (!live) return null
  const key = activeGoogleClickKey(live)
  if (!key || !live[key] || !isValidGoogleClickId(live[key])) return null
  const ts = googleClickEpochMs(live, key)
  if (!googleClickTsIsLive(ts, now)) return null
  return { key, value: live[key], ts }
}

export function googleClickCookieValue(bag: AttributionBag, now = Date.now()): string | null {
  const parsed = parseGoogleClickCookieBag(bag, now)
  if (!parsed) return null
  return encodeURIComponent(
    JSON.stringify({ [parsed.key]: parsed.value, [`${parsed.key}_ts`]: String(parsed.ts) })
  )
}

export function googleClickSetCookieHeader(
  bag: GoogleClickCookieBag | null,
  now = Date.now()
): string {
  const cleared = `${GOOGLE_CLICK_COOKIE}=; Path=/; Domain=${GOOGLE_CLICK_COOKIE_DOMAIN}; Max-Age=0; Secure; SameSite=Lax`
  if (!bag) return cleared
  if (!isValidGoogleClickId(bag.value)) return cleared
  const maxAge = remainingGoogleClickMaxAgeSec(bag.ts, now)
  if (maxAge <= 0) return cleared
  const json = encodeURIComponent(
    JSON.stringify({ [bag.key]: bag.value, [`${bag.key}_ts`]: String(bag.ts) })
  )
  return `${GOOGLE_CLICK_COOKIE}=${json}; Path=/; Domain=${GOOGLE_CLICK_COOKIE_DOMAIN}; Max-Age=${maxAge}; Secure; SameSite=Lax`
}

/** JS cookie: immediate, readable on shop., Safari-capped at ~7 days. */
export function persistGoogleClickCookie(bag: AttributionBag | null, now = Date.now()): void {
  if (typeof document === 'undefined') return
  try {
    if (!bag) {
      document.cookie = googleClickSetCookieHeader(null, now)
      return
    }
    document.cookie = googleClickSetCookieHeader(parseGoogleClickCookieBag(bag, now), now)
  } catch {
    /* private mode */
  }
}

/**
 * Uncached apex Set-Cookie; ignore failures. Never posts an empty bag — the
 * endpoint rejects `{}` clears, and only expiry (via document.cookie Max-Age=0)
 * may drop a stored click.
 */
export function beaconGoogleClickCookie(bag: AttributionBag, now = Date.now()): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return
  const body = googleClickCookieValue(bag, now)
  if (!body) return
  const payload = decodeURIComponent(body)
  try {
    const blob = new Blob([payload], { type: 'application/json' })
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/pd-gclick', blob)
      return
    }
    void fetch('/api/pd-gclick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* noop */
  }
}

export function extractCookieValue(cookieHeader: string, name: string): string {
  const parts = `; ${cookieHeader}`.split(`; ${name}=`)
  if (parts.length < 2) return ''
  const raw = parts[1].split(';')[0] || ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function parseCookieJson(raw: string, now: number): GoogleClickCookieBag | null {
  const candidates = [raw]
  try {
    candidates.push(decodeURIComponent(raw))
  } catch {
    /* already decoded */
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      const bag = parseGoogleClickCookieBag(parsed, now)
      if (bag) return bag
    } catch {
      /* try next */
    }
  }
  return null
}

/** Read a live Google click from a Cookie header or document.cookie. */
export function readGoogleClickCookieBag(
  cookieHeader: string,
  now = Date.now()
): GoogleClickCookieBag | null {
  const raw = extractCookieValue(cookieHeader, GOOGLE_CLICK_COOKIE)
  if (!raw) return null
  return parseCookieJson(raw, now)
}

export function googleClickCookiePresent(cookieHeader: string): boolean {
  return extractCookieValue(cookieHeader, GOOGLE_CLICK_COOKIE) !== ''
}

export function isSameSitePdGclickUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    const site = GOOGLE_CLICK_COOKIE_SITE.toLowerCase()
    return host === site || host.endsWith(`.${site}`)
  } catch {
    return false
  }
}

/** Same-site https Origin, or Referer when Origin is absent. */
export function isSameSitePdGclickRequest(headers: Headers): boolean {
  const origin = headers.get('Origin') ?? headers.get('origin')
  if (origin !== null && origin !== undefined && origin !== '') {
    return isSameSitePdGclickUrl(origin)
  }
  const referer = headers.get('Referer') ?? headers.get('referer')
  return isSameSitePdGclickUrl(referer)
}

function liveGoogleClick(bag: AttributionBag, now: number): AttributionBag | null {
  let best: GoogleClickCookieBag | null = null
  for (const key of GOOGLE_CLICK_PARAMS) {
    const value = bag[key]
    if (!value || !isValidGoogleClickId(value)) continue
    const ts = googleClickEpochMs(bag, key)
    if (!googleClickTsIsLive(ts, now)) continue
    if (!best || ts > best.ts) best = { key, value, ts }
  }
  if (!best) return null
  return { [best.key]: best.value, [`${best.key}_ts`]: String(best.ts) }
}

function bagFromCookie(parsed: GoogleClickCookieBag | null): AttributionBag | null {
  if (!parsed) return null
  return { [parsed.key]: parsed.value, [`${parsed.key}_ts`]: String(parsed.ts) }
}

/** Newer live click wins. Equal timestamps keep the first argument. */
export function newerGoogleClickBag(
  first: AttributionBag | null,
  second: AttributionBag | null,
  now = Date.now()
): AttributionBag | null {
  const a = first ? liveGoogleClick(first, now) : null
  const b = second ? liveGoogleClick(second, now) : null
  if (!a) return b
  if (!b) return a
  const aKey = activeGoogleClickKey(a)
  const bKey = activeGoogleClickKey(b)
  if (!aKey) return b
  if (!bKey) return a
  const aTs = googleClickEpochMs(a, aKey)
  const bTs = googleClickEpochMs(b, bKey)
  return bTs > aTs ? b : a
}

export function googleClickBagsEqual(
  a: AttributionBag | null,
  b: AttributionBag | null,
  now = Date.now()
): boolean {
  const left = a ? liveGoogleClick(a, now) : null
  const right = b ? liveGoogleClick(b, now) : null
  if (!left && !right) return true
  if (!left || !right) return false
  return JSON.stringify(left) === JSON.stringify(right)
}

export function readGoogleClickStoreBag(
  raw: string | null,
  now = Date.now()
): AttributionBag | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return liveGoogleClick(parsed as AttributionBag, now)
  } catch {
    return null
  }
}

/**
 * Record a real click. A non-click visit (srsltid, UTMs, empty) leaves the
 * stored click in place. A newer click replaces an older one. Another paid
 * network clears it, matching the session-bag rule.
 */
export function updateGoogleClickStore(
  store: AttributionBag | null,
  incoming: AttributionBag,
  now = Date.now()
): AttributionBag | null {
  const current = store ? liveGoogleClick(store, now) : null
  const network = incomingPaidNetwork(incoming)
  if (network && network !== 'google') return null

  const incomingClick = activeGoogleClickKey(incoming)
  if (!incomingClick) return current
  const value = incoming[incomingClick]
  if (!value) return current

  const previousTs = current?.[`${incomingClick}_ts`]
  const ts = current?.[incomingClick] === value && previousTs ? String(previousTs) : String(now)
  return { [incomingClick]: value, [`${incomingClick}_ts`]: ts }
}

/** Overlay the 90-day click onto a session bag. The newer click wins. */
export function applyStoredGoogleClick(
  bag: AttributionBag,
  stored: AttributionBag | null,
  now = Date.now()
): AttributionBag {
  const live = stored ? liveGoogleClick(stored, now) : null
  if (!live) return bag
  const network = incomingPaidNetwork(bag)
  if (network && network !== 'google') return bag

  const storedKey = activeGoogleClickKey(live)
  if (!storedKey || !live[storedKey]) return bag
  const storedTs = googleClickEpochMs(live, storedKey)
  const bagKey = activeGoogleClickKey(bag)
  if (!bagKey) {
    return {
      ...bag,
      [storedKey]: live[storedKey],
      [`${storedKey}_ts`]: String(storedTs),
    }
  }
  if (bagKey === storedKey && bag[bagKey] === live[storedKey]) {
    if (!bag[`${bagKey}_ts`]) return { ...bag, [`${bagKey}_ts`]: String(storedTs) }
    return bag
  }

  const bagTs = googleClickEpochMs(bag, bagKey, Number(bag._timestamp) || 0)
  if (!(storedTs > bagTs)) return bag

  const out: AttributionBag = { ...bag }
  for (const key of GOOGLE_CLICK_PARAMS) {
    delete out[key]
    delete out[`${key}_ts`]
  }
  out[storedKey] = live[storedKey]
  out[`${storedKey}_ts`] = String(storedTs)
  return out
}

function cookieBagAsStore(now: number): AttributionBag | null {
  if (typeof document === 'undefined') return null
  return bagFromCookie(readGoogleClickCookieBag(document.cookie, now))
}

export function loadGoogleClickStore(now = Date.now()): AttributionBag | null {
  let fromLs: AttributionBag | null = null
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(GOOGLE_CLICK_STORE_KEY)
      if (raw) {
        fromLs = readGoogleClickStoreBag(raw, now)
        if (!fromLs) localStorage.removeItem(GOOGLE_CLICK_STORE_KEY)
      }
    } catch {
      /* private mode */
    }
  }
  const fromCookie = cookieBagAsStore(now)
  return newerGoogleClickBag(fromLs, fromCookie, now)
}

/**
 * Persist a Google click to localStorage and, when the stored click changes,
 * to the first-party cookie + beacon. Reads the cookie alongside localStorage
 * and keeps the newest. A visit with no click, or with only srsltid, never
 * clears the cookie and never beacons `{}`. Only expiry (or another paid
 * network, matching the session-bag rule) may drop it, and then only via a
 * JS Max-Age=0 write — never a `{}` beacon.
 */
export function saveGoogleClickStore(incoming: AttributionBag, now = Date.now()): void {
  if (typeof localStorage === 'undefined') return
  try {
    const fromLs = readGoogleClickStoreBag(localStorage.getItem(GOOGLE_CLICK_STORE_KEY), now)
    const fromCookie = cookieBagAsStore(now)
    const current = newerGoogleClickBag(fromLs, fromCookie, now)
    const next = updateGoogleClickStore(current, incoming, now)
    if (!next) {
      const network = incomingPaidNetwork(incoming)
      const rawCookie =
        typeof document !== 'undefined'
          ? extractCookieValue(document.cookie, GOOGLE_CLICK_COOKIE)
          : ''
      const expiredOrInvalid = !!rawCookie && !fromCookie
      if ((network && network !== 'google') || expiredOrInvalid) {
        localStorage.removeItem(GOOGLE_CLICK_STORE_KEY)
        persistGoogleClickCookie(null, now)
      }
      return
    }
    const raw = JSON.stringify(next)
    if (raw !== localStorage.getItem(GOOGLE_CLICK_STORE_KEY)) {
      localStorage.setItem(GOOGLE_CLICK_STORE_KEY, raw)
    }
    if (!googleClickBagsEqual(fromCookie, next, now)) {
      persistGoogleClickCookie(next, now)
      beaconGoogleClickCookie(next, now)
    }
  } catch {
    /* private mode */
  }
}
