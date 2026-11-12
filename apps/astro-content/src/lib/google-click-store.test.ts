import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { Cart, CartLineAttribute } from '@southland/shopify-storefront'
import { GOOGLE_CLICK_MS } from './attribution-storage'
import { getAttributionAttrs } from './cart'

/**
 * The four lost orders from the Nov 4–11 join. Imports stay limited to symbols
 * that already exist on main so a revert fails these assertions instead of
 * dying at load time. New helpers are loaded with a dynamic import.
 */

const CLICK_STORE_KEY = '_pd_gclick'

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

function assertFunction(value: unknown, name: string): void {
  assert.equal(typeof value, 'function', `${name} is missing`)
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
    CLICK_STORE_KEY,
    JSON.stringify({ gclid: 'G-NOT-IN-URL', gclid_ts: String(now - 9 * 60 * 1000) })
  )

  const attrs = getAttributionAttrs()
  assert.equal(attr(attrs, '_pd_gclid'), 'G-NOT-IN-URL')
  assert.equal(attr(attrs, '_pd_gclid_ts'), String(now - 9 * 60 * 1000))
})

test('srsltid after a gclid keeps the click id and stamps both', () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem(
    CLICK_STORE_KEY,
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

test('an srsltid visit does not clear a stored click and a newer click replaces it', async () => {
  const storage = await import('./attribution-storage.ts')
  assertFunction(storage.updateGoogleClickStore, 'updateGoogleClickStore')
  const updateGoogleClickStore = storage.updateGoogleClickStore

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
  localStorage.setItem(CLICK_STORE_KEY, JSON.stringify({ gclid: 'G-NEWER', gclid_ts: String(now) }))

  const attrs = getAttributionAttrs()
  assert.equal(attr(attrs, '_pd_gclid'), 'G-NEWER')
  assert.equal(attr(attrs, '_pd_gbraid'), undefined)
})

test('checkout stamp keeps existing line properties and skips a current click', async () => {
  installStorage()
  const now = Date.now()
  const ts = String(now - 9 * 60 * 1000)
  localStorage.setItem(CLICK_STORE_KEY, JSON.stringify({ gclid: 'G-SSO', gclid_ts: ts }))
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      srsltid: 'S-SHOP',
      utm_source: 'google',
      utm_medium: 'shopping_unattributed',
      _timestamp: String(now),
    })
  )

  const cartMod = await import('./cart.ts')
  assertFunction(cartMod.planGoogleClickCheckoutStamp, 'planGoogleClickCheckoutStamp')
  const fresh = getAttributionAttrs()
  const kept: CartLineAttribute[] = [
    { key: '_bundle_id', value: 'case-9' },
    { key: '_pd_utm_source', value: 'google' },
    { key: '_pd_utm_medium', value: 'cpc' },
    { key: '_nexus_cid', value: 'cid-1' },
  ]
  const cart = {
    id: 'gid://shopify/Cart/24532',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/same-token?key=before',
    attributes: [
      { key: '_pd_brand', value: 'southland' },
      { key: '_pd_srsltid', value: 'S-SHOP' },
      { key: '_pd_utm_medium', value: 'shopping_unattributed' },
    ],
    lines: [{ id: 'gid://shopify/CartLine/1', quantity: 1, attributes: kept }],
  } as Cart

  const plan = cartMod.planGoogleClickCheckoutStamp(cart, fresh, [
    { key: '_nexus_cid', value: 'cid-1' },
    ...fresh,
  ])
  assert.equal(plan.cartId, cart.id)
  assert.equal(plan.needsAttributeUpdate, true)
  assert.equal(attr(plan.attributes, '_pd_gclid'), 'G-SSO')
  assert.equal(attr(plan.attributes, '_pd_srsltid'), 'S-SHOP')
  assert.equal(attr(plan.attributes, '_pd_brand'), 'southland')
  assert.equal(plan.lineUpdates.length, 1)
  const lineAttrs = plan.lineUpdates[0]?.attributes ?? []
  assert.equal(plan.lineUpdates[0]?.id, 'gid://shopify/CartLine/1')
  assert.equal(attr(lineAttrs, '_pd_gclid'), 'G-SSO')
  assert.equal(attr(lineAttrs, '_bundle_id'), 'case-9')
  assert.equal(attr(lineAttrs, '_pd_utm_source'), 'google')
  assert.equal(attr(lineAttrs, '_pd_utm_medium'), 'cpc')
  assert.equal(attr(lineAttrs, '_nexus_cid'), 'cid-1')

  const already = cartMod.planGoogleClickCheckoutStamp(
    {
      ...cart,
      lines: [
        {
          id: 'gid://shopify/CartLine/1',
          quantity: 1,
          attributes: [
            ...kept,
            { key: '_pd_gclid', value: 'G-SSO' },
            { key: '_pd_gclid_ts', value: ts },
          ],
        },
      ],
    } as Cart,
    fresh,
    fresh
  )
  assert.equal(already.lineUpdates.length, 0)
})

test('a Meta line restamps to a Google line and keeps bundle and nexus ids', async () => {
  const cartMod = await import('./cart.ts')
  assertFunction(cartMod.planGoogleClickCheckoutStamp, 'planGoogleClickCheckoutStamp')
  const stamp = [
    { key: '_nexus_cid', value: 'cid-1' },
    { key: '_pd_gclid', value: 'G-NEW' },
    { key: '_pd_gclid_ts', value: '2000' },
    { key: '_pd_utm_source', value: 'google' },
    { key: '_pd_utm_medium', value: 'cpc' },
    { key: '_pd_utm_campaign', value: 'brand-search' },
  ]
  const cart = {
    id: 'gid://shopify/Cart/24542',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/same-token',
    attributes: [],
    lines: [
      {
        id: 'gid://shopify/CartLine/1',
        quantity: 1,
        attributes: [
          { key: '_bundle_id', value: 'case-9' },
          { key: '_nexus_cid', value: 'cid-1' },
          { key: '_pd_fbclid', value: 'META' },
          { key: '_pd_utm_source', value: 'facebook' },
          { key: '_pd_utm_medium', value: 'paid_social' },
          { key: '_pd_utm_campaign', value: 'meta-prospecting' },
        ],
      },
    ],
  } as Cart
  const plan = cartMod.planGoogleClickCheckoutStamp(cart, stamp, stamp)
  const lineAttrs = plan.lineUpdates[0]?.attributes ?? []
  assert.equal(plan.lineUpdates.length, 1)
  assert.equal(attr(lineAttrs, '_pd_gclid'), 'G-NEW')
  assert.equal(attr(lineAttrs, '_pd_utm_source'), 'google')
  assert.equal(attr(lineAttrs, '_pd_utm_medium'), 'cpc')
  assert.equal(attr(lineAttrs, '_pd_utm_campaign'), 'brand-search')
  assert.equal(attr(lineAttrs, '_pd_fbclid'), undefined)
  assert.equal(attr(lineAttrs, '_bundle_id'), 'case-9')
  assert.equal(attr(lineAttrs, '_nexus_cid'), 'cid-1')
})

test('a newer gclid replaces an older Google campaign on the line', async () => {
  const cartMod = await import('./cart.ts')
  assertFunction(cartMod.planGoogleClickCheckoutStamp, 'planGoogleClickCheckoutStamp')
  const stamp = [
    { key: '_nexus_cid', value: 'cid-1' },
    { key: '_pd_gclid', value: 'G-NEW' },
    { key: '_pd_gclid_ts', value: '4000' },
    { key: '_pd_utm_source', value: 'google' },
    { key: '_pd_utm_medium', value: 'cpc' },
    { key: '_pd_utm_campaign', value: 'brand-search' },
  ]
  const cart = {
    id: 'gid://shopify/Cart/24542',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/same-token',
    attributes: [],
    lines: [
      {
        id: 'gid://shopify/CartLine/1',
        quantity: 1,
        attributes: [
          { key: '_bundle_id', value: 'case-9' },
          { key: '_nexus_cid', value: 'cid-1' },
          { key: '_pd_gclid', value: 'G-OLD' },
          { key: '_pd_gclid_ts', value: '1000' },
          { key: '_pd_utm_source', value: 'google' },
          { key: '_pd_utm_medium', value: 'cpc' },
          { key: '_pd_utm_campaign', value: 'old-campaign' },
        ],
      },
    ],
  } as Cart
  const plan = cartMod.planGoogleClickCheckoutStamp(cart, stamp, stamp)
  const lineAttrs = plan.lineUpdates[0]?.attributes ?? []
  assert.equal(attr(lineAttrs, '_pd_gclid'), 'G-NEW')
  assert.equal(attr(lineAttrs, '_pd_utm_campaign'), 'brand-search')
  assert.equal(attr(lineAttrs, '_bundle_id'), 'case-9')
  assert.equal(attr(lineAttrs, '_nexus_cid'), 'cid-1')
  assert.equal(
    lineAttrs.some((item) => item.value === 'old-campaign' || item.value === 'G-OLD'),
    false
  )
})

test('a line with no click gains only the Google click keys', async () => {
  const cartMod = await import('./cart.ts')
  assertFunction(cartMod.planGoogleClickCheckoutStamp, 'planGoogleClickCheckoutStamp')
  const stamp = [
    { key: '_nexus_cid', value: 'cid-1' },
    { key: '_pd_gclid', value: 'G-ADD' },
    { key: '_pd_gclid_ts', value: '2000' },
    { key: '_pd_utm_source', value: 'google' },
    { key: '_pd_utm_campaign', value: 'brand-search' },
    { key: '_pd_fbclid', value: 'SHOULD-NOT-COPY' },
  ]
  const cart = {
    id: 'gid://shopify/Cart/24542',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/same-token',
    attributes: [],
    lines: [
      {
        id: 'gid://shopify/CartLine/1',
        quantity: 1,
        attributes: [
          { key: '_bundle_id', value: 'case-9' },
          { key: '_nexus_cid', value: 'cid-1' },
          { key: '_gift_note', value: 'hello' },
        ],
      },
    ],
  } as Cart
  const plan = cartMod.planGoogleClickCheckoutStamp(cart, stamp, stamp)
  const lineAttrs = plan.lineUpdates[0]?.attributes ?? []
  assert.equal(attr(lineAttrs, '_pd_gclid'), 'G-ADD')
  assert.equal(attr(lineAttrs, '_pd_gclid_ts'), '2000')
  assert.equal(attr(lineAttrs, '_bundle_id'), 'case-9')
  assert.equal(attr(lineAttrs, '_nexus_cid'), 'cid-1')
  assert.equal(attr(lineAttrs, '_gift_note'), 'hello')
  assert.equal(attr(lineAttrs, '_pd_utm_source'), undefined)
  assert.equal(attr(lineAttrs, '_pd_utm_campaign'), undefined)
  assert.equal(attr(lineAttrs, '_pd_fbclid'), undefined)
})

test('a second checkout click while the first is in flight navigates once', async () => {
  const cartMod = await import('./cart.ts')
  assertFunction(cartMod.goToCheckoutAfterStamp, 'goToCheckoutAfterStamp')
  const fallback = 'https://southland-organics.myshopify.com/cart/c/fallback'
  const stamped = 'https://southland-organics.myshopify.com/cart/c/same-token?key=after'
  const cart = {
    id: 'gid://shopify/Cart/24532',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/same-token?key=before',
    attributes: [],
    lines: [],
  } as Cart
  const urls: string[] = []
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const stamp = async (current: Cart) => {
    await gate
    return { ...current, checkoutUrl: stamped }
  }
  const first = cartMod.goToCheckoutAfterStamp(
    fallback,
    (url: string) => {
      urls.push(url)
    },
    cart,
    stamp
  )
  const second = cartMod.goToCheckoutAfterStamp(
    fallback,
    (url: string) => {
      urls.push(url)
    },
    cart,
    stamp
  )
  release()
  await first
  await second
  assert.deepEqual(urls, [stamped])
})

test('a stamp that never resolves still navigates within the deadline', async () => {
  const cartMod = await import('./cart.ts')
  assertFunction(cartMod.goToCheckoutAfterStamp, 'goToCheckoutAfterStamp')
  const deadline = cartMod.CHECKOUT_STAMP_DEADLINE_MS
  assert.equal(typeof deadline, 'number')
  assert.ok(deadline <= 2000)

  const checkoutUrl = 'https://southland-organics.myshopify.com/cart/c/same-token?key=before'
  const fallback = 'https://southland-organics.myshopify.com/cart/c/fallback'
  const cart = {
    id: 'gid://shopify/Cart/24532',
    checkoutUrl,
    attributes: [],
    lines: [],
  } as Cart
  const urls: string[] = []
  const started = Date.now()
  await cartMod.goToCheckoutAfterStamp(
    fallback,
    (url: string) => {
      urls.push(url)
    },
    cart,
    () => new Promise<Cart>(() => {})
  )
  const elapsed = Date.now() - started
  assert.deepEqual(urls, [checkoutUrl])
  assert.ok(elapsed < deadline + 800, `navigated after ${elapsed}ms`)
})

test('a thrown stamp still navigates to the fallback URL', async () => {
  const cartMod = await import('./cart.ts')
  assertFunction(cartMod.goToCheckoutAfterStamp, 'goToCheckoutAfterStamp')
  const fallback = 'https://southland-organics.myshopify.com/cart/c/fallback'
  const cart = {
    id: 'gid://shopify/Cart/24532',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/same-token',
    attributes: [],
    lines: [],
  } as Cart
  const urls: string[] = []
  await cartMod.goToCheckoutAfterStamp(
    fallback,
    (url: string) => {
      urls.push(url)
    },
    cart,
    async () => {
      throw new Error('stamp failed')
    }
  )
  assert.deepEqual(urls, [fallback])
})

test('a stamp that finishes inside the deadline uses the stamped checkout URL', async () => {
  const cartMod = await import('./cart.ts')
  assertFunction(cartMod.goToCheckoutAfterStamp, 'goToCheckoutAfterStamp')
  const fallback = 'https://southland-organics.myshopify.com/cart/c/fallback'
  const stamped = 'https://southland-organics.myshopify.com/cart/c/same-token?key=after'
  const cart = {
    id: 'gid://shopify/Cart/24532',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/same-token?key=before',
    attributes: [],
    lines: [],
  } as Cart
  const urls: string[] = []
  await cartMod.goToCheckoutAfterStamp(
    fallback,
    (url: string) => {
      urls.push(url)
    },
    cart,
    async (current: Cart) => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return { ...current, checkoutUrl: stamped }
    }
  )
  assert.deepEqual(urls, [stamped])
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
  localStorage.setItem(CLICK_STORE_KEY, JSON.stringify({ gbraid: 'B-85D', gbraid_ts: String(age) }))

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
    CLICK_STORE_KEY,
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
    CLICK_STORE_KEY,
    JSON.stringify({ gbraid: 'B-OLD', gbraid_ts: String(now - 10 * DAY_MS) })
  )

  const attrs = getAttributionAttrs()
  assert.equal(attr(attrs, '_pd_gclid'), 'G-NEW')
  assert.equal(attr(attrs, '_pd_gbraid'), undefined)
})

test('a Meta click clears a stored Google click instead of stamping both', () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem(CLICK_STORE_KEY, JSON.stringify({ gclid: 'G-STALE', gclid_ts: String(now) }))
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
  assert.equal(localStorage.getItem(CLICK_STORE_KEY), null)
})

test('updateGoogleClickStore drops a Google click when a Meta click arrives', async () => {
  const storage = await import('./attribution-storage.ts')
  assertFunction(storage.updateGoogleClickStore, 'updateGoogleClickStore')
  const cleared = storage.updateGoogleClickStore(
    { gclid: 'G-AD', gclid_ts: '1000' },
    { fbclid: 'META' },
    2_000
  )
  assert.equal(cleared, null)
})

test('a future-dated click timestamp is not stamped', () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      gclid: 'G-FUTURE',
      gclid_ts: String(now + 365 * DAY_MS),
      _timestamp: String(now),
    })
  )

  const fromBag = getAttributionAttrs()
  assert.equal(attr(fromBag, '_pd_gclid'), undefined)

  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({ _timestamp: String(now), _landing_page: '/' })
  )
  localStorage.setItem(
    CLICK_STORE_KEY,
    JSON.stringify({ gclid: 'G-FUTURE-STORE', gclid_ts: String(now + 10 * DAY_MS) })
  )
  const fromStore = getAttributionAttrs()
  assert.equal(attr(fromStore, '_pd_gclid'), undefined)
  assert.equal(localStorage.getItem(CLICK_STORE_KEY), null)
})

test('landing capture stores a gclid and a later srsltid URL does not blank it', async () => {
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
    const landing = await import('./attribution-landing-client.ts')
    assertFunction(landing.captureLandingAttribution, 'captureLandingAttribution')
    landing.captureLandingAttribution()
    assert.equal(JSON.parse(localStorage.getItem(CLICK_STORE_KEY) ?? '{}').gclid, 'G-LANDING')

    location.href = 'https://southlandorganics.com/?srsltid=S-LATER'
    landing.captureLandingAttribution()
    const stored = JSON.parse(localStorage.getItem(CLICK_STORE_KEY) ?? '{}') as {
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
