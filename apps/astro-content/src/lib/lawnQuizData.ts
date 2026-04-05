/**
 * Lawn Health Assessment Quiz — Questions & Recommendation Engine
 *
 * 5-7 questions → personalized product recommendations.
 * Feel: "Quick diagnosis from an agronomy helper" — not a marketing funnel.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface QuizAnswer {
  id: string
  label: string
  icon?: string
  description?: string
}

export interface QuizQuestion {
  id: string
  title: string
  subtitle?: string
  type: 'single-select' | 'chip-select' | 'severity'
  answers: QuizAnswer[]
  /** If set, only show this question when condition is met */
  condition?: (answers: Record<string, string>) => boolean
}

export interface ProductRecommendation {
  handle: string
  name: string
  reason: string
  priority: number
}

export interface QuizResult {
  diagnosisTitle: string
  diagnosisSummary: string
  recommendations: ProductRecommendation[]
  applicationTiming: string
  calculatorLink: string
}

// =============================================================================
// QUESTIONS
// =============================================================================

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'goal',
    title: "What's your main goal or problem?",
    subtitle: 'Pick the one that matters most right now',
    type: 'single-select',
    answers: [
      {
        id: 'greener',
        label: 'Greener, thicker lawn',
        description: 'General health improvement',
      },
      {
        id: 'weeds',
        label: 'Weed control',
        description: 'Weeds taking over',
      },
      {
        id: 'bare-spots',
        label: 'Bare spots & thin areas',
        description: 'Patchy coverage',
      },
      {
        id: 'pests',
        label: 'Pest or grub issues',
        description: 'Insects damaging turf',
      },
      {
        id: 'general',
        label: 'General soil health',
        description: 'Building long-term foundation',
      },
      {
        id: 'new-lawn',
        label: 'New lawn or renovation',
        description: 'Starting from scratch',
      },
    ],
  },
  {
    id: 'region',
    title: 'What region are you in?',
    type: 'single-select',
    answers: [
      { id: 'southeast', label: 'Southeast' },
      { id: 'northeast', label: 'Northeast' },
      { id: 'midwest', label: 'Midwest' },
      { id: 'southwest', label: 'Southwest' },
      { id: 'west', label: 'West Coast' },
      { id: 'pacific-nw', label: 'Pacific Northwest' },
    ],
  },
  {
    id: 'sun',
    title: 'How much sun does your lawn get?',
    type: 'single-select',
    answers: [
      { id: 'full', label: 'Full sun', description: '6+ hours direct sun' },
      {
        id: 'partial',
        label: 'Partial shade',
        description: '3-6 hours direct sun',
      },
      {
        id: 'mostly-shade',
        label: 'Mostly shade',
        description: 'Less than 3 hours direct sun',
      },
    ],
  },
  {
    id: 'size',
    title: 'How big is your lawn?',
    type: 'chip-select',
    answers: [
      { id: 'under-2k', label: 'Under 2,000 sq ft' },
      { id: '2k-5k', label: '2,000 - 5,000 sq ft' },
      { id: '5k-10k', label: '5,000 - 10,000 sq ft' },
      { id: '10k-20k', label: '10,000 - 20,000 sq ft' },
      { id: '20k-plus', label: '20,000+ sq ft' },
    ],
  },
  {
    id: 'severity',
    title: 'How bad is the issue?',
    type: 'severity',
    answers: [
      {
        id: 'mild',
        label: 'Just starting',
        description: 'Noticed recently, small area',
      },
      {
        id: 'moderate',
        label: 'Moderate',
        description: 'Clearly visible, spreading',
      },
      {
        id: 'severe',
        label: 'Severe',
        description: 'Major problem, large area affected',
      },
    ],
  },
  {
    id: 'pets-kids',
    title: 'Do you have pets or kids using the lawn?',
    subtitle: "This affects which products we'll recommend",
    type: 'single-select',
    condition: (answers) => answers.goal === 'pests' || answers.goal === 'weeds',
    answers: [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ],
  },
  {
    id: 'grass-type',
    title: 'What type of grass do you have?',
    type: 'single-select',
    condition: (answers) => answers.goal === 'bare-spots' || answers.goal === 'new-lawn',
    answers: [
      { id: 'bermuda', label: 'Bermuda' },
      { id: 'fescue', label: 'Fescue' },
      { id: 'zoysia', label: 'Zoysia' },
      { id: 'st-augustine', label: 'St. Augustine' },
      { id: 'not-sure', label: 'Not sure' },
    ],
  },
]

// =============================================================================
// RECOMMENDATION ENGINE
// =============================================================================

export function getRecommendations(answers: Record<string, string>): QuizResult {
  const recs: ProductRecommendation[] = []
  const goal = answers.goal
  const severity = answers.severity ?? 'moderate'
  const hasPetsKids = answers['pets-kids'] === 'yes'

  // Genesis is the foundation for almost everything
  const genesisReasons: Record<string, string> = {
    greener:
      'Genesis rebuilds the soil biology that makes nutrients available to your grass — the foundation of a greener lawn.',
    weeds:
      'Healthy soil biology supports dense turf that crowds out weeds naturally. Genesis is the biological foundation.',
    'bare-spots':
      'Genesis introduces mycorrhizal fungi that extend root networks, helping new growth fill in faster.',
    pests:
      'Diverse soil biology suppresses pest-friendly conditions. Genesis rebuilds that biological defense.',
    general:
      'Genesis introduces 20+ microbial species to rebuild the soil food web — exactly what long-term soil health requires.',
    'new-lawn':
      'New construction soil is biologically dead. Genesis restores the microbial life that new grass needs to establish.',
  }

  recs.push({
    handle: 'genesis',
    name: 'Genesis',
    reason:
      genesisReasons[goal] ??
      'Genesis rebuilds soil biology — the foundation of every healthy lawn.',
    priority: 1,
  })

  // Humates pair with Genesis for soil health
  if (goal === 'greener' || goal === 'general' || goal === 'new-lawn' || severity === 'severe') {
    recs.push({
      handle: 'veridian-humate-liquid-iron-for-lawns',
      name: 'Humates',
      reason:
        'Humic acid feeds and sustains the microbes Genesis introduces. Together, they rebuild soil structure and nutrient availability.',
      priority: 2,
    })
  }

  // Torched for weed control
  if (goal === 'weeds') {
    recs.push({
      handle: 'torched-all-natural-weed-killer',
      name: 'Torched',
      reason: hasPetsKids
        ? 'Natural weed killer safe for kids and pets. Spray directly on weeds — no re-entry restrictions.'
        : 'Natural weed killer that burns down existing weeds. Apply directly to weed foliage on a sunny day.',
      priority: 2,
    })
  }

  // Jump Start for depleted / new lawns
  if (goal === 'new-lawn' || goal === 'bare-spots') {
    recs.push({
      handle: 'jump-start-soil-conditioner',
      name: 'Jump Start',
      reason:
        'Jump Start conditions depleted soil so new grass establishes faster. Use before Genesis to prepare the soil.',
      priority: severity === 'severe' ? 1 : 3,
    })
  }

  // C-Fix for severe soil issues
  if (severity === 'severe' && (goal === 'general' || goal === 'new-lawn')) {
    recs.push({
      handle: 'c-fix-biochar-soil-amendment',
      name: 'C-Fix Biochar',
      reason:
        'Biochar creates permanent microbial habitat in the soil. For severely depleted soil, it accelerates the biological rebuild.',
      priority: 3,
    })
  }

  // Chicken Manure Fertilizer for greener / bare spots
  if (goal === 'greener' || goal === 'bare-spots') {
    recs.push({
      handle: 'chicken-manure-fertilizer',
      name: 'Chicken Manure Fertilizer',
      reason:
        'Organic slow-release fertility that feeds both the grass and the soil biology. Pairs perfectly with Genesis.',
      priority: 3,
    })
  }

  // Sort by priority, limit to top 3
  recs.sort((a, b) => a.priority - b.priority)
  const topRecs = recs.slice(0, 3)

  // Build diagnosis
  const diagnosisTitles: Record<string, string> = {
    greener: 'Your lawn needs a soil biology boost',
    weeds: 'Weeds are winning because your soil biology is weak',
    'bare-spots': 'Bare spots signal depleted soil and weak roots',
    pests: 'Pest pressure increases when soil biology declines',
    general: 'Your soil needs a biological foundation',
    'new-lawn': 'New soil needs biology before grass can thrive',
  }

  const diagnosisSummaries: Record<string, string> = {
    greener:
      "A lawn that won't green up despite fertilizer usually has a soil biology problem, not a nutrient problem. When beneficial microbes are absent, nutrients get locked up in forms grass can't use. Rebuilding microbial life unlocks existing soil nutrients and improves root depth.",
    weeds:
      'Weeds thrive in stressed, thin turf with poor soil biology. Instead of just killing weeds (which creates bare spots for more weeds), rebuild the soil so your grass can outcompete them naturally. Torched handles existing weeds while Genesis builds the biological defense.',
    'bare-spots':
      "Bare spots and thin areas usually mean shallow roots and depleted soil biology. Without mycorrhizal fungi extending the root network, grass can't access water and nutrients beyond the top inch of soil. Restoring biology helps new growth fill in and stay.",
    pests:
      'Pest pressure is often a symptom of stressed turf and unbalanced soil biology. Diverse microbial populations suppress pest-friendly conditions through competitive exclusion. Rebuilding biology reduces the conditions pests exploit.',
    general:
      'Long-term soil health starts with biology. Beneficial bacteria and fungi cycle nutrients, decompose thatch, build soil structure, and suppress disease. Genesis + Humates is the foundational program that makes everything else work better.',
    'new-lawn':
      'New construction soil is typically compacted, stripped of topsoil, and biologically dead. Seeding or sodding without restoring biology means your grass is growing in sterile dirt. Jump-start the soil first, then seed.',
  }

  // Application timing based on region
  const warmSeason = ['southeast', 'southwest'].includes(answers.region ?? 'southeast')
  const applicationTiming = warmSeason
    ? 'Best applied in early spring (March-April) or early fall (September-October) when soil temps are above 55°F.'
    : 'Best applied in spring (April-May) or fall (September-October) when soil biology is most active.'

  // Size-appropriate calculator link
  const sizeParam =
    answers.size === 'under-2k'
      ? '1000'
      : answers.size === '2k-5k'
        ? '3500'
        : answers.size === '5k-10k'
          ? '7500'
          : answers.size === '10k-20k'
            ? '15000'
            : '25000'

  return {
    diagnosisTitle: diagnosisTitles[goal] ?? 'Your lawn needs biological help',
    diagnosisSummary:
      diagnosisSummaries[goal] ?? 'Rebuilding soil biology is the foundation of a healthy lawn.',
    recommendations: topRecs,
    applicationTiming,
    calculatorLink: `/application-rate-calculator/?product=genesis&area=${sizeParam}`,
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/** Human-readable summary for Nexus lead message */
export function buildQuizSummary(answers: Record<string, string>, result: QuizResult): string {
  const parts = [
    `Goal=${answers.goal}`,
    `Region=${answers.region}`,
    `Sun=${answers.sun}`,
    `Size=${answers.size}`,
    `Severity=${answers.severity}`,
  ]
  if (answers['pets-kids']) parts.push(`PetsKids=${answers['pets-kids']}`)
  if (answers['grass-type']) parts.push(`Grass=${answers['grass-type']}`)

  const recNames = result.recommendations.map((r) => r.name).join(' + ')
  return `Lawn Quiz: ${parts.join(', ')}. Recommended: ${recNames}.`
}
