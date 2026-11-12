import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import type { Cart } from '@southland/shopify-storefront'

/**
 * Mocks the Storefront client, then calls the real ensureGoogleClickStamped
 * and goToCheckoutAfterStamp. cartCreate must not run. A hung or thrown
 * getCart still navigates.
 */

const createCartCalls: string[] = []
const lineCalls: Array<{ cartId: string; lines: Array<{ id?: string; attributes?: unknown }> }> = []
const attributeCalls: Array<{ cartId: string }> = []
let getCartImpl: (client: unknown, cartId: string) => Promise<Cart | null> = async () => null
let createCartImpl: () => Promise<unknown> = async () => {
  createCartCalls.push('create')
  throw new Error('cartCreate')
}
let updateAttributesImpl: (client: unknown, cartId: string) => Promise<unknown> = async (
  _client,
  cartId
) => {
  attributeCalls.push({ cartId })
  return { id: cartId }
}
let updateLinesImpl: (
  client: unknown,
  cartId: string,
  lines: Array<{ id?: string; attributes?: unknown }>
) => Promise<unknown> = async (_client, cartId, lines) => {
  lineCalls.push({ cartId, lines })
  return { id: cartId }
}
let addToCartImpl: (client: unknown, cartId: string) => Promise<unknown> = async () => undefined
let removeFromCartImpl: (client: unknown, cartId: string) => Promise<unknown> = async () =>
  undefined

mock.module('@southland/shopify-storefront', {
  namedExports: {
    createClient() {
      return { request: async () => ({}) }
    },
    createCart() {
      return createCartImpl()
    },
    addToCart(client: unknown, cartId: string) {
      return addToCartImpl(client, cartId)
    },
    getCart(client: unknown, cartId: string) {
      return getCartImpl(client, cartId)
    },
    removeFromCart(client: unknown, cartId: string) {
      return removeFromCartImpl(client, cartId)
    },
    updateCartLines(
      client: unknown,
      cartId: string,
      lines: Array<{ id?: string; attributes?: unknown }>
    ) {
      return updateLinesImpl(client, cartId, lines)
    },
    updateCartAttributes(client: unknown, cartId: string) {
      return updateAttributesImpl(client, cartId)
    },
    applyDiscountCode() {
      return undefined
    },
  },
})

const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

function installStorage(): Map<string, string> {
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
  return store
}

function restore(
  name: 'window' | 'localStorage',
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor)
  else Reflect.deleteProperty(globalThis, name)
}

afterEach(() => {
  restore('window', priorWindow)
  restore('localStorage', priorStorage)
  createCartCalls.length = 0
  lineCalls.length = 0
  attributeCalls.length = 0
  getCartImpl = async () => null
  createCartImpl = async () => {
    createCartCalls.push('create')
    throw new Error('cartCreate')
  }
  updateAttributesImpl = async (_client, cartId) => {
    attributeCalls.push({ cartId })
    return { id: cartId }
  }
  updateLinesImpl = async (_client, cartId, lines) => {
    lineCalls.push({ cartId, lines })
    return { id: cartId }
  }
  addToCartImpl = async () => undefined
  removeFromCartImpl = async () => undefined
})

function attr(attrs: Array<{ key: string; value: string }>, key: string): string | undefined {
  return attrs.find((item) => item.key === key)?.value
}

test('ensureGoogleClickStamped updates the existing cart id and never calls cartCreate', async () => {
  installStorage()
  const now = Date.now()
  const ts = String(now - 60_000)
  localStorage.setItem('_pd_gclick', JSON.stringify({ gclid: 'G-REAL', gclid_ts: ts }))
  localStorage.setItem('_pd_attribution', JSON.stringify({ _timestamp: String(now) }))
  localStorage.setItem('_nexus_cid', 'cid-keep')

  const cartMod = await import('./cart.ts')
  assert.equal(
    typeof cartMod.ensureGoogleClickStamped,
    'function',
    'ensureGoogleClickStamped is missing'
  )

  const cart = {
    id: 'gid://shopify/Cart/24542',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/same-token',
    attributes: [{ key: '_pd_brand', value: 'southland' }],
    lines: [
      {
        id: 'gid://shopify/CartLine/9',
        quantity: 1,
        attributes: [
          { key: '_bundle_id', value: 'case-9' },
          { key: '_pd_utm_source', value: 'google' },
          { key: '_pd_utm_medium', value: 'cpc' },
          { key: '_nexus_cid', value: 'cid-keep' },
        ],
      },
    ],
  } as Cart

  await cartMod.ensureGoogleClickStamped(cart)

  assert.deepEqual(createCartCalls, [])
  assert.equal(attributeCalls.length, 1)
  assert.equal(attributeCalls[0]?.cartId, cart.id)
  assert.equal(lineCalls.length, 1)
  assert.equal(lineCalls[0]?.cartId, cart.id)
  const lineAttrs = (lineCalls[0]?.lines[0]?.attributes ?? []) as Array<{
    key: string
    value: string
  }>
  assert.equal(attr(lineAttrs, '_pd_gclid'), 'G-REAL')
  assert.equal(attr(lineAttrs, '_bundle_id'), 'case-9')
  assert.equal(attr(lineAttrs, '_pd_utm_source'), undefined)
  assert.equal(attr(lineAttrs, '_pd_utm_medium'), undefined)
  assert.equal(attr(lineAttrs, '_nexus_cid'), 'cid-keep')
})

test('ensureGoogleClickStamped skips cartLinesUpdate when the line already has the click', async () => {
  installStorage()
  const now = Date.now()
  const ts = String(now - 60_000)
  localStorage.setItem('_pd_gclick', JSON.stringify({ gclid: 'G-REAL', gclid_ts: ts }))
  localStorage.setItem('_pd_attribution', JSON.stringify({ _timestamp: String(now) }))

  const cartMod = await import('./cart.ts')
  assert.equal(
    typeof cartMod.ensureGoogleClickStamped,
    'function',
    'ensureGoogleClickStamped is missing'
  )
  const fresh = cartMod.getAttributionAttrs()
  const cart = {
    id: 'gid://shopify/Cart/24542',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/same-token',
    attributes: fresh,
    lines: [
      {
        id: 'gid://shopify/CartLine/9',
        quantity: 1,
        attributes: [
          { key: '_bundle_id', value: 'case-9' },
          { key: '_pd_utm_source', value: 'google' },
          { key: '_nexus_cid', value: 'cid-keep' },
          { key: '_pd_gclid', value: attr(fresh, '_pd_gclid') ?? '' },
          { key: '_pd_gclid_ts', value: attr(fresh, '_pd_gclid_ts') ?? '' },
        ],
      },
    ],
  } as Cart

  await cartMod.ensureGoogleClickStamped(cart)

  assert.deepEqual(createCartCalls, [])
  assert.equal(lineCalls.length, 0)
})

test('a thrown getCart still navigates to the fallback URL', async () => {
  installStorage()
  localStorage.setItem('southland_cart_id', 'gid://shopify/Cart/24532')
  getCartImpl = async () => {
    throw new Error('getCart failed')
  }

  const cartMod = await import('./cart.ts')
  assert.equal(
    typeof cartMod.goToCheckoutAfterStamp,
    'function',
    'goToCheckoutAfterStamp is missing'
  )
  const fallback = 'https://southland-organics.myshopify.com/cart/c/fallback'
  const urls: string[] = []
  await cartMod.goToCheckoutAfterStamp(fallback, (url: string) => {
    urls.push(url)
  })
  assert.deepEqual(urls, [fallback])
  assert.deepEqual(createCartCalls, [])
})

test('a getCart that never resolves still navigates within the deadline', async () => {
  installStorage()
  localStorage.setItem('southland_cart_id', 'gid://shopify/Cart/24532')
  getCartImpl = () => new Promise<Cart>(() => {})

  const cartMod = await import('./cart.ts')
  assert.equal(
    typeof cartMod.goToCheckoutAfterStamp,
    'function',
    'goToCheckoutAfterStamp is missing'
  )
  const deadline = cartMod.CHECKOUT_STAMP_DEADLINE_MS
  const fallback = 'https://southland-organics.myshopify.com/cart/c/fallback'
  const urls: string[] = []
  const started = Date.now()
  await cartMod.goToCheckoutAfterStamp(fallback, (url: string) => {
    urls.push(url)
  })
  const elapsed = Date.now() - started
  assert.deepEqual(urls, [fallback])
  assert.ok(elapsed < deadline + 800, `navigated after ${elapsed}ms`)
  assert.deepEqual(createCartCalls, [])
})

test('a hung click stamp does not block add to cart', async () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem('_pd_gclick', JSON.stringify({ gclid: 'G-HANG', gclid_ts: String(now) }))
  localStorage.setItem('_pd_attribution', JSON.stringify({ _timestamp: String(now) }))
  ;(globalThis as { dispatchEvent?: (event: Event) => boolean }).dispatchEvent = () => true

  const created = {
    id: 'gid://shopify/Cart/hang',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/hang',
    attributes: [] as Array<{ key: string; value: string }>,
    lines: [] as Cart['lines'],
    totalQuantity: 1,
  }
  createCartImpl = async () => {
    createCartCalls.push('create')
    return created
  }
  updateAttributesImpl = (_client, cartId) => {
    attributeCalls.push({ cartId })
    return new Promise(() => {})
  }

  const cartMod = await import('./cart.ts')
  assert.equal(typeof cartMod.addToCart, 'function', 'addToCart is missing')
  const started = Date.now()
  let cart: { id?: string } | null = null
  try {
    cart = await cartMod.addToCart([
      { merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 1 },
    ])
  } catch {
    cart = null
  }
  const elapsed = Date.now() - started
  assert.equal(attributeCalls.length, 1)
  assert.equal(cart?.id, created.id)
  assert.ok(elapsed < 400, `add resolved after ${elapsed}ms`)
})

test('a failed line stamp refetches instead of dispatching the stale cart', async () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem('_pd_gclick', JSON.stringify({ gclid: 'G-FRESH', gclid_ts: String(now) }))
  localStorage.setItem('_pd_attribution', JSON.stringify({ _timestamp: String(now) }))
  const lineId = 'gid://shopify/CartLine/gone'
  const withLine = {
    id: 'gid://shopify/Cart/stale',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/stale',
    attributes: [] as Array<{ key: string; value: string }>,
    lines: [
      {
        id: lineId,
        quantity: 1,
        attributes: [
          { key: '_pd_utm_source', value: 'customerio' },
          { key: '_pd_utm_campaign', value: 'Welcome Series, Email #1' },
        ],
      },
    ],
    totalQuantity: 1,
  }
  const stale = {
    ...withLine,
    attributes: [{ key: '_pd_gclid', value: 'G-STALE' }],
  }
  const removed = {
    ...withLine,
    attributes: [{ key: '_pd_gclid', value: 'G-FRESH' }],
    lines: [] as Cart['lines'],
    totalQuantity: 0,
  }
  localStorage.setItem('southland_cart_id', withLine.id)
  updateAttributesImpl = async () => stale
  updateLinesImpl = async (_client, cartId, lines) => {
    lineCalls.push({ cartId, lines })
    if (lineCalls.length === 1) return withLine
    throw new Error('line removed')
  }
  getCartImpl = async () => removed as Cart

  const dispatched: Array<{ lines?: Array<{ id?: string }> }> = []
  ;(globalThis as { dispatchEvent?: (event: Event) => boolean }).dispatchEvent = (event) => {
    const detail = (event as CustomEvent<{ lines?: Array<{ id?: string }> }>).detail
    if (detail) dispatched.push(detail)
    return true
  }

  const cartMod = await import('./cart.ts')
  assert.equal(typeof cartMod.updateCartLines, 'function', 'updateCartLines is missing')
  try {
    await cartMod.updateCartLines([{ id: lineId, quantity: 1 }])
  } catch {
    /* main throws before the stamp */
  }
  await new Promise((resolve) => setTimeout(resolve, 0))
  const last = dispatched[dispatched.length - 1]
  assert.equal(last?.lines?.length, 0)
  assert.equal(
    dispatched.some((cart) => cart.lines?.some((line) => line.id === lineId) && cart !== withLine),
    false
  )
})

const NO_CLICK_SESSIONS = [
  {
    name: 'an expired session',
    bag: (now: number) => ({
      utm_source: 'customerio',
      utm_medium: 'email',
      utm_campaign: 'Welcome Series, Email #1',
      _timestamp: String(now - 2 * 60 * 60 * 1000),
    }),
  },
  {
    name: 'a facebook non-click session',
    bag: (now: number) => ({
      utm_source: 'facebook',
      utm_medium: 'social',
      utm_campaign: 'link_in_bio',
      _timestamp: String(now),
    }),
  },
]

const NO_CLICK_LINE_ID = 'gid://shopify/CartLine/customerio'

function customerioCart(): Cart {
  return {
    id: 'gid://shopify/Cart/no-click',
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/no-click',
    attributes: [{ key: '_pd_brand', value: 'southland' }],
    lines: [
      {
        id: NO_CLICK_LINE_ID,
        quantity: 1,
        attributes: [
          { key: '_bundle_id', value: 'case-9' },
          { key: '_nexus_cid', value: 'cid-keep' },
          { key: '_pd_utm_source', value: 'customerio' },
          { key: '_pd_utm_medium', value: 'email' },
          { key: '_pd_utm_campaign', value: 'Welcome Series, Email #1' },
        ],
      },
    ],
    totalQuantity: 1,
  } as Cart
}

/** userLineCalls is the cartLinesUpdate the shopper's own change makes, if any. */
const NO_CLICK_ENTRY_POINTS: Array<{
  name: string
  userLineCalls: number
  run: (cart: Cart) => Promise<void>
}> = [
  {
    name: 'add to cart',
    userLineCalls: 0,
    run: async (cart) => {
      addToCartImpl = async () => cart
      const cartMod = await import('./cart.ts')
      await cartMod.addToCart([{ merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 1 }])
    },
  },
  {
    name: 'update cart lines',
    userLineCalls: 1,
    run: async (cart) => {
      updateLinesImpl = async (_client, cartId, lines) => {
        lineCalls.push({ cartId, lines })
        return cart
      }
      const cartMod = await import('./cart.ts')
      await cartMod.updateCartLines([{ id: NO_CLICK_LINE_ID, quantity: 2 }])
    },
  },
  {
    name: 'remove from cart',
    userLineCalls: 0,
    run: async (cart) => {
      removeFromCartImpl = async () => cart
      const cartMod = await import('./cart.ts')
      await cartMod.removeFromCart(['gid://shopify/CartLine/other'])
    },
  },
  {
    name: 'checkout',
    userLineCalls: 0,
    run: async (cart) => {
      const cartMod = await import('./cart.ts')
      const urls: string[] = []
      await cartMod.goToCheckoutAfterStamp(
        'https://southland-organics.myshopify.com/cart/c/fallback',
        (url: string) => {
          urls.push(url)
        },
        cart
      )
      assert.deepEqual(urls, [cart.checkoutUrl])
    },
  },
]

for (const session of NO_CLICK_SESSIONS) {
  for (const entry of NO_CLICK_ENTRY_POINTS) {
    test(`${entry.name} with no stored click and ${session.name} leaves a customerio line alone`, async () => {
      installStorage()
      localStorage.setItem('_pd_attribution', JSON.stringify(session.bag(Date.now())))
      localStorage.setItem('_nexus_cid', 'cid-keep')
      const cart = customerioCart()
      localStorage.setItem('southland_cart_id', cart.id)
      ;(globalThis as { dispatchEvent?: (event: Event) => boolean }).dispatchEvent = () => true
      updateAttributesImpl = async (_client, cartId) => {
        attributeCalls.push({ cartId })
        return cart
      }

      await entry.run(cart)
      await new Promise((resolve) => setTimeout(resolve, 10))

      assert.equal(localStorage.getItem('_pd_gclick'), null)
      assert.deepEqual(createCartCalls, [])
      assert.equal(lineCalls.length, entry.userLineCalls)
      for (const call of lineCalls) {
        assert.deepEqual(call.lines, [{ id: NO_CLICK_LINE_ID, quantity: 2 }])
      }
    })
  }
}

test('a background stamp that finishes after a later cart change does not dispatch its old snapshot', async () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem('_pd_gclick', JSON.stringify({ gclid: 'G-LATE', gclid_ts: String(now) }))
  localStorage.setItem('_pd_attribution', JSON.stringify({ _timestamp: String(now) }))
  const cartId = 'gid://shopify/Cart/late'
  const lineId = 'gid://shopify/CartLine/late'
  localStorage.setItem('southland_cart_id', cartId)

  const updated = {
    id: cartId,
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/updated',
    attributes: [] as Array<{ key: string; value: string }>,
    lines: [{ id: lineId, quantity: 2, attributes: [{ key: '_bundle_id', value: 'case-9' }] }],
    totalQuantity: 2,
  }
  const removed = {
    ...updated,
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/removed',
    lines: [] as Cart['lines'],
    totalQuantity: 0,
  }
  const staleStamped = {
    ...updated,
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/stale-stamp',
  }

  let release: (cart: unknown) => void = () => {}
  updateAttributesImpl = (_client, id) => {
    attributeCalls.push({ cartId: id })
    if (attributeCalls.length === 1) {
      return new Promise((resolve) => {
        release = resolve
      })
    }
    return Promise.resolve(removed)
  }
  updateLinesImpl = async (_client, id, lines) => {
    lineCalls.push({ cartId: id, lines })
    return lineCalls.length === 1 ? updated : staleStamped
  }
  removeFromCartImpl = async () => removed

  const dispatched: unknown[] = []
  ;(globalThis as { dispatchEvent?: (event: Event) => boolean }).dispatchEvent = (event) => {
    dispatched.push((event as CustomEvent<unknown>).detail)
    return true
  }

  const cartMod = await import('./cart.ts')
  await cartMod.updateCartLines([{ id: lineId, quantity: 2 }])
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(attributeCalls.length, 1, 'the first stamp is held open')

  await cartMod.removeFromCart([lineId])
  await new Promise((resolve) => setTimeout(resolve, 10))
  release(updated)
  await new Promise((resolve) => setTimeout(resolve, 10))

  assert.equal(lineCalls.length, 2, 'the held stamp still wrote its line')
  assert.equal(dispatched.includes(staleStamped), false)
  assert.equal(dispatched[dispatched.length - 1], removed)
})
