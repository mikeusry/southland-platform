import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  GOOGLE_CLICK_COOKIE,
  GOOGLE_CLICK_COOKIE_DOMAIN,
  GOOGLE_CLICK_COOKIE_SITE,
  GOOGLE_CLICK_ID_MAX_LEN,
  GOOGLE_CLICK_MS,
  GOOGLE_CLICK_STORE_KEY,
  beaconGoogleClickCookie,
  googleClickCookieValue,
  googleClickSetCookieHeader,
  isSameSitePdGclickRequest,
  isSameSitePdGclickUrl,
  isValidGoogleClickId,
  loadGoogleClickStore,
  parseGoogleClickCookieBag,
  persistGoogleClickCookie,
  readGoogleClickCookieBag,
  remainingGoogleClickMaxAgeSec,
  saveGoogleClickStore,
} from './attribution-storage'
import { POST } from '../pages/api/pd-gclick'

const DAY_MS = 24 * 60 * 60 * 1000

const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const priorFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch')

function restore(
  name: 'window' | 'localStorage' | 'document' | 'navigator' | 'fetch',
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor)
  else Reflect.deleteProperty(globalThis, name)
}

afterEach(() => {
  restore('window', priorWindow)
  restore('localStorage', priorStorage)
  restore('document', priorDocument)
  restore('navigator', priorNavigator)
  restore('fetch', priorFetch)
})

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

function installCookie(seed = ''): { assignments: string[] } {
  const assignments: string[] = []
  let jar = seed
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      get cookie() {
        return jar
      },
      set cookie(value: string) {
        assignments.push(value)
        if (/Max-Age=0(?:;|$)/.test(value)) {
          const name = value.split('=')[0]
          jar = jar
            .split('; ')
            .filter((part) => !part.startsWith(`${name}=`))
            .join('; ')
          return
        }
        jar = value.split(';')[0]
      },
    },
  })
  return { assignments }
}

function cookieFlags(header: string): string[] {
  return header
    .split(';')
    .slice(1)
    .map((part) => part.trim())
}

test('cookie value is the click type, id, and timestamp', () => {
  const now = 1_700_000_000_000
  const encoded = googleClickCookieValue({ gclid: 'Cj0KCQ-TEST', gclid_ts: String(now) }, now)
  assert.ok(encoded)
  const bag = JSON.parse(decodeURIComponent(encoded!)) as Record<string, string>
  assert.deepEqual(bag, { gclid: 'Cj0KCQ-TEST', gclid_ts: String(now) })
})

test('Set-Cookie is first-party, Secure, SameSite=Lax, and at most 90 days', () => {
  const now = 1_700_000_000_000
  const header = googleClickSetCookieHeader({ key: 'gclid', value: 'Cj0KCQ-TEST', ts: now }, now)
  assert.ok(header.startsWith(`${GOOGLE_CLICK_COOKIE}=`))
  const flags = cookieFlags(header)
  assert.ok(flags.includes('Path=/'))
  assert.ok(flags.includes(`Domain=${GOOGLE_CLICK_COOKIE_DOMAIN}`))
  assert.ok(flags.includes('Secure'))
  assert.ok(flags.includes('SameSite=Lax'))
  const maxAge = flags.find((flag) => flag.startsWith('Max-Age='))
  assert.equal(maxAge, `Max-Age=${GOOGLE_CLICK_MS / 1000}`)
  assert.equal(header.toLowerCase().includes('httponly'), false)
})

test('Max-Age is the remaining 90-day window, not a fresh 90 days', () => {
  const now = 1_700_000_000_000
  const ts = now - 10 * DAY_MS
  const remaining = remainingGoogleClickMaxAgeSec(ts, now)
  assert.equal(remaining, Math.floor((GOOGLE_CLICK_MS - 10 * DAY_MS) / 1000))
  const header = googleClickSetCookieHeader({ key: 'gbraid', value: 'GB-1', ts }, now)
  assert.ok(cookieFlags(header).includes(`Max-Age=${remaining}`))
})

test('future timestamps are rejected', () => {
  const now = 1_700_000_000_000
  assert.equal(
    parseGoogleClickCookieBag({ gclid: 'G-FUTURE', gclid_ts: String(now + DAY_MS) }, now),
    null
  )
  assert.equal(
    googleClickCookieValue({ gclid: 'G-FUTURE', gclid_ts: String(now + DAY_MS) }, now),
    null
  )
  assert.equal(remainingGoogleClickMaxAgeSec(now + DAY_MS, now), 0)
  const header = googleClickSetCookieHeader(
    { key: 'gclid', value: 'G-FUTURE', ts: now + DAY_MS },
    now
  )
  assert.ok(cookieFlags(header).includes('Max-Age=0'))
})

test('clicks older than 90 days are rejected', () => {
  const now = 1_700_000_000_000
  const ts = now - GOOGLE_CLICK_MS - 1
  assert.equal(parseGoogleClickCookieBag({ gclid: 'G-OLD', gclid_ts: String(ts) }, now), null)
  assert.equal(remainingGoogleClickMaxAgeSec(ts, now), 0)
})

test('invalid click ids are rejected', () => {
  const now = 1_700_000_000_000
  assert.equal(
    parseGoogleClickCookieBag({ gclid: 'bad id with spaces', gclid_ts: String(now) }, now),
    null
  )
  assert.equal(parseGoogleClickCookieBag({ gclid: 'alert(1)', gclid_ts: String(now) }, now), null)
})

test('gbraid and wbraid parse the same way as gclid', () => {
  const now = 1_700_000_000_000
  assert.deepEqual(parseGoogleClickCookieBag({ gbraid: 'GB-1', gbraid_ts: now }, now), {
    key: 'gbraid',
    value: 'GB-1',
    ts: now,
  })
  assert.deepEqual(parseGoogleClickCookieBag({ wbraid: 'WB-1', wbraid_ts: String(now) }, now), {
    key: 'wbraid',
    value: 'WB-1',
    ts: now,
  })
})

test('persistGoogleClickCookie writes the encoded bag and clears on null', () => {
  const now = 1_700_000_000_000
  const { assignments } = installCookie()
  persistGoogleClickCookie({ gclid: 'G-JS', gclid_ts: String(now) }, now)
  assert.equal(assignments.length, 1)
  assert.ok(assignments[0].includes(GOOGLE_CLICK_COOKIE))
  assert.ok(
    assignments[0].includes(
      encodeURIComponent(JSON.stringify({ gclid: 'G-JS', gclid_ts: String(now) }))
    )
  )
  persistGoogleClickCookie(null, now)
  assert.ok(assignments[1].includes('Max-Age=0'))
})

test('saveGoogleClickStore writes the cookie and beacons the bag', () => {
  installStorage()
  const { assignments } = installCookie()
  const beacons: Array<{ url: string; body: string }> = []
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon(url: string, blob: Blob) {
        // Blob.text is async; the payload is also readable via the constructor input.
        beacons.push({ url, body: typeof blob === 'string' ? blob : '' })
        if (blob && typeof blob === 'object' && 'size' in blob) {
          beacons[beacons.length - 1].body = '[blob]'
        }
        return true
      },
    },
  })
  const now = 1_700_000_000_000
  saveGoogleClickStore({ gclid: 'G-SAVE', gclid_ts: String(now) }, now)
  const stored = JSON.parse(localStorage.getItem(GOOGLE_CLICK_STORE_KEY) ?? '{}') as {
    gclid?: string
    gclid_ts?: string
  }
  assert.equal(stored.gclid, 'G-SAVE')
  assert.equal(assignments.length, 1)
  assert.ok(assignments[0].includes('G-SAVE'))
  assert.equal(beacons.length, 1)
  assert.equal(beacons[0].url, '/api/pd-gclick')
})

test('saveGoogleClickStore keeps the cookie when a later visit is only srsltid', () => {
  installStorage()
  const { assignments } = installCookie()
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon() {
        return true
      },
    },
  })
  const now = 1_700_000_000_000
  saveGoogleClickStore({ gclid: 'G-KEEP', gclid_ts: String(now) }, now)
  saveGoogleClickStore({ srsltid: 'S-SHOP' }, now + 60_000)
  const stored = JSON.parse(localStorage.getItem(GOOGLE_CLICK_STORE_KEY) ?? '{}') as {
    gclid?: string
  }
  assert.equal(stored.gclid, 'G-KEEP')
  const last = assignments.at(-1) ?? ''
  assert.ok(last.includes('G-KEEP'))
  assert.equal(last.includes('Max-Age=0'), false)
})

test('saveGoogleClickStore clears the cookie when another paid network wins', () => {
  installStorage()
  const { assignments } = installCookie()
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon() {
        return true
      },
    },
  })
  const now = 1_700_000_000_000
  saveGoogleClickStore({ gclid: 'G-META', gclid_ts: String(now) }, now)
  saveGoogleClickStore({ fbclid: 'FB-1' }, now + 60_000)
  assert.equal(localStorage.getItem(GOOGLE_CLICK_STORE_KEY), null)
  const last = assignments.at(-1) ?? ''
  assert.ok(last.includes('Max-Age=0'))
})

test('a newer click replaces the cookie and an older click does not', () => {
  installStorage()
  const { assignments } = installCookie()
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon() {
        return true
      },
    },
  })
  const now = 1_700_000_000_000
  saveGoogleClickStore({ gclid: 'G-OLD', gclid_ts: String(now - 5 * DAY_MS) }, now - 5 * DAY_MS)
  saveGoogleClickStore({ gclid: 'G-NEW' }, now)
  const stored = JSON.parse(localStorage.getItem(GOOGLE_CLICK_STORE_KEY) ?? '{}') as {
    gclid?: string
  }
  assert.equal(stored.gclid, 'G-NEW')
  const lastSet = assignments.filter((item) => !item.includes('Max-Age=0')).at(-1) ?? ''
  assert.ok(lastSet.includes('G-NEW'))
})

async function postBag(
  body: string | object | null,
  opts: { origin?: string | null; referer?: string; cookie?: string; url?: string } = {}
) {
  const payload = body === null ? '' : typeof body === 'string' ? body : JSON.stringify(body)
  const url = opts.url ?? `https://${GOOGLE_CLICK_COOKIE_SITE}/api/pd-gclick`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.origin !== null) {
    headers.Origin = opts.origin ?? `https://${GOOGLE_CLICK_COOKIE_SITE}`
  }
  if (opts.referer) headers.Referer = opts.referer
  if (opts.cookie) headers.Cookie = opts.cookie
  const request = new Request(url, {
    method: 'POST',
    headers,
    body: payload,
  })
  return POST({ request } as Parameters<typeof POST>[0])
}

test('POST /api/pd-gclick sets an uncached 90-day cookie', async () => {
  const now = Date.now()
  const res = await postBag({ gclid: 'G-API', gclid_ts: String(now) })
  assert.equal(res.status, 204)
  assert.equal(res.headers.get('Cache-Control'), 'no-store')
  const cookie = res.headers.get('Set-Cookie')
  assert.ok(cookie)
  assert.ok(cookie!.includes('G-API'))
  assert.ok(cookie!.includes(`Domain=${GOOGLE_CLICK_COOKIE_DOMAIN}`))
  assert.ok(cookie!.includes('Secure'))
  assert.ok(cookie!.includes('SameSite=Lax'))
  assert.equal(cookie!.toLowerCase().includes('httponly'), false)
  const maxAge = cookieFlags(cookie!).find((flag) => flag.startsWith('Max-Age='))
  const age = Number(maxAge?.slice('Max-Age='.length))
  assert.ok(age > 89 * 24 * 60 * 60)
  assert.ok(age <= GOOGLE_CLICK_MS / 1000)
  assert.equal(await res.text(), '')
})

test('POST /api/pd-gclick accepts gbraid and wbraid', async () => {
  const now = Date.now()
  const gbraid = await postBag({ gbraid: 'GB-API', gbraid_ts: String(now) })
  assert.ok((gbraid.headers.get('Set-Cookie') ?? '').includes('GB-API'))
  const wbraid = await postBag({ wbraid: 'WB-API', wbraid_ts: String(now) })
  assert.ok((wbraid.headers.get('Set-Cookie') ?? '').includes('WB-API'))
})

test('POST /api/pd-gclick rejects an empty bag and does not clear the cookie', async () => {
  const res = await postBag({})
  assert.equal(res.status, 204)
  assert.equal(res.headers.get('Set-Cookie'), null)
  assert.equal(res.headers.get('Cache-Control'), 'no-store')
})

test('POST /api/pd-gclick does not clear the cookie on a future timestamp or junk', async () => {
  const now = Date.now()
  const future = await postBag({ gclid: 'G-FUTURE', gclid_ts: String(now + DAY_MS) })
  assert.equal(future.status, 204)
  assert.equal(future.headers.get('Set-Cookie'), null)
  assert.equal(future.headers.get('Cache-Control'), 'no-store')

  const junk = await postBag('not-json')
  assert.equal(junk.status, 204)
  assert.equal(junk.headers.get('Set-Cookie'), null)

  const expired = await postBag({
    gclid: 'G-OLD',
    gclid_ts: String(now - GOOGLE_CLICK_MS - 1000),
  })
  assert.equal(expired.headers.get('Set-Cookie'), null)
})

test('beaconGoogleClickCookie posts JSON and ignores failures', () => {
  const sent: Array<{ url: string; body: string; type: string }> = []
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon(url: string, blob: Blob) {
        sent.push({ url, body: 'blob', type: blob.type })
        return true
      },
    },
  })
  const now = 1_700_000_000_000
  beaconGoogleClickCookie({ gclid: 'G-BEACON', gclid_ts: String(now) }, now)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].url, '/api/pd-gclick')
  assert.equal(sent[0].type, 'application/json')
})

test('an over-long click id is rejected', () => {
  const now = 1_700_000_000_000
  const longId = `G-${'A'.repeat(GOOGLE_CLICK_ID_MAX_LEN)}`
  assert.equal(isValidGoogleClickId(longId), false)
  assert.equal(parseGoogleClickCookieBag({ gclid: longId, gclid_ts: String(now) }, now), null)
})

test('saveGoogleClickStore restores from a live cookie when localStorage is empty', () => {
  const now = 1_700_000_000_000
  const bag = { gclid: 'G-SAFARI', gclid_ts: String(now - 10 * DAY_MS) }
  const encoded = googleClickCookieValue(bag, now)
  assert.ok(encoded)
  installStorage()
  const { assignments } = installCookie(`${GOOGLE_CLICK_COOKIE}=${encoded}`)
  const beacons: string[] = []
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon() {
        beacons.push('beacon')
        return true
      },
    },
  })
  assert.equal(localStorage.getItem(GOOGLE_CLICK_STORE_KEY), null)
  const loaded = loadGoogleClickStore(now)
  assert.equal(loaded?.gclid, 'G-SAFARI')
  saveGoogleClickStore({ srsltid: 'S-ONLY' }, now)
  const stored = JSON.parse(localStorage.getItem(GOOGLE_CLICK_STORE_KEY) ?? '{}') as {
    gclid?: string
    gclid_ts?: string
  }
  assert.equal(stored.gclid, 'G-SAFARI')
  assert.equal(stored.gclid_ts, String(now - 10 * DAY_MS))
  assert.equal(
    assignments.some((item) => item.includes('Max-Age=0')),
    false
  )
  assert.equal(beacons.length, 0)
  saveGoogleClickStore({}, now + 60_000)
  assert.equal(beacons.length, 0)
  assert.equal(JSON.parse(localStorage.getItem(GOOGLE_CLICK_STORE_KEY) ?? '{}').gclid, 'G-SAFARI')
})

test('saveGoogleClickStore beacons only when the stored click changes', () => {
  installStorage()
  installCookie()
  const beacons: string[] = []
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon() {
        beacons.push('beacon')
        return true
      },
    },
  })
  const now = 1_700_000_000_000
  saveGoogleClickStore({ gclid: 'G-ONCE', gclid_ts: String(now) }, now)
  assert.equal(beacons.length, 1)
  saveGoogleClickStore({ gclid: 'G-ONCE', gclid_ts: String(now) }, now + 1_000)
  saveGoogleClickStore({ srsltid: 'S-1' }, now + 2_000)
  saveGoogleClickStore({}, now + 3_000)
  assert.equal(beacons.length, 1)
  saveGoogleClickStore({ gclid: 'G-TWO' }, now + 4_000)
  assert.equal(beacons.length, 2)
})

test('same-site Origin and Referer checks accept the apex and shop hosts', () => {
  const site = `https://${GOOGLE_CLICK_COOKIE_SITE}`
  const shop = `https://shop.${GOOGLE_CLICK_COOKIE_SITE}`
  assert.equal(isSameSitePdGclickUrl(site), true)
  assert.equal(isSameSitePdGclickUrl(shop), true)
  assert.equal(isSameSitePdGclickUrl(`http://${GOOGLE_CLICK_COOKIE_SITE}`), false)
  assert.equal(isSameSitePdGclickUrl('https://evil.example'), false)
  assert.equal(isSameSitePdGclickUrl('null'), false)
  assert.equal(isSameSitePdGclickUrl(''), false)
  const ok = new Headers({ Origin: site })
  assert.equal(isSameSitePdGclickRequest(ok), true)
  const refererOnly = new Headers({ Referer: `${shop}/cart` })
  assert.equal(isSameSitePdGclickRequest(refererOnly), true)
  const evil = new Headers({ Origin: 'https://evil.example', Referer: `${site}/` })
  assert.equal(isSameSitePdGclickRequest(evil), false)
  const missing = new Headers()
  assert.equal(isSameSitePdGclickRequest(missing), false)
})

test('POST /api/pd-gclick requires a same-site Origin or Referer', async () => {
  const now = Date.now()
  const bag = { gclid: 'G-ORIGIN', gclid_ts: String(now) }
  const noOrigin = await postBag(bag, { origin: null })
  assert.equal(noOrigin.headers.get('Set-Cookie'), null)
  const evil = await postBag(bag, { origin: 'https://evil.example' })
  assert.equal(evil.headers.get('Set-Cookie'), null)
  const http = await postBag(bag, { origin: `http://${GOOGLE_CLICK_COOKIE_SITE}` })
  assert.equal(http.headers.get('Set-Cookie'), null)
  const referer = await postBag(bag, {
    origin: null,
    referer: `https://shop.${GOOGLE_CLICK_COOKIE_SITE}/products/x`,
  })
  assert.ok((referer.headers.get('Set-Cookie') ?? '').includes('G-ORIGIN'))
})

test('POST /api/pd-gclick keeps the newer existing cookie', async () => {
  const now = Date.now()
  const existing = googleClickCookieValue({ gclid: 'G-NEWER', gclid_ts: String(now - 1_000) }, now)
  assert.ok(existing)
  const older = await postBag(
    { gclid: 'G-OLDER', gclid_ts: String(now - 10 * DAY_MS) },
    { cookie: `${GOOGLE_CLICK_COOKIE}=${existing}` }
  )
  assert.equal(older.headers.get('Set-Cookie'), null)
  const newer = await postBag(
    { gbraid: 'GB-NEWER', gbraid_ts: String(now) },
    { cookie: `${GOOGLE_CLICK_COOKIE}=${existing}` }
  )
  const set = newer.headers.get('Set-Cookie') ?? ''
  assert.ok(set.includes('GB-NEWER'))
  assert.equal(set.includes('G-NEWER'), false)
})

test('readGoogleClickCookieBag parses a live cookie header', () => {
  const now = 1_700_000_000_000
  const encoded = googleClickCookieValue({ wbraid: 'WB-READ', wbraid_ts: String(now) }, now)
  const parsed = readGoogleClickCookieBag(`${GOOGLE_CLICK_COOKIE}=${encoded}`, now)
  assert.deepEqual(parsed, { key: 'wbraid', value: 'WB-READ', ts: now })
})

test('POST /api/pd-gclick sets only the _pd_gclick cookie', async () => {
  const now = Date.now()
  const res = await postBag({ gclid: 'G-ONLY', gclid_ts: String(now) })
  assert.equal(res.status, 204)
  const cookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('Set-Cookie')].filter((value): value is string => !!value)
  assert.equal(cookies.length, 1)
  assert.ok(cookies[0].startsWith(`${GOOGLE_CLICK_COOKIE}=`))
  assert.equal(await res.text(), '')
  // No other header is a cookie.
  const names: string[] = []
  res.headers.forEach((_, name) => names.push(name.toLowerCase()))
  assert.equal(names.filter((name) => name === 'set-cookie').length, 1)
})

test('POST /api/pd-gclick rejects an over-long or malformed id', async () => {
  const now = Date.now()
  const longId = `G-${'A'.repeat(GOOGLE_CLICK_ID_MAX_LEN)}`
  const tooLong = await postBag({ gclid: longId, gclid_ts: String(now) })
  assert.equal(tooLong.headers.get('Set-Cookie'), null)
  const badChars = await postBag({ gclid: 'G-BAD ID/<script>', gclid_ts: String(now) })
  assert.equal(badChars.headers.get('Set-Cookie'), null)
})

test('beaconGoogleClickCookie retries sendBeacon once on failure', () => {
  const results: boolean[] = []
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon() {
        results.push(results.length === 0 ? false : true)
        return results[results.length - 1]
      },
    },
  })
  const now = 1_700_000_000_000
  beaconGoogleClickCookie({ gclid: 'G-RETRY', gclid_ts: String(now) }, now)
  assert.equal(results.length, 2)
  assert.deepEqual(results, [false, true])
})

test('beaconGoogleClickCookie does not retry a successful sendBeacon', () => {
  let calls = 0
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      sendBeacon() {
        calls += 1
        return true
      },
    },
  })
  const now = 1_700_000_000_000
  beaconGoogleClickCookie({ gclid: 'G-ONCE', gclid_ts: String(now) }, now)
  assert.equal(calls, 1)
})

test('beaconGoogleClickCookie retries fetch once on rejection or a non-ok response', async () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {},
  })

  let rejects = 0
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => {
      rejects += 1
      if (rejects === 1) throw new Error('network')
      return new Response(null, { status: 204 })
    },
  })
  const now = 1_700_000_000_000
  beaconGoogleClickCookie({ gclid: 'G-FETCH-REJ', gclid_ts: String(now) }, now)
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(rejects, 2)

  let statuses = 0
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => {
      statuses += 1
      return new Response(null, { status: statuses === 1 ? 429 : 204 })
    },
  })
  beaconGoogleClickCookie({ gclid: 'G-FETCH-429', gclid_ts: String(now) }, now)
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(statuses, 2)
})
