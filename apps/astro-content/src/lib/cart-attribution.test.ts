import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  ATTRIBUTION_SESSION_MS,
  filterLastTouchAttribution,
  getAttributionAttrs,
  getFirstTouchAttrs,
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

test('last-touch attrs stamp gbraid and wbraid immediately after gclid', () => {
  installStorage()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      gclid: 'G',
      gbraid: 'X',
      wbraid: 'Y',
      gclid_ts: Date.now(),
      gbraid_ts: Date.now(),
      wbraid_ts: Date.now(),
      _timestamp: Date.now(),
    })
  )

  assert.deepEqual(clickIds(getAttributionAttrs(), '_pd_'), [
    { key: '_pd_gclid', value: 'G' },
    { key: '_pd_gbraid', value: 'X' },
    { key: '_pd_wbraid', value: 'Y' },
  ])
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

  assert.deepEqual(getAttributionAttrs().filter((a) => a.key === '_pd_fbc'), [
    { key: '_pd_fbc', value: 'fb.1.123.abc' },
  ])
})

test('last-touch attrs stamp Google click capture timestamps for gclid, gbraid, and wbraid', () => {
  installStorage()
  const ts = 1_700_000_000_000
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      gclid: 'G',
      gbraid: 'X',
      wbraid: 'Y',
      gclid_ts: ts,
      gbraid_ts: ts,
      wbraid_ts: ts,
      _timestamp: Date.now(),
    })
  )

  assert.deepEqual(
    getAttributionAttrs().filter((a) => a.key.endsWith('_ts')),
    [
      { key: '_pd_gclid_ts', value: String(ts) },
      { key: '_pd_gbraid_ts', value: String(ts) },
      { key: '_pd_wbraid_ts', value: String(ts) },
    ]
  )
})
