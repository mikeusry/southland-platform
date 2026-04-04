// Erosion Control Seed Calculator — Pure Calculation Functions
//
// No side effects. Imports config from erosionControlRules.ts.
// Call calculateResult(inputs) from the React component.

import type {
  CalculatorInputs,
  CalculatorResult,
  Confidence,
  MixConfig,
  ProductRecommendation,
} from './erosionControlTypes'
import {
  DEFAULT_MIX_ID,
  HYDROSEED_OVERLAY_SUMMARY,
  METHOD_OVERRIDES,
  MIX_CONFIGS,
  PRODUCT_CATALOG,
  SEASON_OVERRIDES,
  SLOPE_OVERRIDES,
  SOIL_OVERRIDES,
  SUN_OVERRIDES,
} from './erosionControlRules'

// ---------------------------------------------------------------------------
// Mix Selection
// ---------------------------------------------------------------------------

/**
 * Select the biological mix based on goal.
 * Hydroseeding goal falls through to Standard Slope (hydroseed is a method overlay).
 */
export function selectMix(inputs: CalculatorInputs): MixConfig {
  const goal = inputs.goal === 'hydroseeding' ? 'quick-long-term' : inputs.goal
  const match = MIX_CONFIGS.find((m) => m.matchGoal === goal)
  return match ?? MIX_CONFIGS.find((m) => m.id === DEFAULT_MIX_ID)!
}

// ---------------------------------------------------------------------------
// Override Collection
// ---------------------------------------------------------------------------

interface OverrideResult {
  notes: string[]
  warnings: string[]
  blanketRequired: boolean
  blanketReason: string | null
  productRecommendations: ProductRecommendation[]
  confidence: Confidence
}

export function applyOverrides(mix: MixConfig, inputs: CalculatorInputs): OverrideResult {
  const notes: string[] = []
  const warnings: string[] = []
  const productRecommendations: ProductRecommendation[] = []
  let blanketRequired = false
  let blanketReason: string | null = null
  let confidence: Confidence = 'standard'

  // -- Slope ----------------------------------------------------------------
  const slope = SLOPE_OVERRIDES[inputs.slope]
  if (slope.blanketRequired) {
    blanketRequired = true
    blanketReason = slope.blanketReason
  }
  notes.push(...slope.notes)

  // -- Soil -----------------------------------------------------------------
  const soil = SOIL_OVERRIDES[inputs.soil]
  notes.push(...soil.notes)

  if (inputs.compost && soil.compostYesNote) {
    notes.push(soil.compostYesNote)
  }
  if (!inputs.compost && soil.compostNoNote) {
    warnings.push(soil.compostNoNote)
  }

  // Disturbed soil on moderate/steep slopes strengthens blanket recommendation
  if (soil.strengthensBlanket && (inputs.slope === 'moderate' || inputs.slope === 'steep')) {
    if (!blanketRequired) {
      blanketRequired = true
      blanketReason =
        'Disturbed soil on a moderate-to-steep slope significantly increases erosion risk. An erosion control blanket is strongly recommended.'
    }
  }

  // -- Sun ------------------------------------------------------------------
  const sun = SUN_OVERRIDES[inputs.sun]
  warnings.push(...sun.warnings)
  if (sun.confidence === 'custom-review') {
    confidence = 'custom-review'
  }

  // -- Season ---------------------------------------------------------------
  const season = SEASON_OVERRIDES[inputs.season]
  warnings.push(...season.warnings)
  notes.push(...season.notes)

  // -- Method ---------------------------------------------------------------
  const method = METHOD_OVERRIDES[inputs.method]
  notes.push(...method.notes)
  productRecommendations.push(...method.productRecommendations)

  // -- Hydroseed goal overlay (when goal=hydroseeding but method isn't hydroseed) ---
  if (inputs.goal === 'hydroseeding' && inputs.method !== 'hydroseed') {
    const hydro = METHOD_OVERRIDES.hydroseed
    notes.push(...hydro.notes)
    // Add hydroseed products that aren't already included
    for (const rec of hydro.productRecommendations) {
      if (!productRecommendations.some((p) => p.slug === rec.slug)) {
        productRecommendations.push(rec)
      }
    }
  }

  // -- Blanket product recommendation ---------------------------------------
  if (blanketRequired) {
    const blanketProduct = PRODUCT_CATALOG['erosion-control-blanket']
    if (!productRecommendations.some((p) => p.slug === blanketProduct.slug)) {
      productRecommendations.push({
        name: blanketProduct.name,
        slug: blanketProduct.slug,
        reason: blanketProduct.defaultReason,
        required: true,
      })
    }
  }

  return {
    notes,
    warnings,
    blanketRequired,
    blanketReason,
    productRecommendations,
    confidence,
  }
}

// ---------------------------------------------------------------------------
// Mulch Recommendation
// ---------------------------------------------------------------------------

function getMulchRecommendation(inputs: CalculatorInputs, blanketRequired: boolean): string {
  if (inputs.method === 'hydroseed' || inputs.goal === 'hydroseeding') {
    return blanketRequired
      ? 'Hydromulch in the slurry plus erosion control blanket on steep or exposed areas.'
      : 'Hydromulch applied as part of the hydroseeding slurry.'
  }

  if (inputs.goal === 'mowable-turf') {
    return 'Light straw mulch optional — helps retain moisture during establishment.'
  }

  if (blanketRequired) {
    return 'Straw mulch under erosion control blanket, or bonded fiber matrix on steep slopes.'
  }

  if (inputs.soil === 'sandy') {
    return 'Straw mulch recommended — critical for moisture retention in sandy soils.'
  }

  return 'Straw mulch or hydromulch — maintains moisture and protects seed from washout.'
}

// ---------------------------------------------------------------------------
// Main Calculation
// ---------------------------------------------------------------------------

export function calculateResult(inputs: CalculatorInputs): CalculatorResult {
  const mix = selectMix(inputs)
  const overrides = applyOverrides(mix, inputs)

  const totalLbs = (inputs.area / 1000) * mix.ratePer1000
  const roundedTotalLbs = Math.ceil(totalLbs)

  const isHydroseedOverlay = inputs.goal === 'hydroseeding' || inputs.method === 'hydroseed'

  const mulchRecommendation = getMulchRecommendation(inputs, overrides.blanketRequired)

  // Add Jump Start to product recs for non-hydroseed scenarios
  if (!overrides.productRecommendations.some((p) => p.slug === 'jump-start-soil-conditioner')) {
    const jumpStart = PRODUCT_CATALOG['jump-start-soil-conditioner']
    overrides.productRecommendations.push({
      name: jumpStart.name,
      slug: jumpStart.slug,
      reason: jumpStart.defaultReason,
      required: false,
    })
  }

  // Build display name — append "(Hydroseed System)" when overlay is active
  const mixName = isHydroseedOverlay ? `${mix.name} — Hydroseed System` : mix.name

  const summary = isHydroseedOverlay
    ? HYDROSEED_OVERLAY_SUMMARY
    : mix.summary

  return {
    mixName,
    summary,
    speciesBreakdown: mix.species,
    ratePer1000: mix.ratePer1000,
    totalLbs,
    roundedTotalLbs,
    mulchRecommendation,
    blanketRequired: overrides.blanketRequired,
    blanketReason: overrides.blanketReason,
    notes: overrides.notes,
    warnings: overrides.warnings,
    productRecommendations: overrides.productRecommendations,
    confidence: overrides.confidence,
    isHydroseedOverlay,
  }
}

// ---------------------------------------------------------------------------
// Display Helpers
// ---------------------------------------------------------------------------

export function formatWeight(lbs: number): string {
  if (lbs < 1) return `${(lbs * 16).toFixed(0)} oz`
  if (Number.isInteger(lbs)) return `${lbs} lb`
  return `${lbs.toFixed(1)} lb`
}
