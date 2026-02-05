/**
 * Analytics helpers for podcast tracking
 * Integrates with Southland's point.dog pixel
 */

// Type for the pixel instance
declare global {
  interface Window {
    pdPixel?: {
      track: (event: string, properties?: Record<string, unknown>) => void
      identify: (userId: string, traits?: Record<string, unknown>) => void
      page: (name?: string, properties?: Record<string, unknown>) => void
    }
    dataLayer?: unknown[]
  }
}

/**
 * Track a podcast-specific event
 */
export function trackPodcastEvent(
  eventName: string,
  properties: Record<string, unknown> = {}
): void {
  // Track via Southland pixel
  if (typeof window !== 'undefined' && window.pdPixel) {
    window.pdPixel.track(eventName, {
      content_type: 'podcast',
      ...properties,
    })
  }

  // Also push to GTM dataLayer
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      content_type: 'podcast',
      ...properties,
    })
  }
}

/**
 * Track episode play start
 */
export function trackEpisodePlay(episode: {
  slug: string
  episodeNumber: number
  title: string
  duration?: number
}): void {
  trackPodcastEvent('podcast_play', {
    episode_slug: episode.slug,
    episode_number: episode.episodeNumber,
    episode_title: episode.title,
    duration_seconds: episode.duration || 0,
    progress_percent: 0,
  })
}

/**
 * Track episode progress (25%, 50%, 75%, 100%)
 */
export function trackEpisodeProgress(
  episode: {
    slug: string
    episodeNumber: number
  },
  progressPercent: number,
  currentTime: number
): void {
  trackPodcastEvent('podcast_progress', {
    episode_slug: episode.slug,
    episode_number: episode.episodeNumber,
    progress_percent: progressPercent,
    current_time: currentTime,
  })
}

/**
 * Track episode completion
 */
export function trackEpisodeComplete(episode: {
  slug: string
  episodeNumber: number
  title: string
  durationSeconds: number
}): void {
  trackPodcastEvent('podcast_complete', {
    episode_slug: episode.slug,
    episode_number: episode.episodeNumber,
    episode_title: episode.title,
    duration_seconds: episode.durationSeconds,
  })
}

/**
 * Track share clip creation
 */
export function trackShareClip(
  episode: {
    slug: string
    episodeNumber: number
  },
  startTime: number,
  endTime: number
): void {
  trackPodcastEvent('podcast_share_clip', {
    episode_slug: episode.slug,
    episode_number: episode.episodeNumber,
    start_time: startTime,
    end_time: endTime,
    clip_duration: endTime - startTime,
  })
}

/**
 * Track transcript click (jumping to timestamp)
 */
export function trackTranscriptClick(
  episode: {
    slug: string
    episodeNumber: number
  },
  timestamp: number
): void {
  trackPodcastEvent('podcast_transcript_click', {
    episode_slug: episode.slug,
    episode_number: episode.episodeNumber,
    timestamp: timestamp,
  })
}

/**
 * Track chapter navigation
 */
export function trackChapterClick(
  episode: {
    slug: string
    episodeNumber: number
  },
  chapterTitle: string,
  chapterTime: number
): void {
  trackPodcastEvent('podcast_chapter_click', {
    episode_slug: episode.slug,
    episode_number: episode.episodeNumber,
    chapter_title: chapterTitle,
    chapter_time: chapterTime,
  })
}

/**
 * Track search query
 */
export function trackPodcastSearch(query: string, resultsCount: number): void {
  trackPodcastEvent('podcast_search', {
    search_query: query,
    results_count: resultsCount,
  })
}

/**
 * Track email signup from podcast
 */
export function trackPodcastEmailSignup(location: string): void {
  trackPodcastEvent('podcast_email_signup', {
    signup_location: location,
  })
}

/**
 * Track subscribe button click
 */
export function trackSubscribeClick(platform: string, episodeSlug?: string): void {
  trackPodcastEvent('podcast_subscribe_click', {
    platform: platform,
    episode_slug: episodeSlug || 'hub',
  })
}

/**
 * Track product CTA click from podcast
 */
export function trackProductCTAClick(productSlug: string, episodeSlug: string): void {
  trackPodcastEvent('podcast_product_click', {
    product_slug: productSlug,
    episode_slug: episodeSlug,
  })
}
