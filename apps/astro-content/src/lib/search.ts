/**
 * Semantic Search Utilities
 *
 * Combines OpenAI embeddings with Supabase vector search to provide
 * intent-aware search across content and products.
 */

import { generateEmbedding } from './embeddings'
import { supabase, type WebsiteContent, type Product } from './supabase'

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

/**
 * Perform semantic search across content and products
 */
export async function semanticSearch(
  query: string,
  options: {
    contentTypes?: string[]
    matchThreshold?: number
    maxContentResults?: number
    maxProductResults?: number
  } = {}
): Promise<SearchResponse> {
  const {
    contentTypes = ['blog', 'page', 'faq', 'guide'],
    matchThreshold = 0.65,
    maxContentResults = 5,
    maxProductResults = 3,
  } = options

  // Generate unique search ID for tracking
  const searchId = `search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  if (!supabase) {
    console.warn('Supabase not configured - returning empty search results')
    return {
      query,
      results: [],
      content: [],
      products: [],
      totalCount: 0,
      searchId,
    }
  }

  try {
    // Generate embedding for the search query
    const embedding = await generateEmbedding(query)

    // Search content and products in parallel
    const [contentResults, productResults] = await Promise.all([
      searchContent(embedding, contentTypes, matchThreshold, maxContentResults),
      searchProducts(embedding, matchThreshold, maxProductResults),
    ])

    // Combine and sort by similarity
    const allResults = [...contentResults, ...productResults].sort(
      (a, b) => b.similarity - a.similarity
    )

    return {
      query,
      results: allResults,
      content: contentResults,
      products: productResults,
      totalCount: allResults.length,
      searchId,
    }
  } catch (error) {
    console.error('Semantic search failed:', error)
    return {
      query,
      results: [],
      content: [],
      products: [],
      totalCount: 0,
      searchId,
    }
  }
}

/**
 * Search website content using vector similarity
 */
async function searchContent(
  embedding: number[],
  pageTypes: string[],
  matchThreshold: number,
  matchCount: number
): Promise<SearchResult[]> {
  if (!supabase) return []

  try {
    const { data, error } = await supabase.rpc('search_website_content', {
      query_embedding: embedding,
      page_types: pageTypes,
      match_threshold: matchThreshold,
      match_count: matchCount,
    })

    if (error) {
      console.error('Content search error:', error)
      return []
    }

    return (data || []).map((item: WebsiteContent & { similarity: number }) => ({
      type: 'content' as const,
      id: item.id,
      title: item.title,
      description: item.description || item.content_text?.slice(0, 200) || '',
      url: item.url,
      similarity: item.similarity,
      pageType: item.page_type,
      segment: item.segment || undefined,
    }))
  } catch (err) {
    console.error('Content search failed:', err)
    return []
  }
}

/**
 * Search products using vector similarity
 */
async function searchProducts(
  embedding: number[],
  matchThreshold: number,
  matchCount: number
): Promise<SearchResult[]> {
  if (!supabase) return []

  try {
    const { data, error } = await supabase.rpc('find_products_for_content', {
      content_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    })

    if (error) {
      console.error('Product search error:', error)
      return []
    }

    return (data || []).map((item: Product & { similarity: number }) => ({
      type: 'product' as const,
      id: item.id,
      title: item.name,
      description: item.description || '',
      url: item.url,
      imageUrl: item.image_url || undefined,
      similarity: item.similarity,
      segment: item.segment,
    }))
  } catch (err) {
    console.error('Product search failed:', err)
    return []
  }
}

/**
 * Get search suggestions based on partial query
 * (For future autocomplete - currently returns empty)
 */
export async function getSearchSuggestions(query: string): Promise<string[]> {
  // TODO: Implement with popular queries or content titles
  return []
}
