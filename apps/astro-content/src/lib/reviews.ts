/**
 * Product reviews client — first-party, reads from Nexus.
 *
 * This replaces `klaviyo-reviews.ts` as the PDP's data source. The exported
 * types and function signatures are deliberately IDENTICAL to that module, so
 * every consumer (ReviewsSection, ReviewCard, RatingHistogram, ReviewFilters,
 * CollectionProductCard, the JSON-LD builder) is untouched by the swap.
 *
 * Why the move:
 *   - Klaviyo's reviews API is READ-ONLY for us (PATCH → 403, missing
 *     `reviews:write`), so moderation decisions could never be written there.
 *     Nexus owns the corpus and the moderation queue; the storefront must read
 *     from the same place those decisions land, or moderating changes nothing.
 *   - Nexus returns ONLY `published` + `featured` rows. That is what makes the
 *     queue actually control what customers see.
 *   - Review photos are self-hosted (`/review-images/*.webp`). Klaviyo returned
 *     relative paths that 404'd, and its S3 bucket dies with the account.
 *
 * `klaviyo-reviews.ts` is intentionally left in place: reverting this cutover
 * is a one-line import change in [handle].astro, not a rewrite.
 *
 * Fails soft — returns null on any error so the PDP renders without reviews
 * rather than 500ing.
 */

// ── Types (identical shape to klaviyo-reviews.ts) ──────────────────────────

export interface ProductReview {
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
  /** Reviews with written text — drives the "N reviews" label and JSON-LD reviewCount. */
  reviewCount: number
  /** ALL 1-5 star submissions including star-only ratings — drives the average and histogram. */
  ratingCount: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

export interface ProductReviewData {
  aggregate: ReviewAggregate
  reviews: ProductReview[]
  questions: ProductReview[]
  hasMore: boolean
  nextCursor: string | null
}

// Alias so consumers importing the old name keep compiling during the cutover.
export type KlaviyoReview = ProductReview

// ── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_NEXUS_BASE = 'https://nexus.southlandorganics.com'
const TIMEOUT_MS = 5000

function nexusBase(): string {
  return import.meta.env.NEXUS_API_BASE || DEFAULT_NEXUS_BASE
}

/** `gid://shopify/Product/3827189317730` → `3827189317730` */
function numericShopifyId(gid: string): string {
  return gid.split('/').pop() ?? gid
}

const EMPTY_AGGREGATE: ReviewAggregate = {
  averageRating: 0,
  reviewCount: 0,
  ratingCount: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
}

// ── Fetch ──────────────────────────────────────────────────────────────────

/**
 * All published reviews + answered questions for one product.
 * Returns null on any failure — the PDP degrades to no reviews.
 */
export async function fetchProductReviews(
  shopifyGid: string,
  _unusedApiKey?: string
): Promise<ProductReviewData | null> {
  const productId = numericShopifyId(shopifyGid)

  try {
    const res = await fetch(
      `${nexusBase()}/api/public/reviews?shopify_product_id=${encodeURIComponent(productId)}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) }
    )

    if (!res.ok) {
      console.error(`[reviews] Nexus responded ${res.status} ${res.statusText}`)
      return null
    }

    const json: any = await res.json()
    if (!json?.aggregate) return null

    return {
      aggregate: {
        averageRating: json.aggregate.averageRating ?? 0,
        reviewCount: json.aggregate.reviewCount ?? 0,
        ratingCount: json.aggregate.ratingCount ?? 0,
        distribution: {
          1: json.aggregate.distribution?.['1'] ?? 0,
          2: json.aggregate.distribution?.['2'] ?? 0,
          3: json.aggregate.distribution?.['3'] ?? 0,
          4: json.aggregate.distribution?.['4'] ?? 0,
          5: json.aggregate.distribution?.['5'] ?? 0,
        },
      },
      reviews: (json.reviews ?? []) as ProductReview[],
      questions: (json.questions ?? []) as ProductReview[],
      hasMore: false,
      nextCursor: null,
    }
  } catch (err) {
    console.error('[reviews] Fetch failed:', err)
    return null
  }
}

/**
 * Per-product aggregates for collection pages, keyed by Shopify GID.
 * Cached per module instance for the lifetime of the SSR worker.
 */
let _aggregateCache: Map<string, ReviewAggregate> | null = null

export async function fetchAllAggregates(
  _unusedApiKey?: string
): Promise<Map<string, ReviewAggregate>> {
  if (_aggregateCache) return _aggregateCache

  try {
    const res = await fetch(`${nexusBase()}/api/public/reviews?aggregates=1`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      console.error(`[reviews] Aggregates responded ${res.status}`)
      return new Map()
    }

    const json: any = await res.json()
    const out = new Map<string, ReviewAggregate>()

    for (const [productId, agg] of Object.entries<any>(json.aggregates ?? {})) {
      out.set(`gid://shopify/Product/${productId}`, {
        averageRating: agg.averageRating ?? 0,
        reviewCount: agg.reviewCount ?? 0,
        ratingCount: agg.ratingCount ?? 0,
        distribution: {
          1: agg.distribution?.['1'] ?? 0,
          2: agg.distribution?.['2'] ?? 0,
          3: agg.distribution?.['3'] ?? 0,
          4: agg.distribution?.['4'] ?? 0,
          5: agg.distribution?.['5'] ?? 0,
        },
      })
    }

    _aggregateCache = out
    return out
  } catch (err) {
    console.error('[reviews] Aggregates fetch failed:', err)
    return new Map()
  }
}

/**
 * Single page of reviews, for the client-side pagination endpoint.
 * Nexus returns the full set in one call at our volume, so this slices it.
 */
export async function fetchReviewPage(
  shopifyGid: string,
  cursor?: string,
  pageSize = 10,
  _unusedApiKey?: string
): Promise<{ reviews: ProductReview[]; nextCursor: string | null } | null> {
  const data = await fetchProductReviews(shopifyGid)
  if (!data) return null

  const offset = cursor ? Number(cursor) || 0 : 0
  const slice = data.reviews.slice(offset, offset + pageSize)
  const next = offset + pageSize < data.reviews.length ? String(offset + pageSize) : null

  return { reviews: slice, nextCursor: next }
}

export { EMPTY_AGGREGATE }
