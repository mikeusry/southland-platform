import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { StorefrontClient } from '@southland/shopify-storefront'
import { filterLiveProductSearchCards, resolveLiveProductSearchCards } from './product-search-live'

const hen = {
  url: 'https://southlandorganics.com/products/hen-helper/',
  title: 'Hen Helper',
}
const alpet = {
  url: '/products/alpet-d2-surface-sanitizer',
  title: 'Alpet D2',
}
const ss10018 = {
  url: 'https://southlandorganics.com/products/ss10018/',
  title: 'Old SKU',
}
const md20001 = { url: '/products/md20001', title: 'Moved SKU' }
const usp20085 = {
  url: 'https://southlandorganics.com/products/usp20085/',
  title: 'USP',
}

test('live handles are kept and linked with a trailing slash', () => {
  const cards = filterLiveProductSearchCards([hen, alpet], {
    status: 'ok',
    byQueriedHandle: new Map([
      ['hen-helper', 'hen-helper'],
      ['alpet-d2-surface-sanitizer', 'alpet-d2-surface-sanitizer'],
    ]),
  })

  assert.deepEqual(cards, [
    { result: hen, href: '/products/hen-helper/' },
    { result: alpet, href: '/products/alpet-d2-surface-sanitizer/' },
  ])
})

test('unknown handles are dropped', () => {
  const cards = filterLiveProductSearchCards([ss10018, hen, usp20085, md20001, alpet], {
    status: 'ok',
    byQueriedHandle: new Map([
      ['hen-helper', 'hen-helper'],
      ['alpet-d2-surface-sanitizer', 'alpet-d2-surface-sanitizer'],
    ]),
  })

  assert.deepEqual(
    cards.map((card) => card.href),
    ['/products/hen-helper/', '/products/alpet-d2-surface-sanitizer/']
  )
})

test('a Shopify error results in no product cards', () => {
  const cards = filterLiveProductSearchCards([hen, ss10018, md20001], { status: 'error' })
  assert.deepEqual(cards, [])
})

test('a resolved product links to the current Shopify handle', () => {
  const cards = filterLiveProductSearchCards([md20001, hen], {
    status: 'ok',
    byQueriedHandle: new Map([
      ['md20001', 'bsi-foamer-gauges'],
      ['hen-helper', 'hen-helper'],
    ]),
  })

  assert.deepEqual(cards, [
    { result: md20001, href: '/products/bsi-foamer-gauges/' },
    { result: hen, href: '/products/hen-helper/' },
  ])
})

test('a product URL with no handle is not a card', () => {
  const cards = filterLiveProductSearchCards(
    [{ url: 'https://southlandorganics.com/' }, { url: '' }],
    {
      status: 'ok',
      byQueriedHandle: new Map([['hen-helper', 'hen-helper']]),
    }
  )
  assert.deepEqual(cards, [])
})

test('resolveLiveProductSearchCards keeps live handles from one batched lookup', async () => {
  const calls: Array<{ query: string; variables?: Record<string, unknown>; signal?: AbortSignal }> =
    []
  const client = {
    request: async (
      query: string,
      options?: { variables?: Record<string, unknown>; signal?: AbortSignal }
    ) => {
      calls.push({ query, variables: options?.variables, signal: options?.signal })
      return {
        data: {
          p0: { handle: 'hen-helper' },
          p1: null,
          p2: { handle: 'bsi-foamer-gauges' },
        },
      }
    },
  } as StorefrontClient

  const cards = await resolveLiveProductSearchCards([hen, ss10018, md20001], client)

  assert.equal(calls.length, 1)
  assert.match(calls[0]?.query ?? '', /p0: product\(handle: \$h0\)/)
  assert.match(calls[0]?.query ?? '', /p1: product\(handle: \$h1\)/)
  assert.match(calls[0]?.query ?? '', /p2: product\(handle: \$h2\)/)
  assert.deepEqual(calls[0]?.variables, {
    h0: 'hen-helper',
    h1: 'ss10018',
    h2: 'md20001',
  })
  assert.ok(calls[0]?.signal)
  assert.deepEqual(
    cards.map((card) => card.href),
    ['/products/hen-helper/', '/products/bsi-foamer-gauges/']
  )
})

test('a Storefront error hides every product card', async () => {
  const client = {
    request: async () => ({
      data: { p0: { handle: 'hen-helper' } },
      errors: { message: 'Throttled' },
    }),
  } as StorefrontClient

  const cards = await resolveLiveProductSearchCards([hen, ss10018], client)
  assert.deepEqual(cards, [])
})

test('a Storefront timeout hides every product card', { timeout: 1000 }, async () => {
  const client = {
    request: (_query: string, options?: { signal?: AbortSignal }) =>
      new Promise((resolve) => {
        const signal = options?.signal
        const finish = () => resolve({ errors: { message: 'aborted' } })
        if (!signal) return
        if (signal.aborted) {
          finish()
          return
        }
        signal.addEventListener('abort', finish, { once: true })
      }),
  } as StorefrontClient

  const cards = await resolveLiveProductSearchCards([hen], client, 40)
  assert.deepEqual(cards, [])
})
