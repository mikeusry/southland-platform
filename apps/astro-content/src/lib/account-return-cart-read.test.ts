import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

/**
 * The Storefront client turns GraphQL errors and a thrown fetch into `errors`
 * and no cart. The restamp must not treat that as an expired cart.
 */

process.env.PUBLIC_SHOPIFY_STORE_DOMAIN = 'southland-organics.myshopify.com'
process.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN = 'public-test-token'

const CART_ID = 'gid://shopify/Cart/24540'
const priorFetch = globalThis.fetch
const fetches: string[] = []

type FetchMode = 'graphql-errors' | 'throw' | 'expired'

let fetchMode: FetchMode = 'graphql-errors'

function installBrowser(): void {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: globalThis,
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
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
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      referrer: '',
      cookie: '',
      addEventListener() {},
    },
  })
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    writable: true,
    value: new URL('https://southlandorganics.com/?country=US'),
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon() {
        return true
      },
    },
  })
}

function installFetch(mode: FetchMode): void {
  fetchMode = mode
  fetches.length = 0
  globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
    fetches.push(typeof init?.body === 'string' ? init.body : '')
    if (fetchMode === 'throw') throw new Error('fetch failed')
    if (fetchMode === 'graphql-errors') {
      return new Response(JSON.stringify({ errors: [{ message: 'Throttled' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ data: { cart: null } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = priorFetch
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'localStorage')
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'navigator')
  Reflect.deleteProperty(globalThis, 'location')
})

async function restampOnAccountReturn(): Promise<void> {
  installBrowser()
  const realSetTimeout = globalThis.setTimeout
  globalThis.setTimeout = (() => 0) as typeof setTimeout
  try {
    localStorage.setItem('southland_cart_id', CART_ID)
    localStorage.setItem(
      '_pd_gclick',
      JSON.stringify({ gclid: 'G-SSO', gclid_ts: String(Date.now() - 60_000) })
    )
    const landing = await import('./attribution-landing-client.ts')
    await landing.captureLandingAttribution()
  } finally {
    globalThis.setTimeout = realSetTimeout
  }
}

test('a Storefront error during an account-return restamp keeps the cart id', async () => {
  for (const mode of ['graphql-errors', 'throw'] as const) {
    installFetch(mode)
    await restampOnAccountReturn()
    assert.equal(localStorage.getItem('southland_cart_id'), CART_ID, mode)
    assert.equal(
      fetches.some((body) => body.includes('cartAttributesUpdate') || body.includes('cartCreate')),
      false,
      mode
    )
  }
})

test('an expired cart with no Storefront errors still clears the saved id', async () => {
  installBrowser()
  installFetch('expired')
  localStorage.setItem('southland_cart_id', CART_ID)
  const cart = await import('./cart.ts')
  const result = await cart.getCart()
  assert.equal(result, null)
  assert.equal(localStorage.getItem('southland_cart_id'), null)
})
