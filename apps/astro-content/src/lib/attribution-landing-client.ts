/**
 * Browser-only landing attribution capture (replaces inline BaseLayout scripts).
 */
import {
  activeGoogleClickKey,
  applyGoogleClickFirstSeen,
  mergeLastTouchCapture,
  isChatGptUtmSource,
  normalizeStoredLastTouch,
  pruneToSingleGoogleClick,
} from './attribution-storage'

const LAST_TOUCH_KEY = '_pd_attribution'
const FIRST_TOUCH_KEY = '_pd_first_touch'

const URL_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclid',
  'ttclid',
  'srsltid',
  'oppref',
] as const

const FT_URL_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclid',
  'ttclid',
  'srsltid',
  'oppref',
] as const

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : ''
}

function parseJsonStore(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function enrichPaidShoppingRules(found: Record<string, string>): void {
  const otherPaid = found.fbclid || found.msclid || found.ttclid || found.oppref
  const chatGptSource = isChatGptUtmSource(found.utm_source)

  if (found.srsltid && !found.gclid && !otherPaid) {
    found.utm_source = 'google'
    found.utm_medium = 'shopping_unattributed'
    found.utm_campaign = 'shopping-unattributed'
  } else if (found.srsltid && found.gclid && !chatGptSource) {
    found.utm_source = found.utm_source || 'google'
    found.utm_medium = found.utm_medium || 'cpc'
  }
  if (found.gclid && !found.utm_source && !chatGptSource) {
    found.utm_source = 'google'
    found.utm_medium = found.utm_medium || 'cpc'
  }
  if (found.fbclid && !found.utm_source && !chatGptSource) {
    found.utm_source = 'facebook'
    found.utm_medium = found.utm_medium || 'paid_social'
  }
  if (found.oppref && !found.utm_source) {
    found.utm_source = found.utm_source || 'chatgpt'
    found.utm_medium = found.utm_medium || 'ppc'
  }
}

function captureLastTouch(): void {
  try {
    const url = new URL(window.location.href)
    const found: Record<string, string> = {}
    let hasNew = false

    for (const p of URL_PARAMS) {
      const v = url.searchParams.get(p)
      if (v) {
        found[p] = v
        hasNew = true
      }
    }

    enrichPaidShoppingRules(found)

    const fbp = readCookie('_fbp')
    if (fbp) {
      found.fbp = fbp
      hasNew = true
    }
    const fbc = readCookie('_fbc')
    if (fbc) {
      found.fbc = fbc
      hasNew = true
    }
    if (!found.oppref) {
      const fromOai = readCookie('__oppref')
      if (fromOai) {
        found.oppref = fromOai
        hasNew = true
      }
    }

    window.setTimeout(() => {
      const laterOpp = readCookie('__oppref')
      if (!laterOpp) return
      const cur = parseJsonStore(LAST_TOUCH_KEY)
      if (cur.oppref) return
      cur.oppref = laterOpp
      if (!cur.utm_source || isChatGptUtmSource(cur.utm_source)) {
        if (!isChatGptUtmSource(cur.utm_source)) cur.utm_source = 'chatgpt'
        cur.utm_medium = cur.utm_medium || 'ppc'
      }
      cur._timestamp = String(Date.now())
      try {
        localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(cur))
      } catch {
        /* private mode */
      }
    }, 1500)

    window.setTimeout(() => {
      const laterFbc = readCookie('_fbc')
      if (!laterFbc) return
      const cur = parseJsonStore(LAST_TOUCH_KEY)
      if (cur.fbc) return
      cur.fbc = laterFbc
      cur._timestamp = String(Date.now())
      try {
        localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(cur))
      } catch {
        /* private mode */
      }
    }, 1500)

    const stored = normalizeStoredLastTouch(parseJsonStore(LAST_TOUCH_KEY))

    if (hasNew) {
      const merged = mergeLastTouchCapture(stored, found, {
        landingPage: url.pathname + url.search,
        referrer: document.referrer || '',
      })
      try {
        localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(merged))
      } catch {
        /* private mode */
      }
    }
  } catch {
    /* noop */
  }
}

function captureFirstTouch(): void {
  try {
    if (localStorage.getItem(FIRST_TOUCH_KEY)) return

    const url = new URL(window.location.href)
    const data: Record<string, string> = {}
    for (const p of FT_URL_PARAMS) {
      const v = url.searchParams.get(p)
      if (v) data[p] = v
    }

    enrichPaidShoppingRules(data)
    const now = Date.now()
    applyGoogleClickFirstSeen(data, {}, now)
    const ftActive = activeGoogleClickKey(data)
    if (ftActive) pruneToSingleGoogleClick(data, ftActive)

    const fbp = readCookie('_fbp')
    if (fbp) data.fbp = fbp
    const fbc = readCookie('_fbc')
    if (fbc) data.fbc = fbc
    if (!data.oppref) {
      const fromOai = readCookie('__oppref')
      if (fromOai) data.oppref = fromOai
    }

    data._timestamp = String(now)
    data._landing_page = url.pathname + url.search
    data._referrer = document.referrer || ''

    try {
      localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(data))
    } catch {
      return
    }

    if (data.fbc) return

    window.setTimeout(() => {
      try {
        if (!localStorage.getItem(FIRST_TOUCH_KEY)) return
        const laterFbc = readCookie('_fbc')
        if (!laterFbc) return
        const parsed = parseJsonStore(FIRST_TOUCH_KEY)
        if (parsed.fbc) return
        parsed.fbc = laterFbc
        localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(parsed))
      } catch {
        /* noop */
      }
    }, 1500)
  } catch {
    /* noop */
  }
}

if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  captureLastTouch()
  captureFirstTouch()
}
