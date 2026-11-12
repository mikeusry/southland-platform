import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EXAMPLE_ORDER_DOLLARS,
  FALLBACK_REWARDS_CONFIG,
  POINTS_DO_NOT_EXPIRE_ANSWER,
  REWARD_STACKING_ANSWER,
  buildRewardsKnowledge,
  exampleEarnPoints,
  formatEarnRate,
  formatQualifyingSpendCell,
  loadRewardsConfig,
  mapRewardCards,
  referralRedemptionClause,
  referralTenFriendsClause,
  referralWhatCanIDoBody,
  referralsToNextRewardSentence,
  rewardsMenuLead,
  type RewardsConfig,
} from './rewards-config'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

const SAMPLE: RewardsConfig = {
  earn: { points_per_dollar: 2 },
  tiers: [
    {
      key: 'bronze',
      label: 'Bronze',
      qualifying_spend: 0,
      earn_multiplier: 1,
      upgrade_bonus_points: 0,
    },
    {
      key: 'silver',
      label: 'Silver',
      qualifying_spend: 800,
      earn_multiplier: 2,
      upgrade_bonus_points: 40,
    },
    {
      key: 'gold',
      label: 'Gold',
      qualifying_spend: 2000,
      earn_multiplier: 3,
      upgrade_bonus_points: 0,
    },
  ],
  rewards: [
    {
      name: '$8 Off',
      points_required: 100,
      discount_type: 'fixed_amount',
      discount_value: 8,
      minimum_purchase: 20,
      min_tier: 'bronze',
    },
    {
      name: '$40 Off',
      points_required: 1000,
      discount_type: 'fixed_amount',
      discount_value: 40,
      minimum_purchase: null,
      min_tier: 'silver',
    },
    {
      name: 'Gold Rate Reward',
      points_required: 2000,
      discount_type: 'percentage',
      discount_value: 15,
      minimum_purchase: 75,
      min_tier: 'gold',
    },
  ],
  referral: { referrer_points: 250, referee_discount: 7, code_prefix: 'PAL-' },
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('loadRewardsConfig', () => {
  it('uses the live config when the API returns rewards', async () => {
    const live: RewardsConfig = {
      ...SAMPLE,
      rewards: [
        {
          name: '$3 Off',
          points_required: 10,
          discount_type: 'fixed_amount',
          discount_value: 3,
          minimum_purchase: 5,
          min_tier: 'bronze',
        },
      ],
    }
    const config = await loadRewardsConfig({
      fetchImpl: async () => jsonResponse(live),
    })
    assert.equal(config.rewards[0]?.name, '$3 Off')
    assert.equal(config.referral.referrer_points, 250)
    assert.notEqual(config, FALLBACK_REWARDS_CONFIG)
  })

  it('falls back when the fetch fails', async () => {
    const config = await loadRewardsConfig({
      fetchImpl: async () => {
        throw new Error('network down')
      },
    })
    assert.equal(config, FALLBACK_REWARDS_CONFIG)
  })

  it('falls back when the request times out', async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal
        if (!signal) {
          reject(new Error('missing timeout signal'))
          return
        }
        // AbortSignal.timeout does not keep the event loop alive by itself.
        const hung = setTimeout(() => reject(new Error('timed out without abort')), 1000)
        const onAbort = () => {
          clearTimeout(hung)
          reject(signal.reason ?? new Error('aborted'))
        }
        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, { once: true })
      })
    const config = await loadRewardsConfig({ fetchImpl, timeoutMs: 20 })
    assert.equal(config, FALLBACK_REWARDS_CONFIG)
  })

  it('falls back when the API returns no rewards', async () => {
    for (const rewards of [[], null, undefined]) {
      const config = await loadRewardsConfig({
        fetchImpl: async () => jsonResponse({ rewards, tiers: [] }),
      })
      assert.equal(config, FALLBACK_REWARDS_CONFIG)
    }
  })

  it('falls back when the API responds with an error status', async () => {
    const config = await loadRewardsConfig({
      fetchImpl: async () => jsonResponse({ rewards: SAMPLE.rewards }, 503),
    })
    assert.equal(config, FALLBACK_REWARDS_CONFIG)
  })
})

describe('rewards page text from the fallback config', () => {
  it('renders the same reward grid as the previous hardcoded menu', () => {
    assert.deepEqual(mapRewardCards(FALLBACK_REWARDS_CONFIG), [
      { name: '$10 Off', points: 200, minPurchase: '$25', tier: null },
      { name: '$15 Off', points: 300, minPurchase: '$30', tier: null },
      { name: '$20 Off', points: 400, minPurchase: '$40', tier: null },
      { name: '$25 Off', points: 500, minPurchase: '$50', tier: null },
    ])
    assert.equal(
      rewardsMenuLead(FALLBACK_REWARDS_CONFIG),
      'Four dollar-off rewards, starting at 200 points.'
    )
    assert.equal(formatQualifyingSpendCell(0), '$0')
    assert.equal(formatQualifyingSpendCell(500), '$500+')
    assert.equal(formatQualifyingSpendCell(1500), '$1,500+')
    assert.equal(formatEarnRate(1), '1x')
    assert.equal(formatEarnRate(1.25), '1.25x')
    assert.equal(formatEarnRate(1.5), '1.5x')
    assert.equal(exampleEarnPoints(EXAMPLE_ORDER_DOLLARS, 1, 1), 75)
    assert.equal(exampleEarnPoints(EXAMPLE_ORDER_DOLLARS, 1, 1.25), 94)
    assert.equal(exampleEarnPoints(EXAMPLE_ORDER_DOLLARS, 1, 1.5), 113)
    assert.equal(FALLBACK_REWARDS_CONFIG.tiers[1]?.upgrade_bonus_points, 100)
    assert.equal(FALLBACK_REWARDS_CONFIG.tiers[2]?.upgrade_bonus_points, 250)
  })
})

describe('referral copy built from config', () => {
  it('keeps the ten-referral sentence when the live math still produces it', () => {
    assert.equal(
      referralTenFriendsClause(FALLBACK_REWARDS_CONFIG),
      "Refer 10 friends and earn 5,000 bonus points — that's $25+ in rewards."
    )
  })

  it('states the best reward one referral can buy, including its minimum', () => {
    assert.equal(
      referralRedemptionClause(FALLBACK_REWARDS_CONFIG),
      '500 points redeems for $25 off (min $50 order).'
    )
    assert.equal(referralsToNextRewardSentence(FALLBACK_REWARDS_CONFIG), null)
    assert.equal(
      referralWhatCanIDoBody(FALLBACK_REWARDS_CONFIG),
      '500 points redeems for $25 off (min $50 order).'
    )
  })

  it('builds both sentences from a sample config instead of the fallback numbers', () => {
    assert.equal(
      referralTenFriendsClause(SAMPLE),
      "Refer 10 friends and earn 2,500 bonus points — that's $40+ in rewards."
    )
    assert.equal(referralRedemptionClause(SAMPLE), '250 points redeems for $8 off (min $20 order).')
    assert.equal(
      referralsToNextRewardSentence(SAMPLE),
      "Refer four friends and you've earned enough for $40 off (1,000 points)."
    )
    assert.equal(
      referralWhatCanIDoBody(SAMPLE),
      "250 points redeems for $8 off (min $20 order). Refer four friends and you've earned enough for $40 off (1,000 points)."
    )
  })
})

describe('ai-content rewards block', () => {
  it('matches the rewards page FAQ word for word and lists the fallback catalog', () => {
    const knowledge = buildRewardsKnowledge(FALLBACK_REWARDS_CONFIG)
    assert.equal(
      knowledge,
      [
        'Loyalty Rewards Program — Earn points on every order. Redeem for dollar-off discounts and VIP perks.',
        '',
        'How to Earn Points:',
        '- Earn 1 point per $1 spent on every order (after discounts, before shipping)',
        '- Points multiplied by tier: Bronze 1x, Silver 1.25x, Gold 1.5x',
        '',
        'VIP Tiers:',
        '- Bronze: $0+ spent. 1x earn rate.',
        '- Silver: $500+ spent. 1.25x earn rate. Upgrade bonus: 100 points.',
        '- Gold: $1,500+ spent. 1.5x earn rate. Upgrade bonus: 250 points.',
        '',
        'Available Rewards:',
        '- $10 Off: 200 points (min $25 order)',
        '- $15 Off: 300 points (min $30 order)',
        '- $20 Off: 400 points (min $40 order)',
        '- $25 Off: 500 points (min $50 order)',
        '',
        'Referral Program:',
        '- Share your unique referral code with friends',
        '- New customer gets $10 off their first order',
        '- You earn 500 bonus points',
        '- Referral codes start with REF- prefix',
        '',
        'FAQ:',
        'Q: Do points expire?',
        `A: ${POINTS_DO_NOT_EXPIRE_ANSWER}`,
        '',
        'Q: Can I use rewards with other discounts?',
        `A: ${REWARD_STACKING_ANSWER}`,
        '',
        'Q: How do I check my points balance?',
        'A: Visit southlandorganics.com/rewards and enter your email address.',
      ].join('\n')
    )
    assert.equal(POINTS_DO_NOT_EXPIRE_ANSWER, 'No. Points do not expire.')
    assert.equal(
      REWARD_STACKING_ANSWER,
      'Yes. Reward discounts can be used on sale prices. One reward code per order.'
    )
    assert.equal(knowledge.includes(['750', 'points'].join(' ')), false)
    assert.equal(knowledge.includes(['$5', 'Off'].join(' ')), false)
    assert.equal(knowledge.includes('purchase per year'), false)
    assert.equal(knowledge.includes('cannot be stacked'), false)
    assert.equal(knowledge.includes('exclusive 15%'), false)
  })

  it('generates rewards, tiers, and referral lines from a sample config', () => {
    const knowledge = buildRewardsKnowledge(SAMPLE)
    assert.match(knowledge, /Earn 2 points per \$1 spent/)
    assert.match(knowledge, /Bronze 1x, Silver 2x, Gold 3x/)
    assert.match(knowledge, /- Silver: \$800\+ spent\. 2x earn rate\. Upgrade bonus: 40 points\./)
    assert.match(knowledge, /- Gold: \$2,000\+ spent\. 3x earn rate\./)
    assert.doesNotMatch(knowledge, /Upgrade bonus: 0/)
    assert.match(knowledge, /- \$8 Off: 100 points \(min \$20 order\)/)
    assert.match(knowledge, /- \$40 Off: 1,000 points \(Silver\+ tier\)/)
    assert.match(knowledge, /- Gold Rate Reward: 2,000 points \(min \$75 order, Gold only\)/)
    assert.match(knowledge, /- New customer gets \$7 off their first order/)
    assert.match(knowledge, /- You earn 250 bonus points/)
    assert.match(knowledge, /- Referral codes start with PAL- prefix/)
    assert.match(knowledge, /A: No\. Points do not expire\./)
    assert.match(
      knowledge,
      /A: Yes\. Reward discounts can be used on sale prices\. One reward code per order\./
    )
    assert.doesNotMatch(knowledge, /\$10 Off: 200 points/)
    assert.doesNotMatch(knowledge, /You earn 500 bonus points/)
  })
})

describe('catalog literals', () => {
  it('keeps hand-typed reward amounts in the shared fallback only', () => {
    const catalogValue =
      /(?:points_required|qualifying_spend|earn_multiplier|referrer_points|referee_discount|upgrade_bonus_points|discount_value|minimum_purchase):\s*\d/
    const retired = [
      /\$5 Off/,
      /750 points/,
      /free shipping \(750 points\)/,
      /10% Off/,
      /15% Off/,
      /2,500 points/,
      /purchase per year/,
      /cannot be stacked/,
      /exclusive 15%/,
    ]
    const hits: string[] = []
    const retiredHits: string[] = []
    for (const file of sourceFiles(repoRoot)) {
      const text = readFileSync(file, 'utf8')
      const rel = relative(repoRoot, file)
      if (catalogValue.test(text) && rel !== 'apps/astro-content/src/lib/rewards-config.ts') {
        hits.push(rel)
      }
      for (const pattern of retired) {
        if (pattern.test(text)) retiredHits.push(`${rel}: ${pattern}`)
      }
    }
    assert.deepEqual(hits, [])
    assert.deepEqual(retiredHits, [])
  })
})

describe('free shipping wording', () => {
  it('is absent from the referral page and the rewards knowledge block', () => {
    const referral = readFileSync(
      join(repoRoot, 'apps/astro-content/src/pages/referral/index.astro'),
      'utf8'
    )
    const aiContent = readFileSync(
      join(repoRoot, 'apps/astro-content/src/pages/api/ai-content.ts'),
      'utf8'
    )
    const rewardsBlock = sliceBetween(aiContent, "id: 'page:rewards'", "id: 'page:shipping'")
    const knowledge = [
      buildRewardsKnowledge(FALLBACK_REWARDS_CONFIG),
      buildRewardsKnowledge(SAMPLE),
    ].join('\n')
    const storeShippingPolicy = '- Free shipping on orders over $99'

    assert.deepEqual(freeShippingLines(referral), [])
    assert.deepEqual(freeShippingLines(rewardsBlock), [])
    assert.deepEqual(freeShippingLines(knowledge), [])
    assert.equal(aiContent.includes(storeShippingPolicy), true)
    assert.equal(rewardsBlock.includes(storeShippingPolicy), false)
  })
})

function freeShippingLines(text: string): string[] {
  return text.split('\n').filter((line) => /free shipping/i.test(line))
}

function sliceBetween(text: string, start: string, end: string): string {
  const from = text.indexOf(start)
  const to = text.indexOf(end, from + start.length)
  assert.notEqual(from, -1, `missing ${start}`)
  assert.notEqual(to, -1, `missing ${end}`)
  return text.slice(from, to)
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  const skip = new Set(['node_modules', 'dist', '.git', '.astro', 'coverage', '.turbo', '.vercel'])
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out)
      continue
    }
    if (!/\.(astro|ts|tsx|js|mjs|md|mdx)$/.test(entry)) continue
    if (entry.endsWith('.test.ts')) continue
    out.push(path)
  }
  return out
}
