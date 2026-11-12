/**
 * Live loyalty numbers for /rewards, /referral, and the chat knowledge in
 * /api/ai-content.
 *
 * The source of truth is `api/public/rewards-config`, which reads
 * `loyalty_rewards` and the tier / earn constants that actually calculate
 * points. Do not type a second copy of these numbers into a page.
 *
 * /rewards and /referral are `prerender = true`, so they fetch at build time
 * and a Nexus change reaches those pages on the next deploy. /api/ai-content
 * runs on each request (`output: 'server'`), so the same helper fetches again
 * there, with the same timeout and the same fallback.
 *
 * The fallback is last-known-good, not empty. If the API is unreachable, pages
 * render these values rather than a blank rewards grid. They matched production
 * on 2026-11-12 (Smile dollar-off rungs, not the retired 1% catalog). A stale
 * table is bad; a blank one on a page customers were emailed to is worse.
 */

export const REWARDS_CONFIG_URL = 'https://nexus.southlandorganics.com/api/public/rewards-config'

const FETCH_TIMEOUT_MS = 8000

/** Illustrative order on /rewards. Not a reward price. */
export const EXAMPLE_ORDER_DOLLARS = 75

/** The "refer 10 friends" example. 10 × referrer points, not a catalog price. */
export const REFERRAL_EXAMPLE_FRIENDS = 10

export const POINTS_DO_NOT_EXPIRE_ANSWER = 'No. Points do not expire.'

export const REWARD_STACKING_ANSWER =
  'Yes. Reward discounts can be used on sale prices. One reward code per order.'

export type RewardDiscountType = 'fixed_amount' | 'percentage'

export type RewardsTier = {
  key: string
  label: string
  qualifying_spend: number
  earn_multiplier: number
  upgrade_bonus_points?: number
}

export type RewardsReward = {
  slug?: string
  name: string
  description?: string
  points_required: number
  discount_type?: RewardDiscountType | null
  discount_value?: number | null
  minimum_purchase?: number | null
  min_tier?: string | null
}

export type RewardsConfig = {
  earn: {
    points_per_dollar: number
    code_expiration_days?: number
  }
  tiers: RewardsTier[]
  rewards: RewardsReward[]
  referral: {
    referrer_points: number
    referee_discount: number
    code_prefix?: string
  }
  generated_at?: string
}

export const FALLBACK_REWARDS_CONFIG: RewardsConfig = {
  earn: { points_per_dollar: 1, code_expiration_days: 90 },
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
      qualifying_spend: 500,
      earn_multiplier: 1.25,
      upgrade_bonus_points: 100,
    },
    {
      key: 'gold',
      label: 'Gold',
      qualifying_spend: 1500,
      earn_multiplier: 1.5,
      upgrade_bonus_points: 250,
    },
  ],
  rewards: [
    {
      slug: '10-off',
      name: '$10 Off',
      points_required: 200,
      discount_type: 'fixed_amount',
      discount_value: 10,
      minimum_purchase: 25,
      min_tier: 'bronze',
    },
    {
      slug: '15-off',
      name: '$15 Off',
      points_required: 300,
      discount_type: 'fixed_amount',
      discount_value: 15,
      minimum_purchase: 30,
      min_tier: 'bronze',
    },
    {
      slug: '20-off',
      name: '$20 Off',
      points_required: 400,
      discount_type: 'fixed_amount',
      discount_value: 20,
      minimum_purchase: 40,
      min_tier: 'bronze',
    },
    {
      slug: '25-off',
      name: '$25 Off',
      points_required: 500,
      discount_type: 'fixed_amount',
      discount_value: 25,
      minimum_purchase: 50,
      min_tier: 'bronze',
    },
  ],
  referral: { referrer_points: 500, referee_discount: 10, code_prefix: 'REF-' },
}

const COUNT_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
] as const

export type RewardCard = {
  name: string
  points: number
  minPurchase: string
  tier: string | null
}

type LoadRewardsConfigOptions = {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  url?: string
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function formatEarnRate(multiplier: number): string {
  return `${formatNumber(multiplier)}x`
}

/** Comparison-table spend cell. $0 has no plus; every other tier is "$500+". */
export function formatQualifyingSpendCell(amount: number): string {
  if (amount === 0) return '$0'
  return `$${formatNumber(amount)}+`
}

export function exampleEarnPoints(
  orderDollars: number,
  pointsPerDollar: number,
  multiplier: number
): number {
  return Math.round(orderDollars * pointsPerDollar * multiplier)
}

export function tierByKey(config: RewardsConfig, key: string): RewardsTier {
  const tier = config.tiers.find((item) => item.key === key) ?? config.tiers[0]
  if (!tier) throw new Error('[rewards] config has no tiers')
  return tier
}

export function tierNote(config: RewardsConfig, minTier: string | null | undefined): string | null {
  if (!minTier || minTier === 'bronze') return null
  const label = config.tiers.find((tier) => tier.key === minTier)?.label ?? minTier
  if (minTier === 'gold') return `${label} only`
  return `${label}+`
}

export function mapRewardCards(config: RewardsConfig): RewardCard[] {
  return config.rewards.map((reward) => ({
    name: reward.name,
    points: reward.points_required,
    minPurchase: reward.minimum_purchase ? `$${reward.minimum_purchase}` : 'None',
    tier: tierNote(config, reward.min_tier),
  }))
}

export function rewardsMenuLead(config: RewardsConfig): string {
  const count = config.rewards.length
  const word = COUNT_WORDS[count]
  const label = word ? word.charAt(0).toUpperCase() + word.slice(1) : String(count)
  const starting = Math.min(...config.rewards.map((reward) => reward.points_required))
  return `${label} dollar-off rewards, starting at ${formatNumber(starting)} points.`
}

export function fixedDiscountDollars(reward: RewardsReward): number | null {
  if (reward.discount_type === 'percentage') return null
  if (typeof reward.discount_value === 'number') return reward.discount_value
  const match = /^\$(\d+(?:\.\d+)?)/.exec(reward.name.trim())
  return match ? Number(match[1]) : null
}

/** Largest fixed-dollar reward the point balance can buy. */
export function bestAffordableFixedReward(
  rewards: RewardsReward[],
  points: number
): RewardsReward | null {
  let best: RewardsReward | null = null
  let bestDollars = -1
  for (const reward of rewards) {
    if (reward.points_required > points) continue
    const dollars = fixedDiscountDollars(reward)
    if (dollars == null) continue
    const closer =
      best != null && dollars === bestDollars && reward.points_required > best.points_required
    if (dollars > bestDollars || closer) {
      best = reward
      bestDollars = dollars
    }
  }
  return best
}

function rewardOfferLabel(reward: RewardsReward): string {
  const dollars = fixedDiscountDollars(reward)
  if (dollars == null) return reward.name
  return `$${formatNumber(dollars)} off`
}

/**
 * "Refer 10 friends and earn 5,000 bonus points — that's $25+ in rewards."
 * Points are friend-count × referrer points. The dollar figure is the best
 * fixed reward those points can buy. "+" stays when points are left over,
 * which is how the old sentence used "$25+".
 */
export function referralTenFriendsClause(
  config: RewardsConfig,
  friends = REFERRAL_EXAMPLE_FRIENDS
): string {
  const points = friends * config.referral.referrer_points
  const best = bestAffordableFixedReward(config.rewards, points)
  const dollars = best ? fixedDiscountDollars(best) : null
  if (!best || dollars == null) {
    return `Refer ${friends} friends and earn ${formatNumber(points)} bonus points.`
  }
  const plus = points > best.points_required ? '+' : ''
  return `Refer ${friends} friends and earn ${formatNumber(points)} bonus points — that's $${formatNumber(dollars)}${plus} in rewards.`
}

/** "500 points redeems for $25 off (min $50 order)." */
export function referralRedemptionClause(config: RewardsConfig): string {
  const points = config.referral.referrer_points
  const best = bestAffordableFixedReward(config.rewards, points)
  if (!best) return ''
  const dollars = fixedDiscountDollars(best)
  if (dollars == null) return ''
  const min = best.minimum_purchase
  const offer = min
    ? `$${formatNumber(dollars)} off (min $${formatNumber(min)} order)`
    : `$${formatNumber(dollars)} off your next order`
  return `${formatNumber(points)} points redeems for ${offer}.`
}

/**
 * "Refer two friends and you've earned enough for …" when some reward costs
 * more than one referral. Returns null when one referral already covers every
 * reward (true of the current catalog — there is no free-shipping rung).
 */
export function referralsToNextRewardSentence(config: RewardsConfig): string | null {
  const perReferral = config.referral.referrer_points
  if (!Number.isFinite(perReferral) || perReferral <= 0) return null

  const next = config.rewards
    .filter((reward) => reward.points_required > perReferral)
    .map((reward) => ({
      reward,
      referrals: Math.ceil(reward.points_required / perReferral),
    }))
    .filter((candidate) => candidate.referrals >= 2)
    .sort(
      (a, b) => a.referrals - b.referrals || a.reward.points_required - b.reward.points_required
    )[0]

  if (!next) return null
  const word = COUNT_WORDS[next.referrals] ?? String(next.referrals)
  const noun = next.referrals === 1 ? 'friend' : 'friends'
  return `Refer ${word} ${noun} and you've earned enough for ${rewardOfferLabel(next.reward)} (${formatNumber(next.reward.points_required)} points).`
}

export function referralWhatCanIDoBody(config: RewardsConfig): string {
  const redemption = referralRedemptionClause(config)
  const next = referralsToNextRewardSentence(config)
  if (redemption && next) return `${redemption} ${next}`
  return redemption || next || ''
}

function rewardKnowledgeLine(config: RewardsConfig, reward: RewardsReward): string {
  const notes: string[] = []
  if (reward.minimum_purchase) notes.push(`min $${formatNumber(reward.minimum_purchase)} order`)
  const tier = tierNote(config, reward.min_tier)
  if (tier) notes.push(tier.endsWith('only') ? tier : `${tier} tier`)
  const detail = notes.length > 0 ? notes.join(', ') : 'any order'
  return `- ${reward.name}: ${formatNumber(reward.points_required)} points (${detail})`
}

function tierKnowledgeLine(tier: RewardsTier): string {
  const bonus = tier.upgrade_bonus_points
    ? ` Upgrade bonus: ${formatNumber(tier.upgrade_bonus_points)} points.`
    : ''
  return `- ${tier.label}: $${formatNumber(tier.qualifying_spend)}+ spent. ${formatEarnRate(tier.earn_multiplier)} earn rate.${bonus}`
}

/** Chatbot knowledge for page:rewards. Numbers come only from config. */
export function buildRewardsKnowledge(config: RewardsConfig): string {
  const pointsPerDollar = config.earn.points_per_dollar
  const pointWord = pointsPerDollar === 1 ? 'point' : 'points'
  const tierRates = config.tiers
    .map((tier) => `${tier.label} ${formatEarnRate(tier.earn_multiplier)}`)
    .join(', ')

  const referralLines = [
    '- Share your unique referral code with friends',
    `- New customer gets $${formatNumber(config.referral.referee_discount)} off their first order`,
    `- You earn ${formatNumber(config.referral.referrer_points)} bonus points`,
  ]
  if (config.referral.code_prefix) {
    referralLines.push(`- Referral codes start with ${config.referral.code_prefix} prefix`)
  }

  return [
    'Loyalty Rewards Program — Earn points on every order. Redeem for dollar-off discounts and VIP perks.',
    '',
    'How to Earn Points:',
    `- Earn ${formatNumber(pointsPerDollar)} ${pointWord} per $1 spent on every order (after discounts, before shipping)`,
    `- Points multiplied by tier: ${tierRates}`,
    '',
    'VIP Tiers:',
    ...config.tiers.map(tierKnowledgeLine),
    '',
    'Available Rewards:',
    ...config.rewards.map((reward) => rewardKnowledgeLine(config, reward)),
    '',
    'Referral Program:',
    ...referralLines,
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
}

function hasRewards(value: unknown): value is RewardsConfig {
  if (!value || typeof value !== 'object') return false
  const rewards = (value as RewardsConfig).rewards
  return Array.isArray(rewards) && rewards.length > 0
}

export async function loadRewardsConfig(
  options: LoadRewardsConfigOptions = {}
): Promise<RewardsConfig> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS
  const url = options.url ?? REWARDS_CONFIG_URL
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) {
      console.warn(`[rewards] config HTTP ${res.status} — using fallback`)
      return FALLBACK_REWARDS_CONFIG
    }
    const live: unknown = await res.json()
    if (hasRewards(live)) return live
    console.warn('[rewards] config returned no rewards — using fallback')
    return FALLBACK_REWARDS_CONFIG
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('[rewards] config unreachable — using fallback:', message)
    return FALLBACK_REWARDS_CONFIG
  }
}
