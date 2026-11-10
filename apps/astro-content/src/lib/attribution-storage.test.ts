import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ATTRIBUTION_SESSION_MS,
  applyGoogleClickFirstSeen,
  filterLastTouchAttribution,
  mergeLastTouchCapture,
  pruneToSingleGoogleClick,
  retainGoogleClicksAfterSession,
} from './attribution-storage'

test('applyGoogleClickFirstSeen preserves ts on reload of the same gclid', () => {
  const stored = { gclid: 'A', gclid_ts: '1000', _timestamp: '1000' }
  const incoming = { gclid: 'A' }
  applyGoogleClickFirstSeen(incoming, stored, 9_999)
  assert.equal(incoming.gclid_ts, '1000')
})

test('applyGoogleClickFirstSeen sets new ts when the click id value changes', () => {
  const stored = { gclid: 'A', gclid_ts: '1000' }
  const incoming = { gclid: 'B' }
  applyGoogleClickFirstSeen(incoming, stored, 2_000)
  assert.equal(incoming.gclid_ts, '2000')
})

test('applyGoogleClickFirstSeen uses session _timestamp for legacy rows without *_ts', () => {
  const stored = { gclid: 'A', _timestamp: '5000' }
  const incoming = { gclid: 'A' }
  applyGoogleClickFirstSeen(incoming, stored, 9_999)
  assert.equal(incoming.gclid_ts, '5000')
})

test('retainGoogleClicksAfterSession keeps gclid without per-click ts using _timestamp', () => {
  const now = 2_000_000_000_000
  const sessionTs = now - ATTRIBUTION_SESSION_MS - 60_000
  const store = {
    gclid: 'G',
    utm_campaign: 'old',
    _timestamp: String(sessionTs),
  }
  const kept = retainGoogleClicksAfterSession(store, now)
  assert.deepEqual(kept, {
    gclid: 'G',
    gclid_ts: String(sessionTs),
  })
})

test('filterLastTouchAttribution keeps legacy gclid after UTM session expires', () => {
  const now = Date.now()
  const filtered = filterLastTouchAttribution(
    {
      utm_campaign: 'stale',
      gclid: 'G',
      _timestamp: String(now - ATTRIBUTION_SESSION_MS - 5_000),
    },
    now
  )
  assert.deepEqual(filtered, {
    gclid: 'G',
    gclid_ts: String(now - ATTRIBUTION_SESSION_MS - 5_000),
  })
})

test('mergeLastTouchCapture prunes other Google click types when gclid lands', () => {
  const stored = { gbraid: 'old-braid', gbraid_ts: '1', gclid: 'old-g', gclid_ts: '1' }
  const incoming = { gclid: 'new-g' }
  const merged = mergeLastTouchCapture(stored, incoming, {
    landingPage: '/x',
    referrer: '',
    now: 2_000,
  })
  assert.equal(merged.gclid, 'new-g')
  assert.equal(merged.gclid_ts, '2000')
  assert.equal(merged.gbraid, undefined)
  assert.equal(merged.gbraid_ts, undefined)
})

test('pruneToSingleGoogleClick removes inactive click types', () => {
  const bag = { gclid: 'G', gbraid: 'B', wbraid: 'W', gclid_ts: '1', gbraid_ts: '2' }
  pruneToSingleGoogleClick(bag, 'gclid')
  assert.deepEqual(bag, { gclid: 'G', gclid_ts: '1' })
})
