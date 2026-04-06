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

  // Use 'sops' key for compatibility with worker's /index/sops handler
  return new Response(JSON.stringify({ sops: items, count: items.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
