/**
 * First-touch segment resolution.
 *
 * 86% of traffic is single-page — they land on a product or blog page and
 * leave before the persona engine (which needs 3+ pages) can classify them.
 * But the entry page itself usually reveals clear SEGMENT intent: a torched
 * (weed killer) view is unmistakably turf; a chicken-mites article is poultry.
 *
 * This maps an entry page to a segment so we can stamp `sl_segment` and show a
 * segment-relevant engagement module on page one. Segment is coarse and safe to
 * act on from a single signal (much lower wrong-guess risk than a full persona).
 *
 * Segment ids align with persona.ts SegmentId: poultry | turf | waste | sports
 * | general. (Blog's 'agriculture' segment maps to turf — soil/garden content
 * shares the turf hub.)
 */

import type { SegmentId } from './persona'

/**
 * High-traffic product handles → segment. Derived from 14 days of real product
 * traffic (top SKUs by unique visitors). Checked before the productType
 * heuristic because handles are unambiguous. Keep additions data-driven.
 */
const HANDLE_SEGMENT: Record<string, SegmentId> = {
  // Turf / lawn / soil
  'torched-all-natural-weed-killer': 'turf',
  torched: 'turf',
  genesis: 'turf',
  'natural-lawn-care-subscription': 'turf',
  'dog-spot-for-lawns': 'turf',
  'jump-start-soil-conditioner': 'turf',
  humates: 'turf',
  'turf-revival': 'turf',
  'c-fix-biochar-soil-amendment': 'turf',
  fertalive: 'turf',
  'omega-soil-activator': 'turf',
  'veridian-humate-liquid-iron-for-lawns': 'turf',
  'soil-sulfur': 'turf',
  'compost-tea': 'turf',
  'perfect-pot': 'turf',
  'indoor-plant-food-1': 'turf',

  // Poultry
  desecticide: 'poultry',
  'hen-helper': 'poultry',
  'poultry-probiotic': 'poultry',
  'big-ole-bird': 'poultry',
  'catalyst-poultry-vitamin': 'poultry',
  'backyard-poultry-bundle-chicken-supplements': 'poultry',
  'litter-life': 'poultry',
  'poultry-litter-amendment': 'poultry',
  'natural-mite-control-livestock-poultry': 'poultry',
  'apple-cider-vinegar-for-chickens': 'poultry',
  'chicken-manure-fertilizer': 'poultry',
  'liquid-catalyst-poultry-vitamin': 'poultry',
  'roost-natural-supplements-for-chickens-bundle': 'poultry',
  'defender-natural-insecticide': 'poultry',

  // Waste / septic
  'waste-treatment': 'waste',
  'holding-tank-treatment': 'waste',
  'pour-the-port-septic-tank-treatment': 'waste',
  'pure-b-s-bio-surfactant': 'waste',

  // Sports (JockShock)
  jockshock: 'sports',
}

/**
 * Keyword fallback against Shopify productType when the handle isn't mapped.
 * Order matters — first hit wins.
 */
const TYPE_KEYWORDS: Array<{ terms: string[]; segment: SegmentId }> = [
  { terms: ['poultry', 'chicken', 'flock', 'egg', 'livestock'], segment: 'poultry' },
  { terms: ['lawn', 'turf', 'soil', 'garden', 'fertiliz', 'humic', 'humate'], segment: 'turf' },
  { terms: ['septic', 'waste', 'tank', 'drain'], segment: 'waste' },
  { terms: ['sport', 'athletic', 'gear', 'deodor'], segment: 'sports' },
]

/**
 * Resolve the segment for a product entry page.
 * @param handle Shopify product handle (from the URL)
 * @param productType Shopify productType (fallback heuristic)
 */
export function segmentForProduct(
  handle: string | undefined,
  productType?: string | null
): SegmentId | null {
  if (handle && HANDLE_SEGMENT[handle]) return HANDLE_SEGMENT[handle]

  const type = (productType || '').toLowerCase()
  if (type) {
    for (const { terms, segment } of TYPE_KEYWORDS) {
      if (terms.some((t) => type.includes(t))) return segment
    }
  }
  return null
}

/**
 * Normalize a blog post's `segment` field to a persona.ts SegmentId.
 * Blog uses 'agriculture' (soil/garden) which rolls up to the turf hub.
 */
export function segmentForBlog(
  blogSegment: 'poultry' | 'turf' | 'agriculture' | 'general' | undefined
): SegmentId | null {
  switch (blogSegment) {
    case 'poultry':
      return 'poultry'
    case 'turf':
    case 'agriculture':
      return 'turf'
    default:
      return null // 'general' or unset → no first-touch hint
  }
}
