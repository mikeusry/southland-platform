import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PRODUCTS } from './appRateRules'
import { calculateApplication } from './appRateUtils'

const product = PRODUCTS.find((p) => p.handle === 'natural-mite-control-livestock-poultry')

describe('Desecticide label rate', () => {
  it('cleanout is 4 gallons of product for one 20,000 sq ft house', () => {
    assert.ok(product)
    const rule = product.rates.find((r) => r.useCase === 'cleanout')
    assert.ok(rule)
    assert.equal(rule.rate, 4)
    assert.equal(rule.rateUnit, 'gal')
    assert.equal(rule.perArea, 1)
    assert.equal(rule.perAreaUnit, 'houses')
    assert.equal(rule.rateMin, undefined)
    assert.equal(rule.rateMax, undefined)
    assert.match(rule.notes ?? '', /per 10 gal water to cover 5,000 square feet/)
    assert.doesNotMatch(rule.notes ?? '', /20 gal/)
    assert.doesNotMatch(rule.notes ?? '', /30 gal/)

    const oneHouse = calculateApplication(product, rule, 1, 'houses', 0)
    assert.equal(oneHouse?.totalNeeded, 4)
    assert.equal(oneHouse?.rateRange, null)

    const twentyThousandSqFt = calculateApplication(product, rule, 20_000, 'sqft', 0)
    assert.equal(twentyThousandSqFt?.totalNeeded, 4)
  })

  it('does not state a 1:30 production dilution', () => {
    assert.ok(product)
    const rule = product.rates.find((r) => r.useCase === 'during-production')
    assert.ok(rule)
    assert.doesNotMatch(`${rule.notes ?? ''} ${rule.frequency ?? ''}`, /1:30/)
    assert.doesNotMatch(rule.notes ?? '', /30 gal/)
  })
})
