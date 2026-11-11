import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ATTRIBUTION_SESSION_MS,
  applyChatGptUtmIfNeeded,
  applyGoogleClickFirstSeen,
  expireGoogleClicksPast90Days,
  filterLastTouchAttribution,
  GOOGLE_CLICK_MS,
  isChatGptUtmSource,
  mergeLastTouchCapture,
  normalizeStoredLastTouch,
  opprefCountsAsNewPaidTouch,
  pruneLosingPaidNetworks,
  pruneToSingleGoogleClick,
  stripRepeatOpprefCookie,
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

test('normalizeStoredLastTouch keeps gclid without per-click ts using _timestamp', () => {
  const now = 2_000_000_000_000
  const sessionTs = now - ATTRIBUTION_SESSION_MS - 60_000
  const store = {
    gclid: 'G',
    utm_campaign: 'old',
    _timestamp: String(sessionTs),
  }
  const kept = normalizeStoredLastTouch(store, now)
  assert.deepEqual(kept, {
    gclid: 'G',
    gclid_ts: String(sessionTs),
  })
})

test('expireGoogleClicksPast90Days drops aged ids inside an active session', () => {
  const now = 2_000_000_000_000
  const expired = expireGoogleClicksPast90Days(
    {
      gclid: 'OLD',
      gclid_ts: String(now - GOOGLE_CLICK_MS - 1),
      utm_campaign: 'still-here',
      _timestamp: String(now - 60_000),
    },
    now
  )
  assert.equal(expired.gclid, undefined)
  assert.equal(expired.utm_campaign, 'still-here')
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

test('pruneLosingPaidNetworks clears Google when Meta fbclid lands', () => {
  const merged = {
    gclid: 'G',
    gclid_ts: '1',
    utm_source: 'google',
    utm_campaign: 'old-campaign',
    fbclid: 'stale',
  }
  pruneLosingPaidNetworks(merged, { fbclid: 'NEW' })
  assert.equal(merged.gclid, undefined)
  assert.equal(merged.gclid_ts, undefined)
  assert.equal(merged.fbclid, 'stale')
})

test('mergeLastTouchCapture clears Google when fbclid is the new touch', () => {
  const stored = {
    gclid: 'G',
    gclid_ts: '1',
    utm_source: 'google',
    utm_campaign: 'google-campaign',
  }
  const merged = mergeLastTouchCapture(
    stored,
    { fbclid: 'META', utm_source: 'facebook', utm_medium: 'paid_social' },
    { landingPage: '/l', referrer: '', now: 3_000 }
  )
  assert.equal(merged.gclid, undefined)
  assert.equal(merged.fbclid, 'META')
  assert.equal(merged.utm_source, 'facebook')
})

test('isChatGptUtmSource recognizes chatgpt.com', () => {
  assert.equal(isChatGptUtmSource('chatgpt.com'), true)
  assert.equal(isChatGptUtmSource('google'), false)
})

test('pruneToSingleGoogleClick removes inactive click types', () => {
  const bag = { gclid: 'G', gbraid: 'B', wbraid: 'W', gclid_ts: '1', gbraid_ts: '2' }
  pruneToSingleGoogleClick(bag, 'gclid')
  assert.deepEqual(bag, { gclid: 'G', gclid_ts: '1' })
})

test('repeat __oppref cookie is not a new touch when gclid is still fresh', () => {
  const now = Date.now()
  const stored = {
    gclid: 'G-AD',
    gclid_ts: String(now),
    oppref: 'oai-same',
    _timestamp: String(now),
  }
  assert.equal(
    opprefCountsAsNewPaidTouch(stored, 'oai-same', {
      referrer: '',
      utmSource: undefined,
      now,
    }),
    false
  )
  const merged = mergeLastTouchCapture(
    stored,
    { oppref: 'oai-same' },
    { landingPage: '/products', referrer: '', now }
  )
  assert.equal(merged.gclid, 'G-AD')
  assert.equal(merged.oppref, 'oai-same')
})

test('Google ad click after stored ChatGPT oppref wins and clears oppref', () => {
  const now = 10_000
  const stored = {
    oppref: 'oai-old',
    utm_source: 'chatgpt',
    _timestamp: String(now - ATTRIBUTION_SESSION_MS - 1),
  }
  const merged = mergeLastTouchCapture(
    stored,
    { gclid: 'G-NEW', gclid_ts: String(now), utm_source: 'google' },
    { landingPage: '/?gclid=G-NEW', referrer: 'https://google.com/', now }
  )
  assert.equal(merged.gclid, 'G-NEW')
  assert.equal(merged.oppref, undefined)
  assert.equal(merged.utm_source, 'google')
})

test('cookie-only oppref with ChatGPT referrer sets utm_source without overwriting explicit source', () => {
  const touch = stripRepeatOpprefCookie(
    {},
    { oppref: 'oai-1' },
    { referrer: 'https://chatgpt.com/', now: 1000 }
  )
  assert.equal(touch.oppref, 'oai-1')
  assert.equal(touch.utm_source, 'chatgpt')

  const keepGoogle = stripRepeatOpprefCookie(
    {},
    { oppref: 'oai-1', utm_source: 'google' },
    { referrer: 'https://chatgpt.com/', now: 1000 }
  )
  assert.equal(keepGoogle.utm_source, 'google')

  const bare = { oppref: 'oai-1' }
  applyChatGptUtmIfNeeded(bare)
  assert.equal(bare.utm_source, 'chatgpt')
})
