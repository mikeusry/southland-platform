/**
 * Backyard Flock Health Check — Questions & Recommendation Engine
 *
 * 7 questions → personalized flock health risk score + recommended care plan.
 * Persona target: Backyard Betty (small flock owner, 5–25 birds).
 * Output: risk tier (Low / Moderate / High) + ranked Southland products + seasonal timing.
 *
 * Feel: "A poultry-keeper friend with experience giving honest care advice."
 * NOT: marketing funnel, NOT diagnostic. Information + product fit, not medical claims.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface QuizAnswer {
  id: string
  label: string
  description?: string
  /** Risk score contribution (0 = healthy signal, higher = higher risk) */
  risk: number
}

export interface QuizQuestion {
  id: string
  title: string
  subtitle?: string
  type: 'single-select' | 'chip-select' | 'severity'
  answers: QuizAnswer[]
  condition?: (answers: Record<string, string>) => boolean
}

export interface ProductRecommendation {
  handle: string
  name: string
  reason: string
  priority: number
}

export type RiskTier = 'low' | 'moderate' | 'high'

export interface QuizResult {
  riskTier: RiskTier
  riskScore: number
  diagnosisTitle: string
  diagnosisSummary: string
  recommendations: ProductRecommendation[]
  seasonalGuidance: string
}

// =============================================================================
// QUESTIONS
// =============================================================================

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'flock-size',
    title: 'How many chickens do you have?',
    subtitle: 'Helps us right-size your care plan',
    type: 'single-select',
    answers: [
      { id: 'just-starting', label: "I don't have any yet", description: 'Planning a flock', risk: 0 },
      { id: 'tiny', label: '1–4 birds', description: 'Backyard starter', risk: 0 },
      { id: 'small', label: '5–10 birds', description: 'Family flock', risk: 0 },
      { id: 'medium', label: '11–25 birds', description: 'Small homestead', risk: 0 },
      { id: 'large', label: '25+ birds', description: 'Larger operation', risk: 0 },
    ],
  },
  {
    id: 'bird-age',
    title: "What's your flock's age range?",
    type: 'single-select',
    answers: [
      { id: 'chicks', label: 'Chicks (under 6 weeks)', description: 'Brooder-age', risk: 2 },
      { id: 'pullets', label: 'Pullets (6 weeks – 5 months)', description: 'Pre-laying', risk: 1 },
      { id: 'layers', label: 'Laying hens (5+ months)', description: 'Adult productive', risk: 0 },
      { id: 'mixed', label: 'Mixed ages', description: 'Multi-generational', risk: 1 },
      { id: 'older', label: 'Older flock (3+ years)', description: 'Veteran birds', risk: 1 },
    ],
  },
  {
    id: 'recent-symptoms',
    title: 'Any of these signs in the last 30 days?',
    subtitle: 'Pick all that apply — be honest, this is private',
    type: 'chip-select',
    answers: [
      { id: 'none', label: 'None — flock looks great', risk: 0 },
      { id: 'pasty-butt', label: 'Pasty butt or vent issues', risk: 3 },
      { id: 'feather-loss', label: 'Feather loss or thin patches', risk: 2 },
      { id: 'lethargy', label: 'Lethargy or low energy', risk: 3 },
      { id: 'low-eggs', label: 'Egg production drop', risk: 2 },
      { id: 'soft-eggs', label: 'Soft or shell-less eggs', risk: 2 },
      { id: 'mites-suspect', label: 'Mites or lice suspected', risk: 3 },
      { id: 'smell', label: 'Strong coop odor', risk: 1 },
      { id: 'loose-droppings', label: 'Loose or watery droppings', risk: 2 },
    ],
  },
  {
    id: 'current-supplements',
    title: "What's currently in your flock's water or feed routine?",
    type: 'single-select',
    answers: [
      { id: 'none', label: 'Just feed and water', description: 'No supplements yet', risk: 2 },
      { id: 'acv-only', label: 'Apple cider vinegar in water', description: 'Occasional or regular', risk: 1 },
      { id: 'probiotic-only', label: 'Probiotic in rotation', description: 'Hen Helper or similar', risk: 0 },
      { id: 'full-program', label: 'Full natural care program', description: 'Probiotic + ACV + supplements', risk: 0 },
      { id: 'medicated', label: 'Medicated feed or antibiotics', description: 'From a vet or feed store', risk: 2 },
    ],
  },
  {
    id: 'coop-conditions',
    title: 'How would you describe your coop?',
    subtitle: 'Picking the closest match is fine',
    type: 'single-select',
    answers: [
      { id: 'spotless', label: 'Spotless — cleaned weekly', description: 'Low-stress environment', risk: 0 },
      { id: 'tidy', label: 'Tidy — bedding refreshed often', description: 'Standard care', risk: 0 },
      { id: 'lived-in', label: 'Lived-in — needs cleaning soon', description: "It's been a while", risk: 1 },
      { id: 'overdue', label: 'Overdue for a deep clean', description: 'Long overdue', risk: 2 },
      { id: 'crowded', label: 'Crowded for the bird count', description: 'More birds than space', risk: 3 },
    ],
  },
  {
    id: 'recent-changes',
    title: 'Anything stressful in the last 2 weeks?',
    subtitle: 'Stress is the #1 trigger for flock health issues',
    type: 'chip-select',
    answers: [
      { id: 'none', label: 'Nothing unusual', risk: 0 },
      { id: 'new-birds', label: 'Added new birds', risk: 2 },
      { id: 'weather', label: 'Big weather swing', risk: 1 },
      { id: 'predator', label: 'Predator scare', risk: 2 },
      { id: 'feed-change', label: 'Switched feed brand', risk: 1 },
      { id: 'travel', label: 'I was away from the flock', risk: 1 },
      { id: 'broody', label: 'Hen went broody', risk: 1 },
      { id: 'molt', label: 'Birds are molting', risk: 1 },
    ],
  },
  {
    id: 'biggest-concern',
    title: 'What matters most to you right now?',
    subtitle: 'This shapes our recommendation',
    type: 'single-select',
    answers: [
      { id: 'fix-problem', label: 'Fixing an active problem', description: 'Something is going on', risk: 0 },
      { id: 'prevention', label: 'Year-round prevention', description: 'Stay ahead of issues', risk: 0 },
      { id: 'egg-quality', label: 'Better eggs', description: 'Stronger shells, better yolks', risk: 0 },
      { id: 'simplify', label: 'Simplify what I am doing', description: 'Fewer products, easier routine', risk: 0 },
      { id: 'beginner', label: 'Just starting out', description: 'Build it right from day 1', risk: 0 },
    ],
  },
]

// =============================================================================
// RECOMMENDATION ENGINE
// =============================================================================

/** Total risk score across all answers */
function calculateRiskScore(answers: Record<string, string>): number {
  let total = 0
  for (const q of QUIZ_QUESTIONS) {
    const answerValue = answers[q.id]
    if (!answerValue) continue
    if (q.type === 'chip-select') {
      // Chip-select stores comma-separated ids. "none" overrides everything.
      const ids = answerValue.split(',').filter(Boolean)
      if (ids.includes('none')) continue
      for (const id of ids) {
        const a = q.answers.find((x) => x.id === id)
        if (a) total += a.risk
      }
    } else {
      const a = q.answers.find((x) => x.id === answerValue)
      if (a) total += a.risk
    }
  }
  return total
}

/** Risk tier from total score */
function tierFromScore(score: number): RiskTier {
  if (score >= 7) return 'high'
  if (score >= 3) return 'moderate'
  return 'low'
}

export function getRecommendations(answers: Record<string, string>): QuizResult {
  const riskScore = calculateRiskScore(answers)
  const riskTier = tierFromScore(riskScore)

  const symptoms = (answers['recent-symptoms'] || '').split(',').filter(Boolean)
  const concern = answers['biggest-concern'] || 'prevention'
  const supplements = answers['current-supplements'] || 'none'
  const flockSize = answers['flock-size'] || 'small'
  const age = answers['bird-age'] || 'layers'
  const recentChanges = (answers['recent-changes'] || '').split(',').filter(Boolean)

  const recs: ProductRecommendation[] = []

  // Hen Helper — anchors most plans (probiotic baseline)
  if (supplements !== 'probiotic-only' && supplements !== 'full-program') {
    let henHelperReason =
      'A daily probiotic in your waterer is the single highest-leverage habit for flock health. Hen Helper supports gut bacteria, firmer droppings, and stronger eggshells — for active issues and ongoing prevention alike.'
    if (symptoms.includes('pasty-butt') || symptoms.includes('loose-droppings')) {
      henHelperReason =
        'Pasty butt and loose droppings almost always signal gut imbalance. Hen Helper rebuilds the gut bacteria that resolve these symptoms — start daily until the flock looks normal, then weekly.'
    } else if (symptoms.includes('low-eggs') || symptoms.includes('soft-eggs')) {
      henHelperReason =
        'Egg production and shell quality both depend on gut health and nutrient absorption. Hen Helper firms shells and supports cleaner laying — most keepers see improvement within 2 weeks.'
    } else if (concern === 'beginner' || concern === 'simplify') {
      henHelperReason =
        'If you only add one supplement to your routine, make it a probiotic. Hen Helper is the simplest place to start and makes the biggest single difference for backyard flocks.'
    }
    recs.push({
      handle: 'hen-helper',
      name: 'Hen Helper',
      reason: henHelperReason,
      priority: 1,
    })
  }

  // Apple cider vinegar — gut acidification
  if (supplements === 'none' || supplements === 'medicated' || symptoms.includes('pasty-butt') || symptoms.includes('loose-droppings')) {
    recs.push({
      handle: 'apple-cider-vinegar-for-chickens',
      name: 'Mother Load Apple Cider Vinegar',
      reason:
        'Unfiltered ACV with the mother creates a slightly acidic gut environment that yeast and harmful bacteria struggle in. Add 1 tablespoon per gallon of drinking water — rotate with Hen Helper for ongoing gut support.',
      priority: 2,
    })
  }

  // Big Ole Bird — broader probiotic support, especially for stress / new birds / mixed flocks
  if (
    riskTier !== 'low' ||
    recentChanges.includes('new-birds') ||
    age === 'mixed' ||
    flockSize === 'medium' ||
    flockSize === 'large'
  ) {
    let bobReason =
      'Big Ole Bird is our concentrated multi-strain probiotic — the right pick when you have stress events, new birds, or mixed-age flocks where one universal product needs to work for everyone.'
    if (recentChanges.includes('new-birds')) {
      bobReason =
        'Adding new birds is one of the highest-stress events for an established flock. Big Ole Bird supports the whole flock through the integration period — start the day you introduce new birds and run for 14 days.'
    }
    recs.push({
      handle: 'big-ole-bird',
      name: 'Big Ole Bird',
      reason: bobReason,
      priority: riskTier === 'high' ? 1 : 3,
    })
  }

  // Desecticide — mites
  if (symptoms.includes('mites-suspect') || symptoms.includes('feather-loss')) {
    recs.push({
      handle: 'desecticide',
      name: 'Desecticide',
      reason:
        'Mites and lice cause feather loss, irritation, and stress that opens the door to bigger problems. Desecticide is safe for chickens, kids, and pets — spray the coop and birds, repeat in 7-10 days to break the egg cycle.',
      priority: symptoms.includes('mites-suspect') ? 1 : 4,
    })
  }

  // Catalyst — poultry vitamin for older flock or low energy
  if (age === 'older' || symptoms.includes('lethargy') || symptoms.includes('low-eggs')) {
    recs.push({
      handle: 'liquid-catalyst-poultry-vitamin',
      name: 'Liquid Catalyst',
      reason:
        'A poultry-specific vitamin support that helps tired-looking birds bounce back. Especially useful for older flocks, post-molt recovery, or extended laying periods where birds need extra micronutrient support.',
      priority: 4,
    })
  }

  // Beginner / starter bundle
  if (concern === 'beginner' || answers['flock-size'] === 'just-starting' || answers['flock-size'] === 'tiny') {
    recs.push({
      handle: 'backyard-poultry-bundle-chicken-supplements',
      name: 'Backyard Poultry Bundle',
      reason:
        'Skip the guesswork of buying supplements one at a time — the bundle includes everything most backyard keepers need to run a complete natural care program from day one.',
      priority: concern === 'beginner' ? 1 : 5,
    })
  }

  // Sort by priority, dedupe by handle, limit to top 3
  const seen = new Set<string>()
  recs.sort((a, b) => a.priority - b.priority)
  const topRecs: ProductRecommendation[] = []
  for (const r of recs) {
    if (seen.has(r.handle)) continue
    seen.add(r.handle)
    topRecs.push(r)
    if (topRecs.length >= 3) break
  }

  // Diagnosis title and summary by tier + concern combination
  const diagnosisTitle = (() => {
    if (riskTier === 'high') return 'Your flock needs attention now'
    if (riskTier === 'moderate') {
      if (concern === 'fix-problem') return "Let's fix what's going on"
      return 'A few risk signals worth addressing'
    }
    if (concern === 'beginner') return 'Great news — you can build it right from day one'
    if (concern === 'prevention') return 'Your flock looks healthy — let\'s keep it that way'
    if (concern === 'simplify') return 'Your routine can be simpler than this'
    if (concern === 'egg-quality') return 'Your flock is stable — focus on egg-quality gains'
    return 'Your flock is in good shape'
  })()

  const diagnosisSummary = (() => {
    if (riskTier === 'high') {
      const trigger = symptoms.includes('mites-suspect')
        ? 'Mites and parasites'
        : symptoms.includes('pasty-butt') || symptoms.includes('loose-droppings')
          ? 'Gut imbalance'
          : symptoms.includes('lethargy')
            ? 'Stress and lethargy'
            : 'Multiple risk signals'
      return `${trigger} can cascade fast in a small flock. The signs you described point to issues that respond well to intervention if caught early — most resolve within 2-3 weeks of starting the right care routine. The plan below addresses the immediate problem and builds the underlying gut and coop conditions that prevent recurrence.`
    }
    if (riskTier === 'moderate') {
      return "You're not in crisis territory but you do have a few risk signals worth addressing before they compound. Small flocks can shift from healthy to struggling within 7-10 days when stress events stack up. The recommendations below close the gaps and tighten your routine without overcomplicating it."
    }
    if (concern === 'beginner') {
      return "Building flock health from day one is dramatically easier than trying to fix problems later. Backyard chicken keepers who establish a probiotic + ACV routine in the first 30 days have measurably fewer health issues for the life of the flock. The plan below is the foundation we recommend for new keepers."
    }
    if (concern === 'simplify') {
      return "Most backyard flock health programs are over-engineered. You really only need 2-3 supplements rotated correctly to cover 90% of what comes up. The plan below strips the routine down to what actually moves the needle."
    }
    if (concern === 'egg-quality') {
      return 'Egg quality is downstream of gut health and mineral absorption. Once your flock is stable, the highest-leverage upgrades are gut-bacteria support and the trace minerals that build shell strength and yolk color.'
    }
    return "Your flock looks healthy. The single best move from here is locking in a year-round prevention routine — probiotics in the waterer, occasional ACV, and a coop-cleaning schedule. The plan below is what we recommend for keepers who want to stay ahead of issues before they appear."
  })()

  // Seasonal guidance — tied to risk + symptoms + season-agnostic since we don't ask
  const seasonalGuidance = (() => {
    if (riskTier === 'high') {
      return 'Start the priority products today. Reassess in 14 days. If symptoms persist beyond 2 weeks of consistent use, contact our team or a poultry vet — some issues need professional eyes.'
    }
    if (riskTier === 'moderate') {
      return 'Add Hen Helper to your waterers daily for the first 2 weeks, then rotate to weekly maintenance. Reassess in 30 days. Pair with a thorough coop deep-clean if the conditions question flagged that.'
    }
    return 'For ongoing prevention: weekly Hen Helper in the waterer, monthly ACV rotation, quarterly coop deep-clean, and a bi-annual mite inspection (spring + late summer). Most issues never start when this routine is in place.'
  })()

  return {
    riskTier,
    riskScore,
    diagnosisTitle,
    diagnosisSummary,
    recommendations: topRecs,
    seasonalGuidance,
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/** Human-readable summary for Nexus lead message */
export function buildQuizSummary(answers: Record<string, string>, result: QuizResult): string {
  const parts = [
    `RiskTier=${result.riskTier}`,
    `Score=${result.riskScore}`,
    `FlockSize=${answers['flock-size']}`,
    `Age=${answers['bird-age']}`,
    `Concern=${answers['biggest-concern']}`,
  ]
  if (answers['recent-symptoms']) parts.push(`Symptoms=${answers['recent-symptoms']}`)
  if (answers['recent-changes']) parts.push(`Changes=${answers['recent-changes']}`)

  const recNames = result.recommendations.map((r) => r.name).join(' + ')
  return `Flock Health Check: ${parts.join(', ')}. Recommended: ${recNames}.`
}
