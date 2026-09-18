/**
 * Lawn / turf weed product selector — contact vs systemic framing, chicken-adjacent paths.
 * Rates stay on PDP / handbook — not invented here.
 */

export interface SelAnswer {
  id: string
  label: string
  description?: string
}

export interface SelQuestion {
  id: string
  title: string
  answers: SelAnswer[]
}

export interface SelProduct {
  handle: string
  name: string
  reason: string
}

export interface SelResult {
  headline: string
  summary: string
  products: SelProduct[]
  reads: { href: string; label: string }[]
  boundaries: string[]
}

export const SELECTOR_QUESTIONS: SelQuestion[] = [
  {
    id: 'where',
    title: 'Where are the weeds?',
    answers: [
      { id: 'hardscape', label: 'Driveway, gravel, fence line, cracks', description: 'Hardscape / edge' },
      { id: 'lawn', label: 'In the lawn turf', description: 'Living grass' },
      { id: 'beds', label: 'Beds / garden edges', description: 'Near ornamentals or food plants' },
      { id: 'mixed', label: 'Mixed areas', description: 'More than one surface' },
    ],
  },
  {
    id: 'approach',
    title: 'What kind of control do you want?',
    answers: [
      {
        id: 'contact',
        label: 'Contact control (top kill / desiccation)',
        description: 'Fast visible burn-down; may need repeats on perennials',
      },
      {
        id: 'systemic',
        label: 'Systemic herbicide behavior',
        description: 'Moves in the plant — different product class',
      },
      { id: 'unsure', label: 'Not sure — explain the difference', description: 'Help me choose' },
    ],
  },
  {
    id: 'animals',
    title: 'Are backyard chickens or pets nearby?',
    answers: [
      { id: 'chickens', label: 'Yes — chickens on the property', description: 'Need careful boundaries' },
      { id: 'pets', label: 'Dogs / cats use the area', description: 'Pet traffic' },
      { id: 'neither', label: 'No animals in the spray zone', description: 'Standard site' },
    ],
  },
  {
    id: 'goal',
    title: 'Primary outcome?',
    answers: [
      { id: 'edges', label: 'Clean fence lines and cracks', description: 'Hardscape tidy-up' },
      { id: 'compare', label: 'Compare Torched vs vinegar', description: 'Functional alternative' },
      { id: 'soil', label: 'Longer-term lawn / soil program', description: 'Not just spot weeds' },
      { id: 'docs', label: 'I need label / SDS first', description: 'Documentation' },
    ],
  },
]

export function getSelectorResult(answers: Record<string, string>): SelResult {
  const products: SelProduct[] = []
  const reads: { href: string; label: string }[] = []
  const boundaries = [
    'Torched is a contact desiccant (FIFRA 25b minimum-risk category) — not a systemic herbicide and not USDA Organic.',
    'We do not claim Torched matches glyphosate kill rates. Follow the current label for mix, weather, and site limits.',
    '“Near chickens” is not a free pass — keep animals off treated surfaces until dry / as the label requires.',
  ]

  if (answers.approach === 'systemic') {
    return {
      headline: 'You are asking for systemic behavior',
      summary:
        'Torched is not positioned as a systemic herbicide. If you need systemic activity, that is a different product class — do not force Torched into that job.',
      products: [],
      reads: [
        {
          href: '/blog/get-rid-of-weeds-with-torched-all-natural-weed-killer/',
          label: 'Torched vs vinegar (what contact control means)',
        },
        { href: '/lawn/torched-comparison-center/', label: 'Torched decision center' },
      ],
      boundaries,
    }
  }

  if (answers.where === 'hardscape' || answers.where === 'mixed' || answers.goal === 'edges') {
    products.push({
      handle: 'torched-all-natural-weed-killer',
      name: 'Torched',
      reason: 'Contact weed control for many hardscape and fence-line jobs — confirm site fit on the PDP and label.',
    })
  }

  if (answers.where === 'lawn' && answers.goal === 'soil') {
    products.push({
      handle: 'genesis',
      name: 'Genesis',
      reason: 'Soil-biology / conditioner lane for lawn programs — not a substitute for a weed-contact product.',
    })
    reads.push({ href: '/tools/lawn-quiz/', label: 'Full lawn health quiz' })
  }

  if (answers.animals === 'chickens' || answers.animals === 'pets') {
    reads.push({
      href: '/blog/eliminate-weeds-without-harming-your-birds-torched-all-natural-weed-killer/',
      label: 'Torched around birds — read carefully',
    })
    reads.push({
      href: '/blog/keeping-pets-safe-guide-to-weed-killer-and-pet-safety/',
      label: 'Pet safety guide',
    })
  }

  if (answers.goal === 'compare' || answers.approach === 'unsure') {
    reads.push({
      href: '/blog/get-rid-of-weeds-with-torched-all-natural-weed-killer/',
      label: 'Torched vs vinegar comparison',
    })
    reads.push({ href: '/lawn/torched-comparison-center/', label: 'Torched comparison center' })
  }

  if (answers.goal === 'docs' || products.length) {
    reads.push({ href: '/how-to-use/torched/', label: 'Torched how-to handbook' })
    reads.push({ href: '/products/torched-all-natural-weed-killer/', label: 'Torched product page + SDS path' })
  }

  if (!products.length && answers.where === 'beds') {
    return {
      headline: 'Beds and food plants need extra care',
      summary:
        'Do not assume “natural” means safe on everything. Check the Torched label for site restrictions before spraying near ornamentals or edibles.',
      products: [
        {
          handle: 'torched-all-natural-weed-killer',
          name: 'Torched (verify site fit)',
          reason: 'Only if the label supports your exact site. When unsure, ask support before you spray.',
        },
      ],
      reads: [
        { href: '/products/torched-all-natural-weed-killer/', label: 'Torched PDP / FAQ' },
        { href: '/contact/', label: 'Ask before you spray' },
      ],
      boundaries,
    }
  }

  return {
    headline: products.length ? 'Start with these paths' : 'Read before you buy',
    summary:
      'This selector routes you to claim-safe pages. Mix rates and re-entry live on the label and handbook — not in this tool.',
    products,
    reads: reads.length
      ? reads
      : [{ href: '/lawn/torched-comparison-center/', label: 'Torched comparison center' }],
    boundaries,
  }
}
