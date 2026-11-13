/**
 * Browser-only landing attribution capture (replaces inline BaseLayout scripts).
 */
import {
  activeGoogleClickKey,
  applyChatGptUtmIfNeeded,
  applyGoogleClickFirstSeen,
  flushGoogleClickBeforeAccountLeave,
  isCustomerAccountHref,
  loadGoogleClickStore,
  mergeLastTouchCapture,
  prepareFirstTouchBagForStorage,
  isChatGptUtmSource,
  normalizeStoredLastTouch,
  opprefCountsAsNewPaidTouch,
  pruneToSingleGoogleClick,
  saveGoogleClickStore,
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

    const urlOppref = url.searchParams.get('oppref') || undefined
    const stored = normalizeStoredLastTouch(parseJsonStore(LAST_TOUCH_KEY))

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
      if (
        fromOai &&
        opprefCountsAsNewPaidTouch(stored, fromOai, {
          urlOppref,
          utmSource: found.utm_source,
          referrer: document.referrer || '',
        })
      ) {
        found.oppref = fromOai
        applyChatGptUtmIfNeeded(found)
        hasNew = true
      }
    }

    window.setTimeout(() => {
      const laterOpp = readCookie('__oppref')
      if (!laterOpp) return
      const curStored = normalizeStoredLastTouch(parseJsonStore(LAST_TOUCH_KEY))
      if (curStored.oppref === laterOpp) return
      if (
        !opprefCountsAsNewPaidTouch(curStored, laterOpp, {
          utmSource: curStored.utm_source,
          referrer: document.referrer || '',
        })
      ) {
        return
      }
      const merged = mergeLastTouchCapture(
        curStored,
        { oppref: laterOpp },
        {
          landingPage: curStored._landing_page || window.location.pathname + window.location.search,
          referrer: curStored._referrer || document.referrer || '',
        }
      )
      saveGoogleClickStore({ oppref: laterOpp })
      try {
        localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(merged))
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

    // Click store is independent of the session bag. saveGoogleClickStore
    // reads the _pd_gclick cookie alongside localStorage and keeps the newest.
    // An srsltid-only or empty visit must not clear a stored click, including
    // the case where Safari has dropped localStorage but the cookie is live.
    saveGoogleClickStore(found)

    if (hasNew) {
      const merged = mergeLastTouchCapture(stored, found, {
        landingPage: url.pathname + url.search,
        referrer: document.referrer || '',
        urlOppref,
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
    prepareFirstTouchBagForStorage(data)

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

let accountLeaveBound = false

export function onCustomerAccountLinkClick(event: Event): void {
  const target = event.target as {
    closest?: (selector: string) => {
      href?: string
      getAttribute?: (name: string) => string | null
    } | null
  } | null
  if (!target || typeof target.closest !== 'function') return
  const link = target.closest('a')
  if (!link) return
  const href = link.href || link.getAttribute?.('href') || ''
  const base =
    typeof window !== 'undefined' ? window.location.href : 'https://southlandorganics.com/'
  if (!isCustomerAccountHref(href, base)) return
  flushGoogleClickBeforeAccountLeave()
}

function bindCustomerAccountLeaveFlush(): void {
  if (accountLeaveBound) return
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return
  accountLeaveBound = true
  document.addEventListener('click', onCustomerAccountLinkClick, true)
}

function hasStoredCartId(): boolean {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('southland_cart_id')) {
      return true
    }
  } catch {
    /* private mode */
  }
  if (typeof document === 'undefined') return false
  return /(?:^|;\s*)sl_cart=/.test(document.cookie)
}

export async function captureLandingAttribution(): Promise<void> {
  captureLastTouch()
  captureFirstTouch()
  bindCustomerAccountLeaveFlush()
  if (!loadGoogleClickStore() || !hasStoredCartId()) return
  // Dynamic import: CLAUDE.md requires a lazy cart import. A static import
  // loads cart code on every page, including ones that never touch the cart.
  try {
    const { restampCartAfterAccountReturn } = await import('./cart')
    await restampCartAfterAccountReturn()
  } catch (err) {
    console.error('[attribution] account-return click stamp failed:', err)
  }
}

if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  void captureLandingAttribution()
}
