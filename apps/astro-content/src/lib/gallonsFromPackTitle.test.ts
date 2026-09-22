import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gallonsFromPackTitle, gallonsFromVariant, pricePerGallon } from './gallonsFromPackTitle'

test('packed cases', () => {
  assert.equal(gallonsFromPackTitle('2x2.5G Case'), 5)
  assert.equal(gallonsFromPackTitle('2x2.5 Gallon Case'), 5)
  assert.equal(gallonsFromPackTitle('4x1 Gallon Case'), 4)
  assert.equal(gallonsFromPackTitle('4 x 1 Gallon'), 4)
})

test('single jugs', () => {
  assert.equal(gallonsFromPackTitle('1 Gallon'), 1)
  assert.equal(gallonsFromPackTitle('2.5 Gallon'), 2.5)
  assert.equal(gallonsFromPackTitle('2.5G'), 2.5)
})

test('quarts and empty stay null', () => {
  assert.equal(gallonsFromPackTitle('Quart'), null)
  assert.equal(gallonsFromPackTitle('32 oz Quart'), null)
  assert.equal(gallonsFromPackTitle(''), null)
  assert.equal(gallonsFromPackTitle('Default Title'), null)
})

test('prefers Size option over title', () => {
  assert.equal(
    gallonsFromVariant({
      title: 'Default Title',
      selectedOptions: [{ name: 'Size', value: '4x1 Gallon Case' }],
    }),
    4
  )
})

test('price per gallon', () => {
  assert.equal(pricePerGallon('116.00', 4), 29)
  assert.equal(pricePerGallon(196, 5), 39.2)
  assert.equal(pricePerGallon('31', 0), null)
})
