/**
 * Blog Content API for AI Indexing
 *
 * GET /api/ai-blog
 *
 * Returns all published blog posts in the NexusSOP-compatible format
 * expected by the AI Worker's /index/blog endpoint.
 *
 * Called by Nexus reindex-ai cron daily at 3 AM ET.
 */

import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'

const SITE_URL = 'https://southlandorganics.com'

function inferBusinessUnit(segment: string, tags: string[]): string {
  if (segment === 'poultry') return 'poultry'
  if (segment === 'turf') return 'turf'
  if (segment === 'agriculture') return 'agriculture'
  const tagStr = tags.join(' ').toLowerCase()
  if (tagStr.includes('poultry') || tagStr.includes('chicken') || tagStr.includes('broiler'))
    return 'poultry'
  if (tagStr.includes('lawn') || tagStr.includes('turf') || tagStr.includes('golf')) return 'turf'
  if (tagStr.includes('cattle') || tagStr.includes('swine') || tagStr.includes('dairy'))
    return 'agriculture'
  return 'general'
}

export const GET: APIRoute = async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft)

  const sops = posts.map((post) => {
    const segment = post.data.segment || 'general'
    const tags = [...(post.data.tags || []), ...(post.data.topics || [])]
    const bu = inferBusinessUnit(segment, tags)

    return {
      id: post.id,
      slug: post.id,
      title: post.data.title,
      content: post.body || post.data.description || '',
      category: segment,
      tags,
      business_unit: bu,
      answer_type: 'factual' as const,
      url: `${SITE_URL}/blog/${post.id}`,
      tenant: 'southland',
      support_relevant: true,
      word_count: (post.body || '').split(/\s+/).length,
      updated_at: (post.data.updatedDate || post.data.publishDate).toISOString(),
    }
  })

  return new Response(JSON.stringify({ sops, count: sops.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
