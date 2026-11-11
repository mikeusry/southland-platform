import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  ATTRIBUTION_SESSION_MS,
  filterLastTouchAttribution,
  getAttributionAttrs,
  getFirstTouchAttrs,
  googleClickBundleChangedOnCart,
  mergeCartAttributes,
  restampCartLineAttributes,
  retryTwice,
  syncAttributionLocalStorageAfterIdentityChange,
} from './cart'

const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

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
  name: 'window' | 'localStorage',
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor)
  else Reflect.deleteProperty(globalThis, name)
}

afterEach(() => {
  restore('window', priorWindow)
  restore('localStorage', priorStorage)
})

function clickIds(attrs: Array<{ key: string; value: string }>, prefix: string) {
  return attrs.filter(
    (attr) =>
      attr.key === `${prefix}gclid` ||
      attr.key === `${prefix}gbraid` ||
      attr.key === `${prefix}wbraid`
  )
}

test('mergeCartAttributes clears stale gclid when winning click type is gbraid', () => {
  const merged = mergeCartAttributes(
    [
      { key: '_pd_gclid', value: 'OLD-G' },
      { key: '_pd_gclid_ts', value: '100' },
      { key: '_pd_utm_campaign', value: 'old-campaign' },
      { key: '_pd_utm_source', value: 'google' },
    ],
    [
      { key: '_pd_gbraid', value: 'NEW-B' },
      { key: '_pd_gbraid_ts', value: '2000' },
      { key: '_pd_utm_campaign', value: 'new-campaign' },
      { key: '_pd_utm_source', value: 'google' },
    ]
  )
  const map = new Map(merged.map((a) => [a.key, a.value]))
  assert.equal(map.get('_pd_gclid'), undefined)
  assert.equal(map.get('_pd_gclid_ts'), undefined)
  assert.equal(map.get('_pd_gbraid'), 'NEW-B')
  assert.equal(map.get('_pd_utm_campaign'), 'new-campaign')
})

test('mergeCartAttributes pairs fresh UTMs when the Google click bundle changes', () => {
  const merged = mergeCartAttributes(
    [
      { key: '_pd_gclid', value: 'OLD' },
      { key: '_pd_utm_campaign', value: 'old-campaign' },
      { key: '_pd_landing_page', value: '/old' },
    ],
    [
      { key: '_pd_gclid', value: 'NEW' },
      { key: '_pd_gclid_ts', value: '2000' },
      { key: '_pd_utm_campaign', value: 'new-campaign' },
      { key: '_pd_landing_page', value: '/new' },
    ]
  )
  const map = new Map(merged.map((a) => [a.key, a.value]))
  assert.equal(map.get('_pd_gclid'), 'NEW')
  assert.equal(map.get('_pd_utm_campaign'), 'new-campaign')
  assert.equal(map.get('_pd_landing_page'), '/new')
})

test('mergeCartAttributes keeps stale UTMs when the Google click bundle is unchanged', () => {
  const merged = mergeCartAttributes(
    [
      { key: '_pd_gclid', value: 'SAME' },
      { key: '_pd_utm_campaign', value: 'stale-campaign' },
    ],
    [
      { key: '_pd_gclid', value: 'SAME' },
      { key: '_pd_gclid_ts', value: '2000' },
      { key: '_pd_utm_campaign', value: 'new-campaign' },
    ]
  )
  const map = new Map(merged.map((a) => [a.key, a.value]))
  assert.equal(map.get('_pd_gclid_ts'), '2000')
  assert.equal(map.get('_pd_utm_campaign'), 'stale-campaign')
})

test('googleClickBundleChangedOnCart detects value and type changes', () => {
  assert.equal(
    googleClickBundleChangedOnCart(
      [{ key: '_pd_gclid', value: 'A' }],
      [{ key: '_pd_gclid', value: 'B' }]
    ),
    true
  )
  assert.equal(
    googleClickBundleChangedOnCart(
      [{ key: '_pd_gclid', value: 'A' }],
      [{ key: '_pd_gbraid', value: 'B' }]
    ),
    true
  )
  assert.equal(
    googleClickBundleChangedOnCart(
      [{ key: '_pd_gclid', value: 'A' }],
      [{ key: '_pd_gclid', value: 'A' }]
    ),
    false
  )
})

test('retryTwice succeeds on second attempt', async () => {
  let calls = 0
  const value = await retryTwice(async () => {
    calls += 1
    if (calls < 2) throw new Error('transient')
    return 'ok'
  })
  assert.equal(value, 'ok')
  assert.equal(calls, 2)
})

test('retryTwice throws after two failures', async () => {
  let calls = 0
  await assert.rejects(
    () =>
      retryTwice(async () => {
        calls += 1
        throw new Error('fail')
      }),
    /fail/
  )
  assert.equal(calls, 2)
})

test('filterLastTouchAttribution drops UTMs after session gap but keeps Google click IDs for 90 days', () => {
  const now = Date.now()
  const filtered = filterLastTouchAttribution(
    {
      utm_campaign: 'broiler-bill-pmax',
      gclid: 'G',
      gclid_ts: String(now - ATTRIBUTION_SESSION_MS - 1000),
      _timestamp: String(now - ATTRIBUTION_SESSION_MS - 1000),
    },
    now
  )
  assert.deepEqual(filtered, { gclid: 'G', gclid_ts: String(now - ATTRIBUTION_SESSION_MS - 1000) })
})

test('getAttributionAttrs returns Google click IDs when UTM session expired within 90-day click window', () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      utm_campaign: 'stale-campaign',
      gclid: 'G',
      gclid_ts: now - 60 * 60 * 1000,
      _timestamp: now - ATTRIBUTION_SESSION_MS - 60 * 1000,
    })
  )

  assert.ok(getAttributionAttrs().some((a) => a.key === '_pd_gclid' && a.value === 'G'))
  assert.ok(!getAttributionAttrs().some((a) => a.key === '_pd_utm_campaign'))
})

test('last-touch attrs keep a single Google click type when legacy storage had all three', () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      gclid: 'G',
      gbraid: 'X',
      wbraid: 'Y',
      gclid_ts: now,
      gbraid_ts: now,
      wbraid_ts: now,
      _timestamp: now,
    })
  )

  assert.deepEqual(clickIds(getAttributionAttrs(), '_pd_'), [{ key: '_pd_gclid', value: 'G' }])
})

test('first-touch attrs stamp gbraid and wbraid immediately after gclid', () => {
  installStorage()
  const ts = 1_700_000_000_000
  localStorage.setItem(
    '_pd_first_touch',
    JSON.stringify({
      gclid: 'G',
      gbraid: 'X',
      wbraid: 'Y',
      gclid_ts: ts,
      gbraid_ts: ts,
      wbraid_ts: ts,
      _timestamp: ts,
    })
  )

  assert.deepEqual(clickIds(getFirstTouchAttrs(), '_pd_ft_'), [
    { key: '_pd_ft_gclid', value: 'G' },
    { key: '_pd_ft_gbraid', value: 'X' },
    { key: '_pd_ft_wbraid', value: 'Y' },
  ])
  assert.deepEqual(
    getFirstTouchAttrs().filter((a) => a.key.endsWith('_ts')),
    [
      { key: '_pd_ft_gclid_ts', value: String(ts) },
      { key: '_pd_ft_gbraid_ts', value: String(ts) },
      { key: '_pd_ft_wbraid_ts', value: String(ts) },
    ]
  )
})

test('last-touch attrs stamp Meta _fbc when stored on landing capture', () => {
  installStorage()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      fbc: 'fb.1.123.abc',
      _timestamp: Date.now(),
    })
  )

  assert.deepEqual(
    getAttributionAttrs().filter((a) => a.key === '_pd_fbc'),
    [{ key: '_pd_fbc', value: 'fb.1.123.abc' }]
  )
})

test('restampCartLineAttributes drops stale gclid on line when identity changes to gbraid', () => {
  const stamp = [
    { key: '_pd_gbraid', value: 'B-NEW' },
    { key: '_pd_gbraid_ts', value: '2000' },
    { key: '_pd_utm_campaign', value: 'new-campaign' },
  ]
  const out = restampCartLineAttributes(
    [
      { key: '_pd_gclid', value: 'G-OLD' },
      { key: '_pd_gclid_ts', value: '100' },
      { key: '_pd_utm_campaign', value: 'old-campaign' },
      { key: '_nexus_cid', value: 'cid-1' },
    ],
    stamp,
    true
  )
  const map = new Map(out.map((a) => [a.key, a.value]))
  assert.equal(map.get('_pd_gclid'), undefined)
  assert.equal(map.get('_pd_gbraid'), 'B-NEW')
  assert.equal(map.get('_nexus_cid'), 'cid-1')
})

test('syncAttributionLocalStorageAfterIdentityChange clears stale gclid from localStorage', () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      gclid: 'G-OLD',
      gclid_ts: '100',
      utm_campaign: 'old-campaign',
      _timestamp: String(now),
    })
  )
  syncAttributionLocalStorageAfterIdentityChange([
    { key: '_pd_gbraid', value: 'B-NEW' },
    { key: '_pd_gbraid_ts', value: String(now) },
    { key: '_pd_utm_campaign', value: 'new-campaign' },
  ])
  const bag = JSON.parse(localStorage.getItem('_pd_attribution') ?? '{}') as Record<string, string>
  assert.equal(bag.gclid, undefined)
  assert.equal(bag.gbraid, 'B-NEW')
  assert.equal(bag.utm_campaign, 'new-campaign')
})

test('getAttributionAttrs coalesces duplicate Google click ids in localStorage on read', () => {
  installStorage()
  const now = Date.now()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      gclid: 'G-OLD',
      gbraid: 'B-NEW',
      gclid_ts: '100',
      gbraid_ts: String(now),
      _timestamp: String(now),
    })
  )
  const attrs = getAttributionAttrs()
  const clickKeys = attrs.filter((a) => ['_pd_gclid', '_pd_gbraid', '_pd_wbraid'].includes(a.key))
  assert.equal(clickKeys.length, 1)
  assert.equal(clickKeys[0]?.key, '_pd_gbraid')
})

test('last-touch attrs stamp Google click capture timestamp for the active click type only', () => {
  installStorage()
  const ts = Date.now()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      gclid: 'G',
      gbraid: 'X',
      wbraid: 'Y',
      gclid_ts: ts,
      gbraid_ts: ts,
      wbraid_ts: ts,
      _timestamp: ts,
    })
  )

  assert.deepEqual(
    getAttributionAttrs().filter((a) => a.key.endsWith('_ts')),
    [{ key: '_pd_gclid_ts', value: String(ts) }]
  )
})
