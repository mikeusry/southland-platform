import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shopPolicyCanonicalUrl } from './shop-policy-meta'

const SITE = 'https://southlandorganics.com'

test('refund-policy canonicalizes to return-policy URL', () => {
  assert.equal(
    shopPolicyCanonicalUrl(SITE, 'refund-policy'),
    'https://southlandorganics.com/pages/return-policy/'
  )
})

test('other policy slugs stay self-canonical', () => {
  for (const slug of ['privacy-policy', 'terms-of-service', 'shipping-policy', 'return-policy']) {
    assert.equal(shopPolicyCanonicalUrl(SITE, slug), `https://southlandorganics.com/pages/${slug}/`)
  }
})
