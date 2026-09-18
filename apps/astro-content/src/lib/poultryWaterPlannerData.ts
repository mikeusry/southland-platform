/**
 * Poultry Water-System Planner — decision questions → next actions.
 * No disease diagnosis. No invented rates — point to label / ZeroPoint PDP.
 */

export interface PlannerAnswer {
  id: string
  label: string
  description?: string
}

export interface PlannerQuestion {
  id: string
  title: string
  subtitle?: string
  answers: PlannerAnswer[]
}

export interface PlannerAction {
  title: string
  body: string
  href?: string
  hrefLabel?: string
}

export interface PlannerResult {
  headline: string
  summary: string
  actions: PlannerAction[]
  notFor: string[]
}

export const PLANNER_QUESTIONS: PlannerQuestion[] = [
  {
    id: 'operation',
    title: 'What kind of operation is this?',
    answers: [
      { id: 'backyard', label: 'Backyard / small flock', description: 'Hobby or small commercial' },
      { id: 'broiler', label: 'Commercial broilers', description: 'Integrator or contract grower' },
      { id: 'layer', label: 'Layers / breeders', description: 'Long-cycle houses' },
      { id: 'other', label: 'Other / mixed', description: 'Pullets, turkeys, or mixed use' },
    ],
  },
  {
    id: 'system',
    title: 'What are you focused on right now?',
    answers: [
      { id: 'drinkers', label: 'Drinker / nipple lines', description: 'Biofilm, flow, nipple trigger' },
      { id: 'coolcell', label: 'Cool cells / pads', description: 'Evaporative cooling system' },
      { id: 'both', label: 'Both water lines and cool cells', description: 'Whole-house water path' },
      { id: 'unsure', label: 'Not sure — odor or performance dip', description: 'Need a starting point' },
    ],
  },
  {
    id: 'timing',
    title: 'When can you treat?',
    answers: [
      { id: 'between', label: 'Between flocks (empty house)', description: 'Strongest cleaning window' },
      { id: 'birds-in', label: 'Birds are in the house', description: 'Must stay label-safe' },
      { id: 'either', label: 'Either is possible', description: 'Flexible schedule' },
    ],
  },
  {
    id: 'concern',
    title: 'What concerns you most?',
    answers: [
      { id: 'biofilm', label: 'Biofilm / slime in lines', description: 'Organic load in the pipe' },
      { id: 'equipment', label: 'Equipment compatibility', description: 'Seals, regulators, nipples' },
      { id: 'odor', label: 'Odor / organic load', description: 'House smell or litter issues' },
      { id: 'docs', label: 'Need docs before I buy', description: 'Label, SDS, dealer help' },
    ],
  },
]

export function getPlannerResult(answers: Record<string, string>): PlannerResult {
  const actions: PlannerAction[] = []
  const notFor: string[] = [
    'This planner does not diagnose disease or prescribe animal-health treatments.',
    'Always follow the current product label for dilutions, contact time, and bird-present vs empty-house use.',
  ]

  actions.push({
    title: 'Read the water-line cleaning overview',
    body: 'Process basics: when to clean, chlorine vs peroxide vs HOCl framing, and why biofilm matters.',
    href: '/blog/how-to-clean-water-lines-in-poultry-houses/',
    hrefLabel: 'Water-line cleaning guide',
  })

  actions.push({
    title: 'Compare line-cleaner approaches',
    body: 'Trade-offs growers actually face — consistency and handling matter as much as chemistry.',
    href: '/blog/choosing-the-right-line-cleaner/',
    hrefLabel: 'Choosing the right line cleaner',
  })

  if (answers.system === 'coolcell' || answers.system === 'both') {
    actions.push({
      title: 'Separate cool-cell work from drinker-line work',
      body: 'Cool pads and drinker lines are different jobs. Confirm what your label covers before treating pads or sumps.',
      href: '/products/zeropoint-industrial/',
      hrefLabel: 'ZeroPoint product page',
    })
  } else {
    actions.push({
      title: 'Review ZeroPoint for poultry water systems',
      body: 'EPA-registered HOCl product page — ORP/protocol language and label-linked directions live there. Do not invent mix rates here.',
      href: '/products/zeropoint-industrial/',
      hrefLabel: 'ZeroPoint industrial',
    })
  }

  if (answers.concern === 'docs' || answers.concern === 'equipment') {
    actions.push({
      title: 'Get label / SDS / dealer path',
      body: 'Download documentation from the product page or talk to a dealer before you commit pack size.',
      href: '/contact/',
      hrefLabel: 'Contact / dealer help',
    })
  }

  if (answers.timing === 'birds-in') {
    notFor.push(
      'Birds-in treatments are label-gated. If the label is empty-house only, wait for turnaround.'
    )
  }

  const headline =
    answers.timing === 'between'
      ? 'Between-flock window — plan a full line clean'
      : answers.timing === 'birds-in'
        ? 'Birds present — stay inside label limits'
        : 'Map the job before you buy a jug'

  const summary =
    'Use the guides and product page below to separate cleaning, maintenance, odor, and disinfection jobs. This tool only routes you — it does not replace the label.'

  return { headline, summary, actions, notFor }
}

export function buildPlannerSummary(answers: Record<string, string>, result: PlannerResult): string {
  return [
    `Operation: ${answers.operation || 'n/a'}`,
    `Focus: ${answers.system || 'n/a'}`,
    `Timing: ${answers.timing || 'n/a'}`,
    `Concern: ${answers.concern || 'n/a'}`,
    `Result: ${result.headline}`,
  ].join('\n')
}
