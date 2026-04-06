/**
 * Sitemap Crawler for AI Indexing
 *
 * GET /api/ai-sitemap
 *
 * Crawls the site's sitemap, fetches each page's rendered HTML, extracts
 * text content, and returns it in NexusSOP-compatible format for AI indexing.
 *
 * This ensures EVERY page on the site is in the AI knowledge base —
 * including static .astro pages that aren't in content collections.
 *
 * Skips pages already covered by /api/ai-content and /api/ai-blog:
 * - /blog/* (handled by ai-blog)
 * - /products/* (handled by ai-content)
 * - /podcast/* (handled by ai-content)
 * - /team/* (handled by ai-content)
 * - /collections/* (handled by ai-content)
 * - /cart, /search, /account (utility pages, no useful content)
 * - /admin/* (internal)
 *
 * Called by Nexus reindex-ai cron daily at 3 AM ET.
 */

import type { APIRoute } from 'astro'

const SITE_URL = 'https://southlandorganics.com'

// Pages already indexed by other endpoints or not useful for AI
const SKIP_PREFIXES = [
  '/blog',
  '/products',
  '/podcast',
  '/team',
  '/collections',
  '/cart',
  '/search',
  '/account',
  '/admin',
  '/api/',
  '/survey',
]

// Pages to skip entirely (utility, no content value)
const SKIP_EXACT = new Set(['/', '/cart/', '/search/', '/account/'])

interface PageItem {
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

function inferCategory(path: string): { category: string; bu: string; tags: string[] } {
  const lower = path.toLowerCase()
  if (lower.includes('/poultry'))
    return { category: 'poultry', bu: 'poultry', tags: ['poultry', 'landing-page'] }
  if (lower.includes('/lawn') || lower.includes('/turf'))
    return { category: 'lawn', bu: 'turf', tags: ['lawn', 'landing-page'] }
  if (lower.includes('/agriculture') || lower.includes('/livestock'))
    return { category: 'agriculture', bu: 'agriculture', tags: ['agriculture', 'landing-page'] }
  if (lower.includes('/distribution') || lower.includes('/hydroseed'))
    return { category: 'wholesale', bu: 'general', tags: ['wholesale', 'distribution'] }
  if (lower.includes('/tools') || lower.includes('/calculator'))
    return { category: 'tools', bu: 'general', tags: ['tools', 'calculator'] }
  if (lower.includes('/rewards'))
    return { category: 'loyalty', bu: 'general', tags: ['rewards', 'loyalty'] }
  if (lower.includes('/about') || lower.includes('/contact'))
    return { category: 'company', bu: 'general', tags: ['company', 'about'] }
  return { category: 'general', bu: 'general', tags: ['page'] }
}

/**
 * Extract meaningful text content from rendered HTML.
 * Strips scripts, styles, nav, footer, and returns clean text.
 */
function extractText(html: string): { title: string; text: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is)
  const title = titleMatch
    ? titleMatch[1]
        .replace(/\s*\|.*$/, '')
        .replace(/\s*[–—-]\s*Southland.*$/i, '')
        .trim()
    : 'Untitled'

  // Remove script, style, nav, header, footer tags and their content
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')

  // Remove HTML tags but keep text
  cleaned = cleaned.replace(/<[^>]+>/g, ' ')

  // Clean up whitespace and decode entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Remove very short content (likely just nav remnants)
  if (cleaned.length < 100) return { title, text: '' }

  return { title, text: cleaned }
}

export const GET: APIRoute = async () => {
  const items: PageItem[] = []
  const now = new Date().toISOString()

  try {
    // Step 1: Fetch sitemap
    const sitemapIndexRes = await fetch(`${SITE_URL}/sitemap-index.xml`)
    const sitemapIndexXml = await sitemapIndexRes.text()

    // Extract child sitemap URLs
    const sitemapUrls = [...sitemapIndexXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])

    // Step 2: Fetch each child sitemap and collect page URLs
    const pageUrls: string[] = []
    for (const sitemapUrl of sitemapUrls) {
      const res = await fetch(sitemapUrl)
      const xml = await res.text()
      const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
      pageUrls.push(...urls)
    }

    // Step 3: Filter to pages not covered by other endpoints
    const pagesToCrawl = pageUrls.filter((url) => {
      const path = url.replace(SITE_URL, '')
      if (SKIP_EXACT.has(path) || SKIP_EXACT.has(path + '/')) return false
      return !SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))
    })

    // Step 4: Fetch and extract text from each page (in batches to avoid overwhelming)
    const BATCH_SIZE = 5
    for (let i = 0; i < pagesToCrawl.length; i += BATCH_SIZE) {
      const batch = pagesToCrawl.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'SouthlandAI-Indexer/1.0' },
          })
          if (!res.ok) return null
          const html = await res.text()
          const { title, text } = extractText(html)
          if (!text || text.length < 100) return null

          const path = url.replace(SITE_URL, '')
          const { category, bu, tags } = inferCategory(path)

          return {
            id: `page:${path.replace(/\//g, '-').replace(/^-|-$/g, '') || 'home'}`,
            slug: path.replace(/\//g, '-').replace(/^-|-$/g, '') || 'home',
            title,
            content: `Page: ${title}\nURL: ${url}\n\n${text}`,
            category,
            tags,
            business_unit: bu,
            answer_type: 'factual' as const,
            url: path || '/',
            tenant: 'southland',
            support_relevant: true,
            word_count: text.split(/\s+/).length,
            updated_at: now,
          } satisfies PageItem
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          items.push(result.value)
        }
      }
    }
  } catch (err) {
    console.error('Sitemap crawl error:', err)
  }

  return new Response(JSON.stringify({ sops: items, count: items.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
