/**
 * Search Utilities
 *
 * Text-based search against crawled website_content in Supabase.
 * Falls back gracefully if Supabase is not configured.
 */

import { supabase } from './supabase'

export interface SearchResult {
  type: 'content' | 'product'
  id: string
  title: string
  description: string
  url: string
  imageUrl?: string
  similarity: number
  pageType?: string
  segment?: string
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  content: SearchResult[]
  products: SearchResult[]
  totalCount: number
  searchId: string
}

const EMPTY_RESPONSE = (query: string, searchId: string): SearchResponse => ({
  query,
  results: [],
  content: [],
  products: [],
  totalCount: 0,
  searchId,
})

/**
 * Search crawled website content using Postgres full-text search + ilike fallback
 */
export async function semanticSearch(
  query: string,
  options: { maxContentResults?: number } = {}
): Promise<SearchResponse> {
  const { maxContentResults = 10 } = options
  const searchId = `search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  if (!supabase) {
    console.warn('Supabase not configured — returning empty search results')
    return EMPTY_RESPONSE(query, searchId)
  }

  try {
    // 1. Try Postgres full-text search first (handles stemming, ranking)
    const { data: ftsData, error: ftsError } = await supabase
      .from('website_content')
      .select('id, title, h1, meta_description, url, url_path, page_type')
      .textSearch('title', query, { type: 'plain' })
      .not('title', 'is', null)
      .limit(maxContentResults)

    let results = ftsData || []

    // 2. If FTS returns too few, supplement with ilike on title + h1 + meta_description
    if (results.length < maxContentResults) {
      const words = query
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .map((w) => w.replace(/[%_]/g, ''))
      if (words.length > 0) {
        const existingIds = new Set(results.map((r) => r.id))
        const orClauses = words.flatMap((w) => [
          `title.ilike.%${w}%`,
          `h1.ilike.%${w}%`,
          `meta_description.ilike.%${w}%`,
        ])

        const { data: ilikeData } = await supabase
          .from('website_content')
          .select('id, title, h1, meta_description, url, url_path, page_type')
          .or(orClauses.join(','))
          .not('title', 'is', null)
          .limit(maxContentResults * 2)

        if (ilikeData) {
          for (const row of ilikeData) {
            if (!existingIds.has(row.id) && results.length < maxContentResults) {
              results.push(row)
              existingIds.add(row.id)
            }
          }
        }
      }
    }

    // Deduplicate by url_path (crawls may have duplicates)
    const seen = new Set<string>()
    results = results.filter((r) => {
      const key = r.url_path || r.url || r.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const contentResults: SearchResult[] = results.map((item) => ({
      type: 'content' as const,
      id: item.id,
      title: cleanTitle(item.h1 || item.title || ''),
      description: item.meta_description || '',
      url: rewriteUrl(item.url_path || item.url || ''),
      similarity: 1,
      pageType: formatPageType(item.page_type),
    }))

    return {
      query,
      results: contentResults,
      content: contentResults,
      products: [],
      totalCount: contentResults.length,
      searchId,
    }
  } catch (error) {
    console.error('Search failed:', error)
    return EMPTY_RESPONSE(query, searchId)
  }
}

/** Strip " - Southland Organics" suffix from crawled titles */
function cleanTitle(title: string): string {
  return title.replace(/\s*[-–|]\s*Southland Organics\s*$/i, '').trim()
}

/** Rewrite old Shopify URLs to current Astro routes */
function rewriteUrl(url: string): string {
  return url
    .replace(/^https?:\/\/[^/]+/, '') // strip domain
    .replace(/^\/blogs\/news\//, '/blog/') // /blogs/news/slug → /blog/slug
    .replace(/^\/pages\//, '/') // /pages/about-us → /about-us
}

/** Humanize page_type for display */
function formatPageType(pt: string | null): string {
  if (!pt) return 'Page'
  const map: Record<string, string> = {
    blog: 'Article',
    collection: 'Collection',
    product: 'Product',
    page: 'Page',
    homepage: 'Page',
  }
  return map[pt] || pt.charAt(0).toUpperCase() + pt.slice(1)
}
