import assert from 'node:assert/strict'
import { test } from 'node:test'
import { productSearchHref } from './product-search-href'

test('trailing slash uses the last non-empty path segment and keeps a trailing slash', () => {
  assert.equal(productSearchHref('https://southlandorganics.com/products/foo/'), '/products/foo/')
  assert.equal(
    productSearchHref('https://southlandorganics.com/products/alpet-d2-surface-sanitizer/'),
    '/products/alpet-d2-surface-sanitizer/'
  )
})

test('path without a trailing slash still links with one', () => {
  assert.equal(productSearchHref('/products/foo'), '/products/foo/')
})

test('query and hash are stripped before the handle is taken', () => {
  assert.equal(productSearchHref('products/foo?x=1'), '/products/foo/')
  assert.equal(productSearchHref('products/foo?x=1#section'), '/products/foo/')
  assert.equal(productSearchHref('/products/foo#details'), '/products/foo/')
})

test('no usable handle is not a product link', () => {
  assert.equal(productSearchHref(''), null)
  assert.equal(productSearchHref('/'), null)
  assert.equal(productSearchHref('https://southlandorganics.com/'), null)
  assert.equal(productSearchHref('https://southlandorganics.com'), null)
})
