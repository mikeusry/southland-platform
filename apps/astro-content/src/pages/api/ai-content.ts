/**
 * Comprehensive Site Content API for AI Indexing
 *
 * GET /api/ai-content
 *
 * Returns ALL content from the Astro site in NexusSOP-compatible format:
 * - 24 product MDX files (dosing, FAQs, testimonials, proof stats)
 * - 18 shop collections (per-segment FAQs, hero copy)
 * - 26 topic taxonomy pages
 * - 6 podcast episodes
 * - 11 team members
 * - Key pages (rewards, about, shipping)
 *
 * This is the "whole site scrape" that makes the chatbot match aissist.io quality.
 * Called by Nexus reindex-ai cron daily at 3 AM ET.
 */

import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'

const SITE_URL = 'https://southlandorganics.com'

interface ContentItem {
  id: string
  slug: string
  title: string
  content: string
  category: string
  tags: string[]
  business_unit: string
  answer_type: 'factual' | 'procedural' | 'policy' | 'comparison'
  url: string
  tenant: string
  support_relevant: boolean
  word_count: number
  updated_at: string
}

function inferBU(segment: string, tags: string[], text: string): string {
  const all = `${segment} ${tags.join(' ')} ${text}`.toLowerCase()
  if (
    all.includes('poultry') ||
    all.includes('chicken') ||
    all.includes('broiler') ||
    all.includes('layer')
  )
    return 'poultry'
  if (
    all.includes('turf') ||
    all.includes('lawn') ||
    all.includes('garden') ||
    all.includes('golf')
  )
    return 'turf'
  if (all.includes('septic') || all.includes('waste') || all.includes('port')) return 'agriculture'
  if (all.includes('sanitiz') || all.includes('d2') || all.includes('alpet')) return 'ancillary'
  if (all.includes('swine') || all.includes('pig') || all.includes('cattle')) return 'agriculture'
  return 'general'
}

export const GET: APIRoute = async () => {
  const items: ContentItem[] = []
  const now = new Date().toISOString()

  // ─── 1. Products (24 rich MDX files) ──────────────────────────────────
  const products = await getCollection('products')
  for (const product of products) {
    const d = product.data as Record<string, unknown>
    const parts: string[] = []

    // Core info
    parts.push(`Product: ${d.name}`)
    if (d.shortDescription) parts.push(String(d.shortDescription))
    if (d.headline) parts.push(String(d.headline))

    // Hero bullets
    if (Array.isArray(d.heroBullets)) {
      parts.push('Key Benefits:')
      for (const b of d.heroBullets) parts.push(`- ${b}`)
    }

    // Benefits
    if (Array.isArray(d.benefits)) {
      for (const b of d.benefits) parts.push(`- ${b}`)
    }

    // Use cases
    if (Array.isArray(d.useCases)) {
      parts.push('Best for:')
      for (const u of d.useCases) parts.push(`- ${u}`)
    }

    // Dosing instructions (CRITICAL for chatbot)
    if (d.dosingInstructions) {
      parts.push('\nApplication Instructions:')
      parts.push(String(d.dosingInstructions))
    }
    if (d.applicationMethod) {
      parts.push(`Application method: ${d.applicationMethod}`)
    }

    // Features + benefits
    if (Array.isArray(d.features)) {
      parts.push('\nFeatures:')
      for (const f of d.features as Array<{ feature: string; benefit: string }>) {
        parts.push(`- ${f.feature}: ${f.benefit}`)
      }
    }

    // Problem cards (PAS framework)
    if (Array.isArray(d.problemCards)) {
      parts.push('\nCommon Problems This Solves:')
      for (const p of d.problemCards as Array<{ title: string; body: string }>) {
        parts.push(`- ${p.title}: ${p.body}`)
      }
    }

    // Proof stats
    if (Array.isArray(d.proofStats)) {
      parts.push('\nProven Results:')
      for (const s of d.proofStats as Array<{ value: string; label: string; source?: string }>) {
        parts.push(`- ${s.value} ${s.label}${s.source ? ` (${s.source})` : ''}`)
      }
    }

    // Testimonials
    if (Array.isArray(d.testimonials)) {
      parts.push('\nCustomer Testimonials:')
      for (const t of d.testimonials as Array<{ quote: string; name: string; role: string }>) {
        parts.push(`"${t.quote}" — ${t.name}, ${t.role}`)
      }
    }

    // FAQ (CRITICAL for chatbot)
    if (Array.isArray(d.faq)) {
      parts.push('\nFrequently Asked Questions:')
      for (const f of d.faq as Array<{ question: string; answer: string }>) {
        parts.push(`Q: ${f.question}`)
        parts.push(`A: ${f.answer}`)
      }
    }

    // Trust badges
    if (Array.isArray(d.trustBadges)) {
      parts.push(`\nTrust: ${(d.trustBadges as string[]).join(', ')}`)
    }

    // Body content
    if (product.body) {
      parts.push('\n' + product.body)
    }

    const content = parts.join('\n')
    const segment = String(d.segment || 'general')
    const tags = Array.isArray(d.topics) ? (d.topics as string[]) : []

    items.push({
      id: `product-mdx:${product.id}`,
      slug: product.id,
      title: String(d.name),
      content,
      category: segment,
      tags: [...tags, segment, 'product'],
      business_unit: inferBU(segment, tags, content),
      answer_type: 'factual',
      url: `${SITE_URL}/products/${d.shopifyHandle || product.id}`,
      tenant: 'southland',
      support_relevant: true,
      word_count: content.split(/\s+/).length,
      updated_at: now,
    })
  }

  // ─── 2. Shop Collections (18 with FAQs) ──────────────────────────────
  const collections = await getCollection('shopCollections')
  for (const coll of collections) {
    const d = coll.data as Record<string, unknown>
    const parts: string[] = []

    parts.push(`Collection: ${d.title}`)
    if (d.heroHeadline) parts.push(String(d.heroHeadline))
    if (d.heroSubheadline) parts.push(String(d.heroSubheadline))
    if (d.seoDescription) parts.push(String(d.seoDescription))

    // Collection FAQs (rich, expert-level content)
    if (Array.isArray(d.faq)) {
      parts.push('\nFrequently Asked Questions:')
      for (const f of d.faq as Array<{ question: string; answer: string }>) {
        parts.push(`Q: ${f.question}`)
        parts.push(`A: ${f.answer}`)
      }
    }

    if (coll.body) parts.push('\n' + coll.body)

    const content = parts.join('\n')
    const persona = String(d.persona || 'general')

    items.push({
      id: `collection:${coll.id}`,
      slug: coll.id,
      title: String(d.title),
      content,
      category: persona,
      tags: [persona, 'collection', String(d.handle || coll.id)],
      business_unit: inferBU(persona, [], content),
      answer_type: 'factual',
      url: `${SITE_URL}/collections/${d.handle || coll.id}`,
      tenant: 'southland',
      support_relevant: true,
      word_count: content.split(/\s+/).length,
      updated_at: now,
    })
  }

  // ─── 3. Topics (26 taxonomy pages) ────────────────────────────────────
  const topics = await getCollection('topics')
  for (const topic of topics) {
    const d = topic.data as Record<string, unknown>
    const parts: string[] = []

    parts.push(`Topic: ${d.name}`)
    if (d.description) parts.push(String(d.description))
    if (d.metaDescription) parts.push(String(d.metaDescription))
    if (Array.isArray(d.keywords)) parts.push(`Keywords: ${(d.keywords as string[]).join(', ')}`)
    if (topic.body) parts.push('\n' + topic.body)

    const content = parts.join('\n')
    const segment = String(d.segment || 'general')

    items.push({
      id: `topic:${topic.id}`,
      slug: topic.id,
      title: String(d.name),
      content,
      category: segment,
      tags: [
        segment,
        'topic',
        ...(Array.isArray(d.relatedTopics) ? (d.relatedTopics as string[]) : []),
      ],
      business_unit: inferBU(segment, [], content),
      answer_type: 'factual',
      url: `${SITE_URL}/podcast/topics/${topic.id}`,
      tenant: 'southland',
      support_relevant: false,
      word_count: content.split(/\s+/).length,
      updated_at: now,
    })
  }

  // ─── 4. Podcast Episodes (6) ──────────────────────────────────────────
  const episodes = await getCollection('episodes', ({ data }) => !data.draft)
  for (const ep of episodes) {
    const d = ep.data as Record<string, unknown>
    const parts: string[] = []

    parts.push(`Podcast Episode ${d.episodeNumber}: ${d.title}`)
    if (d.description) parts.push(String(d.description))
    if (d.longDescription) parts.push(String(d.longDescription))
    if (d.hook) parts.push(String(d.hook))

    // Transcript excerpts
    if (Array.isArray(d.transcript)) {
      parts.push('\nTranscript excerpts:')
      for (const t of (d.transcript as Array<{ text: string }>).slice(0, 20)) {
        if (t.text) parts.push(t.text)
      }
    }

    // Guest info
    if (Array.isArray(d.guests)) {
      for (const g of d.guests as Array<{ name: string; role?: string; bio?: string }>) {
        parts.push(`Guest: ${g.name}${g.role ? ` — ${g.role}` : ''}`)
        if (g.bio) parts.push(g.bio)
      }
    }

    if (ep.body) parts.push('\n' + ep.body)

    const content = parts.join('\n')
    const tags = Array.isArray(d.topics) ? (d.topics as string[]) : []

    items.push({
      id: `episode:${ep.id}`,
      slug: ep.id,
      title: String(d.title),
      content,
      category: 'podcast',
      tags: [...tags, 'podcast', 'episode'],
      business_unit: inferBU('general', tags, content),
      answer_type: 'factual',
      url: `${SITE_URL}/podcast/${ep.id}`,
      tenant: 'southland',
      support_relevant: false,
      word_count: content.split(/\s+/).length,
      updated_at: now,
    })
  }

  // ─── 5. Team Members (11) ─────────────────────────────────────────────
  const team = await getCollection('team')
  for (const member of team) {
    const d = member.data as Record<string, unknown>
    if (d.active === false) continue

    const parts: string[] = []
    parts.push(`Team Member: ${d.name}`)
    if (d.role) parts.push(`Role: ${d.role}`)
    if (d.bio) parts.push(String(d.bio))
    if (Array.isArray(d.expertiseAreas))
      parts.push(`Expertise: ${(d.expertiseAreas as string[]).join(', ')}`)
    if (Array.isArray(d.credentials))
      parts.push(`Credentials: ${(d.credentials as string[]).join(', ')}`)
    if (d.email) parts.push(`Email: ${d.email}`)
    if (d.phone) parts.push(`Phone: ${d.phone}`)
    if (member.body) parts.push('\n' + member.body)

    const content = parts.join('\n')

    items.push({
      id: `team:${member.id}`,
      slug: member.id,
      title: `${d.name} — ${d.role || 'Team Member'}`,
      content,
      category: 'company',
      tags: ['team', 'about', 'contact'],
      business_unit: 'general',
      answer_type: 'factual',
      url: `${SITE_URL}/team/${member.id}`,
      tenant: 'southland',
      support_relevant: true,
      word_count: content.split(/\s+/).length,
      updated_at: now,
    })
  }

  // ─── 6. Key Static Pages (rewards, shipping, about) ────────────────────
  // These pages have hardcoded content in .astro files, not content collections.
  // Including them here ensures the chatbot can answer questions about rewards,
  // shipping, returns, and company info without relying on SOPs (which are
  // filtered from customer chat context).

  const staticPages: ContentItem[] = [
    {
      id: 'page:rewards',
      slug: 'rewards',
      title: 'Southland Organics Rewards Program',
      content: `Loyalty Rewards Program — Earn points on every order. Redeem for discounts, free shipping, and VIP perks.

How to Earn Points:
- Earn 1 point per $1 spent on every order (after discounts, before shipping)
- Points multiplied by tier: Bronze 1x, Silver 1.25x, Gold 1.5x

VIP Tiers:
- Bronze: Free, automatic. Basic rewards.
- Silver: $500+ lifetime spend. 1.25x multiplier, bonus rewards.
- Gold: $1,500+ lifetime spend. 1.5x multiplier, exclusive 15% off reward.

Available Rewards:
- $5 Off: 500 points (min $25 order)
- Free Shipping: 750 points (any order)
- $10 Off: 1,000 points (min $50 order)
- 10% Off: 1,500 points (min $50, Silver+ tier)
- 15% Off: 2,000 points (min $75, Gold only)
- $25 Off: 2,500 points (min $100, Silver+ tier)

Referral Program:
- Share your unique referral code with friends
- New customer gets $10 off their first order
- You earn 500 bonus points
- Referral codes start with REF- prefix

FAQ:
Q: Do points expire?
A: Points remain valid as long as you make at least one purchase per year.

Q: Can I use rewards with other discounts?
A: Only one discount code per order. Rewards cannot be stacked with other promo codes.

Q: How do I check my points balance?
A: Visit southlandorganics.com/rewards and enter your email address.`,
      category: 'general',
      tags: ['loyalty', 'rewards', 'points', 'referrals', 'VIP', 'discounts'],
      business_unit: 'general',
      answer_type: 'factual',
      url: `${SITE_URL}/rewards`,
      tenant: 'southland',
      support_relevant: true,
      word_count: 200,
      updated_at: now,
    },
    {
      id: 'page:shipping',
      slug: 'shipping-policy',
      title: 'Shipping & Returns Policy',
      content: `Shipping & Returns — Southland Organics

Shipping:
- Ships from Ringgold, Georgia
- Most orders ship within 1-2 business days
- Delivery: 3-5 business days via UPS or FedEx Ground
- Free shipping on orders over $99
- Large/heavy orders may ship LTL freight

Returns:
- 30-day return window for unopened products
- Opened or damaged items: contact us to discuss options
- Returns reviewed on case-by-case basis

How to Return:
1. Contact us at 800-608-3755 or success@southlandorganics.com
2. We provide return instructions and authorization
3. Ship product back to our warehouse
4. Refund processed within 5-7 business days

Damaged Products:
- Contact us immediately if product arrives damaged
- We ship a replacement at no cost
- No need to return the damaged item
- Take photos for our records

Refunds processed to original payment method within 5-7 business days.`,
      category: 'general',
      tags: ['shipping', 'returns', 'refunds', 'delivery', 'policy'],
      business_unit: 'general',
      answer_type: 'policy',
      url: `${SITE_URL}/contact`,
      tenant: 'southland',
      support_relevant: true,
      word_count: 150,
      updated_at: now,
    },
    {
      id: 'page:subscriptions',
      slug: 'subscriptions-info',
      title: 'Pour The Port Subscription — How It Works',
      content: `Pour The Port — Monthly Septic Tank Treatment Subscription

What It Is:
Pour The Port is a biological septic tank treatment delivered to your door. Monthly application keeps your septic system healthy by maintaining beneficial bacteria.

What's Included:
Each shipment includes four bottles: one quart and three 8-ounce bottles. Ships every four months (4-month supply per shipment).

Price: $28.00 per shipment (was $40.00 — subscription saves 30%)

How to Subscribe:
1. Visit southlandorganics.com/products/pour-the-port-septic-tank-treatment
2. Select the subscription option (not one-time purchase)
3. Add to cart and complete checkout
4. First shipment ships immediately, then every 4 months

How to Use PORT:
- Pour one 8-ounce bottle down any toilet or drain monthly
- Flush twice to move into the septic system
- Use the quart bottle for initial treatment
- Best applied in the evening when water usage is low

Managing Your Subscription:
- Skip a delivery: contact us, we push the next billing date
- Pause: we pause billing, resume anytime
- Cancel: permanent, cannot be undone — we recommend pausing instead
- Contact: 800-608-3755 or success@southlandorganics.com

Results:
- Reduced odors within 1-2 weeks
- Full microbial balance improvement in 1-3 months
- Works with all septic types: conventional, aerobic, mound

FAQ:
Q: Can I cancel anytime?
A: Yes. Cancellation is immediate and permanent. If you just need a break, pause instead.

Q: Can I get PORT without a subscription?
A: PORT is subscription-only because consistent monthly use is key to septic health.

Q: Is PORT safe for all septic systems?
A: Yes — works with all types including conventional, aerobic, and mound systems.`,
      category: 'agriculture',
      tags: ['subscriptions', 'pour-the-port', 'septic', 'recurring', 'billing'],
      business_unit: 'agriculture',
      answer_type: 'factual',
      url: `${SITE_URL}/products/pour-the-port-septic-tank-treatment`,
      tenant: 'southland',
      support_relevant: true,
      word_count: 250,
      updated_at: now,
    },
  ]

  items.push(...staticPages)

  // Use 'sops' key for compatibility with worker's /index/sops handler
  return new Response(JSON.stringify({ sops: items, count: items.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
