/**
 * Persona Profiles — Command Center Data
 *
 * Hardcoded persona data for /admin/personas/ pages.
 * Source of truth for all persona detail, JTBD, products, plays.
 * Wire to live CDP data when available.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PersonaMission {
  text: string
  target: number
  done: number
  deadline: string
}

export interface PersonaActivity {
  label: string
  date: string
}

export interface PersonaJTBD {
  statement: string
  status: 'covered' | 'partial' | 'gap'
}

export interface PersonaProduct {
  name: string
  handle: string
  roas?: number
}

export interface PersonaPlay {
  title: string
  description: string
  targetEstimate?: string
  expectedLift?: string
}

export interface PersonaProfile {
  slug: string
  name: string
  tagline: string
  color: string
  bgColor: string
  landerUrl: string

  // Stats
  weight: number
  customerCount: number
  avgLTV: number
  revenueGoalPct: number

  // Narrative
  narrative: string

  // Mission
  mission: PersonaMission

  // Last activity
  lastActivity: PersonaActivity[]

  // Demographics
  demographics: {
    age: string
    income: string
    location: string
    operation: string
  }

  // Psychographics
  values: string[]
  fears: string[]
  painPoints: string[]
  buyingTriggers: string[]
  objections: string[]

  // Communication
  preferredChannels: string[]
  contentPreferences: string[]
  languageRules: { use: string[]; avoid: string[] }
  skepticismTriggers: string[]
  trustHierarchy: string[]

  // JTBD
  jtbd: PersonaJTBD[]

  // Products
  topProducts: PersonaProduct[]

  // Plays
  plays: PersonaPlay[]
}

// =============================================================================
// PROFILES
// =============================================================================

export const PERSONAS: PersonaProfile[] = [
  // ---------------------------------------------------------------------------
  // BROILER BILL
  // ---------------------------------------------------------------------------
  {
    slug: 'bill',
    name: 'Broiler Bill',
    tagline: 'Contract poultry grower, 3-6 houses, 150K-400K birds/year',
    color: '#166534',
    bgColor: '#f0fdf4',
    landerUrl: '/poultry/commercial/',

    weight: 0.44,
    customerCount: 574,
    avgLTV: 902.94,
    revenueGoalPct: 55,

    narrative: 'Bill is 44% of the customer base with $903 avg LTV. Strong awareness content and persona landers shipped. Major JTBD gap in post-placement troubleshooting and utility cost reduction. No live re-engagement campaigns yet.',

    mission: {
      text: 'Add 2 consideration articles and close the post-placement troubleshooting gap for Bill.',
      target: 3,
      done: 1,
      deadline: '2026-04-15',
    },

    lastActivity: [
      { label: 'New page: /blog/how-to-reduce-ammonia-in-poultry-house-naturally/', date: '2026-03-15' },
      { label: 'Persona lander shipped: /poultry/commercial/', date: '2026-03-01' },
    ],

    demographics: {
      age: '38-52',
      income: '$85-150K',
      location: 'Southeast US (GA, AR, AL, NC)',
      operation: '3-6 houses, 150K-400K birds/year, $800K-1.2M mortgage',
    },

    values: [
      'Family legacy and farm continuity',
      'Top settlement rankings among peers',
      'Financial security for kids\' college',
      'Community respect and neighbor relationships',
      'Independence and self-reliance',
    ],

    fears: [
      'Financial annihilation — "One disaster and we lose everything"',
      'Family legacy failure — "I\'ll be the one who lost the farm"',
      'Integrator contract loss — "They could cancel tomorrow"',
      'Disease catastrophe — "Avian flu could wipe me out"',
      'Competitive displacement — "New growers with better houses beating me"',
      'Community judgment — "Everyone knowing I failed"',
    ],

    painPoints: [
      'Integrator squeeze: one customer, zero price negotiation, tournament system',
      'Ammonia buildup between flocks destroying bird health',
      'Darkling beetle infestations consuming feed and spreading disease',
      'High mortality in first 7 days after placement',
      'Litter quality degradation over multiple flocks',
      'Rising utility costs with no ability to pass through',
    ],

    buyingTriggers: [
      'High mortality flock (crisis mode)',
      'Integrator pressure or failed inspection',
      'Upcoming grow-out or seasonal preparation',
      'Coffee shop crew recommendation',
      'Between-flock window (receptive to change)',
      'Post-good-settlement confidence',
    ],

    objections: [
      '"I\'ve tried natural products before and they didn\'t work"',
      '"My integrator tech says chemicals are fine"',
      '"I can\'t afford to experiment — one bad flock ruins me"',
      '"Show me it works for guys like me, not lab rats"',
      '"I don\'t trust companies that don\'t know poultry"',
    ],

    preferredChannels: [
      'Text (most responsive, 5-30 min)',
      'Phone (trust builder)',
      'Face-to-face (decision maker)',
      'Facebook (lurks 95%, posts 5%)',
      'Print: Poultry Times',
    ],

    contentPreferences: [
      'One-page sell sheets',
      'Comparison charts (us vs chemical)',
      'Cost-per-bird calculators',
      'Video testimonials from local growers',
      'Allen Reynolds YouTube content',
    ],

    languageRules: {
      use: ['placement', 'mortality', 'FCR', 'livability', 'grow-out', 'house ranking', 'settlement', 'cents per bird'],
      avoid: ['putting chicks in', 'death rate', 'feed efficiency', 'survival rate', 'raising period', 'performance comparison', 'payment', 'synergistic', 'revolutionary', 'sustainable agriculture'],
    },

    skepticismTriggers: [
      '"Synergistic solutions," "paradigm shift," "sustainable agriculture"',
      '"Guaranteed to...," "revolutionary breakthrough"',
      'Suit and tie on farm, clean boots, rental car with out-of-state plates',
      'West Coast company, no local dealers, requires apps, MLM structure',
      'Doesn\'t ask about his operation first',
    ],

    trustHierarchy: [
      'Top local grower (within 50 miles, similar operation)',
      'Experienced integrator field tech (10+ years, grew up local)',
      'Coffee shop crew (3-4 trusted growers)',
      'Long-term feed store owner',
      'Local veterinarian',
      'Extension service (practical, not academic)',
      'Sales reps (3+ consistent interactions, must know poultry)',
      'University research (in-state, field trials)',
      'Online experts (least trusted)',
    ],

    jtbd: [
      { statement: 'Reduce mortality below 3% without antibiotics', status: 'covered' },
      { statement: 'Control ammonia between flocks naturally', status: 'covered' },
      { statement: 'Eliminate darkling beetles without harsh chemicals', status: 'covered' },
      { statement: 'Improve FCR to rank top 5 in settlement', status: 'partial' },
      { statement: 'Manage litter through multiple flocks', status: 'partial' },
      { statement: 'Troubleshoot post-placement problems fast', status: 'gap' },
      { statement: 'Reduce utility costs per flock', status: 'gap' },
    ],

    topProducts: [
      { name: 'Big Ole Bird', handle: 'poultry-probiotic', roas: 10.97 },
      { name: 'Hen Helper', handle: 'hen-helper', roas: 48.0 },
      { name: 'Catalyst', handle: 'catalyst', roas: 6.62 },
      { name: 'Litter Life', handle: 'poultry-litter-amendment' },
      { name: 'Desecticide', handle: 'natural-mite-control-livestock-poultry' },
    ],

    plays: [
      {
        title: 'Re-engage lapsed Bill buyers with ammonia pillar page',
        description: 'Target Bill customers who bought in last 12 months but haven\'t returned in 90 days. Send email with the new ammonia reduction article + Litter Life CTA.',
        targetEstimate: '~340 customers',
        expectedLift: 'Based on Litter Life ROAS, expect $4-6K in 30 days',
      },
      {
        title: 'Upsell Big Ole Bird buyers to Catalyst',
        description: 'Bill customers who buy Big Ole Bird but have never purchased Catalyst. Stress-period product for placement week.',
        targetEstimate: '~180 customers',
        expectedLift: 'Catalyst 6.62x ROAS, avg order $85',
      },
      {
        title: 'Post-settlement follow-up campaign',
        description: 'Automated email 3 days after estimated settlement date. "How was your last flock?" with outcome survey link + reorder CTA.',
        targetEstimate: 'All active Bill customers',
        expectedLift: 'Shorten reorder cycle from 45 to 38 days',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // BACKYARD BETTY
  // ---------------------------------------------------------------------------
  {
    slug: 'betty',
    name: 'Backyard Betty',
    tagline: 'Small flock owner, 5-25 birds, suburban/rural homesteader',
    color: '#92400e',
    bgColor: '#fffbeb',
    landerUrl: '/poultry/backyard/',

    weight: 0.48,
    customerCount: 1087,
    avgLTV: 77.38,
    revenueGoalPct: 30,

    narrative: 'Betty is 48% of customers but only 30% of revenue due to low LTV ($77). Highest volume, lowest spend. Online-native — her entire purchase loop is digital. Lander shipped. No re-engagement campaigns live. Major JTBD gaps: sick bird diagnosis and small flock dosing guides.',

    mission: {
      text: 'Create 1 consideration-stage guide for Betty and launch first re-engagement campaign.',
      target: 2,
      done: 0,
      deadline: '2026-04-15',
    },

    lastActivity: [
      { label: 'Lander page built: /poultry/backyard/', date: '2026-03-10' },
      { label: 'Betty lander copy doc complete: BB-Persona/betty-storybrand.md', date: '2026-03-05' },
    ],

    demographics: {
      age: '30-55',
      income: '$50-100K',
      location: 'Suburban and rural US, all regions',
      operation: '5-25 birds, backyard coop, hobby/homestead',
    },

    values: [
      'Family health and chemical-free food',
      'Self-sufficiency and homesteading',
      'Animal welfare — birds are pets with purpose',
      'Community and sharing (eggs, knowledge)',
      'Natural/organic lifestyle',
    ],

    fears: [
      'Losing birds to illness she can\'t diagnose',
      'Exposing family to chemicals near food source',
      'Not knowing what\'s wrong when birds act sick',
      'Predator attacks wiping out the flock',
      'Being judged as a "bad chicken mom"',
    ],

    painPoints: [
      'No veterinary support for backyard poultry in most areas',
      'Overwhelming conflicting advice online (forums, YouTube, Facebook groups)',
      'Seasonal health challenges (heat stress, molting, respiratory)',
      'Egg production drops with no clear cause',
      'Mite and lice infestations',
      'Biosecurity anxiety without professional guidance',
    ],

    buyingTriggers: [
      'Sick bird (panic purchase)',
      'Seasonal change (winter prep, spring chicks)',
      'Facebook group recommendation',
      'YouTube video showing product results',
      'First flock experience (new chicken owner)',
      'Adding new birds to existing flock',
    ],

    objections: [
      '"It seems expensive for just a few chickens"',
      '"I can\'t tell if it\'s actually working"',
      '"I found something similar at Tractor Supply"',
      '"Is this really safe around my kids and garden?"',
      '"I don\'t understand the dosing for small flocks"',
    ],

    preferredChannels: [
      'Facebook groups (most active)',
      'YouTube (research and how-to)',
      'Instagram (coop photos, community)',
      'Google search (problem-driven)',
      'Email (responsive to nurture sequences)',
    ],

    contentPreferences: [
      'How-to guides with photos',
      'Symptom checkers and diagnostic tools',
      'Seasonal care calendars',
      'Video demonstrations',
      'Community stories and testimonials',
    ],

    languageRules: {
      use: ['flock', 'girls', 'coop', 'healthy', 'natural', 'safe for family', 'easy to use', 'keep your family safe'],
      avoid: ['commercial', 'production', 'mortality rate', 'FCR', 'ROI', 'operation', 'grow-out', 'tonnage'],
    },

    skepticismTriggers: [
      'Products clearly designed for commercial operations',
      'No clear dosing instructions for small flocks',
      'Aggressive sales tactics',
      'No community reviews or social proof',
      'Complex application requiring equipment she doesn\'t have',
    ],

    trustHierarchy: [
      'Facebook chicken groups (BackYard Chickens, local groups)',
      'YouTube creators she follows',
      'Local feed store staff',
      'Veterinarian (if available for poultry)',
      'Homesteading bloggers',
      'Friends who also keep chickens',
      'Brand websites with clear educational content',
    ],

    jtbd: [
      { statement: 'Keep my birds healthy without chemicals near my family', status: 'covered' },
      { statement: 'Diagnose what\'s wrong when a bird acts sick', status: 'covered' },
      { statement: 'Prevent seasonal health problems before they start', status: 'partial' },
      { statement: 'Get reliable advice without a poultry vet', status: 'covered' },
      { statement: 'Know the right product and dose for my small flock', status: 'covered' },
      { statement: 'Feel confident I\'m doing right by my birds', status: 'partial' },
    ],

    topProducts: [
      { name: 'Big Ole Bird (backyard size)', handle: 'poultry-probiotic' },
      { name: 'Hen Helper', handle: 'hen-helper' },
      { name: 'Desecticide', handle: 'natural-mite-control-livestock-poultry' },
    ],

    plays: [
      {
        title: 'New chicken owner welcome sequence',
        description: 'Email sequence for first-time buyers: Day 1 getting started, Day 7 first week check, Day 30 seasonal tips. Each email links to relevant blog content.',
        targetEstimate: '~200 new customers/quarter',
        expectedLift: 'Increase 90-day repeat rate from 12% to 25%',
      },
      {
        title: 'Seasonal prep campaign (Spring/Fall)',
        description: 'Email + social push 2 weeks before season change. Spring: new chick supplies + biosecurity. Fall: winterization + immune support.',
        targetEstimate: 'All active Betty customers',
        expectedLift: 'Seasonal spike in Hen Helper + Big Ole Bird sales',
      },
      {
        title: 'Facebook group seeding',
        description: 'Identify top 5 backyard chicken Facebook groups. Share educational content (not product) to build trust. Link to blog, not product pages.',
        targetEstimate: '500K+ group members across top groups',
        expectedLift: 'Brand awareness, organic traffic to backyard content',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // TURF PRO TAYLOR
  // ---------------------------------------------------------------------------
  {
    slug: 'taylor',
    name: 'Turf Pro Taylor',
    tagline: 'Lawn care professional, golf course super, sports turf manager',
    color: '#065f46',
    bgColor: '#ecfdf5',
    landerUrl: '/lawn/',

    weight: 0.08,
    customerCount: 0,
    avgLTV: 0,
    revenueGoalPct: 15,

    narrative: 'Taylor is 8% weight with no labeled customers yet — the greenfield opportunity. Turf lander copy not started. 4 collection pages exist (golf, homeowners, landscapers, turf) but all on legacy /collections/ URLs needing migration. No campaigns.',

    mission: {
      text: 'Ship Taylor lander and migrate 4 turf collection pages to /lawn/* URLs.',
      target: 5,
      done: 0,
      deadline: '2026-05-01',
    },

    lastActivity: [],

    demographics: {
      age: '30-50',
      income: '$60-120K',
      location: 'Southeast and transition zone US',
      operation: 'Professional lawn care, golf courses, sports fields, municipalities',
    },

    values: [
      'Client retention and callback avoidance',
      'Consistent, visible results on turf',
      'Professional reputation and word-of-mouth',
      'Efficiency — fewer passes, less product, better results',
      'Staying ahead of regulatory changes on chemicals',
    ],

    fears: [
      'Client callbacks and complaints about turf quality',
      'Chemical liability (applicator license, drift, runoff)',
      'Competitors undercutting on price with cheaper inputs',
      'Drought or weather events destroying work',
      'Losing a major account (golf club, HOA)',
    ],

    painPoints: [
      'Southern clay soil resists organic improvement',
      'Warm-season grasses (bermuda, zoysia) have specific nutrition needs',
      'Transition from chemical to organic programs is risky mid-season',
      'Clients want instant green but organic works on soil biology timeline',
      'No clear "program builder" for organic turf management',
      'Pricing organic services competitively against chemical lawn care',
    ],

    buyingTriggers: [
      'Client requesting organic/chemical-free lawn care',
      'Regulatory pressure on chemical applications',
      'Peer recommendation at industry trade show',
      'Visible soil health problem (compaction, thatch, disease)',
      'Off-season planning and program building',
      'Golf course super wanting to reduce chemical inputs',
    ],

    objections: [
      '"Organic takes too long — my clients want green now"',
      '"I can\'t charge enough to cover the cost difference"',
      '"How do I transition mid-season without losing accounts?"',
      '"My soil is pure clay — nothing organic works on clay"',
      '"I need a proven program, not individual products"',
    ],

    preferredChannels: [
      'Trade shows and industry events',
      'Peer network and referrals',
      'Industry publications (Turf Magazine, Golf Course Management)',
      'YouTube and field demonstration videos',
      'Sales rep relationship (technical, consultative)',
    ],

    contentPreferences: [
      'Program guides with application schedules',
      'Before/after case studies with soil tests',
      'ROI calculators for organic vs chemical programs',
      'Video field demonstrations',
      'Technical data sheets with rates and timing',
    ],

    languageRules: {
      use: ['program', 'turf', 'soil biology', 'application rate', 'results', 'clients', 'accounts', 'warm-season', 'transition zone'],
      avoid: ['lawn', 'grass', 'yard', 'homeowner', 'easy', 'simple', 'green thumb', 'natural gardening'],
    },

    skepticismTriggers: [
      'Products marketed to homeowners, not professionals',
      'No rate charts or application schedules',
      'Claims without soil test data or university trials',
      'Consumer-grade packaging or branding',
      'No understanding of warm-season vs cool-season needs',
    ],

    trustHierarchy: [
      'Other turf professionals (golf supers, successful lawn care owners)',
      'University extension turfgrass specialists',
      'Trade show demonstrations with live results',
      'Technical sales reps who understand soil science',
      'Industry publications and research',
      'Product distributors with turf expertise',
    ],

    jtbd: [
      { statement: 'Build an organic turf program that competes with chemical results', status: 'gap' },
      { statement: 'Fix compacted southern clay soil for lasting turf health', status: 'partial' },
      { statement: 'Transition existing accounts from chemical to organic without callbacks', status: 'gap' },
      { statement: 'Price organic services competitively', status: 'gap' },
      { statement: 'Show clients measurable soil improvement (before/after)', status: 'gap' },
      { statement: 'Reduce chemical liability and stay ahead of regulations', status: 'partial' },
    ],

    topProducts: [
      { name: 'Turf Formula', handle: 'turf-formula' },
      { name: 'Soil Conditioner', handle: 'soil-conditioner' },
      { name: 'Humic Acid', handle: 'humic-acid' },
    ],

    plays: [
      {
        title: 'Golf course super outreach',
        description: 'Direct mail + follow-up call to golf course superintendents in GA, AL, NC, SC. Include soil test offer and case study from a peer course.',
        targetEstimate: '~500 courses in target geography',
        expectedLift: '10-15 trial accounts at $2-5K annual value each',
      },
      {
        title: 'Trade show presence (GIS, Southern turf)',
        description: 'Booth at 2 major turf trade shows. Demo soil biology before/after. Collect leads for follow-up program builder consultation.',
        targetEstimate: '200-400 qualified leads per show',
        expectedLift: 'Pipeline for $50-100K in annual recurring turf revenue',
      },
      {
        title: '"Organic Program Builder" landing page',
        description: 'Interactive page where Taylor selects grass type, soil type, and acreage. Outputs a 12-month application schedule with products and rates. Captures lead info.',
        targetEstimate: 'Organic search + paid traffic',
        expectedLift: 'Convert informational searches into qualified leads',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // SEPTIC SAM
  // ---------------------------------------------------------------------------
  {
    slug: 'sam',
    name: 'Septic Sam',
    tagline: 'Homeowner or facility manager dealing with waste, odor, and drain problems',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    landerUrl: '/waste/',

    weight: 0,
    customerCount: 0,
    avgLTV: 0,
    revenueGoalPct: 0,

    narrative:
      'Sam has zero persona targeting despite an active product line generating revenue through organic search alone. 16+ blog posts cover septic, vault toilets, campgrounds, industrial odor control, and case studies (paper mill, bakery, car wash). PORT subscription drives recurring revenue. Entirely unmanaged segment.',

    mission: {
      text: 'Define persona, assign existing content, and build /waste/ lander page.',
      target: 3,
      done: 0,
      deadline: '2026-05-15',
    },

    lastActivity: [],

    demographics: {
      age: '35-65',
      income: '$50-120K',
      location: 'Rural and suburban US, nationwide',
      operation: 'Residential septic system, RV park, campground, apartment complex, or industrial facility',
    },

    values: [
      'A system that works quietly without thinking about it',
      'Avoiding expensive emergency repairs ($5-15K septic replacement)',
      'Keeping odors away from family and neighbors',
      'Simple maintenance — pour and forget',
      'Chemical-free solutions safe for groundwater',
    ],

    fears: [
      'Septic failure and $10K+ replacement cost',
      'Sewage backup into the house',
      'Neighbors complaining about odor',
      'Contaminating well water or groundwater',
      'Getting scammed by septic pumping companies upselling unnecessary work',
    ],

    painPoints: [
      'Septic systems are invisible until they fail catastrophically',
      'No clear maintenance guidance — pump every 3 years? 5 years? It depends?',
      'Chemical drain cleaners killing beneficial bacteria in the tank',
      'Holding tank and vault toilet odor in campgrounds and RV parks',
      'Grease trap and drain line buildup in commercial kitchens',
      'TSS/CBOD compliance for industrial wastewater discharge',
    ],

    buyingTriggers: [
      'Slow drains or sewage smell (panic mode)',
      'Septic inspection for home sale',
      'Moving to rural property with first septic system',
      'Campground/RV park seasonal opening prep',
      'Failed wastewater discharge test (industrial)',
      'Neighbor or online recommendation',
    ],

    objections: [
      '"I just pump my tank — why do I need a treatment?"',
      '"How is bacteria better than the chemical stuff at Home Depot?"',
      '"My septic guy says I don\'t need additives"',
      '"Does it actually work or is it snake oil?"',
      '"I don\'t want to sign up for a subscription"',
    ],

    preferredChannels: [
      'Google search (problem-driven: "septic smell," "slow drain")',
      'YouTube (DIY septic maintenance)',
      'Home improvement forums and Reddit',
      'Local septic company recommendations',
      'Facebook homeowner groups',
    ],

    contentPreferences: [
      'Case studies with before/after data (TSS reduction, odor elimination)',
      'Simple "how it works" explainers with diagrams',
      'Maintenance schedules and calendars',
      'Cost comparison: treatment vs emergency repair',
      'Video demonstrations of application',
    ],

    languageRules: {
      use: ['septic', 'drain', 'odor', 'bacteria', 'treatment', 'maintenance', 'holding tank', 'vault toilet', 'grease trap', 'TSS', 'beneficial bacteria'],
      avoid: ['industrial-grade', 'commercial operations', 'wastewater engineering', 'bioremediation protocol', 'anaerobic digestion kinetics'],
    },

    skepticismTriggers: [
      'Claims that sound too good ("never pump again!")',
      'No explanation of how the product works',
      'MLM or affiliate-heavy marketing',
      'No third-party case studies or data',
      'Products that claim to work on everything',
    ],

    trustHierarchy: [
      'Local septic service technician',
      'Neighbor or friend with same system type',
      'Home inspector',
      'Online reviews with specific before/after details',
      'YouTube DIY channels',
      'Brand websites with case studies and data',
    ],

    jtbd: [
      { statement: 'Keep my septic system healthy without expensive pump-outs', status: 'covered' },
      { statement: 'Eliminate odor from holding tanks and vault toilets', status: 'covered' },
      { statement: 'Clear slow drains without killing tank bacteria', status: 'covered' },
      { statement: 'Meet industrial wastewater discharge limits (TSS/CBOD)', status: 'covered' },
      { statement: 'Understand what maintenance my septic system actually needs', status: 'partial' },
      { statement: 'Find a treatment I can trust that isn\'t snake oil', status: 'partial' },
    ],

    topProducts: [
      { name: 'Pour the PORT', handle: 'pour-the-port-septic-tank-treatment' },
      { name: 'Holding Tank Treatment', handle: 'holding-tank-treatment' },
      { name: 'Pure B.S. Bio-Surfactant', handle: 'pure-b-s-bio-surfactant' },
      { name: 'Compost Starter', handle: 'compost-starter' },
    ],

    plays: [
      {
        title: 'Septic emergency content funnel',
        description:
          'Target "septic smell," "slow drain septic," "septic tank treatment" search queries. Blog posts → PORT product page → subscription signup. 16 blog posts already exist, need internal linking overhaul.',
        targetEstimate: '~2,400 monthly organic searches for septic treatment terms',
        expectedLift: 'Convert existing organic traffic into PORT subscriptions',
      },
      {
        title: 'Campground/RV park B2B outreach',
        description:
          'Direct outreach to campground owners and RV parks before summer season. Case studies: vault toilet odor elimination, holding tank treatment. Seasonal timing (March-April for summer prep).',
        targetEstimate: '~16,000 private campgrounds in US',
        expectedLift: 'B2B accounts at $500-2K annual value each',
      },
      {
        title: 'Home sale septic inspection campaign',
        description:
          'Google Ads targeting "septic inspection" and "selling house with septic." Content: "How to pass a septic inspection." Product: PORT 3-month treatment to restore system before inspection.',
        targetEstimate: 'Seasonal (spring/summer home selling season)',
        expectedLift: 'One-time purchases converting to subscriptions',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // GOLF COURSE GARY
  // ---------------------------------------------------------------------------
  {
    slug: 'gary',
    name: 'Golf Course Gary',
    tagline: 'Golf course superintendent managing championship-level turf on organic soil biology',
    color: '#0e7490',
    bgColor: '#ecfeff',
    landerUrl: '/lawn/golf/',

    weight: 0,
    customerCount: 0,
    avgLTV: 0,
    revenueGoalPct: 0,

    narrative:
      'Gary is a high-value B2B prospect with $2-5K annual spend potential per account. Dedicated collection page with superintendent-specific specs (CEC improvements, infiltration rates). Pillar page shipped (bermuda grass fairways). No lander, no campaigns, no outreach. Completely organic discovery only.',

    mission: {
      text: 'Build /lawn/golf/ lander and create 1 case study targeting superintendent peer network.',
      target: 2,
      done: 0,
      deadline: '2026-05-15',
    },

    lastActivity: [
      { label: 'Pillar page shipped: /blog/organic-soil-health-bermuda-grass-fairways/', date: '2026-03-15' },
    ],

    demographics: {
      age: '35-55',
      income: '$75-130K',
      location: 'Southeast US, transition zone (GA, NC, SC, TN, TX, FL)',
      operation: '18-36 holes, $200K-1M annual turf budget, 5-15 person crew',
    },

    values: [
      'Course conditioning and playability rankings',
      'Board and membership satisfaction',
      'Agronomic excellence and peer recognition',
      'Environmental stewardship (water quality, wildlife habitat)',
      'Budget efficiency — demonstrable ROI on inputs',
    ],

    fears: [
      'Turf failure during tournament or peak season',
      'Board questioning budget spend on "unproven" organic program',
      'Regulatory action on chemical runoff into waterways',
      'Peer judgment — being the superintendent who "went organic and failed"',
      'Losing position due to visible turf quality decline',
    ],

    painPoints: [
      'Bermuda grass fairways under heavy traffic stress',
      'Compacted clay subsoil reducing water infiltration',
      'Chemical dependency creating salt buildup and dead soil',
      'Rising chemical costs with flat or declining budgets',
      'Member expectations for instant results vs soil biology timeline',
      'Water restrictions limiting irrigation options',
    ],

    buyingTriggers: [
      'Board directive to reduce chemical usage',
      'Peer superintendent recommendation at GCSAA event',
      'Failed soil test revealing dead biology',
      'Off-season (fall/winter) program planning window',
      'Water quality regulation pressure',
      'New superintendent inheriting a chemically-dependent course',
    ],

    objections: [
      '"I can\'t risk my greens on an organic experiment"',
      '"My board wants results by spring — biology takes years"',
      '"How do I justify the cost premium to my budget committee?"',
      '"Show me data from a course like mine, not a university plot"',
      '"I already have a chemical program that works — why change?"',
    ],

    preferredChannels: [
      'GCSAA conferences and regional superintendent meetups',
      'Golf Course Management magazine and GCM Online',
      'Peer superintendent network (phone, text)',
      'University turfgrass extension programs',
      'Sales rep visits with soil test results in hand',
    ],

    contentPreferences: [
      'Before/after soil test data from comparable courses',
      '12-month application calendars with rates and timing',
      'ROI calculators: organic vs chemical 3-year cost comparison',
      'Peer superintendent testimonials with course name and photo',
      'Technical data sheets with CEC, infiltration, and microbial activity metrics',
    ],

    languageRules: {
      use: ['fairway', 'greens', 'tees', 'bentgrass', 'bermuda', 'zoysia', 'MLSN', 'CEC', 'infiltration rate', 'soil biology', 'program', 'application calendar', 'superintendent'],
      avoid: ['lawn', 'yard', 'grass', 'homeowner', 'easy', 'simple', 'DIY', 'natural gardening', 'green thumb'],
    },

    skepticismTriggers: [
      'Consumer-grade packaging or branding',
      'No rate charts or application schedules for turf',
      'Claims without soil test data or university trials',
      'Salesperson who doesn\'t know warm-season vs cool-season',
      'Products marketed to homeowners, not professionals',
    ],

    trustHierarchy: [
      'Peer superintendents at comparable courses (same grass type, same climate)',
      'University turfgrass researchers (UGA, Clemson, NC State, Texas A&M)',
      'GCSAA certified agronomists',
      'Long-term distributor with turf expertise',
      'Technical sales rep who reads soil tests fluently',
      'Golf Course Management editorial content',
    ],

    jtbd: [
      { statement: 'Transition fairways from chemical to organic without visible quality loss', status: 'partial' },
      { statement: 'Improve water infiltration on compacted clay fairways', status: 'covered' },
      { statement: 'Reduce chemical input costs while maintaining conditioning standards', status: 'partial' },
      { statement: 'Build a 12-month organic turf program I can present to my board', status: 'gap' },
      { statement: 'Show measurable soil biology improvement with before/after data', status: 'gap' },
      { statement: 'Meet environmental regulations on chemical runoff without sacrificing turf', status: 'partial' },
    ],

    topProducts: [
      { name: 'Genesis Soil Conditioner', handle: 'soil-conditioner' },
      { name: 'Omega Soil Activator', handle: 'omega-soil-activator' },
      { name: 'C-Fix Biochar', handle: 'c-fix-biochar-soil-amendment' },
      { name: 'Turf Revival', handle: 'turf-revival' },
      { name: 'Soil Sulfur', handle: 'soil-sulfur' },
    ],

    plays: [
      {
        title: 'GCSAA regional chapter outreach',
        description:
          'Sponsor or attend 3 regional GCSAA chapter meetings. Bring soil test kits and offer free fairway soil analysis. Follow up with 12-month program proposal.',
        targetEstimate: '~500 courses in target geography (GA, NC, SC, FL)',
        expectedLift: '10-15 trial accounts at $2-5K annual value each',
      },
      {
        title: 'Superintendent peer case study',
        description:
          'Partner with 1-2 early adopter superintendents to document a full season of organic transition. Before/after soil tests, infiltration data, photo documentation. Publish as blog + PDF.',
        targetEstimate: 'Cornerstone content for all Gary-targeted marketing',
        expectedLift: 'Peer proof that unlocks the "show me someone like me" objection',
      },
      {
        title: 'Bermuda fairway pillar page → program builder funnel',
        description:
          'Pillar page already shipped. Add interactive program builder: select grass type + soil type + acreage → output 12-month calendar with products and rates. Capture lead info.',
        targetEstimate: 'Organic search + GCSAA referral traffic',
        expectedLift: 'Convert informational searches into qualified B2B leads',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // HOMEOWNER HANNAH
  // ---------------------------------------------------------------------------
  {
    slug: 'hannah',
    name: 'Homeowner Hannah',
    tagline: 'Suburban homeowner who wants a beautiful yard that\'s safe for kids and pets',
    color: '#be185d',
    bgColor: '#fdf2f8',
    landerUrl: '/lawn/homeowner/',

    weight: 0,
    customerCount: 0,
    avgLTV: 0,
    revenueGoalPct: 0,

    narrative:
      'Hannah is lumped into Taylor\'s persona but Taylor\'s language rules explicitly say AVOID "homeowner," "lawn," "yard," "easy," "simple." She\'s a completely different buyer — price-sensitive, Tractor Supply comparison shopper, motivated by family/pet safety. Has a subscription product (Natural Lawn Care Subscription). Collection page exists with beginner messaging. No lander, no campaigns.',

    mission: {
      text: 'Build /lawn/homeowner/ lander with family-safe messaging and subscription CTA.',
      target: 2,
      done: 0,
      deadline: '2026-05-15',
    },

    lastActivity: [],

    demographics: {
      age: '30-50',
      income: '$60-120K',
      location: 'Suburban US, nationwide (South over-indexed due to warm-season grass)',
      operation: '0.25-1 acre residential lawn, DIY maintenance or occasional service',
    },

    values: [
      'Family safety — kids and pets play on the lawn',
      'Curb appeal and neighborhood pride',
      'Chemical-free living aligned with organic food/wellness values',
      'Doing it herself — satisfaction of a beautiful yard',
      'Not spending a fortune — value-conscious',
    ],

    fears: [
      'Chemical lawn treatments harming kids or pets',
      'Wasting money on products that don\'t work',
      'Neighbors judging a brown or weedy yard',
      'Fire ants, ticks, or pests threatening family safety',
      'Not knowing what\'s wrong when grass turns brown',
    ],

    painPoints: [
      'Brown spots with no clear diagnosis (dog urine? disease? drought?)',
      'Weeds taking over without chemical herbicides',
      'Fire ant mounds in the yard',
      'Tick and pest anxiety with kids playing outside',
      'Information overload — conflicting advice from big box stores, YouTube, neighbors',
      'Subscription fatigue — another monthly charge?',
    ],

    buyingTriggers: [
      'Spring lawn prep season (March-April)',
      'Brown spots or visible lawn decline',
      'New home purchase (fresh start on lawn)',
      'Seeing neighbor\'s great lawn and asking what they use',
      'Pet or child health concern about chemicals',
      'Facebook group or Instagram recommendation',
    ],

    objections: [
      '"I can get lawn fertilizer at Home Depot for $20"',
      '"Does organic actually work or will my yard look worse?"',
      '"I don\'t understand what humic acid is or why I need it"',
      '"I tried organic before and it didn\'t do anything"',
      '"How long before I see results?"',
    ],

    preferredChannels: [
      'Google search ("how to fix brown spots in lawn," "organic lawn care")',
      'YouTube lawn care channels',
      'Instagram (lawn transformations, before/after)',
      'Facebook neighborhood groups',
      'Tractor Supply / local garden center browsing',
    ],

    contentPreferences: [
      'Before/after lawn transformation photos',
      'Simple seasonal calendars (when to apply what)',
      'Product comparison: us vs Home Depot brands',
      '"What\'s wrong with my lawn?" diagnostic guides',
      'Pet and kid safety information',
    ],

    languageRules: {
      use: ['lawn', 'yard', 'grass', 'green', 'safe', 'family', 'pets', 'kids', 'easy', 'simple', 'organic', 'natural', 'DIY', 'brown spots', 'weeds', 'fire ants'],
      avoid: ['turf', 'program', 'application rate', 'accounts', 'clients', 'CEC', 'infiltration', 'superintendent', 'warm-season cultivar', 'MLSN'],
    },

    skepticismTriggers: [
      'Professional-grade packaging or technical jargon',
      'High price without clear value explanation',
      'No photos of real residential lawns',
      'No reviews from regular homeowners',
      'Complicated multi-step application process',
    ],

    trustHierarchy: [
      'Neighbor with a great lawn',
      'Facebook and Instagram before/after posts',
      'YouTube lawn care creators (Ryan Knorr, LawnCareNut)',
      'Local garden center staff',
      'Amazon/website reviews from people with similar yards',
      'Tractor Supply recommendations',
    ],

    jtbd: [
      { statement: 'Get a green lawn without chemicals near my kids and pets', status: 'covered' },
      { statement: 'Fix brown spots without knowing what caused them', status: 'partial' },
      { statement: 'Kill weeds naturally without destroying the grass', status: 'partial' },
      { statement: 'Eliminate fire ants safely', status: 'gap' },
      { statement: 'Understand what my lawn actually needs (simple diagnostic)', status: 'gap' },
      { statement: 'Know if organic is worth the price vs Home Depot fertilizer', status: 'gap' },
    ],

    topProducts: [
      { name: 'Natural Lawn Care Subscription', handle: 'natural-lawn-care-subscription' },
      { name: 'Genesis Soil Conditioner', handle: 'soil-conditioner' },
      { name: 'FertAlive Organic Fertilizer', handle: 'fertalive' },
      { name: 'Veridian Humate Liquid Iron', handle: 'veridian-humate-liquid-iron-for-lawns' },
      { name: 'Torched Weed Killer', handle: 'torched-all-natural-weed-killer' },
    ],

    plays: [
      {
        title: 'Lawn subscription onboarding sequence',
        description:
          'Email sequence for Natural Lawn Care Subscription signups: Day 1 welcome + what to expect, Day 14 first application guide, Day 30 "is it working?" check-in with before/after examples, Day 60 seasonal tips.',
        targetEstimate: 'All subscription customers',
        expectedLift: 'Reduce subscription churn from estimated 40% to 20% in first 90 days',
      },
      {
        title: '"What\'s wrong with my lawn?" diagnostic quiz',
        description:
          'Interactive page: select symptoms (brown spots, thinning, weeds, pests) → get diagnosis + recommended product. Captures email for follow-up sequence.',
        targetEstimate: 'Organic search traffic for lawn problem queries',
        expectedLift: 'Convert diagnostic searches into product purchases',
      },
      {
        title: 'Spring lawn prep social campaign',
        description:
          'Instagram + Facebook before/after content series. Real customer lawns. "Tag your yard" UGC campaign. Link to subscription product as seasonal starter.',
        targetEstimate: 'March-April seasonal window',
        expectedLift: 'Subscription signups during peak lawn care decision period',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // MARKET GARDENER MAGGIE
  // ---------------------------------------------------------------------------
  {
    slug: 'maggie',
    name: 'Market Gardener Maggie',
    tagline: 'Small-scale intensive grower selling at farmers markets and through CSA',
    color: '#a16207',
    bgColor: '#fefce8',
    landerUrl: '/garden/',

    weight: 0,
    customerCount: 0,
    avgLTV: 0,
    revenueGoalPct: 0,

    narrative:
      'Maggie is the regenerative/permaculture small farmer — 0.5 to 5 acres, sells at farmers markets and through CSA boxes. Shares Betty\'s values (natural, family, self-sufficiency) and channels (Instagram, Facebook, podcasts) but buys soil and crop products. Collection pages exist (produce, crops) but content is entirely beginner/homeowner-focused. Zero market gardener pillar pages. Reachable digitally — this is not a Frank situation.',

    mission: {
      text: 'Build /garden/ lander and create 1 pillar page targeting "market garden soil health."',
      target: 2,
      done: 0,
      deadline: '2026-06-01',
    },

    lastActivity: [],

    demographics: {
      age: '28-50',
      income: '$35-80K (often supplemented by off-farm work)',
      location: 'Nationwide, peri-urban and rural (within 1 hour of a farmers market)',
      operation: '0.5-5 acres intensive, 30-200 beds, hand tools or walk-behind tractor, $20-150K annual gross',
    },

    values: [
      'Soil biology as philosophy — "feed the soil, not the plant"',
      'Regenerative practice and building long-term soil capital',
      'Community food security and local food systems',
      'Independence from industrial agriculture inputs',
      'Leaving the land better than they found it',
    ],

    fears: [
      'Crop failure wiping out a season\'s income',
      'Soil-borne disease building up in intensive beds',
      'Not being able to compete on price with conventional produce',
      'Burnout — the physical toll of small-scale farming',
      'Losing market customers to another grower',
    ],

    painPoints: [
      'Building soil biology fast enough to see results in the first season',
      'Southern clay soil that resists organic amendment',
      'Compost quality inconsistency — buying vs making',
      'Nutrient cycling in intensive rotation (nitrogen depletion, micronutrient exhaustion)',
      'Scaling up from hobby garden to profitable market farm',
      'Product confusion — too many "organic" options with no clear program',
    ],

    buyingTriggers: [
      'Off-season planning (November-February)',
      'Soil test results showing depleted biology or nutrients',
      'Crop failure or yield decline mid-season',
      'Peer recommendation at farmers market or grower meetup',
      'Podcast or Instagram content from trusted grower',
      'First season on new land (building from scratch)',
    ],

    objections: [
      '"I make my own compost — why do I need a product?"',
      '"This seems expensive for my scale"',
      '"I can\'t tell if it\'s actually doing anything different from compost alone"',
      '"Is this really different from the humic acid at the co-op?"',
      '"I need a whole program, not individual products"',
    ],

    preferredChannels: [
      'Instagram (farm photos, soil building process, crop beauty shots)',
      'Podcasts (No-Till Growers, Farmer to Farmer, The Market Gardener)',
      'Facebook groups (market gardening, permaculture, regenerative ag)',
      'Local grower meetups and field days',
      'Email newsletters from trusted growers',
    ],

    contentPreferences: [
      'Soil building programs with seasonal timelines',
      'Before/after soil test results from similar-scale farms',
      'Cost-per-bed or cost-per-acre breakdowns',
      'Compost tea brewing guides and application schedules',
      'Peer farmer stories with photos and real numbers',
    ],

    languageRules: {
      use: ['soil biology', 'beds', 'compost', 'cover crop', 'no-till', 'regenerative', 'market garden', 'CSA', 'farmers market', 'intensive', 'microbes', 'humus', 'carbon', 'living soil'],
      avoid: ['lawn', 'turf', 'homeowner', 'acres of production', 'commodity', 'bushels per acre', 'yield optimization', 'precision agriculture', 'industrial', 'commercial grower'],
    },

    skepticismTriggers: [
      'Products marketed to large-scale conventional farms',
      'No explanation of the biology behind the product',
      'Corporate branding that doesn\'t feel "farm authentic"',
      'Claims without soil test data',
      'Products that replace rather than build soil biology',
    ],

    trustHierarchy: [
      'Peer growers at farmers market (same scale, same climate)',
      'Market gardening authors and podcasters (Curtis Stone, Jean-Martin Fortier, Jesse Frost)',
      'Local extension small farm specialists',
      'Regenerative agriculture community leaders',
      'Soil lab with farmer-friendly interpretation',
      'Brand with real farm stories and transparent sourcing',
    ],

    jtbd: [
      { statement: 'Build living soil fast enough to see results in the first growing season', status: 'partial' },
      { statement: 'Create a soil amendment program for intensive bed rotation', status: 'gap' },
      { statement: 'Fix heavy clay soil for raised bed or in-ground production', status: 'partial' },
      { statement: 'Replace or supplement compost with concentrated biology', status: 'partial' },
      { statement: 'Understand what my soil test results mean and what to buy', status: 'gap' },
      { statement: 'Justify the cost of organic inputs against market produce prices', status: 'gap' },
    ],

    topProducts: [
      { name: 'Compost Tea', handle: 'compost-tea' },
      { name: 'C-Fix Biochar', handle: 'c-fix-biochar-soil-amendment' },
      { name: 'Jump Start Soil Conditioner', handle: 'jump-start-soil-conditioner' },
      { name: 'FertAlive Organic Fertilizer', handle: 'fertalive' },
      { name: 'Chicken Manure Fertilizer', handle: 'chicken-manure-fertilizer' },
      { name: 'Compost Starter', handle: 'compost-starter' },
    ],

    plays: [
      {
        title: '"Market Garden Soil Program" landing page',
        description:
          'Interactive page: select soil type + bed count + climate zone → output a seasonal soil building program with products, rates, and cost per bed. Capture email for follow-up.',
        targetEstimate: 'Organic search + podcast/Instagram referral traffic',
        expectedLift: 'Convert informational searches into program purchases',
      },
      {
        title: 'Podcast sponsorship / guest appearances',
        description:
          'Sponsor No-Till Growers or Farmer to Farmer podcast. Or pitch Mike/Allen as guests discussing soil biology in market garden context. Link to soil program builder.',
        targetEstimate: '10-20K listeners per episode in target demographic',
        expectedLift: 'Brand awareness → landing page visits → program signups',
      },
      {
        title: 'Instagram soil building series',
        description:
          'Partner with 2-3 market gardeners to document a season of soil building with Southland products. Before/after soil tests, crop photos, honest results. UGC content for our feed.',
        targetEstimate: '3-5 partner farms, 6-month documentation',
        expectedLift: 'Peer proof that unlocks "show me someone like me" objection',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // BREEDER BOB
  // ---------------------------------------------------------------------------
  {
    slug: 'bob',
    name: 'Breeder Bob',
    tagline: 'Poultry breeder or pullet grower focused on hatchability and egg quality',
    color: '#1e40af',
    bgColor: '#eff6ff',
    landerUrl: '/poultry/breeders/',

    weight: 0,
    customerCount: 0,
    avgLTV: 0,
    revenueGoalPct: 0,

    narrative:
      'Bob runs breeder or pullet operations where the JTBD is fundamentally different from Bill\'s grow-out focus. His birds live 40+ weeks, not 6-8. Hatchability, egg quality, and reproductive function are his metrics — not FCR or settlement. Dedicated collection page, stub lander at /poultry/breeders/ (95% built), and blog content on pullet challenges. Real customers already buying.',

    mission: {
      text: 'Finalize /poultry/breeders/ lander copy and create 1 breeder-specific content piece.',
      target: 2,
      done: 1,
      deadline: '2026-05-01',
    },

    lastActivity: [
      { label: 'Lander page built: /poultry/breeders/', date: '2026-03-01' },
    ],

    demographics: {
      age: '35-55',
      income: '$80-150K',
      location: 'Southeast US (GA, AR, AL, NC, MS)',
      operation: 'Breeder houses or pullet farms, contracted to integrators, 10K-50K breeders or 50K-200K pullets',
    },

    values: [
      'Hatchability rates and settable egg percentages',
      'Flock uniformity and low cull rates',
      'Integrator relationship and contract renewal',
      'Biosecurity — one disease event can destroy a flock worth 40 weeks of investment',
      'Efficiency in a long grow-out cycle',
    ],

    fears: [
      'Disease event destroying 40 weeks of work (not 6 weeks like broilers)',
      'Declining hatchability — integrator pressure to cull early',
      'Egg quality deterioration in late lay cycle',
      'Pullet uniformity problems leading to uneven production',
      'Biosecurity failure with high-value breeding stock',
    ],

    painPoints: [
      'Maintaining egg quality and hatchability through 60+ weeks of production',
      'Pullet uniformity — weight variation at placement destroys peak production',
      'Breeder house litter management for 40+ week cycles (much longer than broiler)',
      'Ammonia buildup impact on reproductive performance',
      'Limited product options specifically formulated for breeders vs broilers',
      'Malabsorption syndrome in pullets affecting flock start',
    ],

    buyingTriggers: [
      'Declining hatchability rates (urgent)',
      'New flock placement (preventive program)',
      'Integrator field tech recommendation',
      'Pullet delivery with uniformity concerns',
      'Between-flock house treatment window',
      'Peer breeder recommendation',
    ],

    objections: [
      '"Broiler products might not work the same for breeders"',
      '"I need to see hatchability data, not just mortality data"',
      '"My integrator has a specific program — I can\'t deviate"',
      '"The lay cycle is too long to experiment — if it fails I lose 40 weeks"',
      '"Show me results from breeder operations, not broiler houses"',
    ],

    preferredChannels: [
      'Integrator field tech (most trusted advisor)',
      'Phone calls (direct, relationship-based)',
      'Peer breeder network (small, tight-knit)',
      'Poultry science conferences',
      'Allen Reynolds / Southland field visits',
    ],

    contentPreferences: [
      'Hatchability and egg quality data from breeder operations',
      'Pullet-to-breeder transition protocols',
      'Long-cycle litter management programs',
      'Breeder house ammonia control case studies',
      'Video content from Allen Reynolds on breeder operations',
    ],

    languageRules: {
      use: ['hatchability', 'settable eggs', 'egg quality', 'breeder', 'pullet', 'lay cycle', 'peak production', 'uniformity', 'cull rate', 'reproductive performance', 'brood stock'],
      avoid: ['FCR', 'feed conversion', 'settlement', 'grow-out', 'placement to processing', 'cents per bird', 'tournament ranking'],
    },

    skepticismTriggers: [
      'Products marketed only for broilers with no breeder data',
      'Short-cycle thinking applied to long-cycle birds',
      'No understanding of breeder-specific challenges',
      'Generic "poultry" claims without specifying bird type',
      'Salespeople who ask about FCR instead of hatchability',
    ],

    trustHierarchy: [
      'Peer breeder grower with same integrator',
      'Integrator field tech (10+ years experience)',
      'Allen Reynolds (field knowledge of breeder operations)',
      'Poultry science extension specialist',
      'Feed mill nutritionist',
      'Sales rep who demonstrates breeder-specific knowledge',
    ],

    jtbd: [
      { statement: 'Maximize hatchability and egg quality through the full lay cycle', status: 'partial' },
      { statement: 'Maintain breeder house litter quality for 40+ weeks', status: 'covered' },
      { statement: 'Achieve pullet uniformity from day 1 to placement', status: 'partial' },
      { statement: 'Control ammonia impact on reproductive performance', status: 'covered' },
      { statement: 'Prevent malabsorption syndrome in young pullets', status: 'partial' },
      { statement: 'Find products with breeder-specific data, not just broiler crossover', status: 'gap' },
    ],

    topProducts: [
      { name: 'Big Ole Bird', handle: 'poultry-probiotic' },
      { name: 'Hen Helper', handle: 'hen-helper' },
      { name: 'Mother Load ACV', handle: 'apple-cider-vinegar-for-chickens' },
      { name: 'Catalyst', handle: 'catalyst' },
      { name: 'Litter Life', handle: 'poultry-litter-amendment' },
      { name: 'Desecticide', handle: 'natural-mite-control-livestock-poultry' },
    ],

    plays: [
      {
        title: 'Breeder-specific content series',
        description:
          'Blog series: "Breeder Operations Guide" — hatchability optimization, pullet uniformity protocols, long-cycle litter management. Feature Allen Reynolds as guide.',
        targetEstimate: 'Existing breeder customers + integrator field techs',
        expectedLift: 'Position as breeder expert (not just broiler expert) → unlock new accounts',
      },
      {
        title: 'Pullet placement welcome program',
        description:
          'Triggered email/text when we know a customer is receiving pullets: Day 1 placement protocol with Big Ole Bird + Catalyst, Day 14 check-in, Day 30 uniformity assessment guide.',
        targetEstimate: 'All identified breeder/pullet customers',
        expectedLift: 'Increase per-customer product count from 1.5 to 3+ per cycle',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // TURKEY TOM
  // ---------------------------------------------------------------------------
  {
    slug: 'tom',
    name: 'Turkey Tom',
    tagline: 'Commercial turkey grower navigating longer grow-outs and higher mortality risk',
    color: '#9a3412',
    bgColor: '#fff7ed',
    landerUrl: '/poultry/turkey/',

    weight: 0,
    customerCount: 0,
    avgLTV: 0,
    revenueGoalPct: 0,

    narrative:
      'Tom runs commercial turkey operations with fundamentally different economics from broilers: 15-20 week grow-outs (vs 6-8), heavier birds, higher mortality risk, different integrator landscape (Butterball, Cargill vs Tyson/Pilgrims). Lander page at /poultry/turkey/ is fully built. Blog content exists (turkey vs chicken comparison, clostridial dermatitis). Real customers already buying.',

    mission: {
      text: 'Finalize /poultry/turkey/ lander copy and create 1 turkey-specific troubleshooting article.',
      target: 2,
      done: 1,
      deadline: '2026-05-01',
    },

    lastActivity: [
      { label: 'Lander page built: /poultry/turkey/', date: '2026-03-01' },
    ],

    demographics: {
      age: '38-55',
      income: '$85-160K',
      location: 'AR, MN, NC, MO, IN, VA (turkey belt)',
      operation: '2-6 houses, 50K-200K poults/year, 15-20 week cycles, ~3 flocks/year',
    },

    values: [
      'Bird weight and uniformity at processing',
      'Low mortality through longer grow-out (every dead bird costs more)',
      'House environment control for heavier birds',
      'Integrator relationship — fewer integrators means less leverage',
      'Flock consistency across cycles',
    ],

    fears: [
      'Clostridial dermatitis outbreak (turkey-specific, devastating)',
      'High early mortality in poults (fragile first 2 weeks)',
      'Turkey aggression causing injuries and downgrades',
      'Feed cost spikes on longer grow-out cycle',
      'Integrator consolidation reducing contract options',
    ],

    painPoints: [
      'Poult fragility — first 14 days are critical and losses are higher than chicks',
      'Clostridial dermatitis and necrotic enteritis risk',
      'Ammonia management with heavier birds producing more waste',
      'Litter management through 15-20 weeks (not 6-8)',
      'Turkey aggression and pecking injuries in late grow-out',
      'Fewer product options — most poultry products tested on broilers only',
    ],

    buyingTriggers: [
      'High poult mortality in first flock (crisis)',
      'Clostridial dermatitis outbreak',
      'Between-flock house prep (3 flocks/year = 3 decision windows)',
      'Feed mill or integrator tech suggestion',
      'Peer grower recommendation',
      'Seasonal placement (spring poults)',
    ],

    objections: [
      '"These products are for chickens — do they work on turkeys?"',
      '"Turkey metabolism is different — show me turkey data"',
      '"My grow-out is 15 weeks, not 6 — how does dosing change?"',
      '"I only get 3 flocks a year — I can\'t afford to waste one on a test"',
      '"My integrator doesn\'t use your products — will they approve it?"',
    ],

    preferredChannels: [
      'Phone calls (relationship-based, like Bill)',
      'Integrator field tech recommendation',
      'National Turkey Federation events',
      'Peer grower network (smaller than broiler community)',
      'Allen Reynolds field visits',
    ],

    contentPreferences: [
      'Turkey-specific mortality and performance data',
      'Clostridial dermatitis prevention protocols',
      'Poult brooding guides with Southland products',
      'Long-cycle litter management for turkey houses',
      'Turkey vs broiler comparison guides (dosing, timing, expectations)',
    ],

    languageRules: {
      use: ['poult', 'tom', 'hen (turkey)', 'grow-out', 'processing weight', 'condemnation rate', 'breast blister', 'clostridial', 'necrotic enteritis', 'turkey house'],
      avoid: ['chick', 'placement (broiler context)', 'FCR (broiler metric)', 'settlement (broiler term)', 'backyard', 'hobby flock'],
    },

    skepticismTriggers: [
      'Products with only broiler data and no turkey references',
      'Dosing instructions that don\'t account for turkey body weight',
      'Salespeople who say "it works the same on turkeys"',
      'No understanding of turkey-specific diseases',
      'Consumer or backyard branding on products',
    ],

    trustHierarchy: [
      'Peer turkey grower (same integrator, same region)',
      'Integrator field tech with turkey experience',
      'Allen Reynolds (if he has turkey house experience)',
      'Turkey-specific veterinarian',
      'National Turkey Federation resources',
      'Feed mill nutritionist with turkey formulation experience',
    ],

    jtbd: [
      { statement: 'Keep poults alive through the critical first 14 days', status: 'partial' },
      { statement: 'Prevent clostridial dermatitis and necrotic enteritis naturally', status: 'partial' },
      { statement: 'Manage turkey house litter and ammonia for 15-20 weeks', status: 'covered' },
      { statement: 'Optimize processing weight and reduce condemnations', status: 'gap' },
      { statement: 'Get turkey-specific product data, not just broiler crossover', status: 'gap' },
      { statement: 'Reduce turkey aggression and late-cycle injuries', status: 'gap' },
    ],

    topProducts: [
      { name: 'Big Ole Bird', handle: 'poultry-probiotic' },
      { name: 'Hen Helper', handle: 'hen-helper' },
      { name: 'Catalyst', handle: 'catalyst' },
      { name: 'Litter Life', handle: 'poultry-litter-amendment' },
      { name: 'Desecticide', handle: 'natural-mite-control-livestock-poultry' },
    ],

    plays: [
      {
        title: 'Turkey-specific content hub',
        description:
          'Blog series: poult brooding protocol, clostridial dermatitis prevention, turkey house litter management, turkey vs broiler dosing guide. Position Allen Reynolds as turkey expert.',
        targetEstimate: 'Existing turkey customers + organic search',
        expectedLift: 'Differentiation from competitors who only talk about broilers',
      },
      {
        title: 'Between-flock turkey house prep campaign',
        description:
          'Targeted outreach 2 weeks before expected placement dates (3x/year). "Prep your turkey house" protocol with Litter Life + Desecticide + Big Ole Bird starter pack.',
        targetEstimate: 'All identified turkey customers, 3x annual touchpoints',
        expectedLift: 'Increase reorder rate and per-flock product count',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // GAME BIRD GREG
  // ---------------------------------------------------------------------------
  {
    slug: 'greg',
    name: 'Game Bird Greg',
    tagline: 'Quail, pheasant, or chukar operator running a hunting preserve or hatchery',
    color: '#4338ca',
    bgColor: '#eef2ff',
    landerUrl: '/poultry/game-birds/',

    weight: 0,
    customerCount: 0,
    avgLTV: 0,
    revenueGoalPct: 0,

    narrative:
      'Greg runs quail, pheasant, or chukar operations for hunting preserves, state wildlife programs, or direct sale. Completely different industry from broiler/turkey — hunting season drives demand, birds must fly (not just grow), and stress tolerance during transport is critical. Tuck Farms partnership (1.4M+ quail chicks/year) provides world-class social proof. Lander at /poultry/game-birds/ is fully built.',

    mission: {
      text: 'Finalize /poultry/game-birds/ lander copy and leverage Tuck Farms case study.',
      target: 2,
      done: 1,
      deadline: '2026-05-01',
    },

    lastActivity: [
      { label: 'Lander page built: /poultry/game-birds/', date: '2026-03-01' },
    ],

    demographics: {
      age: '35-60',
      income: '$60-200K (wide range: small preserve to integrated hatchery)',
      location: 'Southeast US (quail), Midwest/Plains (pheasant), nationwide (preserves)',
      operation: 'Hunting preserve, game bird hatchery, state wildlife contract, or shooting club',
    },

    values: [
      'Bird quality — flight ability, feather condition, health at release',
      'Low mortality from hatch through transport to preserve',
      'Seasonal reliability — birds must be ready for hunting season',
      'Reputation with hunting preserve customers',
      'Cost control on tight per-bird margins',
    ],

    fears: [
      'Ulcerative enteritis wiping out a hatch (quail-specific, devastating)',
      'Respiratory disease before hunting season delivery',
      'Transport mortality destroying a shipment',
      'Losing preserve contracts to a competitor with healthier birds',
      'Rising feed costs on already-thin margins',
    ],

    painPoints: [
      'Ulcerative enteritis (quail) — industry\'s #1 killer, antibiotic resistance growing',
      'Respiratory stress in flight pens and brood houses',
      'Transport stress during shipment to hunting preserves',
      'Ammonia in enclosed brood houses affecting respiratory health',
      'Darkling beetle infestations in game bird houses',
      'Limited products tested on game birds — most designed for broilers',
    ],

    buyingTriggers: [
      'Disease outbreak (ulcerative enteritis, respiratory)',
      'Pre-hunting-season bird prep (September-November)',
      'Hatchery startup or expansion',
      'State wildlife contract bid (need to demonstrate bird quality)',
      'Peer operator recommendation (small industry, word travels fast)',
      'Tuck Farms endorsement impact',
    ],

    objections: [
      '"Game birds are different — broiler products don\'t apply"',
      '"My birds need to fly, not just gain weight"',
      '"I can\'t dose a product designed for 50K-bird houses in my 5K-bird pens"',
      '"Show me results on quail/pheasant specifically"',
      '"Who else in the game bird industry uses this?"',
    ],

    preferredChannels: [
      'Industry trade shows (North American Gamebird Association)',
      'Peer operator phone network (tight-knit industry)',
      'Direct sales rep relationships',
      'State wildlife agency recommendations',
      'Industry publications and newsletters',
    ],

    contentPreferences: [
      'Case studies from game bird operations (Tuck Farms = gold)',
      'Disease prevention protocols for quail, pheasant, chukar',
      'Transport stress reduction guides',
      'Dosing calculators for smaller-scale operations',
      'Peer operator testimonials with species-specific results',
    ],

    languageRules: {
      use: ['quail', 'pheasant', 'chukar', 'bobwhite', 'flight pen', 'brood house', 'preserve', 'release', 'transport', 'hatch', 'ulcerative enteritis', 'covey'],
      avoid: ['broiler', 'settlement', 'FCR', 'integrator', 'grow-out', 'processing plant', 'backyard', 'hobby', 'pet'],
    },

    skepticismTriggers: [
      'Products with only broiler/layer data',
      'No understanding of game bird species differences',
      'Consumer-grade packaging',
      'Dosing instructions only for 20K+ bird houses',
      'No peer game bird operator references',
    ],

    trustHierarchy: [
      'Tuck Farms / major game bird operators (ultimate peer proof)',
      'Peer preserve owners and hatchery operators',
      'State wildlife biologists',
      'North American Gamebird Association network',
      'Long-term game bird feed suppliers',
      'Allen Reynolds (if he has game bird field experience)',
    ],

    jtbd: [
      { statement: 'Prevent ulcerative enteritis without antibiotics', status: 'partial' },
      { statement: 'Keep mortality low from hatch to release', status: 'covered' },
      { statement: 'Reduce transport stress and arrival mortality', status: 'partial' },
      { statement: 'Control ammonia in flight pens and brood houses', status: 'covered' },
      { statement: 'Get species-specific protocols for quail vs pheasant vs chukar', status: 'gap' },
      { statement: 'Produce birds with flight quality (not just weight)', status: 'gap' },
    ],

    topProducts: [
      { name: 'Big Ole Bird', handle: 'poultry-probiotic' },
      { name: 'Hen Helper', handle: 'hen-helper' },
      { name: 'Catalyst', handle: 'catalyst' },
      { name: 'Litter Life', handle: 'poultry-litter-amendment' },
      { name: 'Desecticide', handle: 'natural-mite-control-livestock-poultry' },
    ],

    plays: [
      {
        title: 'Tuck Farms case study amplification',
        description:
          'Full case study: "How Tuck Farms Uses Southland Products on 1.4M+ Quail Chicks/Year." Blog post, PDF download, video interview if possible. This is the single most powerful piece of social proof in the game bird industry.',
        targetEstimate: 'Every quail and game bird operator in North America',
        expectedLift: 'Category-defining credibility — no competitor has this proof point',
      },
      {
        title: 'Pre-hunting-season outreach',
        description:
          'Direct mail + email to hunting preserves and game bird operations in August-September. "Get your birds ready for season" with transport stress protocol + Big Ole Bird starter program.',
        targetEstimate: '~2,000 hunting preserves in US',
        expectedLift: 'Seasonal revenue spike Sept-Nov aligned with hunting prep',
      },
      {
        title: 'NAGA trade show presence',
        description:
          'Booth at North American Gamebird Association annual conference. Bring Tuck Farms data, species-specific dosing guides, and free trial offers for preserve operators.',
        targetEstimate: '300-500 attendees, mostly operators',
        expectedLift: 'Direct account acquisition + industry credibility',
      },
    ],
  },
]

// =============================================================================
// HELPERS
// =============================================================================

export function getPersona(slug: string): PersonaProfile | undefined {
  return PERSONAS.find((p) => p.slug === slug)
}

export function getJTBDCoverage(persona: PersonaProfile): { covered: number; partial: number; gap: number; total: number } {
  const covered = persona.jtbd.filter((j) => j.status === 'covered').length
  const partial = persona.jtbd.filter((j) => j.status === 'partial').length
  const gap = persona.jtbd.filter((j) => j.status === 'gap').length
  return { covered, partial, gap, total: persona.jtbd.length }
}

export function getNextBestMove(persona: PersonaProfile): PersonaJTBD | null {
  return persona.jtbd.find((j) => j.status === 'gap') || persona.jtbd.find((j) => j.status === 'partial') || null
}
