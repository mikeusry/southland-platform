import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { Cart } from '@southland/shopify-storefront'
import { captureLandingAttribution } from './attribution-landing-client'
import {
  GOOGLE_CLICK_MS,
  GOOGLE_CLICK_STORE_KEY,
  updateGoogleClickStore,
} from './attribution-storage'
import { getAttributionAttrs, goToCheckoutAfterStamp, planGoogleClickCheckoutStamp } from './cart'

/**
 * The four lost orders from the Nov 4–11 join. These assertions fail when the
 * 90-day click store is not stamped onto the headless cart.
 */

const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const DAY_MS = 24 * 60 * 60 * 1000

function installStorage(): void {
  const store = new Map<string, string>()
  const storage = {
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
    key() {
      return null
    },
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
}

function restore(
  name: 'window' | 'localStorage' | 'document',
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor)
  else Reflect.deleteProperty(globalThis, name)
}

afterEach(() => {
  restore('window', priorWindow)
  restore('localStorage', priorStorage)
  restore('document', priorDocument)
})

function attr(attrs: Array<{ key: string; value: string }>, key: string): string | undefined {
  return attrs.find((item) => item.key === key)?.value
}

test('click id not in the URL is still stamped from the 90-day store', () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      _timestamp: String(now),
      _landing_page: '/products/hen-helper/',
    })
  )
  localStorage.setItem(
    GOOGLE_CLICK_STORE_KEY,
    JSON.stringify({ gclid: 'G-NOT-IN-URL', gclid_ts: String(now - 9 * 60 * 1000) })
  )

  const attrs = getAttributionAttrs()
  assert.equal(attr(attrs, '_pd_gclid'), 'G-NOT-IN-URL')
  assert.equal(attr(attrs, '_pd_gclid_ts'), String(now - 9 * 60 * 1000))
})

test('srsltid after a gclid keeps the click id and stamps both', () => {
  const first = updateGoogleClickStore(null, { gclid: 'G-AD' }, 1_000)
  const afterShopping = updateGoogleClickStore(
    first,
    {
      srsltid: 'S-SHOP',
      utm_source: 'google',
      utm_medium: 'shopping_unattributed',
      utm_campaign: 'shopping-unattributed',
    },
    2_000
  )
  assert.equal(afterShopping?.gclid, 'G-AD')
  assert.equal(afterShopping?.gclid_ts, '1000')
  assert.equal(afterShopping?.srsltid, undefined)

  const newer = updateGoogleClickStore(afterShopping, { gclid: 'G-NEWER' }, 3_000)
  assert.equal(newer?.gclid, 'G-NEWER')
  assert.equal(newer?.gclid_ts, '3000')

  const olderBraid = updateGoogleClickStore(null, { gbraid: 'B-OLD' }, 500)
  const beatBraid = updateGoogleClickStore(olderBraid, { gclid: 'G-NEW' }, 4_000)
  assert.equal(beatBraid?.gclid, 'G-NEW')
  assert.equal(beatBraid?.gbraid, undefined)
  assert.equal(beatBraid?.gbraid_ts, undefined)

  installStorage()
  const now = Date.now()
  localStorage.setItem(
    GOOGLE_CLICK_STORE_KEY,
    JSON.stringify({ gclid: 'G-AD', gclid_ts: String(now - 2 * 60 * 1000) })
  )
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      srsltid: 'S-SHOP',
      utm_source: 'google',
      utm_medium: 'shopping_unattributed',
      utm_campaign: 'shopping-unattributed',
      _timestamp: String(now),
      _landing_page: '/?srsltid=S-SHOP',
    })
  )

  const attrs = getAttributionAttrs()
  assert.equal(attr(attrs, '_pd_gclid'), 'G-AD')
  assert.equal(attr(attrs, '_pd_srsltid'), 'S-SHOP')
  assert.equal(attr(attrs, '_pd_utm_medium'), 'shopping_unattributed')
})

test('a newer stored click wins over an older click still in the session bag', () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      gbraid: 'B-OLD',
      gbraid_ts: String(now - 10 * DAY_MS),
      _timestamp: String(now - 10 * DAY_MS),
    })
  )
  localStorage.setItem(
    GOOGLE_CLICK_STORE_KEY,
    JSON.stringify({ gclid: 'G-NEWER', gclid_ts: String(now) })
  )

  const attrs = getAttributionAttrs()
  assert.equal(attr(attrs, '_pd_gclid'), 'G-NEWER')
  assert.equal(attr(attrs, '_pd_gbraid'), undefined)
})

test('checkout stamp writes the stored click onto the same cart before navigation', async () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem(
    GOOGLE_CLICK_STORE_KEY,
    JSON.stringify({ gclid: 'G-SSO', gclid_ts: String(now - 9 * 60 * 1000) })
  )
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      srsltid: 'S-SHOP',
      utm_source: 'google',
      utm_medium: 'shopping_unattributed',
      _timestamp: String(now),
    })
  )

  const fresh = getAttributionAttrs()
  const cart = {
    id: 'gid://shopify/Cart/24532',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/same-token?key=before',
    attributes: [
      { key: '_pd_brand', value: 'southland' },
      { key: '_pd_srsltid', value: 'S-SHOP' },
      { key: '_pd_utm_medium', value: 'shopping_unattributed' },
    ],
    lines: [
      {
        id: 'gid://shopify/CartLine/1',
        quantity: 1,
        attributes: [{ key: '_nexus_cid', value: 'cid-1' }],
      },
    ],
  } as Cart

  const plan = planGoogleClickCheckoutStamp(cart, fresh, [
    { key: '_nexus_cid', value: 'cid-1' },
    ...fresh,
  ])
  assert.equal(plan.cartId, cart.id)
  assert.equal(plan.needsAttributeUpdate, true)
  assert.equal(attr(plan.attributes, '_pd_gclid'), 'G-SSO')
  assert.equal(attr(plan.attributes, '_pd_srsltid'), 'S-SHOP')
  assert.equal(attr(plan.attributes, '_pd_brand'), 'southland')
  assert.equal(plan.lineUpdates.length, 1)
  assert.equal(plan.lineUpdates[0]?.id, 'gid://shopify/CartLine/1')
  assert.equal(attr(plan.lineUpdates[0]?.attributes ?? [], '_pd_gclid'), 'G-SSO')
  assert.equal(attr(plan.lineUpdates[0]?.attributes ?? [], '_nexus_cid'), 'cid-1')

  const events: string[] = []
  let release: (cart: Cart) => void = () => {}
  const gate = new Promise<Cart>((resolve) => {
    release = resolve
  })
  const pending = goToCheckoutAfterStamp(
    cart.checkoutUrl,
    (url) => {
      events.push(`nav:${url}`)
    },
    cart,
    (current) => {
      events.push(`stamp:${current.id}`)
      return gate
    }
  )
  await Promise.resolve()
  assert.deepEqual(events, ['stamp:gid://shopify/Cart/24532'])
  const stampedUrl = 'https://southland-organics.myshopify.com/cart/c/same-token?key=after'
  release({ ...cart, checkoutUrl: stampedUrl })
  await pending
  assert.deepEqual(events, ['stamp:gid://shopify/Cart/24532', `nav:${stampedUrl}`])
})

test('gbraid inside 90 days is kept and stamped; a click past 90 days is not', () => {
  installStorage()
  const now = Date.now()
  const age = now - 85 * DAY_MS
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      _timestamp: String(now),
      _landing_page: '/',
    })
  )
  localStorage.setItem(
    GOOGLE_CLICK_STORE_KEY,
    JSON.stringify({ gbraid: 'B-85D', gbraid_ts: String(age) })
  )

  const attrs = getAttributionAttrs()
  assert.equal(attr(attrs, '_pd_gbraid'), 'B-85D')
  assert.equal(attr(attrs, '_pd_gbraid_ts'), String(age))

  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      _timestamp: String(now),
      _landing_page: '/',
    })
  )
  localStorage.setItem(
    GOOGLE_CLICK_STORE_KEY,
    JSON.stringify({ gbraid: 'B-91D', gbraid_ts: String(now - GOOGLE_CLICK_MS - DAY_MS) })
  )
  const expired = getAttributionAttrs()
  assert.equal(attr(expired, '_pd_gbraid'), undefined)
  assert.equal(attr(expired, '_pd_gclid'), undefined)
})

test('an older stored click does not replace a newer click in the session bag', () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      gclid: 'G-NEW',
      gclid_ts: String(now),
      _timestamp: String(now),
    })
  )
  localStorage.setItem(
    GOOGLE_CLICK_STORE_KEY,
    JSON.stringify({ gbraid: 'B-OLD', gbraid_ts: String(now - 10 * DAY_MS) })
  )

  const attrs = getAttributionAttrs()
  assert.equal(attr(attrs, '_pd_gclid'), 'G-NEW')
  assert.equal(attr(attrs, '_pd_gbraid'), undefined)
})

test('a Meta click clears a stored Google click instead of stamping both', () => {
  const cleared = updateGoogleClickStore(
    { gclid: 'G-AD', gclid_ts: '1000' },
    { fbclid: 'META' },
    2_000
  )
  assert.equal(cleared, null)

  installStorage()
  const now = Date.now()
  localStorage.setItem(
    GOOGLE_CLICK_STORE_KEY,
    JSON.stringify({ gclid: 'G-STALE', gclid_ts: String(now) })
  )
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      fbclid: 'META',
      utm_source: 'facebook',
      _timestamp: String(now),
    })
  )

  const attrs = getAttributionAttrs()
  assert.equal(attr(attrs, '_pd_gclid'), undefined)
  assert.equal(attr(attrs, '_pd_fbclid'), 'META')
  assert.equal(localStorage.getItem(GOOGLE_CLICK_STORE_KEY), null)
})

test('landing capture stores a gclid and a later srsltid URL does not blank it', () => {
  installStorage()
  const location = new URL('https://southlandorganics.com/?gclid=G-LANDING')
  Object.defineProperty(window, 'location', { configurable: true, value: location })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie: '', referrer: '' },
  })
  const realSetTimeout = globalThis.setTimeout
  globalThis.setTimeout = (() => 0) as typeof setTimeout
  try {
    captureLandingAttribution()
    assert.equal(
      JSON.parse(localStorage.getItem(GOOGLE_CLICK_STORE_KEY) ?? '{}').gclid,
      'G-LANDING'
    )

    location.href = 'https://southlandorganics.com/?srsltid=S-LATER'
    captureLandingAttribution()
    const stored = JSON.parse(localStorage.getItem(GOOGLE_CLICK_STORE_KEY) ?? '{}') as {
      gclid?: string
    }
    assert.equal(stored.gclid, 'G-LANDING')
    const bag = JSON.parse(localStorage.getItem('_pd_attribution') ?? '{}') as {
      gclid?: string
      srsltid?: string
    }
    assert.equal(bag.srsltid, 'S-LATER')
    assert.equal(bag.gclid, 'G-LANDING')

    const attrs = getAttributionAttrs()
    assert.equal(attr(attrs, '_pd_gclid'), 'G-LANDING')
    assert.equal(attr(attrs, '_pd_srsltid'), 'S-LATER')
  } finally {
    globalThis.setTimeout = realSetTimeout
  }
})
