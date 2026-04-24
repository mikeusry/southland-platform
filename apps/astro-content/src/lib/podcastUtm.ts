/**
 * UTM helper for podcast episode links.
 *
 * Convention (matches PODCAST-GAME-PLAN.md):
 *   utm_source   = where the click originated (website | email | youtube | spotify | linkedin | instagram | x)
 *   utm_medium   = audio | email | social | organic
 *   utm_campaign = ep-<slug>  (one per episode)
 *   utm_content  = placement identifier (e.g., sidebar, hero, signature, description, quote-card-1)
 *
 * Use this for every link that points to an episode page, external platform,
 * or embedded media so analytics/attribution reconcile cleanly across channels.
 */

export interface EpisodeUtmInput {
  episodeSlug: string
  source: string
  medium: string
  content?: string
  extra?: Record<string, string>
}

export function buildEpisodeUtm(input: EpisodeUtmInput): string {
  // Strip a leading "ep-" from the slug so we don't double-prefix.
  // Accepts both "ep-006-backyard-to-commercial" and "006-backyard-to-commercial".
  const normalizedSlug = input.episodeSlug.replace(/^ep-/, '')
  const params = new URLSearchParams({
    utm_source: input.source,
    utm_medium: input.medium,
    utm_campaign: `ep-${normalizedSlug}`,
  })
  if (input.content) params.set('utm_content', input.content)
  if (input.extra) {
    for (const [k, v] of Object.entries(input.extra)) params.set(k, v)
  }
  return params.toString()
}

export function appendEpisodeUtm(url: string, input: EpisodeUtmInput): string {
  // Don't rewrite relative/root-relative URLs — they resolve to the same domain
  // and analytics already track these natively via pd-attribution.js.
  if (url.startsWith('/')) return url
  const qs = buildEpisodeUtm(input)
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${qs}`
}
