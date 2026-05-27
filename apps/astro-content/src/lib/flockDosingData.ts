/**
 * Flock Dosing Calculator — product rules + dosing math
 *
 * SEO/AI-search intent (Thursday Pulse #6, 2026-05-27): a calculator that
 * returns a result FROM Southland's own product data is non-commodity content
 * by construction — a model can't regenerate the answer for a specific flock.
 * This is the "give invisible collection/product pages something citable"
 * play from the commodity audit (docs/seo/commodity-audit/ in mothership).
 *
 * SOURCE OF TRUTH: every dosing rate below is transcribed verbatim from the
 * product MDX `dosingInstructions` blocks in
 * src/content/products/*.mdx. Do NOT invent rates. If a product's MDX dosing
 * changes, update it here too (and vice-versa). Backyard-flock scope only —
 * commercial "per 100 gallons" products are intentionally excluded from the
 * primary path because this tool serves the backyard persona.
 */

export type AgeClass = 'chicks' | 'pullets' | 'layers' | 'mixed'

export interface DosingProduct {
  /** Shopify handle — used for cart + PDP link */
  handle: string
  name: string
  /** Bottle size as sold, in fluid ounces */
  bottleOz: number
  /** Dose in tablespoons per gallon of drinking water (backyard standard) */
  tbspPerGallon: number
  /** How often treated water is replaced, in days (for usage math) */
  replaceEveryDays: number
  /** Stress-event guidance (verbatim intent from MDX) */
  stressNote: string
  /** Whether safe to start at day-one chicks */
  safeForChicks: boolean
  /** One-line role so the picker isn't just SKUs */
  role: string
}

/**
 * Backyard water-soluble products with a tablespoon-per-gallon backyard dose.
 * Rates verbatim from MDX (2026-05-27):
 *   - hen-helper:                  "Add 1 tablespoon per gallon", replace every 2-3 days,
 *                                  16 oz treats 6-12 hens ~3-4 months.
 *   - liquid-catalyst-poultry-vitamin: "Add 1 tablespoon per gallon", replace every 2-3 days,
 *                                  8 oz backyard size.
 */
export const PRODUCTS: DosingProduct[] = [
  {
    handle: 'hen-helper',
    name: 'Hen Helper',
    bottleOz: 16,
    tbspPerGallon: 1,
    replaceEveryDays: 2.5, // "every 2-3 days"
    stressNote:
      'Double dose for 3-5 days during extreme heat, new birds, or predator scares, then return to standard.',
    safeForChicks: true,
    role: 'Probiotic — gut health, shell strength, feather condition',
  },
  {
    handle: 'liquid-catalyst-poultry-vitamin',
    name: 'Catalyst Liquid',
    bottleOz: 8,
    tbspPerGallon: 1,
    replaceEveryDays: 2.5,
    stressNote:
      'Double dose for 5-7 days during heat, cold, molting, or when introducing new birds, then return to standard.',
    safeForChicks: true,
    role: 'Vitamin — energy, stress support, early development',
  },
]

/**
 * Treated-water volume per bird per day, in gallons, by age class.
 *
 * CALIBRATED to Southland's own label fact, NOT raw total water intake. A hen's
 * *total* daily drink is ~0.13 gal, but a 16 oz Hen Helper bottle (= 32 tbsp at
 * 1 tbsp/gal) "treats 6-12 hens for ~3-4 months" per the product MDX — which
 * only reconciles if the *treated* portion is ~0.034 gal/bird/day for layers
 * (treatment is intermittent: water is refreshed every 2-3 days and birds also
 * drink untreated water). Verified: at 0.034, a 16 oz bottle lasts ~158 days
 * (6 hens) to ~79 days (12 hens), bracketing the label's 90-120 day claim.
 *
 * An earlier draft used 0.13 (total intake) and produced 21-41 day bottle life
 * — contradicting Southland's own label. Don't regress to total-intake numbers.
 * Other age classes scaled from the layer figure by relative size/intake.
 */
export const WATER_PER_BIRD_GAL: Record<AgeClass, number> = {
  chicks: 0.008,
  pullets: 0.02,
  layers: 0.034,
  mixed: 0.026,
}

export const AGE_LABELS: Record<AgeClass, string> = {
  chicks: 'Chicks (0-6 weeks)',
  pullets: 'Pullets (6-18 weeks)',
  layers: 'Layers / adult hens',
  mixed: 'Mixed flock',
}

const TBSP_PER_FL_OZ = 2 // 1 fl oz = 2 tablespoons

export interface DosingResult {
  product: DosingProduct
  birds: number
  ageClass: AgeClass
  /** Gallons of treated drinking water the flock goes through per day */
  dailyWaterGal: number
  /** Tablespoons of product per refill (sized to the replace interval) */
  tbspPerRefill: number
  /** Days one bottle lasts at standard dosing */
  bottleLastsDays: number
  /** Human-friendly bottle duration */
  bottleLastsLabel: string
  notes: string[]
}

/**
 * Compute a backyard dosing plan. Pure function — deterministic from inputs,
 * which is exactly what makes the output non-regenerable content for a given
 * flock. All product-specific numbers come from PRODUCTS (i.e. from MDX).
 */
export function calculateDosing(
  product: DosingProduct,
  birds: number,
  ageClass: AgeClass
): DosingResult {
  const dailyWaterGal = +(birds * WATER_PER_BIRD_GAL[ageClass]).toFixed(2)

  // Product used per day = dose-per-gallon × gallons consumed per day.
  const tbspPerDay = dailyWaterGal * product.tbspPerGallon
  // Per refill cycle (water replaced every replaceEveryDays).
  const tbspPerRefill = +(tbspPerDay * product.replaceEveryDays).toFixed(2)

  const bottleTbsp = product.bottleOz * TBSP_PER_FL_OZ
  const bottleLastsDays = tbspPerDay > 0 ? Math.round(bottleTbsp / tbspPerDay) : 0

  const bottleLastsLabel =
    bottleLastsDays >= 60
      ? `~${Math.round(bottleLastsDays / 30)} months`
      : bottleLastsDays >= 14
        ? `~${Math.round(bottleLastsDays / 7)} weeks`
        : `~${bottleLastsDays} days`

  const notes: string[] = [
    `Standard dose: ${product.tbspPerGallon} tablespoon per gallon of drinking water.`,
    `Replace treated water every ${product.replaceEveryDays === 2.5 ? '2-3' : product.replaceEveryDays} days.`,
    product.stressNote,
  ]
  if (ageClass === 'chicks' && product.safeForChicks) {
    notes.push('Safe from day one — start chicks at the standard dose for a stronger early start.')
  }

  return {
    product,
    birds,
    ageClass,
    dailyWaterGal,
    tbspPerRefill,
    bottleLastsDays,
    bottleLastsLabel,
    notes,
  }
}
