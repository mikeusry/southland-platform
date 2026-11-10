/**
 * Pure attribution localStorage rules shared between landing capture and cart read.
 * Keep BaseLayout capture and cart.ts in sync by changing this module only.
 */

export const ATTRIBUTION_SESSION_MS = 30 * 60 * 1000
export const GOOGLE_CLICK_MS = 90 * 24 * 60 * 60 * 1000

export const GOOGLE_CLICK_PARAMS = ['gclid', 'gbraid', 'wbraid'] as const
export type GoogleClickParam = (typeof GOOGLE_CLICK_PARAMS)[number]

export type AttributionBag = Record<string, string>

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

/**
 * After a 30-minute UTM session gap, keep only Google click ids still inside 90 days.
 * Legacy rows without per-click *_ts use _timestamp as first-seen fallback.
 */
export function retainGoogleClicksAfterSession(
  store: AttributionBag,
  now = Date.now()
): AttributionBag {
  const lastTs = Number(store._timestamp) || 0
  if (!(lastTs > 0 && now - lastTs > ATTRIBUTION_SESSION_MS)) {
    return { ...store }
  }

  const kept: AttributionBag = {}
  for (const key of GOOGLE_CLICK_PARAMS) {
    if (!store[key]) continue
    const clickTs = googleClickEpochMs(store, key, lastTs)
    if (clickTs > 0 && now - clickTs <= GOOGLE_CLICK_MS) {
      kept[key] = store[key]
      const storedTs = store[`${key}_ts`]
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

/** Google sends one click id type per ad click — drop the other types. */
export function pruneToSingleGoogleClick(
  bag: AttributionBag,
  active: GoogleClickParam
): void {
  for (const key of GOOGLE_CLICK_PARAMS) {
    if (key === active) continue
    delete bag[key]
    delete bag[`${key}_ts`]
  }
}

/**
 * Merge a new landing capture into stored last-touch. Prunes conflicting Google ids
 * when this pageview carried a Google click param.
 */
export function mergeLastTouchCapture(
  stored: AttributionBag,
  incoming: AttributionBag,
  meta: { landingPage: string; referrer: string; now?: number }
): AttributionBag {
  const now = meta.now ?? Date.now()
  applyGoogleClickFirstSeen(incoming, stored, now)

  const merged: AttributionBag = { ...stored }
  for (const [k, v] of Object.entries(incoming)) {
    if (v) merged[k] = v
  }

  const active = activeGoogleClickKey(incoming)
  if (active) pruneToSingleGoogleClick(merged, active)

  merged._timestamp = String(now)
  merged._landing_page = meta.landingPage
  merged._referrer = meta.referrer
  return merged
}

/**
 * Apply the 30-minute UTM session rule while keeping Google click IDs for up to 90 days.
 */
export function filterLastTouchAttribution(
  data: AttributionBag,
  now = Date.now()
): AttributionBag | null {
  const ts = Number(data._timestamp) || 0
  const sessionExpired = ts > 0 && now - ts > ATTRIBUTION_SESSION_MS

  if (!sessionExpired) {
    return { ...data }
  }

  const retained: AttributionBag = {}
  for (const key of GOOGLE_CLICK_PARAMS) {
    if (!data[key]) continue
    const clickTs = googleClickEpochMs(data, key, ts)
    if (clickTs > 0 && now - clickTs <= GOOGLE_CLICK_MS) {
      retained[key] = data[key]
      const storedTs = data[`${key}_ts`]
      retained[`${key}_ts`] = storedTs ? String(storedTs) : String(clickTs)
    }
  }

  return Object.keys(retained).length > 0 ? retained : null
}
