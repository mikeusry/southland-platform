// Erosion Control Seed Calculator — Config-Driven Rules
//
// All domain knowledge lives here as declarative data.
// Sources: GA SWCC Field Manual, UGA Extension, Ernst Seed, P2 InfoHouse.
// Edit rates, species, overrides, and product catalog here without touching UI.

import type {
  Goal,
  InputOption,
  Method,
  MethodOverride,
  MixConfig,
  ProductCatalogEntry,
  Region,
  RegionOverride,
  Season,
  SeasonOverride,
  Slope,
  SlopeOverride,
  Soil,
  SoilOverride,
  Sun,
  SunOverride,
} from './erosionControlTypes'

// ---------------------------------------------------------------------------
// Mix Configs (4 biological mixes — Hydroseed is a method overlay, not a mix)
// ---------------------------------------------------------------------------

export const MIX_CONFIGS: MixConfig[] = [
  {
    id: 'fast-cover',
    name: 'Fast Cover Mix',
    matchGoal: 'quick-cover',
    species: [
      { name: 'Tall Fescue', percentMin: 60, percentMax: 70 },
      { name: 'Ryegrass', percentMin: 30, percentMax: 40 },
    ],
    ratePer1000: 8,
    summary:
      'Best when you need quick surface protection and fast germination, especially on freshly exposed soil.',
  },
  {
    id: 'standard-slope',
    name: 'Standard Slope Stabilization Mix',
    matchGoal: 'quick-long-term',
    species: [
      { name: 'Tall Fescue', percentMin: 75, percentMax: 80 },
      { name: 'Ryegrass', percentMin: 20, percentMax: 25 },
    ],
    ratePer1000: 9,
    summary:
      'Best all-around choice for Georgia slopes when you want quick establishment plus stronger long-term hold.',
  },
  {
    id: 'mowable-turf',
    name: 'Mowable Turf Mix',
    matchGoal: 'mowable-turf',
    species: [
      { name: 'Tall Fescue', percentMin: 85, percentMax: 90 },
      { name: 'Ryegrass', percentMin: 10, percentMax: 15 },
    ],
    ratePer1000: 7,
    summary: 'Best for areas you plan to maintain like a seeded lawn or finished turf zone.',
  },
  {
    id: 'low-maintenance',
    name: 'Low-Maintenance Slope Mix',
    matchGoal: 'low-maintenance',
    species: [
      { name: 'Tall Fescue', percentMin: 70, percentMax: 80 },
      { name: 'Ryegrass', percentMin: 20, percentMax: 30 },
    ],
    ratePer1000: 9,
    summary:
      'Best for banks, utility areas, and practical stabilization where durability matters more than lawn appearance.',
  },
]

// The Standard Slope mix is the default fallback and the base for hydroseed overlay
export const DEFAULT_MIX_ID = 'standard-slope'

// ---------------------------------------------------------------------------
// Hydroseed overlay summary (used when hydroseed method/goal is active)
// ---------------------------------------------------------------------------

export const HYDROSEED_OVERLAY_SUMMARY =
  'Best when you want the seed, mulch, and application system to work together for more uniform coverage.'

// ---------------------------------------------------------------------------
// Slope Overrides — GA SWCC / GA EPD BMP guidance
// ---------------------------------------------------------------------------

export const SLOPE_OVERRIDES: Record<Slope, SlopeOverride> = {
  flat: {
    blanketRequired: false,
    blanketReason: null,
    notes: ['Flat terrain — straw or hydromulch is usually sufficient for surface protection.'],
  },
  mild: {
    blanketRequired: false,
    blanketReason: null,
    notes: [],
  },
  moderate: {
    blanketRequired: false, // upgraded to true by soil override when disturbed
    blanketReason: null,
    notes: [
      'On moderate slopes, erosion blankets are strongly recommended if the soil is disturbed or runoff is concentrated.',
    ],
  },
  steep: {
    blanketRequired: true,
    blanketReason:
      'Georgia EPD BMPs require approved erosion control blankets or matting on slopes steeper than 3:1. Seed should not be left uncovered on steep grades.',
    notes: [
      'Steep slope — an erosion control blanket is required. Toe in and secure the blanket according to manufacturer specs.',
      'Consider staking or pinning at closer intervals on exposed or wind-prone faces.',
    ],
  },
}

// ---------------------------------------------------------------------------
// Soil Overrides
// ---------------------------------------------------------------------------

export const SOIL_OVERRIDES: Record<Soil, SoilOverride> = {
  'red-clay': {
    notes: [],
    compostYesNote:
      'Compost incorporation improves clay workability and seed-to-soil contact — good call.',
    compostNoNote:
      'Red clay without compost can crust and reduce germination. Consider scarifying the surface and incorporating compost or other organic matter before seeding.',
    strengthensBlanket: false,
  },
  loam: {
    notes: ['Loam is the easiest soil type for seed establishment — good starting conditions.'],
    compostYesNote: null,
    compostNoNote: null,
    strengthensBlanket: false,
  },
  sandy: {
    notes: [
      'Sandy soils drain fast — moisture management and consistent mulch coverage are critical for establishment.',
    ],
    compostYesNote:
      'Compost improves moisture retention in sandy soils, which helps seeds stay hydrated during germination.',
    compostNoNote:
      'Sandy soil without compost dries out quickly. Mulch is especially important, and supplemental irrigation may be needed.',
    strengthensBlanket: false,
  },
  disturbed: {
    notes: [
      'Disturbed subsoil lacks organic matter and structure. Seedbed preparation — loosening, grading, and amending — is critical before seeding.',
    ],
    compostYesNote:
      'Compost helps rebuild soil structure in disturbed areas — essential for root establishment.',
    compostNoNote:
      'Disturbed subsoil without amendment has poor water-holding capacity and root penetration. Strongly recommend incorporating compost or topsoil before seeding.',
    strengthensBlanket: true, // disturbed + moderate/steep → blanket strongly recommended
  },
}

// ---------------------------------------------------------------------------
// Sun Overrides
// ---------------------------------------------------------------------------

export const SUN_OVERRIDES: Record<Sun, SunOverride> = {
  'full-sun': {
    warnings: [],
    confidence: 'standard',
  },
  'part-sun': {
    warnings: [],
    confidence: 'standard',
  },
  shade: {
    warnings: [
      'This calculator is optimized for full-sun and part-sun erosion control scenarios. Heavy shade sites may need shade-tolerant species not covered here. We recommend requesting a custom recommendation for your specific conditions.',
    ],
    confidence: 'custom-review',
  },
}

// ---------------------------------------------------------------------------
// Season Overrides
// ---------------------------------------------------------------------------

export const SEASON_OVERRIDES: Record<Season, SeasonOverride> = {
  fall: {
    warnings: [],
    notes: [
      'Fall is the ideal seeding window for cool-season grasses in Georgia and the Southeast.',
    ],
  },
  spring: {
    warnings: [],
    notes: [
      'Spring seeding is acceptable, but warming temperatures shorten the establishment window before summer heat stress. Seed as early as soil conditions allow.',
    ],
  },
  summer: {
    warnings: [
      'Summer seeding in Georgia carries higher failure risk due to heat and drought stress. Extra irrigation is critical. Consider temporary erosion protection while waiting for a better seeding window if the timeline allows.',
    ],
    notes: [],
  },
  winter: {
    warnings: [],
    notes: [
      'Winter seeding is possible but germination slows significantly in cold soil. Use temporary erosion protection (blankets, straw) while waiting for spring warm-up.',
    ],
  },
}

// ---------------------------------------------------------------------------
// Method Overrides
// ---------------------------------------------------------------------------

export const METHOD_OVERRIDES: Record<Method, MethodOverride> = {
  broadcast: {
    notes: [
      'After broadcasting, lightly rake or press seed into the soil surface to improve seed-to-soil contact.',
    ],
    productRecommendations: [],
  },
  hydroseed: {
    notes: [
      'Hydroseeding provides uniform seed distribution and built-in mulch coverage — ideal for slopes and large areas.',
      'Add biological amendments to the slurry tank before water so they coat seeds and mulch in the agitator.',
    ],
    productRecommendations: [
      {
        name: 'Genesis',
        slug: 'genesis',
        reason: 'Soil biology activator — 155% greater germination in third-party testing.',
        required: false,
      },
      {
        name: 'Omega Soil Activator',
        slug: 'omega-soil-activator',
        reason: 'Liquid soil conditioner — 1 gallon per 500 gallons of slurry.',
        required: false,
      },
      {
        name: 'Hydromulch',
        slug: 'hydromulch',
        reason: 'Fiber mulch for hydroseeding application.',
        required: true,
      },
      {
        name: 'Tackifier',
        slug: 'tackifier',
        reason: 'Binds mulch and seed to the soil surface, especially on slopes.',
        required: true,
      },
    ],
  },
  drill: {
    notes: [
      'Drill or slit seeding places seed directly into the soil for excellent seed-to-soil contact — best on terrain that allows equipment access.',
    ],
    productRecommendations: [],
  },
}

// ---------------------------------------------------------------------------
// Region Overrides
// ---------------------------------------------------------------------------
//
// Calculator mixes are tall fescue + ryegrass (cool-season species). These
// establish well across most of the country except the warm-season transition
// and deep-south zones, where bermuda/bahia would typically be specified. For
// those regions we flag custom-review rather than invent a warm-season mix.

export const REGION_OVERRIDES: Record<Region, RegionOverride> = {
  'georgia-southeast': {
    notes: [],
    warnings: [],
    confidence: 'standard',
  },
  'mid-atlantic': {
    notes: [],
    warnings: [],
    confidence: 'standard',
  },
  midwest: {
    notes: [],
    warnings: [],
    confidence: 'standard',
  },
  northeast: {
    notes: [],
    warnings: [],
    confidence: 'standard',
  },
  'pacific-northwest': {
    notes: [],
    warnings: [],
    confidence: 'standard',
  },
  'mountain-west': {
    notes: [
      'Mountain West establishment windows are shorter at elevation — confirm soil temperatures are above 50°F before seeding.',
    ],
    warnings: [],
    confidence: 'standard',
  },
  'south-central': {
    notes: [],
    warnings: [
      'South Central (TX, OK, AR) is primarily a warm-season grass region. Tall fescue and ryegrass can work as a temporary cool-season cover but long-term stabilization typically calls for bermuda or bahia. We recommend requesting a custom recommendation before ordering seed.',
    ],
    confidence: 'custom-review',
  },
}

// ---------------------------------------------------------------------------
// Product Catalog — placeholder slugs for products not yet in Shopify
// ---------------------------------------------------------------------------

export const PRODUCT_CATALOG: Record<string, ProductCatalogEntry> = {
  genesis: {
    name: 'Genesis',
    slug: 'genesis',
    defaultReason: 'Soil biology activator for faster germination and root establishment.',
  },
  'omega-soil-activator': {
    name: 'Omega Soil Activator',
    slug: 'omega-soil-activator',
    defaultReason: 'Liquid soil conditioner that improves seed establishment.',
  },
  hydromulch: {
    name: 'Hydromulch',
    slug: 'hydromulch',
    defaultReason: 'Fiber mulch for erosion protection and moisture retention.',
  },
  tackifier: {
    name: 'Tackifier',
    slug: 'tackifier',
    defaultReason: 'Adhesive that binds mulch and seed to soil on slopes.',
  },
  'erosion-control-blanket': {
    name: 'Erosion Control Blanket',
    slug: 'erosion-control-blanket',
    defaultReason: 'Physical slope protection while seed establishes.',
  },
  'jump-start-soil-conditioner': {
    name: 'Jump Start Soil Conditioner',
    slug: 'jump-start-soil-conditioner',
    defaultReason:
      'Liquid soil conditioner that breaks down compacted layers and improves root establishment.',
  },
}

// ---------------------------------------------------------------------------
// Input Options — labels and descriptions for form dropdowns
// ---------------------------------------------------------------------------

export const SLOPE_OPTIONS: InputOption[] = [
  { value: 'flat', label: 'Flat', description: 'Level ground, minimal runoff' },
  { value: 'mild', label: 'Mild', description: 'Gentle grade' },
  { value: 'moderate', label: 'Moderate', description: 'Noticeable slope' },
  { value: 'steep', label: 'Steep', description: 'Steep bank or cut' },
]

export const SUN_OPTIONS: InputOption[] = [
  { value: 'full-sun', label: 'Full Sun', description: '6+ hours direct sun' },
  { value: 'part-sun', label: 'Part Sun', description: '3–6 hours direct sun' },
  { value: 'shade', label: 'Shade', description: 'Less than 3 hours direct sun' },
]

export const SOIL_OPTIONS: InputOption[] = [
  { value: 'red-clay', label: 'Red Clay', description: 'Common in Georgia Piedmont' },
  { value: 'loam', label: 'Loam', description: 'Well-balanced soil' },
  { value: 'sandy', label: 'Sandy', description: 'Fast-draining, low retention' },
  { value: 'disturbed', label: 'Disturbed / Subsoil', description: 'Cut, fill, or graded ground' },
]

export const GOAL_OPTIONS: InputOption[] = [
  {
    value: 'quick-cover',
    label: 'Quick Cover',
    description: 'Fast green-up and surface protection',
  },
  {
    value: 'quick-long-term',
    label: 'Quick + Long-Term Stabilization',
    description: 'Fast establishment with lasting root structure',
  },
  { value: 'mowable-turf', label: 'Mowable Turf', description: 'Maintained, finished appearance' },
  {
    value: 'low-maintenance',
    label: 'Low-Maintenance Slope',
    description: 'Practical cover for banks and utility areas',
  },
  {
    value: 'hydroseeding',
    label: 'Hydroseeding',
    description: 'Slurry application system for slopes and large areas',
  },
]

export const SEASON_OPTIONS: InputOption[] = [
  { value: 'fall', label: 'Fall', description: 'Best window for cool-season grass' },
  { value: 'spring', label: 'Spring', description: 'Acceptable, narrower window' },
  { value: 'summer', label: 'Summer', description: 'Higher risk — extra irrigation needed' },
  { value: 'winter', label: 'Winter', description: 'Slow germination, temporary cover advised' },
]

export const REGION_OPTIONS: InputOption[] = [
  { value: 'georgia-southeast', label: 'Georgia / Southeast' },
  { value: 'mid-atlantic', label: 'Mid-Atlantic' },
  { value: 'south-central', label: 'South Central (TX, OK, AR)' },
  { value: 'midwest', label: 'Midwest' },
  { value: 'northeast', label: 'Northeast' },
  { value: 'mountain-west', label: 'Mountain West' },
  { value: 'pacific-northwest', label: 'Pacific Northwest' },
]

export const METHOD_OPTIONS: InputOption[] = [
  { value: 'broadcast', label: 'Broadcast', description: 'Spread by hand or spreader' },
  { value: 'hydroseed', label: 'Hydroseed', description: 'Slurry application' },
  { value: 'drill', label: 'Drill / Slit Seed', description: 'Mechanical seed placement' },
]
