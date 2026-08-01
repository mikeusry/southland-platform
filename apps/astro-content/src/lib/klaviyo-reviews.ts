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
  /** Reviews with written text. Drives the "N reviews" label and JSON-LD reviewCount. */
  reviewCount: number
  /**
   * ALL 1-5 star submissions, including star-only ratings with no text.
   * schema.org draws this distinction on purpose: reviewCount counts written
   * reviews, ratingCount counts ratings. Star-only submissions are real
   * customer ratings and belong in the average and the histogram — they were
   * previously discarded by a `content.length > 1` filter meant to drop junk
   * entries like ".". Always >= reviewCount.
   */
  ratingCount: number
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

/**
 * Compute aggregate stats.
 *
 * Takes TWO sets on purpose:
 *   - `rated`   — every 1-5 star submission, text or not. Drives the average,
 *                 the histogram, and `ratingCount`.
 *   - `written` — the subset with review text. Drives `reviewCount`.
 *
 * Previously both came from one already-filtered array, so star-only ratings
 * were excluded from the average and the count. Questions (rating 0) are never
 * in either set.
 */
function computeAggregate(rated: KlaviyoReview[], written: KlaviyoReview[]): ReviewAggregate {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }

  let totalRating = 0
  let ratingCount = 0
  for (const r of rated) {
    if (r.rating >= 1 && r.rating <= 5) {
      distribution[r.rating as 1 | 2 | 3 | 4 | 5]++
      totalRating += r.rating
      ratingCount++
    }
  }

  const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    reviewCount: written.length,
    ratingCount,
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
export async function fetchProductReviews(
  shopifyGid: string,
  apiKeyOverride?: string
): Promise<ProductReviewData | null> {
  const apiKey = apiKeyOverride || import.meta.env.KLAVIYO_API_KEY
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

    // Every real 1-5 star submission — 'review' AND 'rating' (star-only, no text).
    // This is the set the average and histogram are computed over.
    const rated = allParsed.filter(
      (r) => r.reviewType !== 'question' && r.rating >= 1 && r.rating <= 5
    )

    // The subset with actual words — what gets RENDERED as cards. A star-only
    // rating counts toward the score but is not a card worth showing, and the
    // `length > 1` check still drops junk entries like ".".
    const reviews = rated.filter((r) => r.content.trim().length > 1)

    const questions = allParsed.filter((r) => r.reviewType === 'question' && r.publicReply)

    const aggregate = computeAggregate(rated, reviews)

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
  pageSize = 10,
  apiKeyOverride?: string
): Promise<{
  reviews: KlaviyoReview[]
  nextCursor: string | null
} | null> {
  const apiKey = apiKeyOverride || import.meta.env.KLAVIYO_API_KEY
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
export async function fetchAllAggregates(
  apiKeyOverride?: string
): Promise<Map<string, ReviewAggregate>> {
  if (_aggregateCache) return _aggregateCache

  const apiKey = apiKeyOverride || import.meta.env.KLAVIYO_API_KEY
  if (!apiKey) return new Map()

  try {
    // Collect all reviews across all products
    const reviewsByProduct = new Map<string, { ratings: number[]; written: number }>()
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
        // Count every 1-5 star submission, text or not — 'review' AND 'rating'
        // (star-only). Questions carry rating 0 and are excluded by the range check.
        if (!attrs || attrs.review_type === 'question') continue
        if (!(attrs.rating >= 1 && attrs.rating <= 5)) continue

        // Get the Klaviyo item ID and convert back to Shopify GID
        const klaviyoItemId = item.relationships?.item?.data?.id ?? ''
        const numericMatch = klaviyoItemId.match(/:::(\d+)$/)
        if (!numericMatch) continue

        const shopifyGid = `gid://shopify/Product/${numericMatch[1]}`
        if (!reviewsByProduct.has(shopifyGid)) {
          reviewsByProduct.set(shopifyGid, { ratings: [], written: 0 })
        }
        const bucket = reviewsByProduct.get(shopifyGid)!
        bucket.ratings.push(attrs.rating)
        // Track how many carry actual words, for reviewCount.
        if (typeof attrs.content === 'string' && attrs.content.trim().length > 1) {
          bucket.written++
        }
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
      const ratingCount = data.ratings.length
      aggregates.set(gid, {
        averageRating: ratingCount > 0 ? Math.round((total / ratingCount) * 10) / 10 : 0,
        reviewCount: data.written,
        ratingCount,
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
