/**
 * Search Utilities
 *
 * Searches blog content collection + Shopify products using text matching.
 * No external dependencies — uses Astro's content collections directly.
 */

import { getCollection } from 'astro:content'
import {
  createClient,
  getAllProducts,
} from '@southland/shopify-storefront'

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
 * Search blog posts and products by text matching
 */
export async function semanticSearch(
  query: string,
  options: { maxContentResults?: number; maxProductResults?: number } = {}
): Promise<SearchResponse> {
  const { maxContentResults = 8, maxProductResults = 4 } = options
  const searchId = `search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  if (!query.trim()) return EMPTY_RESPONSE(query, searchId)

  try {
    const [contentResults, productResults] = await Promise.all([
      searchBlogContent(query, maxContentResults),
      searchProducts(query, maxProductResults),
    ])

    const allResults = [...contentResults, ...productResults]

    return {
      query,
      results: allResults,
      content: contentResults,
      products: productResults,
      totalCount: allResults.length,
      searchId,
    }
  } catch (error) {
    console.error('Search failed:', error)
    return EMPTY_RESPONSE(query, searchId)
  }
}

/**
 * Search blog posts from the content collection
 */
async function searchBlogContent(
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  const posts = await getCollection('blog')
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1)

  const scored = posts
    .map((post) => {
      const title = (post.data.title || '').toLowerCase()
      const desc = (post.data.description || '').toLowerCase()
      const tags = (post.data.tags || []).join(' ').toLowerCase()
      const body = post.body?.toLowerCase() || ''

      let score = 0

      // Full query match in title (highest weight)
      if (title.includes(query.toLowerCase())) score += 10

      // Individual term matches
      for (const term of terms) {
        if (title.includes(term)) score += 5
        if (desc.includes(term)) score += 3
        if (tags.includes(term)) score += 2
        if (body.includes(term)) score += 1
      }

      return { post, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)

  return scored.map((s) => ({
    type: 'content' as const,
    id: s.post.id,
    title: s.post.data.title || s.post.id,
    description: s.post.data.description || '',
    url: `/blog/${s.post.id.replace(/\.mdx?$/, '')}/`,
    similarity: s.score / 10,
    pageType: 'Article',
  }))
}

/**
 * Search Shopify products by title/tags
 */
async function searchProducts(
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  try {
    const storeDomain = import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN
    const token = import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN
    if (!storeDomain || !token) return []

    const client = createClient({ storeDomain, publicAccessToken: token })
    const products = await getAllProducts(client)
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1)

    const scored = products
      .map((product) => {
        const title = product.title.toLowerCase()
        const tags = product.tags.join(' ').toLowerCase()
        const type = (product.productType || '').toLowerCase()

        let score = 0
        if (title.includes(query.toLowerCase())) score += 10
        for (const term of terms) {
          if (title.includes(term)) score += 5
          if (tags.includes(term)) score += 2
          if (type.includes(term)) score += 2
        }

        return { product, score }
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)

    return scored.map((s) => ({
      type: 'product' as const,
      id: s.product.id,
      title: s.product.title,
      description: '',
      url: `/products/${s.product.handle}/`,
      imageUrl: s.product.images[0]?.url || undefined,
      similarity: s.score / 10,
    }))
  } catch (err) {
    console.error('Product search failed:', err)
    return []
  }
}
