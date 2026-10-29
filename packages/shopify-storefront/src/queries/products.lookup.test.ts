import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { StorefrontClient } from '../client'
import { getProductByHandle, lookupProductByHandle, lookupProductsByHandles } from './products'

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

describe('lookupProductsByHandles', () => {
  it('resolves every handle in one product(handle:) query', async () => {
    const calls: Array<{ query: string; variables?: Record<string, unknown> }> = []
    const client = mockClient(async (query, options) => {
      calls.push({
        query: String(query),
        variables:
          options && typeof options === 'object'
            ? (options as { variables?: Record<string, unknown> }).variables
            : undefined,
      })
      return {
        data: {
          p0: { handle: 'hen-helper' },
          p1: null,
          p2: { handle: 'bsi-foamer-gauges' },
        },
      }
    })

    const result = await lookupProductsByHandles(client, [
      'hen-helper',
      'ss10018',
      'md20001',
      'hen-helper',
    ])

    assert.equal(result.status, 'ok')
    assert.equal(calls.length, 1)
    assert.match(calls[0]?.query ?? '', /p0: product\(handle: \$h0\) \{ handle \}/)
    assert.match(calls[0]?.query ?? '', /p2: product\(handle: \$h2\) \{ handle \}/)
    assert.deepEqual(calls[0]?.variables, {
      h0: 'hen-helper',
      h1: 'ss10018',
      h2: 'md20001',
    })
    if (result.status === 'ok') {
      assert.equal(result.handles.get('hen-helper'), 'hen-helper')
      assert.equal(result.handles.get('ss10018'), null)
      assert.equal(result.handles.get('md20001'), 'bsi-foamer-gauges')
    }
  })

  it('returns error when Shopify returns GraphQL errors, even with partial data', async () => {
    const client = mockClient(async () => ({
      data: { p0: { handle: 'hen-helper' } },
      errors: [{ message: 'Throttled' }],
    }))

    const result = await lookupProductsByHandles(client, ['hen-helper'])
    assert.equal(result.status, 'error')
  })

  it('returns error when the Storefront client throws', async () => {
    const client = mockClient(async () => {
      throw new Error('fetch failed')
    })

    const result = await lookupProductsByHandles(client, ['hen-helper'])
    assert.equal(result.status, 'error')
  })

  it('does not call Shopify when there are no handles', async () => {
    let called = false
    const client = mockClient(async () => {
      called = true
      return { data: {} }
    })

    const result = await lookupProductsByHandles(client, [])
    assert.equal(called, false)
    assert.deepEqual(result, { status: 'ok', handles: new Map() })
  })
})

describe('getProductByHandle (legacy callers)', () => {
  it('returns null on API error — indistinguishable from not found (PDP previously 404)', async () => {
    const client = mockClient(async () => ({
      errors: [{ message: 'Service unavailable' }],
    }))

    const product = await getProductByHandle(client, 'test-product')
    assert.equal(product, null)
  })
})
