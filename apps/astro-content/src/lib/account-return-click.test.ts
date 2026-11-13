import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, mock, test } from 'node:test'
import type { Cart } from '@southland/shopify-storefront'

/**
 * Customer-account round trip drops the Google click (orders 24532 and 24540).
 * Imports of new helpers are dynamic so a revert fails the assertion instead of
 * dying at load time. The return test calls the landing capture that already
 * exists on main and expects the existing cart to be re-stamped.
 */

const createCartCalls: string[] = []
const attributeWrites: Array<{
  cartId: string
  attributes: Array<{ key: string; value: string }>
}> = []
const lineCalls: Array<{ cartId: string; lines: Array<{ id?: string; attributes?: unknown }> }> = []

let getCartImpl: (client: unknown, cartId: string) => Promise<Cart | null> = async () => null

mock.module('@southland/shopify-storefront', {
  namedExports: {
    createClient() {
      return { request: async () => ({}) }
    },
    createCart() {
      createCartCalls.push('create')
      throw new Error('cartCreate')
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
    updateCartLines(
      _client: unknown,
      cartId: string,
      lines: Array<{ id?: string; attributes?: unknown }>
    ) {
      lineCalls.push({ cartId, lines })
      return { id: cartId }
    },
    updateCartAttributes(
      _client: unknown,
      cartId: string,
      attributes: Array<{ key: string; value: string }>
    ) {
      attributeWrites.push({ cartId, attributes })
      return { id: cartId, attributes }
    },
    applyDiscountCode() {
      return undefined
    },
  },
})

const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const priorLocation = Object.getOwnPropertyDescriptor(globalThis, 'location')
const priorSetTimeout = globalThis.setTimeout

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

function restore(name: 'window' | 'localStorage' | 'document' | 'navigator' | 'location'): void {
  const prior = {
    window: priorWindow,
    localStorage: priorStorage,
    document: priorDocument,
    navigator: priorNavigator,
    location: priorLocation,
  }[name]
  if (prior) Object.defineProperty(globalThis, name, prior)
  else Reflect.deleteProperty(globalThis, name)
}

afterEach(() => {
  restore('window')
  restore('localStorage')
  restore('document')
  restore('navigator')
  restore('location')
  globalThis.setTimeout = priorSetTimeout
  createCartCalls.length = 0
  attributeWrites.length = 0
  lineCalls.length = 0
  getCartImpl = async () => null
})

function attr(attrs: Array<{ key: string; value: string }>, key: string): string | undefined {
  return attrs.find((item) => item.key === key)?.value
}

function setLocation(href: string): void {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    writable: true,
    value: new URL(href),
  })
}

function installDocument(referrer: string, cookie = ''): { assignments: string[] } {
  const assignments: string[] = []
  let jar = cookie
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      referrer,
      get cookie() {
        return jar
      },
      set cookie(value: string) {
        assignments.push(value)
        if (/Max-Age=0(?:;|$)/.test(value)) return
        jar = value.split(';')[0]
      },
      addEventListener() {
        /* listener binding is covered by the click-handler test */
      },
    },
  })
  return { assignments }
}

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('BaseLayout persists a URL click before the deferred landing module', () => {
  const layout = read('../layouts/BaseLayout.astro')
  const call = layout.indexOf('earlyGoogleClickCaptureSource()')
  const deferred = layout.indexOf("import '../lib/attribution-landing-client'")
  assert.ok(
    call !== -1 && deferred !== -1 && call < deferred,
    'early click capture is not inline in BaseLayout ahead of the deferred landing module'
  )
  const around = layout.slice(Math.max(0, call - 180), call)
  assert.match(around, /is:inline/)
})

test('early capture stores gclid gbraid and wbraid and a country or srsltid URL does not clear them', async () => {
  const storage = await import('./attribution-storage.ts')
  assert.equal(
    typeof storage.earlyGoogleClickCaptureSource,
    'function',
    'earlyGoogleClickCaptureSource is missing'
  )
  const source = storage.earlyGoogleClickCaptureSource()
  assert.equal(source.includes('</'), false)
  installStorage()
  const beacons: string[] = []
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon(url: string, body: Blob) {
        beacons.push(`${url} ${body.size}`)
        return true
      },
    },
  })
  const { assignments } = installDocument('')
  const now = 1_700_000_000_000
  const realNow = Date.now
  Date.now = () => now
  try {
    setLocation('https://southlandorganics.com/?country=US')
    localStorage.setItem('_pd_gclick', JSON.stringify({ gclid: 'G-KEEP', gclid_ts: '1000' }))
    new Function(source)()
    assert.equal(
      localStorage.getItem('_pd_gclick'),
      JSON.stringify({ gclid: 'G-KEEP', gclid_ts: '1000' })
    )
    assert.equal(beacons.length, 0)

    setLocation('https://southlandorganics.com/?srsltid=S-SHOP')
    new Function(source)()
    assert.equal(JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}').gclid, 'G-KEEP')
    assert.equal(beacons.length, 0)

    setLocation('https://southlandorganics.com/?gclid=bad id')
    new Function(source)()
    assert.equal(JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}').gclid, 'G-KEEP')

    for (const key of ['gclid', 'gbraid', 'wbraid'] as const) {
      beacons.length = 0
      localStorage.removeItem('_pd_gclick')
      setLocation(`https://southlandorganics.com/?${key}=CLICK-${key}`)
      new Function(source)()
      const stored = JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}') as Record<
        string,
        string
      >
      assert.equal(stored[key], `CLICK-${key}`, key)
      assert.equal(stored[`${key}_ts`], String(now), key)
      assert.equal(assignments.length, 0, key)
      assert.equal(document.cookie.includes(encodeURIComponent(`CLICK-${key}`)), false, key)
      assert.equal(beacons.length, 1, key)
      assert.match(beacons[0] ?? '', /^\/api\/pd-gclick /, key)

      new Function(source)()
      const again = JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}') as Record<string, string>
      assert.equal(again[`${key}_ts`], String(now), `${key} reload moved the capture time`)
    }

    localStorage.removeItem('_pd_gclick')
    const keptTs = String(now - 60_000)
    document.cookie = `_pd_gclick=${encodeURIComponent(
      JSON.stringify({ gclid: 'G-COOKIE', gclid_ts: keptTs })
    )}`
    setLocation('https://southlandorganics.com/?gclid=G-COOKIE')
    new Function(source)()
    const fromCookieOnly = JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}') as Record<
      string,
      string
    >
    assert.equal(fromCookieOnly.gclid, 'G-COOKIE')
    assert.equal(fromCookieOnly.gclid_ts, keptTs, 'cookie-only click id moved its capture time')

    setLocation('https://southlandorganics.com/?gclid=G-NEW')
    Date.now = () => now + 5_000
    new Function(source)()
    const replaced = JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}') as Record<
      string,
      string
    >
    assert.equal(replaced.gclid, 'G-NEW')
    assert.equal(replaced.gclid_ts, String(now + 5_000))
    assert.equal(replaced.wbraid, undefined)
  } finally {
    Date.now = realNow
  }
})

test('account and shop login links flush the stored click and srsltid does not clear it', async () => {
  const storage = await import('./attribution-storage.ts')
  assert.equal(typeof storage.isCustomerAccountHref, 'function', 'isCustomerAccountHref is missing')
  assert.equal(
    typeof storage.flushGoogleClickBeforeAccountLeave,
    'function',
    'flushGoogleClickBeforeAccountLeave is missing'
  )
  const cases: Array<[string, boolean]> = [
    ['https://shop.southlandorganics.com/account', true],
    ['https://shop.southlandorganics.com/account/', true],
    ['https://account.southlandorganics.com/orders', true],
    ['https://account.southlandorganics.com/', true],
    ['/account/', true],
    ['https://shop.southlandorganics.com/cart', false],
    ['https://shop.southlandorganics.com/checkout', false],
    ['https://southlandorganics.com/products/genesis/', false],
    ['https://southlandorganics.com/?country=US', false],
  ]
  for (const [href, expected] of cases) {
    assert.equal(storage.isCustomerAccountHref(href), expected, href)
  }

  installStorage()
  const blobs: Blob[] = []
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon(_url: string, body: Blob) {
        blobs.push(body)
        return true
      },
    },
  })
  const { assignments } = installDocument('')
  const now = 1_700_000_000_000
  const realNow = Date.now
  Date.now = () => now
  try {
    setLocation('https://southlandorganics.com/?gclid=G-LEAVE')
    storage.flushGoogleClickBeforeAccountLeave(now)
    assert.equal(JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}').gclid, 'G-LEAVE')
    assert.equal(JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}').gclid_ts, String(now))
    assert.ok(blobs.length >= 1)
    assert.match(await blobs[0].text(), /G-LEAVE/)

    setLocation('https://southlandorganics.com/?srsltid=S-SHOP')
    const before = assignments.length
    storage.flushGoogleClickBeforeAccountLeave(now + 60_000)
    const stored = JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}') as {
      gclid?: string
      gclid_ts?: string
    }
    assert.equal(stored.gclid, 'G-LEAVE')
    assert.equal(stored.gclid_ts, String(now))
    assert.equal(
      assignments.slice(before).some((header) => header.includes('Max-Age=0')),
      false
    )

    globalThis.setTimeout = (() => 0) as typeof setTimeout
    const landing = await import('./attribution-landing-client.ts')
    assert.equal(
      typeof landing.onCustomerAccountLinkClick,
      'function',
      'onCustomerAccountLinkClick is missing'
    )
    blobs.length = 0
    const anchor = {
      href: 'https://shop.southlandorganics.com/account',
      closest(sel: string) {
        return sel === 'a' ? anchor : null
      },
    }
    const icon = {
      closest(sel: string) {
        return sel === 'a' ? anchor : null
      },
    }
    landing.onCustomerAccountLinkClick({ target: icon } as unknown as Event)
    assert.equal(JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}').gclid, 'G-LEAVE')
    assert.ok(blobs.length >= 1)

    blobs.length = 0
    const product = {
      href: 'https://southlandorganics.com/products/genesis/',
      closest(sel: string) {
        return sel === 'a' ? product : null
      },
    }
    landing.onCustomerAccountLinkClick({ target: product } as unknown as Event)
    assert.equal(blobs.length, 0)
  } finally {
    Date.now = realNow
  }
})

test('/account redirect sets the click cookie and does not change the Location', async () => {
  const page = read('../pages/account.astro')
  assert.match(page, /customerAccountRedirectInit/)
  const storage = await import('./attribution-storage.ts')
  assert.equal(
    typeof storage.customerAccountRedirectInit,
    'function',
    'customerAccountRedirectInit is missing'
  )
  const now = 1_700_000_000_000
  const gclid = storage.customerAccountRedirectInit(
    new URL('https://southlandorganics.com/account?gclid=G-ACCT'),
    now
  )
  assert.equal(gclid.status, 302)
  assert.equal(gclid.location, 'https://account.southlandorganics.com/account')
  assert.match(gclid.setCookie ?? '', /^_pd_gclick=/)
  assert.match(gclid.setCookie ?? '', /Domain=\.southlandorganics\.com/)
  assert.match(gclid.setCookie ?? '', /G-ACCT/)

  const wbraid = storage.customerAccountRedirectInit(
    new URL('https://southlandorganics.com/account/?wbraid=WB-ACCT'),
    now
  )
  assert.equal(wbraid.location, gclid.location)
  assert.match(wbraid.setCookie ?? '', /WB-ACCT/)

  const shopping = storage.customerAccountRedirectInit(
    new URL('https://southlandorganics.com/account?srsltid=S-SHOP'),
    now
  )
  assert.equal(shopping.setCookie, null)
  assert.equal(shopping.location, gclid.location)

  const country = storage.customerAccountRedirectInit(
    new URL('https://southlandorganics.com/account?country=US'),
    now
  )
  assert.equal(country.setCookie, null)

  const priorTs = String(now - 60_000)
  const prior = encodeURIComponent(JSON.stringify({ gclid: 'G-ACCT', gclid_ts: priorTs }))
  const same = storage.customerAccountRedirectInit(
    new URL('https://southlandorganics.com/account?gclid=G-ACCT'),
    now,
    `_pd_gclick=${prior}`
  )
  assert.match(same.setCookie ?? '', new RegExp(priorTs))
  assert.doesNotMatch(same.setCookie ?? '', new RegExp(`gclid_ts%22%3A%22${now}`))
})

function wipedCart(id: string): Cart {
  return {
    id,
    checkoutUrl: 'https://southland-organics.myshopify.com/cart/c/same-token',
    attributes: [{ key: '_pd_brand', value: 'southland' }],
    lines: [
      {
        id: 'gid://shopify/CartLine/1',
        quantity: 1,
        attributes: [{ key: '_bundle_id', value: 'case-9' }],
      },
    ],
  } as Cart
}

async function captureReturn(href: string, referrer: string): Promise<void> {
  globalThis.setTimeout = (() => 0) as typeof setTimeout
  const landing = await import('./attribution-landing-client.ts')
  setLocation(href)
  installDocument(referrer)
  await landing.captureLandingAttribution()
}

test('account return on /?country=US restamps the stored click onto the existing cart', async () => {
  installStorage()
  const now = Date.now()
  const ts = String(now - 9 * 60 * 1000)
  const cartId = 'gid://shopify/Cart/24540'
  localStorage.setItem('southland_cart_id', cartId)
  localStorage.setItem('_pd_gclick', JSON.stringify({ gclid: 'G-SSO', gclid_ts: ts }))
  localStorage.setItem(
    '_pd_first_touch',
    JSON.stringify({ _landing_page: '/', _referrer: 'https://www.google.com/' })
  )
  const seen: string[] = []
  getCartImpl = async (_client, id) => {
    seen.push(id)
    return wipedCart(id)
  }

  await captureReturn(
    'https://southlandorganics.com/?country=US',
    'https://account.southlandorganics.com/'
  )

  assert.equal(createCartCalls.length, 0, 'account return must not call cartCreate')
  assert.deepEqual(seen, [cartId, cartId])
  assert.equal(attributeWrites.length, 1)
  assert.equal(attributeWrites[0]?.cartId, cartId)
  const written = attributeWrites[0]?.attributes ?? []
  assert.equal(attr(written, '_pd_gclid'), 'G-SSO')
  assert.equal(attr(written, '_pd_gclid_ts'), ts)
  assert.equal(attr(written, '_pd_brand'), 'southland')
  assert.equal(JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}').gclid, 'G-SSO')
  const lineAttrs = (lineCalls[0]?.lines[0]?.attributes ?? []) as Array<{
    key: string
    value: string
  }>
  assert.equal(attr(lineAttrs, '_pd_gclid'), 'G-SSO')
  assert.equal(attr(lineAttrs, '_pd_gclid_ts'), ts)
  assert.equal(attr(lineAttrs, '_bundle_id'), 'case-9')
})

test('account return restamps gbraid and wbraid onto the same cart id', async () => {
  installStorage()
  const now = Date.now()
  const ts = String(now - 60_000)
  const cartId = 'gid://shopify/Cart/24532'
  localStorage.setItem('southland_cart_id', cartId)
  for (const key of ['gbraid', 'wbraid'] as const) {
    attributeWrites.length = 0
    lineCalls.length = 0
    createCartCalls.length = 0
    localStorage.removeItem('_pd_attribution')
    localStorage.setItem('_pd_gclick', JSON.stringify({ [key]: `ID-${key}`, [`${key}_ts`]: ts }))
    getCartImpl = async (_client, id) => wipedCart(id)
    await captureReturn(
      'https://southlandorganics.com/?country=US',
      'https://account.southlandorganics.com/account'
    )
    assert.equal(createCartCalls.length, 0, key)
    const written = attributeWrites[0]?.attributes ?? []
    assert.equal(attributeWrites[0]?.cartId, cartId, key)
    assert.equal(attr(written, `_pd_${key}`), `ID-${key}`, key)
    assert.equal(attr(written, `_pd_${key}_ts`), ts, key)
    assert.equal(attr(written, '_pd_gclid'), undefined, key)
  }
})

test('a landing whose cart already has the stored click does not write the cart', async () => {
  installStorage()
  const now = Date.now()
  const ts = String(now - 60_000)
  localStorage.setItem('southland_cart_id', 'gid://shopify/Cart/24540')
  localStorage.setItem('_pd_gclick', JSON.stringify({ gclid: 'G-STAY', gclid_ts: ts }))
  getCartImpl = async (_client, id) =>
    ({
      ...wipedCart(id),
      attributes: [
        { key: '_pd_brand', value: 'southland' },
        { key: '_pd_gclid', value: 'G-STAY' },
        { key: '_pd_gclid_ts', value: ts },
      ],
    }) as Cart

  await captureReturn('https://southlandorganics.com/?country=US', 'https://www.google.com/')

  assert.equal(attributeWrites.length, 0)
  assert.equal(createCartCalls.length, 0)
  assert.equal(JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}').gclid, 'G-STAY')
})

test('inline script does not set the cookie and the landing module still beacons with retry', async () => {
  installStorage()
  const { assignments } = installDocument('')
  setLocation('https://southlandorganics.com/?gclid=G-MOD')
  const calls: string[] = []
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon(url: string) {
        calls.push(url)
        return false
      },
    },
  })
  globalThis.setTimeout = (() => 0) as typeof setTimeout
  const storage = await import('./attribution-storage.ts')
  const landing = await import('./attribution-landing-client.ts')
  localStorage.removeItem('_pd_gclick')
  calls.length = 0
  const source = storage.earlyGoogleClickCaptureSource()
  assert.equal(source.includes('document.cookie='), false)
  new Function(source)()
  assert.equal(calls.length, 1, 'the head script sends one beacon and does not retry')
  assert.equal(assignments.length, 0, 'the head script must not write document.cookie')
  assert.equal(JSON.parse(localStorage.getItem('_pd_gclick') ?? '{}').gclid, 'G-MOD')
  await landing.captureLandingAttribution()
  assert.equal(
    calls.length,
    3,
    'the landing module must still beacon /api/pd-gclick and retry once'
  )
})

test('/account refreshes a stored click with no URL click and is not cached', async () => {
  const page = read('../pages/account.astro')
  assert.match(page, /no-store/)
  const storage = await import('./attribution-storage.ts')
  const now = 1_700_000_000_000
  const priorTs = String(now - 60_000)
  const prior = encodeURIComponent(JSON.stringify({ gclid: 'G-KEEP', gclid_ts: priorTs }))
  const refresh = storage.customerAccountRedirectInit(
    new URL('https://southlandorganics.com/account?country=US'),
    now,
    `_pd_gclick=${prior}`
  )
  assert.equal(refresh.location, 'https://account.southlandorganics.com/account')
  assert.match(refresh.setCookie ?? '', /G-KEEP/)
  assert.match(refresh.setCookie ?? '', new RegExp(priorTs))
  assert.doesNotMatch(refresh.setCookie ?? '', /Max-Age=0/)
})

test('apex return to /?country=US with no referrer restamps a cart missing the click', async () => {
  installStorage()
  const now = Date.now()
  const ts = String(now - 9 * 60 * 1000)
  const cartId = 'gid://shopify/Cart/24540'
  localStorage.setItem('southland_cart_id', cartId)
  localStorage.setItem('_pd_gclick', JSON.stringify({ gclid: 'G-SSO', gclid_ts: ts }))
  const seen: string[] = []
  getCartImpl = async (_client, id) => {
    seen.push(id)
    return wipedCart(id)
  }

  await captureReturn('https://southlandorganics.com/?country=US', '')

  assert.equal(createCartCalls.length, 0)
  assert.ok(seen.includes(cartId))
  assert.equal(attributeWrites.length, 1)
  assert.equal(attr(attributeWrites[0]?.attributes ?? [], '_pd_gclid'), 'G-SSO')
  assert.equal(attr(attributeWrites[0]?.attributes ?? [], '_pd_gclid_ts'), ts)
})

test('a restamp rereads the cart and does not overwrite a newer click', async () => {
  installStorage()
  const now = Date.now()
  const ts = String(now - 60_000)
  const cartId = 'gid://shopify/Cart/24540'
  localStorage.setItem('southland_cart_id', cartId)
  localStorage.setItem('_pd_gclick', JSON.stringify({ gclid: 'G-SSO', gclid_ts: ts }))
  let reads = 0
  getCartImpl = async (_client, id) => {
    reads += 1
    if (reads === 1) return wipedCart(id)
    return {
      ...wipedCart(id),
      attributes: [
        { key: '_pd_brand', value: 'southland' },
        { key: '_pd_gclid', value: 'G-NEWER' },
        { key: '_pd_gclid_ts', value: String(now) },
      ],
    } as Cart
  }

  await captureReturn('https://southlandorganics.com/?country=US', '')

  assert.ok(reads >= 2, 'restamp must reread the cart before writing')
  assert.equal(attributeWrites.length, 0)
  assert.equal(createCartCalls.length, 0)
})

test('the landing module does not statically import the cart', () => {
  const source = read('./attribution-landing-client.ts')
  assert.equal(/from '\.\/cart'/.test(source), false)
  assert.match(source, /import\('\.\/cart'\)/)
})

test('an account return with no stored click does not create a cart', async () => {
  installStorage()
  localStorage.setItem('southland_cart_id', 'gid://shopify/Cart/24540')
  getCartImpl = async (_client, id) => wipedCart(id)

  await captureReturn(
    'https://southlandorganics.com/?country=US',
    'https://account.southlandorganics.com/'
  )

  assert.equal(attributeWrites.length, 0)
  assert.equal(createCartCalls.length, 0)
})
