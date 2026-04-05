/**
 * Application Rate Calculator — Calculation Logic (v2)
 *
 * Pure functions. No side effects.
 *
 * Key separation: calculateApplication() computes agronomic need,
 * optimizeContainers() finds the best packaging, determineBuyingPath()
 * routes the user. calculateResult() composes all three.
 */

import type {
  AppRateResult,
  ApplicationResult,
  Assumption,
  BuyingPath,
  ConfidenceLevel,
  ContainerRecommendation,
  ContainerSize,
  ProductConfig,
  PurchaseRecommendation,
  RateRule,
  RateSource,
  RecommendationScope,
  Segment,
  Unit,
} from './appRateTypes'
import { SQFT_PER_ACRE, getProduct } from './appRateRules'

// =============================================================================
// UNIT CONVERSIONS
// =============================================================================

function normalizeArea(area: number, inputUnit: Unit, ratePerAreaUnit: Unit): number {
  if (inputUnit === ratePerAreaUnit) return area

  let sqft: number
  switch (inputUnit) {
    case 'sqft':
      sqft = area
      break
    case 'acres':
      sqft = area * SQFT_PER_ACRE
      break
    case 'houses':
      sqft = area * 20_000
      break
  }

  switch (ratePerAreaUnit) {
    case 'sqft':
      return sqft
    case 'acres':
      return sqft / SQFT_PER_ACRE
    case 'houses':
      return sqft / 20_000
  }
}

const TO_OZ: Record<string, number> = {
  oz: 1,
  gal: 128,
  qt: 32,
  pt: 16,
  tbsp: 0.5,
  tsp: 0.167,
}

const TO_LB: Record<string, number> = {
  lb: 1,
  lbs: 1,
  oz: 0.0625,
}

/** Convert a rate amount to the container's native units */
function toContainerUnits(amount: number, rateUnit: string, containerUnit: string): number {
  // Liquid → liquid
  if (rateUnit in TO_OZ && containerUnit in TO_OZ) {
    return (amount * (TO_OZ[rateUnit] ?? 1)) / (TO_OZ[containerUnit] ?? 1)
  }
  // Weight → weight
  if (rateUnit in TO_LB && containerUnit in TO_LB) {
    return (amount * (TO_LB[rateUnit] ?? 1)) / (TO_LB[containerUnit] ?? 1)
  }
  // Bottles / same unit
  if (rateUnit === containerUnit || rateUnit === 'bottle') return amount
  return amount
}

function inferContainerUnit(product: ProductConfig): string {
  const label = product.containers[0]?.label.toLowerCase() ?? ''
  if (label.includes('gal')) return 'gal'
  if (label.includes('oz')) return 'oz'
  if (label.includes('lb') || label.includes('bag')) return 'lb'
  if (label.includes('qt')) return 'qt'
  if (label.includes('bottle')) return 'count'
  return product.containers[0]?.packageUnit ?? 'oz'
}

// =============================================================================
// APPLICATION CALCULATION
// =============================================================================

export function calculateApplication(
  product: ProductConfig,
  rule: RateRule,
  area: number,
  inputUnit: Unit,
  onHand: number
): ApplicationResult | null {
  if (area <= 0) return null

  const normalizedArea = normalizeArea(area, inputUnit, rule.perAreaUnit)
  const totalRateUnits = rule.rate * (normalizedArea / rule.perArea)
  const totalNeeded = Math.max(0, totalRateUnits - onHand)

  const useCase = product.useCases.find((uc) => uc.id === rule.useCase)
  const scope: RecommendationScope = useCase?.scope ?? 'single_application'

  // Build rate label
  const perAreaLabel =
    rule.perAreaUnit === 'sqft'
      ? `${rule.perArea.toLocaleString()} sq ft`
      : rule.perAreaUnit === 'houses'
        ? rule.perArea === 1
          ? 'house'
          : `${rule.perArea} houses`
        : rule.perArea === 1
          ? 'acre'
          : `${rule.perArea} acres`

  const rateLabel = `${rule.rate} ${rule.rateUnit} per ${perAreaLabel}`

  // Build rate range
  const rateRange =
    rule.rateMin !== undefined && rule.rateMax !== undefined
      ? {
          min: `${rule.rateMin} ${rule.rateUnit}`,
          max: `${rule.rateMax} ${rule.rateUnit}`,
          label: `Label range: ${rule.rateMin}–${rule.rateMax} ${rule.rateUnit} per ${perAreaLabel}`,
        }
      : null

  // Build scope explanation
  const areaDisplay = formatCoverage(area, inputUnit)
  const scopeLabels: Record<RecommendationScope, string> = {
    single_application: `for one application of your ${areaDisplay}`,
    first_2_applications: `for the first 2 applications of your ${areaDisplay} (double rate)`,
    full_flock: `for one full flock across ${areaDisplay}`,
    annual_maintenance: `for ${area} month${area !== 1 ? 's' : ''} of maintenance`,
  }

  // Build calculation steps
  const steps: string[] = []
  const areaStr = formatCoverage(area, inputUnit)
  steps.push(
    `${areaStr} × ${rule.rate} ${rule.rateUnit} per ${perAreaLabel} = ${formatAmount(totalRateUnits, rule.rateUnit)}`
  )
  if (onHand > 0) {
    steps.push(
      `Less ${formatAmount(onHand, rule.rateUnit)} on hand = ${formatAmount(totalNeeded, rule.rateUnit)} needed`
    )
  }

  // Pour the Port special: add 1 extra bottle first month
  if (product.handle === 'pour-the-port-septic-tank-treatment' && rule.useCase === 'monthly') {
    const withExtra = totalNeeded + 1
    steps.push(`Plus 1 extra bottle for first month = ${withExtra} bottles total`)
    return {
      totalNeeded: Math.max(0, withExtra - onHand),
      totalNeededUnit: 'bottle',
      rateUsed: rule.rate,
      rateLabel,
      rateSource: (rule.rateSource as RateSource) ?? 'recommended',
      rateRange,
      scope,
      scopeExplanation: scopeLabels[scope],
      assumptions: [],
      calculationSteps: steps,
      notes: rule.notes ? [rule.notes] : [],
    }
  }

  // Assumptions for poultry
  const assumptions: Assumption[] = []
  if (product.segment === 'poultry' && inputUnit === 'houses') {
    assumptions.push({
      label: 'Standard 40×500 house (20,000 sq ft)',
      editable: false,
      inputKey: null,
    })
  }
  if (product.handle === 'poultry-probiotic') {
    assumptions.push({
      label: '400 gal water system per house',
      editable: false,
      inputKey: null,
    })
    if (rule.useCase === 'broiler-standard') {
      assumptions.push({
        label: '42-day broiler flock',
        editable: false,
        inputKey: null,
      })
    }
  }

  return {
    totalNeeded,
    totalNeededUnit: rule.rateUnit,
    rateUsed: rule.rate,
    rateLabel,
    rateSource: (rule.rateSource as RateSource) ?? 'recommended',
    rateRange,
    scope,
    scopeExplanation: scopeLabels[scope],
    assumptions,
    calculationSteps: steps,
    notes: rule.notes ? [rule.notes] : [],
  }
}

// =============================================================================
// EXHAUSTIVE CONTAINER OPTIMIZER
// =============================================================================

interface ContainerCombo {
  items: { container: ContainerSize; quantity: number }[]
  totalCost: number
  totalAmount: number
  excess: number
  containerCount: number
}

/**
 * Enumerate all feasible container combinations and pick the best.
 * With 2-4 container sizes and small max counts, this is fast.
 */
export function optimizeContainers(
  product: ProductConfig,
  totalNeeded: number,
  rateUnit: string
): PurchaseRecommendation | null {
  const available = product.containers.filter((c) => c.availableForSale)
  if (available.length === 0 || totalNeeded <= 0) return null

  const containerUnit = inferContainerUnit(product)
  const neededInContainerUnits = toContainerUnits(totalNeeded, rateUnit, containerUnit)

  // Special case: bottle/count products (Pour the Port)
  if (available[0].packageUnit === 'count') {
    const c = available[0]
    const qty = Math.ceil(neededInContainerUnits)
    return {
      containers: [
        {
          label: c.label,
          quantity: qty,
          priceEach: c.price,
          subtotal: qty * c.price,
          variantGid: c.variantGid,
          availableForSale: c.availableForSale,
        },
      ],
      estimatedCost: qty * c.price,
      excessAmount: 0,
      excessUnit: 'bottles',
      excessNote: '',
      alternativeOption: null,
    }
  }

  // Generate all combos
  const maxCount = product.maxContainerCount
  const combos: ContainerCombo[] = []

  if (available.length === 1) {
    const c = available[0]
    const qty = Math.ceil(neededInContainerUnits / c.amount)
    const capped = Math.min(qty, maxCount)
    combos.push({
      items: [{ container: c, quantity: capped }],
      totalCost: capped * c.price,
      totalAmount: capped * c.amount,
      excess: capped * c.amount - neededInContainerUnits,
      containerCount: capped,
    })
  } else if (available.length === 2) {
    const [a, b] = available.sort((x, y) => y.amount - x.amount)
    const maxA = Math.min(Math.ceil(neededInContainerUnits / a.amount) + 1, maxCount)
    const maxB = Math.min(Math.ceil(neededInContainerUnits / b.amount) + 1, maxCount)

    for (let qa = 0; qa <= maxA; qa++) {
      for (let qb = 0; qb <= maxB; qb++) {
        if (qa === 0 && qb === 0) continue
        const total = qa * a.amount + qb * b.amount
        if (total < neededInContainerUnits) continue
        const cost = qa * a.price + qb * b.price
        const items: ContainerCombo['items'] = []
        if (qa > 0) items.push({ container: a, quantity: qa })
        if (qb > 0) items.push({ container: b, quantity: qb })
        combos.push({
          items,
          totalCost: cost,
          totalAmount: total,
          excess: total - neededInContainerUnits,
          containerCount: qa + qb,
        })
      }
    }
  } else {
    // 3+ containers: still enumerate but limit iterations
    const sorted = [...available].sort((x, y) => y.amount - x.amount)
    const maxPerContainer = sorted.map((c) =>
      Math.min(Math.ceil(neededInContainerUnits / c.amount) + 1, maxCount)
    )

    function enumerate(idx: number, quantities: number[]): void {
      if (idx === sorted.length) {
        const total = sorted.reduce((sum, c, i) => sum + c.amount * quantities[i], 0)
        if (total < neededInContainerUnits) return
        const cost = sorted.reduce((sum, c, i) => sum + c.price * quantities[i], 0)
        const count = quantities.reduce((a, b) => a + b, 0)
        if (count === 0) return
        const items: ContainerCombo['items'] = []
        sorted.forEach((c, i) => {
          if (quantities[i] > 0) items.push({ container: c, quantity: quantities[i] })
        })
        combos.push({
          items,
          totalCost: cost,
          totalAmount: total,
          excess: total - neededInContainerUnits,
          containerCount: count,
        })
        return
      }
      for (let q = 0; q <= maxPerContainer[idx]; q++) {
        quantities[idx] = q
        enumerate(idx + 1, quantities)
      }
    }

    enumerate(0, new Array(sorted.length).fill(0))
  }

  if (combos.length === 0) {
    // Fallback: just pick the largest container
    const c = available.sort((a, b) => b.amount - a.amount)[0]
    const qty = Math.max(1, Math.ceil(neededInContainerUnits / c.amount))
    combos.push({
      items: [{ container: c, quantity: qty }],
      totalCost: qty * c.price,
      totalAmount: qty * c.amount,
      excess: qty * c.amount - neededInContainerUnits,
      containerCount: qty,
    })
  }

  // Score: lowest cost → lowest excess → fewest containers
  combos.sort((a, b) => {
    if (a.totalCost !== b.totalCost) return a.totalCost - b.totalCost
    if (a.excess !== b.excess) return a.excess - b.excess
    return a.containerCount - b.containerCount
  })

  // Apply single-SKU preference: if top combo uses mixed sizes and a same-cost
  // single-SKU combo exists, prefer it
  const best = combos[0]
  if (best.items.length > 1) {
    const singleSkuAlt = combos.find(
      (c) =>
        c.items.length === 1 &&
        c.items[0].container.preferSingleSku &&
        c.totalCost <= best.totalCost * 1.1
    )
    if (singleSkuAlt) {
      combos.unshift(combos.splice(combos.indexOf(singleSkuAlt), 1)[0])
    }
  }

  const winner = combos[0]
  const runnerUp = combos.length > 1 ? combos[1] : null

  // Determine if alternative is meaningfully different
  let alternativeOption: ContainerRecommendation[] | null = null
  if (
    product.showAlternatives &&
    runnerUp &&
    (Math.abs(runnerUp.totalCost - winner.totalCost) / winner.totalCost > 0.1 ||
      Math.abs(runnerUp.excess - winner.excess) / Math.max(neededInContainerUnits, 1) > 0.5)
  ) {
    alternativeOption = runnerUp.items.map((i) => ({
      label: i.container.label,
      quantity: i.quantity,
      priceEach: i.container.price,
      subtotal: i.quantity * i.container.price,
      variantGid: i.container.variantGid,
      availableForSale: i.container.availableForSale,
    }))
  }

  const excessUnit = inferContainerUnit(product) === 'lb' ? 'lbs' : 'oz'
  const excessPct =
    neededInContainerUnits > 0 ? Math.round((winner.excess / neededInContainerUnits) * 100) : 0
  const excessNote =
    winner.excess > 0
      ? `Includes ${formatAmount(winner.excess, excessUnit)} extra — store sealed for your next application.`
      : ''

  return {
    containers: winner.items.map((i) => ({
      label: i.container.label,
      quantity: i.quantity,
      priceEach: i.container.price,
      subtotal: i.quantity * i.container.price,
      variantGid: i.container.variantGid,
      availableForSale: i.container.availableForSale,
    })),
    estimatedCost: winner.totalCost,
    excessAmount: winner.excess,
    excessUnit,
    excessNote,
    alternativeOption,
  }
}

// =============================================================================
// BUYING PATH DETERMINATION
// =============================================================================

/** Priority: consultation_required > rep_recommended > direct_with_note > direct */
export function determineBuyingPath(
  product: ProductConfig,
  purchase: PurchaseRecommendation | null,
  area: number,
  inputUnit: Unit,
  useCaseId: string,
  confidence: ConfidenceLevel
): { path: BuyingPath; reason: string } {
  const t = product.thresholds

  // Check consultation conditions
  for (const condition of t.consultationRequired.conditions) {
    if (condition === 'houses_gt_8' && inputUnit === 'houses' && area > 8) {
      return {
        path: 'consultation_required',
        reason: 'Large operation — a specialist can help optimize your protocol.',
      }
    }
    if (condition === 'heavy_ammonia' && useCaseId === 'heavy-ammonia') {
      return {
        path: 'consultation_required',
        reason: 'Heavy ammonia situations benefit from a customized protocol.',
      }
    }
  }

  if (!purchase) return { path: 'direct', reason: '' }

  // Check rep_recommended thresholds
  const totalContainers = purchase.containers.reduce((sum, c) => sum + c.quantity, 0)

  if (t.repRecommended.minCost && purchase.estimatedCost >= t.repRecommended.minCost) {
    return {
      path: 'rep_recommended',
      reason: 'Volume pricing available for orders of this size.',
    }
  }
  if (t.repRecommended.minContainers && totalContainers >= t.repRecommended.minContainers) {
    return {
      path: 'rep_recommended',
      reason: 'Volume pricing available for orders of this size.',
    }
  }
  if (t.repRecommended.minHouses && inputUnit === 'houses' && area >= t.repRecommended.minHouses) {
    return {
      path: 'rep_recommended',
      reason: 'Talk to a poultry specialist for multi-house pricing.',
    }
  }

  // direct_with_note for moderate confidence
  if (confidence === 'moderate') {
    return {
      path: 'direct_with_note',
      reason: 'Have questions? A specialist can help fine-tune your application.',
    }
  }

  return { path: 'direct', reason: '' }
}

// =============================================================================
// CONFIDENCE LEVEL
// =============================================================================

function determineConfidence(
  product: ProductConfig,
  useCaseId: string
): { level: ConfidenceLevel; note: string | null } {
  // Water-line products have inherent variability
  if (product.handle === 'poultry-probiotic') {
    return {
      level: 'moderate',
      note: 'Water system capacity varies — verify with your service tech.',
    }
  }

  // Poultry products with estimate disclaimer
  const useCase = product.useCases.find((uc) => uc.id === useCaseId)
  if (useCase?.showEstimateDisclaimer) {
    return {
      level: 'moderate',
      note: 'This is an estimate based on standard house assumptions.',
    }
  }

  return { level: 'high', note: null }
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

export function calculateResult(
  productHandle: string,
  useCaseId: string,
  area: number,
  inputUnit: Unit,
  onHand: number = 0
): AppRateResult | null {
  const product = getProduct(productHandle)
  if (!product) {
    console.error(`[AppRateCalc] Product not found: ${productHandle}`)
    return null
  }

  const rule = product.rates.find((r) => r.useCase === useCaseId)
  if (!rule) {
    console.error(`[AppRateCalc] Rate rule not found: ${productHandle}/${useCaseId}`)
    return null
  }

  if (area <= 0) return null

  // Clamp onHand to non-negative
  const clampedOnHand = Math.max(0, onHand)

  // 1. Application math
  const application = calculateApplication(product, rule, area, inputUnit, clampedOnHand)
  if (!application) return null

  // 2. Check if user has enough on hand
  const sufficientOnHand = application.totalNeeded <= 0

  // 3. Package optimization (skip if user has enough)
  const purchase = sufficientOnHand
    ? null
    : optimizeContainers(product, application.totalNeeded, rule.rateUnit)

  // 4. Confidence
  const { level: confidenceLevel, note: confidenceNote } = determineConfidence(product, useCaseId)

  // 5. Buying path
  const { path: buyingPath, reason: buyingPathReason } = determineBuyingPath(
    product,
    purchase,
    area,
    inputUnit,
    useCaseId,
    confidenceLevel
  )

  // 6. Cart lines
  const cartLines: AppRateResult['cartLines'] = []
  if (purchase) {
    for (const c of purchase.containers) {
      if (c.variantGid) {
        cartLines.push({ variantGid: c.variantGid, quantity: c.quantity })
      }
    }
  }

  // 7. Unit consistency assertion
  if (product.containers.length > 0) {
    const containerPkgUnit = product.containers[0].packageUnit
    const rateUnitFamily =
      rule.rateUnit in TO_OZ ? 'liquid' : rule.rateUnit in TO_LB ? 'weight' : 'other'
    const containerFamily =
      containerPkgUnit in TO_OZ || containerPkgUnit === 'oz'
        ? 'liquid'
        : containerPkgUnit in TO_LB || containerPkgUnit === 'lbs'
          ? 'weight'
          : 'other'
    if (
      rateUnitFamily !== containerFamily &&
      rateUnitFamily !== 'other' &&
      containerFamily !== 'other'
    ) {
      console.error(
        `[AppRateCalc] Unit mismatch: ${product.handle} rate=${rule.rateUnit} (${rateUnitFamily}) vs container=${containerPkgUnit} (${containerFamily})`
      )
    }
  }

  // Detect commercial (legacy compat for component)
  const isCommercial = buyingPath === 'rep_recommended' || buyingPath === 'consultation_required'

  return {
    productName: product.name,
    productHandle: product.handle,
    segment: product.segment as Segment,
    application,
    purchase,
    frequency: rule.frequency ?? null,
    buyingPath,
    buyingPathReason,
    confidenceLevel,
    confidenceNote,
    cartLines,
    sufficientOnHand,
    isCommercial,
  }
}

// =============================================================================
// DISPLAY HELPERS (exported for component use)
// =============================================================================

export function formatAmount(amount: number, unit: string): string {
  if (amount < 0.01) return `< 0.01 ${unit}`
  if (amount >= 100) return `${Math.round(amount)} ${unit}`
  if (amount >= 10) return `${Math.round(amount * 10) / 10} ${unit}`
  return `${Math.round(amount * 100) / 100} ${unit}`
}

export function formatCoverage(area: number, unit: Unit): string {
  const labels: Record<Unit, string> = {
    sqft: 'sq ft',
    acres: area === 1 ? 'acre' : 'acres',
    houses: area === 1 ? 'house' : 'houses',
  }
  return `${area.toLocaleString()} ${labels[unit]}`
}
