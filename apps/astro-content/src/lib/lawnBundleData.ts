/**
 * Lawn Care Bundle finder — turf zone × lawn size → one of 9 bundles.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * This replaces a VideoAsk-hosted quiz (videoask.com/fyahikle6) that lived on
 * three Shopify pages. Those pages are still live on shop.southlandorganics.com
 * but the Astro middleware redirected all three to /lawn/homeowners/, which has
 * no quiz on it — so every visitor arriving from the four blog posts that still
 * say "take our quick and easy quiz" landed on a page that could not answer.
 *
 * 🛑 THE RECOMMENDATION IS DETERMINISTIC — there is no scoring, no weighting and
 * no model. It is a 3×3 lookup: three turf zones × three lawn sizes. That is why
 * a third-party video-quiz product was never needed for it, and why this can run
 * entirely client-side with no API call.
 *
 * Bundle numbering comes from Southland's own instructions page and must not be
 * renumbered — the SKUs (`BUNDLE-Lawn Care-#1` … `#9`) and the Shopify variant
 * IDs below are keyed to it, and Customer.io campaign 42 gates on the SKU prefix.
 *
 * Variant IDs verified live 2026-08-05 from
 * shop.southlandorganics.com/products/natural-lawn-care-subscription.json
 */

export type TurfZone = 'cool' | 'transition' | 'warm'
export type LawnSize = 'small' | 'medium' | 'large'

export interface LawnBundle {
  /** Bundle number, 1-9, as printed on the instructions page. */
  number: number
  sku: string
  /** Shopify variant id on the `natural-lawn-care-subscription` product. */
  variantId: string
  price: number
  zone: TurfZone
  size: LawnSize
  /** Container format — drives which dilution instructions apply. */
  format: 'sprayer-quart' | 'own-sprayer'
  /** Month-by-month application schedule, verbatim from the instructions page. */
  schedule: Array<{ month: string; action: string }>
}

/** Sizes, with the square-footage bands used to describe them. */
export const LAWN_SIZES: Array<{ id: LawnSize; label: string; detail: string }> = [
  { id: 'small', label: 'Small', detail: 'Up to about 5,000 sq ft' },
  { id: 'medium', label: 'Medium', detail: 'About 5,000–10,000 sq ft' },
  { id: 'large', label: 'Large', detail: 'More than 10,000 sq ft' },
]

/**
 * Turf zones. The state lists are the standard cool/transition/warm season turf
 * bands — they let someone pick by where they live instead of having to know
 * their zone, which is the single biggest reason people abandon this question.
 */
export const TURF_ZONES: Array<{
  id: TurfZone
  label: string
  detail: string
  states: string
  season: string
}> = [
  {
    id: 'cool',
    label: 'Cool',
    detail: 'Kentucky bluegrass, fescue, ryegrass',
    states: 'ME NH VT NY MA RI CT NJ PA OH MI IN WI MN IA ND SD NE MT WY ID WA OR northern IL',
    season: 'May – September',
  },
  {
    id: 'transition',
    label: 'Transition',
    detail: 'Tall fescue, bluegrass, zoysia — the zone where both types struggle',
    states: 'VA WV MD DE KY TN NC northern GA northern AL AR MO KS OK northern TX southern IL',
    season: 'April – September',
  },
  {
    id: 'warm',
    label: 'Warm',
    detail: 'Bermuda, zoysia, centipede, St. Augustine',
    states: 'FL southern GA southern AL MS LA southern TX southern SC AZ southern CA HI',
    season: 'March – October',
  },
]

const q = (month: string, action: string) => ({ month, action })

/**
 * The 3×3 grid. Schedules are transcribed from the Natural Lawn Care
 * Instructions page — do not paraphrase them, they are dosing instructions.
 */
export const LAWN_BUNDLES: LawnBundle[] = [
  {
    number: 1,
    sku: 'BUNDLE-Lawn Care-#1',
    variantId: '42793535570165',
    price: 85,
    zone: 'cool',
    size: 'small',
    format: 'sprayer-quart',
    schedule: [
      q('May', 'Apply the one quart of Genesis.'),
      q('June', 'Apply one of the quart bottles of FertALive.'),
      q('July', 'Apply the one quart of Omega.'),
      q('August', 'Apply the other quart bottle of FertALive.'),
      q('September', 'Apply the one quart of Revival.'),
    ],
  },
  {
    number: 2,
    sku: 'BUNDLE-Lawn Care-#2',
    variantId: '42793535602933',
    price: 165,
    zone: 'cool',
    size: 'medium',
    format: 'sprayer-quart',
    schedule: [
      q('May', 'Apply the two quarts of Genesis.'),
      q('June', 'Apply two of the quart bottles of FertALive.'),
      q('July', 'Apply the two quarts of Omega.'),
      q('August', 'Apply the other two quart bottles of FertALive.'),
      q('September', 'Apply the two quarts of Revival.'),
    ],
  },
  {
    number: 3,
    sku: 'BUNDLE-Lawn Care-#3',
    variantId: '42793535635701',
    price: 188,
    zone: 'cool',
    size: 'large',
    format: 'own-sprayer',
    schedule: [
      q('May', 'Apply the one gallon of Genesis.'),
      q('June', 'Apply one of the gallon bottles of FertALive.'),
      q('July', 'Apply the one gallon of Omega.'),
      q('August', 'Apply the other gallon bottle of FertALive.'),
      q('September', 'Apply the one gallon of Revival.'),
    ],
  },
  {
    number: 4,
    sku: 'BUNDLE-Lawn Care-#4',
    variantId: '42793535668469',
    price: 99,
    zone: 'transition',
    size: 'small',
    format: 'sprayer-quart',
    schedule: [
      q('April', 'Apply the one quart of Genesis.'),
      q('May', 'Apply one of the quart bottles of FertALive.'),
      q('June', 'Apply one of the quart bottles of Omega.'),
      q('July', 'Apply the other quart bottle of FertALive.'),
      q('August', 'Apply the other quart bottle of Omega.'),
      q('September', 'Apply the one quart of Revival.'),
    ],
  },
  {
    number: 5,
    sku: 'BUNDLE-Lawn Care-#5',
    variantId: '42793535701237',
    price: 207,
    zone: 'transition',
    size: 'medium',
    format: 'sprayer-quart',
    schedule: [
      q('April', 'Apply the two quarts of Genesis.'),
      q('May', 'Apply two of the quart bottles of FertALive.'),
      q('June', 'Apply two of the quart bottles of Omega.'),
      q('July', 'Apply two of the quart bottles of FertALive.'),
      q('August', 'Apply two of the quart bottles of Omega.'),
      q('September', 'Apply the two quarts of Revival.'),
    ],
  },
  {
    number: 6,
    sku: 'BUNDLE-Lawn Care-#6',
    variantId: '42793535734005',
    price: 220,
    zone: 'transition',
    size: 'large',
    format: 'own-sprayer',
    schedule: [
      q('April', 'Apply the one gallon of Genesis.'),
      q('May', 'Apply one of the gallon bottles of FertALive.'),
      q('June', 'Apply one of the gallon bottles of Omega.'),
      q('July', 'Apply the other gallon bottle of FertALive.'),
      q('August', 'Apply the other gallon bottle of Omega.'),
      q('September', 'Apply the one gallon of Revival.'),
    ],
  },
  {
    number: 7,
    sku: 'BUNDLE-Lawn Care-#7',
    variantId: '42793535766773',
    price: 137,
    zone: 'warm',
    size: 'small',
    format: 'sprayer-quart',
    schedule: [
      q('March', 'Apply the one quart of Genesis.'),
      q('April', 'Apply one of the quart bottles of FertALive.'),
      q('May', 'Apply one of the quart bottles of Omega.'),
      q('June', 'Apply the other quart bottle of FertALive.'),
      q('July', 'Apply the other quart bottle of Omega.'),
      q('August', 'Apply the one quart of Revival.'),
    ],
  },
  {
    number: 8,
    sku: 'BUNDLE-Lawn Care-#8',
    variantId: '42793535799541',
    price: 208,
    zone: 'warm',
    size: 'medium',
    format: 'sprayer-quart',
    schedule: [
      q('March', 'Apply the two quarts of Genesis.'),
      q('April', 'Apply two of the quart bottles of FertALive.'),
      q('May', 'Apply two of the quart bottles of Omega.'),
      q('June', 'Apply two of the quart bottles of FertALive.'),
      q('July', 'Apply two of the quart bottles of Omega.'),
      q('August', 'Apply the two quarts of Revival.'),
    ],
  },
  {
    number: 9,
    sku: 'BUNDLE-Lawn Care-#9',
    variantId: '42793535832309',
    price: 274,
    zone: 'warm',
    size: 'large',
    format: 'own-sprayer',
    schedule: [
      q('March', 'Apply the one gallon of Genesis.'),
      q('April', 'Apply one of the gallon bottles of FertALive.'),
      q('May', 'Apply one of the gallon bottles of Omega.'),
      q('June', 'Apply the other gallon bottle of FertALive.'),
      q('July', 'Apply the other gallon bottle of Omega.'),
      q('August', 'Apply the one gallon of Revival.'),
    ],
  },
]

/** The bundle for a zone/size pair. Every combination has exactly one. */
export function findBundle(zone: TurfZone, size: LawnSize): LawnBundle {
  const match = LAWN_BUNDLES.find((b) => b.zone === zone && b.size === size)
  // The grid is complete by construction; this satisfies the type checker and
  // would surface a data edit that broke it rather than silently returning null.
  if (!match) throw new Error(`No lawn bundle for zone=${zone} size=${size}`)
  return match
}

/** Direct add-to-cart on the Shopify storefront for a bundle. */
export function bundleCartUrl(bundle: LawnBundle): string {
  return `https://shop.southlandorganics.com/cart/${bundle.variantId}:1`
}

/** The product page for a bundle, variant pre-selected. */
export function bundleProductUrl(bundle: LawnBundle): string {
  return `https://shop.southlandorganics.com/products/natural-lawn-care-subscription?variant=${bundle.variantId}`
}

/**
 * The four products every bundle contains. Quantities and container sizes vary
 * by bundle; the roles do not.
 */
export const BUNDLE_PRODUCTS = [
  {
    name: 'Genesis',
    role: 'Humate soil conditioner',
    blurb:
      'Brings out early-season colour and prepares the lawn for summer with activated carbon and soil biology. Trials show a 78% increase in green-up.',
    handle: 'genesis',
  },
  {
    name: 'FertALive',
    role: 'Nutrient enhancer',
    blurb:
      'Delivers nutrient-releasing microbiology and vital nitrogen in small, steady amounts rather than one heavy feed.',
    handle: 'fertalive',
  },
  {
    name: 'Omega',
    role: 'Soil activator',
    blurb:
      'Biologically active carbon and organic acids, plus beneficial bacteria that promote nutrient uptake and stress resilience.',
    handle: 'omega-soil-activator',
  },
  {
    name: 'Revival',
    role: 'Liquid aerator',
    blurb:
      'Microbial dethatcher and liquid aerator — breaks thatch down organically instead of mechanical aeration.',
    handle: 'turf-revival',
  },
] as const

/** Dilution guidance, keyed by container format. Verbatim — these are dosing instructions. */
export const DILUTION = {
  'sprayer-quart': {
    heading: 'If your bundle came with sprayer quarts (bundles 1, 2, 4, 5, 7 and 8)',
    steps: [
      'Insert the straw into the black sprayer nozzle. Attach the nozzle to the sprayer quart bottle of product.',
      'Attach your hose to the sprayer nozzle and turn on your water.',
      'Turn the dial on the sprayer nozzle to "mix" — the sprayer automatically dilutes the product to the proper ratio.',
      'Spray in even strokes, saturating your grass with the mixture. A full quart takes about 3 minutes and covers approximately 1,000 square feet.',
    ],
  },
  'own-sprayer': {
    heading: 'If you are using your own sprayer (bundles 3, 6 and 9)',
    steps: [
      'Assemble your sprayer as directed by the manufacturer and pour the product into the reservoir.',
      'For Genesis, Omega and Revival, turn the dilution dial to one ounce (two tablespoons).',
      'For FertALive, turn the dilution dial to 3/4 ounce (1.5 tablespoons).',
      'Spray in even strokes, saturating your grass with the mixture. A full quart of product covers approximately 1,000 square feet.',
    ],
  },
} as const

/** A plain-text summary of the result, for the Nexus lead `message` field. */
export function buildBundleSummary(bundle: LawnBundle): string {
  const zone = TURF_ZONES.find((z) => z.id === bundle.zone)
  const size = LAWN_SIZES.find((s) => s.id === bundle.size)
  const lines = [
    `Lawn Bundle Finder result: Bundle #${bundle.number} (${bundle.sku})`,
    `Turf zone: ${zone?.label ?? bundle.zone}`,
    `Lawn size: ${size?.label ?? bundle.size} — ${size?.detail ?? ''}`,
    `Price: $${bundle.price}`,
    '',
    'Application schedule:',
    ...bundle.schedule.map((s) => `  ${s.month}: ${s.action}`),
  ]
  return lines.join('\n')
}
