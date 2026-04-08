/**
 * ReviewFilters — React island for sorting and filtering reviews.
 *
 * Receives all reviews as props (already SSR'd below), then controls
 * visibility via DOM manipulation to avoid duplicating card rendering.
 * Uses client:visible to load only when scrolled into view.
 */

import { useState, useCallback } from 'react'
import type { KlaviyoReview } from '../../lib/klaviyo-reviews'

type SortOption = 'newest' | 'highest' | 'lowest'
type FilterOption = 'all' | 'verified' | '5' | '4' | '3' | '2' | '1'

interface Props {
  reviews: KlaviyoReview[]
  totalCount: number
}

export default function ReviewFilters({ reviews, totalCount }: Props) {
  const [sort, setSort] = useState<SortOption>('newest')
  const [filter, setFilter] = useState<FilterOption>('all')

  const applyFilters = useCallback(() => {
    const container = document.getElementById('review-cards')
    if (!container) return

    // Get all review card elements
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-review-id]'))

    // Build the desired order from our reviews data
    let filtered = [...reviews]

    // Apply filter
    if (filter === 'verified') {
      filtered = filtered.filter((r) => r.verified)
    } else if (filter !== 'all') {
      const star = parseInt(filter)
      filtered = filtered.filter((r) => r.rating === star)
    }

    // Apply sort
    if (sort === 'highest') {
      filtered.sort((a, b) => b.rating - a.rating)
    } else if (sort === 'lowest') {
      filtered.sort((a, b) => a.rating - b.rating)
    }
    // 'newest' is default order from API

    const visibleIds = new Set(filtered.map((r) => r.id))

    // Show/hide and reorder
    for (const card of cards) {
      const id = card.dataset.reviewId
      if (id && visibleIds.has(id)) {
        card.style.display = ''
        card.style.order = String(filtered.findIndex((r) => r.id === id))
      } else {
        card.style.display = 'none'
      }
    }

    // Update count display
    const countEl = document.getElementById('review-filter-count')
    if (countEl) {
      countEl.textContent =
        filtered.length === totalCount
          ? `${totalCount} reviews`
          : `${filtered.length} of ${totalCount} reviews`
    }
  }, [reviews, sort, filter, totalCount])

  const handleSort = (value: SortOption) => {
    setSort(value)
    setTimeout(() => applyFilters(), 0)
  }

  const handleFilter = (value: FilterOption) => {
    setFilter(value)
    setTimeout(() => applyFilters(), 0)
  }

  // Apply on mount
  useState(() => {
    setTimeout(() => applyFilters(), 100)
  })

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {/* Sort */}
      <select
        value={sort}
        onChange={(e) => handleSort(e.target.value as SortOption)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-brand-green-light focus:outline-none focus:ring-1 focus:ring-brand-green-light"
        aria-label="Sort reviews"
      >
        <option value="newest">Newest</option>
        <option value="highest">Highest Rated</option>
        <option value="lowest">Lowest Rated</option>
      </select>

      {/* Filter */}
      <select
        value={filter}
        onChange={(e) => handleFilter(e.target.value as FilterOption)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-brand-green-light focus:outline-none focus:ring-1 focus:ring-brand-green-light"
        aria-label="Filter reviews"
      >
        <option value="all">All Reviews</option>
        <option value="verified">Verified Buyers</option>
        <option value="5">5 Stars</option>
        <option value="4">4 Stars</option>
        <option value="3">3 Stars</option>
        <option value="2">2 Stars</option>
        <option value="1">1 Star</option>
      </select>

      <span id="review-filter-count" className="text-sm text-gray-500">
        {totalCount} reviews
      </span>
    </div>
  )
}
