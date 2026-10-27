import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type {
  ProductDetail,
  ProductLookupResult,
  StorefrontClient,
} from '@southland/shopify-storefront'
import {
  httpStatusForProductPageLoad,
  loadProductForProductPage,
  PRODUCT_PAGE_RETRY_AFTER_SECONDS,
} from './product-page-shopify'

const client = {} as StorefrontClient

const sampleProduct = { handle: 'hen-helper' } as ProductDetail

function lookupSequence(results: ProductLookupResult[]): ProductLookupResult[] {
  return [...results]
}

describe('loadProductForProductPage', () => {
  it('returns the product on success', async () => {
    const queue = lookupSequence([{ status: 'found', product: sampleProduct }])
    const load = await loadProductForProductPage(client, 'hen-helper', async () => {
      const next = queue.shift()
      if (!next) throw new Error('unexpected lookup call')
      return next
    })

    assert.equal(load.outcome, 'product')
    assert.equal(load.attempts, 1)
    if (load.outcome === 'product') {
      assert.equal(load.product.handle, 'hen-helper')
    }
    assert.equal(httpStatusForProductPageLoad(load), 200)
  })

  it('returns not_found for a missing product (404)', async () => {
    const load = await loadProductForProductPage(client, 'no-such-product', async () => ({
      status: 'not_found',
    }))

    assert.equal(load.outcome, 'not_found')
    assert.equal(load.attempts, 1)
    assert.equal(httpStatusForProductPageLoad(load), 404)
  })

  it('retries once on error then returns unavailable (503)', async () => {
    const calls: string[] = []
    const load = await loadProductForProductPage(client, 'hen-helper', async (_c, handle) => {
      calls.push(handle)
      return { status: 'error', cause: new Error('timeout') }
    })

    assert.equal(calls.length, 2)
    assert.equal(load.outcome, 'unavailable')
    assert.equal(load.attempts, 2)
    assert.equal(httpStatusForProductPageLoad(load), 503)
  })

  it('succeeds on the second attempt after a transient error', async () => {
    const queue = lookupSequence([
      { status: 'error', cause: new Error('timeout') },
      { status: 'found', product: sampleProduct },
    ])

    const load = await loadProductForProductPage(client, 'hen-helper', async () => {
      const next = queue.shift()
      if (!next) throw new Error('unexpected lookup call')
      return next
    })

    assert.equal(load.outcome, 'product')
    assert.equal(load.attempts, 2)
  })
})

describe('PRODUCT_PAGE_RETRY_AFTER_SECONDS', () => {
  it('matches middleware rate-limit retry hint', () => {
    assert.equal(PRODUCT_PAGE_RETRY_AFTER_SECONDS, 60)
  })
})
