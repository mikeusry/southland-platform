import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  GOOGLE_CLICK_COOKIE,
  GOOGLE_CLICK_COOKIE_DOMAIN,
  GOOGLE_CLICK_MS,
  GOOGLE_CLICK_STORE_KEY,
  beaconGoogleClickCookie,
  googleClickCookieValue,
  googleClickSetCookieHeader,
  parseGoogleClickCookieBag,
  persistGoogleClickCookie,
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

function installCookie(): { assignments: string[] } {
  const assignments: string[] = []
  let jar = ''
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      get cookie() {
        return jar
      },
      set cookie(value: string) {
        assignments.push(value)
        jar = value
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
  url = 'https://southlandorganics.com/api/pd-gclick'
) {
  const payload = body === null ? '' : typeof body === 'string' ? body : JSON.stringify(body)
  const request = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

test('POST /api/pd-gclick clears the cookie on an explicit empty bag', async () => {
  const res = await postBag({})
  assert.equal(res.status, 204)
  const cookie = res.headers.get('Set-Cookie')
  assert.ok(cookie)
  assert.ok(cookie!.includes('Max-Age=0'))
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
