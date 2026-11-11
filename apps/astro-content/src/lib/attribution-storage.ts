/**
 * Pure attribution localStorage rules shared between landing capture and cart read.
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
    if (!(clickTs > 0 && now - clickTs <= GOOGLE_CLICK_MS)) {
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
    if (clickTs > 0 && now - clickTs <= GOOGLE_CLICK_MS) {
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
