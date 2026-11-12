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

mock.module('@southland/shopify-storefront', {
  namedExports: {
    createClient() {
      return { request: async () => ({}) }
    },
    createCart() {
      return createCartImpl()
    },
    addToCart() {
      return undefined
    },
    getCart(client: unknown, cartId: string) {
      return getCartImpl(client, cartId)
    },
    removeFromCart() {
      return undefined
    },
    updateCartLines(_client: unknown, cartId: string, lines: Array<{ id?: string }>) {
      lineCalls.push({ cartId, lines })
      return Promise.resolve({ id: cartId })
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
  assert.equal(attr(lineAttrs, '_pd_utm_source'), 'google')
  assert.equal(attr(lineAttrs, '_pd_utm_medium'), 'cpc')
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
