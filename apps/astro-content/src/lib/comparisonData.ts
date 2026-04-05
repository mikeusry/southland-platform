/**
 * Product Comparison Tool — Scenario Data & Comparison Logic
 *
 * Scenario builder → comparison cards → evidence drawer.
 * Framed as decision support, NOT "us vs them."
 */

// =============================================================================
// TYPES
// =============================================================================

export type CustomerType = 'poultry' | 'turf-pro' | 'lawn' | 'agriculture'
export type GoalType =
  | 'disease-prevention'
  | 'odor-ammonia'
  | 'soil-health'
  | 'growth-performance'
  | 'pest-control'
export type PriorityType = 'cost' | 'safety' | 'long-term' | 'speed'

export interface ScenarioInputs {
  customerType: CustomerType
  goal: GoalType
  priority: PriorityType
}

export interface ComparisonRow {
  criteria: string
  biological: string
  conventional: string
  /** Which approach is generally "best fit" for this criteria */
  advantage?: 'biological' | 'conventional' | 'neutral'
  /** Evidence/notes that go in the expandable drawer */
  evidence?: string
}

export interface ComparisonResult {
  headline: string
  summary: string
  rows: ComparisonRow[]
  biologicalProduct: {
    name: string
    handle: string
    reason: string
  }
  conventionalAlternative: string
  bottomLine: string
}

// =============================================================================
// OPTIONS
// =============================================================================

export const CUSTOMER_TYPES: { id: CustomerType; label: string }[] = [
  { id: 'poultry', label: 'Poultry Operations' },
  { id: 'turf-pro', label: 'Turf Professional' },
  { id: 'lawn', label: 'Homeowner (Lawn)' },
  { id: 'agriculture', label: 'Agriculture / Farm' },
]

export const GOALS: { id: GoalType; label: string }[] = [
  { id: 'disease-prevention', label: 'Disease Prevention' },
  { id: 'odor-ammonia', label: 'Odor / Ammonia Control' },
  { id: 'soil-health', label: 'Soil Health' },
  { id: 'growth-performance', label: 'Growth / Performance' },
  { id: 'pest-control', label: 'Pest / Insect Control' },
]

export const PRIORITIES: { id: PriorityType; label: string }[] = [
  { id: 'cost', label: 'Lowest Cost' },
  { id: 'safety', label: 'Safety First' },
  { id: 'long-term', label: 'Long-Term Results' },
  { id: 'speed', label: 'Fastest Results' },
]

// =============================================================================
// COMPARISON ENGINE
// =============================================================================

export function getComparison(inputs: ScenarioInputs): ComparisonResult {
  const { customerType, goal, priority } = inputs

  // Base comparison rows that apply across scenarios
  const baseRows: ComparisonRow[] = [
    {
      criteria: 'Re-entry / safety interval',
      biological: 'None — apply and enter immediately',
      conventional: '24-48 hours for most chemical treatments',
      advantage: 'biological',
      evidence:
        'Biological products contain naturally occurring organisms with no chemical residue. No PPE, withdrawal, or buffer zone requirements for most biological products.',
    },
    {
      criteria: 'Soil biology impact',
      biological: 'Builds and diversifies over time',
      conventional: 'May suppress beneficial organisms',
      advantage: 'biological',
      evidence:
        'Chemical inputs (fungicides, fumigants, high-salt fertilizers) can reduce microbial diversity by 40-60%. Biological products introduce beneficial species that compound over seasons.',
    },
    {
      criteria: 'Long-term efficacy',
      biological: 'Improves with consistent use as biology establishes',
      conventional: 'Consistent per-application but no compounding benefit',
      advantage: priority === 'long-term' ? 'biological' : 'neutral',
      evidence:
        'Biological programs typically show increasing returns over 2-4 seasons as microbial populations establish. Chemical programs deliver the same result each application.',
    },
    {
      criteria: 'Speed of visible results',
      biological: '2-6 weeks for visible changes',
      conventional: '24-72 hours for most chemical treatments',
      advantage: priority === 'speed' ? 'conventional' : 'neutral',
      evidence:
        'Conventional approaches may act faster in acute situations. Biological programs support longer-term goals but require patience for initial results.',
    },
  ]

  // Scenario-specific rows and products
  if (customerType === 'poultry') {
    return getPoultryComparison(goal, priority, baseRows)
  } else if (customerType === 'turf-pro' || customerType === 'lawn') {
    return getTurfComparison(customerType, goal, priority, baseRows)
  } else {
    return getAgComparison(goal, priority, baseRows)
  }
}

function getPoultryComparison(
  goal: GoalType,
  priority: PriorityType,
  baseRows: ComparisonRow[]
): ComparisonResult {
  const scenarioRows: ComparisonRow[] = []

  if (goal === 'disease-prevention' || goal === 'growth-performance') {
    scenarioRows.push(
      {
        criteria: 'Mechanism of action',
        biological:
          'Competitive exclusion — beneficial bacteria colonize gut, crowding out pathogens',
        conventional: 'Antibiotics kill both harmful and beneficial bacteria',
        advantage: 'neutral',
        evidence:
          'Big Ole Bird uses 7 beneficial strains for competitive exclusion. UGA field trial showed 6.2% mortality reduction vs. untreated controls.',
      },
      {
        criteria: 'Antibiotic-free / NAE compliance',
        biological: 'Fully compatible — USDA Organic compliant',
        conventional: 'Not compatible with NAE programs',
        advantage: 'biological',
        evidence:
          'Integrators increasingly require NAE programs. Biological probiotics are one of the few performance tools available to NAE and organic operations.',
      },
      {
        criteria: 'Cost per bird',
        biological: '~$0.02 per bird (Big Ole Bird)',
        conventional: 'Varies by antibiotic — typically $0.01-0.05 per bird',
        advantage: 'neutral',
        evidence:
          'When factoring in mortality reduction (6.2%) and FCR improvement (0.04 points), the net ROI of Big Ole Bird is positive within the first flock.',
      }
    )

    return {
      headline: 'Probiotics vs. Antibiotics for Poultry Performance',
      summary:
        'Both approaches aim to improve livability and feed conversion. Probiotics build gut health through beneficial bacteria; antibiotics control pathogens through elimination. The choice often depends on program requirements (NAE) and long-term goals.',
      rows: [...scenarioRows, ...baseRows],
      biologicalProduct: {
        name: 'Big Ole Bird',
        handle: 'poultry-probiotic',
        reason:
          'Multi-strain probiotic with UGA-validated results: 6.2% mortality reduction, 0.04 FCR improvement.',
      },
      conventionalAlternative: 'Therapeutic antibiotics (BMD, bacitracin)',
      bottomLine:
        "Big Ole Bird is best fit when you need NAE-compatible performance support with compounding benefits. Conventional antibiotics may act faster for acute therapeutic needs but don't build long-term gut health.",
    }
  }

  if (goal === 'odor-ammonia') {
    scenarioRows.push(
      {
        criteria: 'Ammonia reduction mechanism',
        biological: 'Shifts microbial balance — reduces ammonia-producing bacteria at the source',
        conventional: 'Chemical binding (alum, PLT) — binds ammonia after production',
        advantage: 'biological',
        evidence:
          "Litter Life reduces ammonia 40-60% by competitive exclusion of ammonia-producing bacteria. Chemical PLT lowers pH to bind ammonia but doesn't address the source.",
      },
      {
        criteria: 'Litter life extension',
        biological: '2-3 additional flocks between cleanouts',
        conventional: 'Minimal impact on litter longevity',
        advantage: 'biological',
        evidence:
          'Growers on Litter Life report going 7+ flocks vs. 4 flocks on chemical PLT. Each avoided cleanout saves $3,000-5,000.',
      },
      {
        criteria: 'Paw quality impact',
        biological: 'Drier litter → better paw scores',
        conventional: 'Variable — acidic pH can cause pad burns if over-applied',
        advantage: 'biological',
      }
    )

    return {
      headline: 'Biological vs. Chemical Ammonia Control',
      summary:
        "Both approaches reduce ammonia in poultry houses. Biological treatments shift the microbial balance to reduce ammonia production at the source. Chemical treatments (alum, PLT) bind ammonia after it's produced.",
      rows: [...scenarioRows, ...baseRows],
      biologicalProduct: {
        name: 'Litter Life',
        handle: 'poultry-litter-amendment',
        reason: '40-60% ammonia reduction, extends litter 2-3 flocks, improves paw quality.',
      },
      conventionalAlternative: 'Poultry litter treatment (alum, PLT)',
      bottomLine:
        "Litter Life is best fit when you want source-level ammonia control with extended litter life. Chemical PLT may be faster for acute ammonia events but doesn't reduce production over time.",
    }
  }

  if (goal === 'pest-control') {
    scenarioRows.push(
      {
        criteria: 'Target pests',
        biological: 'Darkling beetles, mites, and litter-dwelling insects',
        conventional: 'Same targets — synthetic pyrethroids, organophosphates',
        advantage: 'neutral',
      },
      {
        criteria: 'Resistance development',
        biological: 'Low resistance risk — multiple mechanisms of action',
        conventional: 'High resistance risk — single mode of action per chemical class',
        advantage: 'biological',
        evidence:
          'Beetle populations commonly develop resistance to cyfluthrin and permethrin within 2-3 seasons. Biological products use multiple mechanisms that are harder to develop resistance to.',
      },
      {
        criteria: 'Compatibility with bird presence',
        biological: 'Can apply perimeter treatment during production',
        conventional: 'Most require bird-free application or buffer zones',
        advantage: 'biological',
      }
    )

    return {
      headline: 'Biological vs. Chemical Beetle & Mite Control',
      summary:
        'Both approaches target darkling beetles and mites in poultry houses. Biological treatments use natural mechanisms; chemical treatments use synthetic insecticides.',
      rows: [...scenarioRows, ...baseRows],
      biologicalProduct: {
        name: 'Desecticide',
        handle: 'natural-mite-control-livestock-poultry',
        reason:
          'Natural beetle and mite control. Low resistance risk. Can treat during production.',
      },
      conventionalAlternative: 'Synthetic pyrethroids (cyfluthrin, permethrin)',
      bottomLine:
        'Desecticide is best fit when you need ongoing beetle management without resistance buildup. Chemical insecticides may deliver faster initial knockdown but lose efficacy over seasons.',
    }
  }

  // Default poultry comparison
  return getPoultryComparison('disease-prevention', priority, baseRows)
}

function getTurfComparison(
  customerType: CustomerType,
  goal: GoalType,
  priority: PriorityType,
  baseRows: ComparisonRow[]
): ComparisonResult {
  const scenarioRows: ComparisonRow[] = []
  const isPro = customerType === 'turf-pro'

  if (goal === 'soil-health' || goal === 'growth-performance') {
    scenarioRows.push(
      {
        criteria: 'Nutrient availability',
        biological: 'Microbes convert locked-up nutrients to plant-available forms',
        conventional: 'Direct nutrient delivery — available immediately but not sustained',
        advantage: priority === 'speed' ? 'conventional' : 'biological',
        evidence:
          "Synthetic fertilizers provide immediately available N-P-K but don't address the soil's ability to cycle nutrients naturally. Over time, biological programs reduce fertilizer input needs as soil biology improves nutrient cycling.",
      },
      {
        criteria: 'Thatch management',
        biological: 'Natural decomposition by beneficial fungi and bacteria',
        conventional: 'Mechanical dethatching or chemical degradation',
        advantage: 'biological',
        evidence:
          'Genesis introduces thatch-decomposing microbes that break down organic matter continuously. Mechanical dethatching is periodic and can damage turf.',
      },
      {
        criteria: 'Root depth improvement',
        biological: 'Mycorrhizal networks extend effective root zone up to 100x',
        conventional: 'No root extension mechanism',
        advantage: 'biological',
        evidence:
          'Mycorrhizal fungi in Genesis form symbiotic networks with grass roots, accessing water and nutrients far beyond the root zone. Soil lab analysis shows 2x root depth improvement within 90 days.',
      },
      {
        criteria: isPro ? 'Cost per acre' : 'Cost per 1,000 sq ft',
        biological: isPro
          ? '$100-150/acre/year (Genesis + Humates)'
          : '$8-12 per 1,000 sq ft per application',
        conventional: isPro
          ? '$200-400/acre/year (full synthetic program)'
          : '$5-15 per 1,000 sq ft per application',
        advantage: priority === 'cost' ? 'neutral' : 'biological',
        evidence:
          'Biological programs have lower per-application costs that decrease over time as soil health improves. Synthetic programs maintain the same cost indefinitely.',
      }
    )

    return {
      headline: 'Biological vs. Synthetic Turf Programs',
      summary:
        "Both approaches aim for healthier, greener turf. Biological programs rebuild soil biology for self-sustaining health. Synthetic programs deliver nutrients directly but don't build soil capacity.",
      rows: [...scenarioRows, ...baseRows],
      biologicalProduct: {
        name: 'Genesis + Humates',
        handle: 'genesis',
        reason:
          'Rebuilds soil biology (20+ microbial species) + feeds it (humic acid). Foundation of organic turf programs.',
      },
      conventionalAlternative: 'Synthetic fertilizer + fungicide program',
      bottomLine:
        'Genesis + Humates is best fit when building long-term soil health and reducing input dependency. Synthetic programs deliver immediate visible results but create ongoing input dependence.',
    }
  }

  if (goal === 'pest-control') {
    scenarioRows.push(
      {
        criteria: 'Environmental safety',
        biological: 'Safe for kids, pets, waterways — no restrictions',
        conventional: 'Re-entry intervals, buffer zones near water',
        advantage: 'biological',
      },
      {
        criteria: 'Target specificity',
        biological: 'Contact-based — affects targeted weeds/pests only',
        conventional: 'Systemic — may affect non-target organisms',
        advantage: 'biological',
      }
    )

    return {
      headline: 'Natural vs. Chemical Weed & Pest Control',
      summary:
        'Both approaches control weeds and pests. Natural products use contact-based mechanisms; chemical products use systemic action.',
      rows: [...scenarioRows, ...baseRows],
      biologicalProduct: {
        name: 'Torched',
        handle: 'torched-all-natural-weed-killer',
        reason: 'Natural weed killer safe for all environments. No re-entry restrictions.',
      },
      conventionalAlternative: 'Synthetic herbicides (glyphosate, 2,4-D)',
      bottomLine:
        'Torched is best fit when safety around kids, pets, and waterways is a priority. Synthetic herbicides may provide broader systemic control but carry restrictions.',
    }
  }

  // Default turf
  return getTurfComparison(customerType, 'soil-health', priority, baseRows)
}

function getAgComparison(
  goal: GoalType,
  priority: PriorityType,
  baseRows: ComparisonRow[]
): ComparisonResult {
  const scenarioRows: ComparisonRow[] = [
    {
      criteria: 'Soil biology impact',
      biological: 'Rebuilds microbial diversity and soil food web',
      conventional: 'May suppress beneficial organisms with repeated use',
      advantage: 'biological',
    },
    {
      criteria: 'Input costs over time',
      biological: 'Decrease as biology establishes and cycles nutrients',
      conventional: 'Remain constant or increase with resistance/depletion',
      advantage: priority === 'long-term' ? 'biological' : 'neutral',
    },
    {
      criteria: 'Organic certification',
      biological: 'Compatible with USDA Organic / WSDA programs',
      conventional: 'Typically not compatible',
      advantage: 'biological',
    },
  ]

  return {
    headline: 'Biological vs. Conventional Farm Inputs',
    summary:
      'Both approaches support crop and soil health. Biological inputs rebuild natural processes; conventional inputs deliver direct chemical intervention.',
    rows: [...scenarioRows, ...baseRows],
    biologicalProduct: {
      name: 'Genesis + Jump Start',
      handle: 'genesis',
      reason:
        'Soil biology rebuild (Genesis) + rapid conditioning (Jump Start) for agricultural applications.',
    },
    conventionalAlternative: 'Synthetic fertilizer + chemical amendment program',
    bottomLine:
      "Biological programs are best fit when building soil health for long-term productivity and organic compatibility. Conventional programs may deliver faster visible results but don't build soil capacity.",
  }
}

// =============================================================================
// HELPERS
// =============================================================================

export function buildComparisonSummary(inputs: ScenarioInputs, result: ComparisonResult): string {
  return `Comparison: ${CUSTOMER_TYPES.find((t) => t.id === inputs.customerType)?.label}, ${GOALS.find((g) => g.id === inputs.goal)?.label}, Priority=${PRIORITIES.find((p) => p.id === inputs.priority)?.label}. Recommended: ${result.biologicalProduct.name} vs. ${result.conventionalAlternative}.`
}
