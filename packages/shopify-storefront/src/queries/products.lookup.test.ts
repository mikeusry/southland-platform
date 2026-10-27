import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import type { StorefrontClient } from '../client'
import type { ProductDetail } from '../types'
import { getProductByHandle, lookupProductByHandle } from './products'

const minimalProductNode = {
  id: 'gid://shopify/Product/1',
  title: 'Test Product',
  handle: 'test-product',
  description: 'Desc',
  descriptionHtml: '<p>Desc</p>',
  vendor: 'Southland Organics',
  productType: 'Poultry',
  tags: [],
  seo: { title: null, description: null },
  priceRange: { minVariantPrice: { amount: '10.00', currencyCode: 'USD' } },
  images: { edges: [] },
  variants: {
    edges: [
      {
        node: {
          id: 'gid://shopify/ProductVariant/1',
          title: 'Default Title',
          price: { amount: '10.00', currencyCode: 'USD' },
          compareAtPrice: null,
          availableForSale: true,
          sku: null,
          barcode: null,
          image: null,
          selectedOptions: [],
          sellingPlanAllocations: { edges: [] },
        },
      },
    ],
  },
}

function mockClient(
  impl: (...args: unknown[]) => Promise<{ data?: unknown; errors?: unknown[] }>
): StorefrontClient {
  return {
    request: impl,
  } as StorefrontClient
}

describe('lookupProductByHandle', () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it('returns found when Shopify returns a product', async () => {
    const client = mockClient(async () => ({
      data: { product: minimalProductNode },
    }))

    const result = await lookupProductByHandle(client, 'test-product')
    assert.equal(result.status, 'found')
    if (result.status === 'found') {
      assert.equal(result.product.handle, 'test-product')
    }
  })

  it('returns not_found when Shopify returns a null product', async () => {
    const client = mockClient(async () => ({
      data: { product: null },
    }))

    const result = await lookupProductByHandle(client, 'missing-handle')
    assert.deepEqual(result, { status: 'not_found' })
  })

  it('returns error when Shopify returns GraphQL errors', async () => {
    const client = mockClient(async () => ({
      data: { product: null },
      errors: [{ message: 'Throttled' }],
    }))

    const result = await lookupProductByHandle(client, 'test-product')
    assert.equal(result.status, 'error')
  })

  it('returns error when the Storefront client throws (network / timeout)', async () => {
    const client = mockClient(async () => {
      throw new Error('fetch failed')
    })

    const result = await lookupProductByHandle(client, 'test-product')
    assert.equal(result.status, 'error')
  })
})

describe('getProductByHandle (legacy callers)', () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it('returns null on API error — indistinguishable from not found (PDP previously 404)', async () => {
    const client = mockClient(async () => ({
      errors: [{ message: 'Service unavailable' }],
    }))

    const product = await getProductByHandle(client, 'test-product')
    assert.equal(product, null)
  })
})
