/**
 * Klaviyo Reviews API client — server-side only.
 *
 * Fetches product reviews from Klaviyo Reviews API using the private API key.
 * Used at SSR time in [handle].astro to render reviews into PDP HTML.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface KlaviyoReview {
  id: string
  rating: number
  title: string | null
  content: string
  author: string
  verified: boolean
  createdAt: string
  images: Array<{ url: string }>
  smartQuote: string
  publicReply: { content: string; author: string } | null
  reviewType: 'review' | 'question' | 'rating'
}

export interface ReviewAggregate {
  averageRating: number
  reviewCount: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

export interface ProductReviewData {
  aggregate: ReviewAggregate
  reviews: KlaviyoReview[]
  questions: KlaviyoReview[]
  hasMore: boolean
  nextCursor: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert Shopify GID to Klaviyo catalog item ID.
 * `gid://shopify/Product/11285069007` → `$shopify:::$default:::11285069007`
 */
function shopifyGidToKlaviyoItemId(gid: string): string {
  const numericId = gid.split('/').pop()
  return `$shopify:::$default:::${numericId}`
}

/** Parse a single Klaviyo review API object into our clean type. */
function parseReview(item: any): KlaviyoReview | null {
  try {
    const attrs = item.attributes
    if (!attrs) return null

    return {
      id: item.id,
      rating: attrs.rating ?? 0,
      title: attrs.title || null,
      content: attrs.content ?? '',
      author: attrs.author ?? 'Anonymous',
      verified: attrs.verified ?? false,
      createdAt: attrs.created ?? '',
      images: Array.isArray(attrs.images)
        ? attrs.images.map((img: any) => ({
            url: typeof img === 'string' ? img : (img?.url ?? ''),
          }))
        : [],
      smartQuote: attrs.smart_quote ?? '',
      publicReply: attrs.public_reply
        ? {
            content: attrs.public_reply.content ?? '',
            author: attrs.public_reply.author ?? '',
          }
        : null,
      reviewType: attrs.review_type ?? 'review',
    }
  } catch {
    return null
  }
}

/** Compute aggregate stats from an array of reviews (review type only, not questions). */
function computeAggregate(reviews: KlaviyoReview[]): ReviewAggregate {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }

  let totalRating = 0
  for (const r of reviews) {
    if (r.rating >= 1 && r.rating <= 5) {
      distribution[r.rating as 1 | 2 | 3 | 4 | 5]++
      totalRating += r.rating
    }
  }

  const reviewCount = reviews.length
  const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    reviewCount,
    distribution,
  }
}

// ── Main fetch ─────────────────────────────────────────────────────────────

const KLAVIYO_API_BASE = 'https://a.klaviyo.com/api'
const REVISION = '2024-10-15'

/**
 * Fetch all published reviews for a product, then split into reviews + questions.
 * Fetches ALL pages to compute accurate aggregates (most products have <50 reviews).
 * Returns null on any failure — PDP renders without reviews.
 */
export async function fetchProductReviews(shopifyGid: string): Promise<ProductReviewData | null> {
  const apiKey = import.meta.env.KLAVIYO_API_KEY
  if (!apiKey) {
    console.warn('[klaviyo-reviews] KLAVIYO_API_KEY not set, skipping reviews')
    return null
  }

  const itemId = shopifyGidToKlaviyoItemId(shopifyGid)

  try {
    const allParsed: KlaviyoReview[] = []
    let nextUrl: string | null =
      `${KLAVIYO_API_BASE}/reviews/?filter=equals(item.id,"${itemId}")&sort=-created&page[size]=20`

    // Fetch all pages (most products have <50 reviews, so 1-3 pages max)
    while (nextUrl) {
      const response: Response = await fetch(nextUrl, {
        headers: {
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          revision: REVISION,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        console.error(`[klaviyo-reviews] API error: ${response.status} ${response.statusText}`)
        return null
      }

      const json: any = await response.json()
      const items = json?.data
      if (!Array.isArray(items)) break

      for (const item of items) {
        const parsed = parseReview(item)
        if (parsed) allParsed.push(parsed)
      }

      nextUrl = json?.links?.next ?? null
    }

    // Split: published reviews vs questions
    const reviews = allParsed.filter(
      (r) => r.reviewType === 'review' && r.rating >= 1 && r.content.length > 1 // Filter junk like "."
    )
    const questions = allParsed.filter((r) => r.reviewType === 'question' && r.publicReply)

    const aggregate = computeAggregate(reviews)

    return {
      aggregate,
      reviews,
      questions,
      hasMore: false, // We fetched all pages
      nextCursor: null,
    }
  } catch (err) {
    console.error('[klaviyo-reviews] Fetch failed:', err)
    return null
  }
}

/**
 * Fetch a single page of reviews (for API endpoint pagination).
 * Returns raw page data with cursor.
 */
export async function fetchReviewPage(
  shopifyGid: string,
  cursor?: string,
  pageSize = 10
): Promise<{
  reviews: KlaviyoReview[]
  nextCursor: string | null
} | null> {
  const apiKey = import.meta.env.KLAVIYO_API_KEY
  if (!apiKey) return null

  const itemId = shopifyGidToKlaviyoItemId(shopifyGid)

  try {
    let url = `${KLAVIYO_API_BASE}/reviews/?filter=equals(item.id,"${itemId}")&sort=-created&page[size]=${pageSize}`
    if (cursor) url += `&page[cursor]=${cursor}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: REVISION,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) return null

    const json = await response.json()
    const items = json?.data
    if (!Array.isArray(items)) return null

    const reviews = items
      .map(parseReview)
      .filter(
        (r): r is KlaviyoReview =>
          r !== null && r.reviewType === 'review' && r.rating >= 1 && r.content.length > 1
      )

    // Extract cursor from next URL
    let nextCursor: string | null = null
    const nextLink = json?.links?.next
    if (nextLink) {
      const match = nextLink.match(/page%5Bcursor%5D=([^&]+)/)
      if (match) nextCursor = decodeURIComponent(match[1])
    }

    return { reviews, nextCursor }
  } catch {
    return null
  }
}

// ── Batch aggregates (for collection pages) ────────────────────────────────

/** In-memory cache for aggregates — lives for the duration of one SSR request. */
let _aggregateCache: Map<string, ReviewAggregate> | null = null

/**
 * Fetch ALL published reviews and compute aggregates per product.
 * Returns a Map keyed by Shopify GID (e.g. "gid://shopify/Product/123").
 * Cached in memory so multiple components on the same page share one fetch.
 */
export async function fetchAllAggregates(): Promise<Map<string, ReviewAggregate>> {
  if (_aggregateCache) return _aggregateCache

  const apiKey = import.meta.env.KLAVIYO_API_KEY
  if (!apiKey) return new Map()

  try {
    // Collect all reviews across all products
    const reviewsByProduct = new Map<string, { ratings: number[] }>()
    let nextUrl: string | null =
      `${KLAVIYO_API_BASE}/reviews/?filter=equals(status,"published")&sort=-created&page[size]=20`

    while (nextUrl) {
      const response: Response = await fetch(nextUrl, {
        headers: {
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          revision: REVISION,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) break

      const json: any = await response.json()
      const items = json?.data
      if (!Array.isArray(items)) break

      for (const item of items) {
        const attrs = item.attributes
        if (!attrs || attrs.review_type !== 'review' || attrs.rating < 1) continue
        if (!attrs.content || attrs.content.length <= 1) continue

        // Get the Klaviyo item ID and convert back to Shopify GID
        const klaviyoItemId = item.relationships?.item?.data?.id ?? ''
        const numericMatch = klaviyoItemId.match(/:::(\d+)$/)
        if (!numericMatch) continue

        const shopifyGid = `gid://shopify/Product/${numericMatch[1]}`
        if (!reviewsByProduct.has(shopifyGid)) {
          reviewsByProduct.set(shopifyGid, { ratings: [] })
        }
        reviewsByProduct.get(shopifyGid)!.ratings.push(attrs.rating)
      }

      nextUrl = json?.links?.next ?? null
    }

    // Compute aggregates
    const aggregates = new Map<string, ReviewAggregate>()
    for (const [gid, data] of reviewsByProduct) {
      const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      }
      let total = 0
      for (const r of data.ratings) {
        if (r >= 1 && r <= 5) {
          distribution[r as 1 | 2 | 3 | 4 | 5]++
          total += r
        }
      }
      const count = data.ratings.length
      aggregates.set(gid, {
        averageRating: Math.round((total / count) * 10) / 10,
        reviewCount: count,
        distribution,
      })
    }

    _aggregateCache = aggregates
    return aggregates
  } catch (err) {
    console.error('[klaviyo-reviews] Batch fetch failed:', err)
    return new Map()
  }
}
