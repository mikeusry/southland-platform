/**
 * Application Rate Calculator — Product Data & Rules (v2)
 *
 * All application rates derived from product label dosing instructions (MDX frontmatter).
 * Container sizes and prices from Shopify catalog.
 *
 * PRICE FRESHNESS: Last verified 2026-04-05 from Shopify Admin.
 * Re-verify quarterly or after any Shopify price change.
 * Prices shown to users as estimates with "pricing may vary" disclaimer.
 */

import type { ContainerSize, Preset, ProductConfig, Segment } from './appRateTypes'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Sqft per acre */
export const SQFT_PER_ACRE = 43560

/** Standard poultry house floor area (40×500) */
export const HOUSE_SQFT = 20_000

const TODAY = '2026-04-05'

// =============================================================================
// HELPER: Container factory (reduces repetition)
// =============================================================================

function oz(
  label: string,
  amount: number,
  price: number,
  variantGid: string | null = null,
  opts: Partial<ContainerSize> = {}
): ContainerSize {
  return {
    label,
    amount,
    packageUnit: 'oz',
    price,
    priceAsOf: TODAY,
    variantGid,
    availableForSale: true,
    preferSingleSku: false,
    ...opts,
  }
}

function lbs(
  label: string,
  amount: number,
  price: number,
  variantGid: string | null = null,
  opts: Partial<ContainerSize> = {}
): ContainerSize {
  return {
    label,
    amount,
    packageUnit: 'lbs',
    price,
    priceAsOf: TODAY,
    variantGid,
    availableForSale: true,
    preferSingleSku: false,
    ...opts,
  }
}

function gal(
  label: string,
  amountOz: number,
  price: number,
  variantGid: string | null = null,
  opts: Partial<ContainerSize> = {}
): ContainerSize {
  return {
    label,
    amount: amountOz,
    packageUnit: 'oz',
    price,
    priceAsOf: TODAY,
    variantGid,
    availableForSale: true,
    preferSingleSku: false,
    ...opts,
  }
}

function bottle(label: string, price: number, variantGid: string | null = null): ContainerSize {
  return {
    label,
    amount: 1,
    packageUnit: 'count',
    price,
    priceAsOf: TODAY,
    variantGid,
    availableForSale: true,
    preferSingleSku: true,
  }
}

// =============================================================================
// DEFAULT THRESHOLDS
// =============================================================================

const LAWN_THRESHOLDS = {
  repRecommended: {
    minCost: 200,
    minQuantityUnits: null,
    minContainers: 5,
    minHouses: null,
  },
  consultationRequired: { conditions: [] },
}

const POULTRY_THRESHOLDS = {
  repRecommended: {
    minCost: 500,
    minQuantityUnits: null,
    minContainers: null,
    minHouses: 3,
  },
  consultationRequired: { conditions: ['houses_gt_8'] },
}

const HOME_THRESHOLDS = {
  repRecommended: {
    minCost: null,
    minQuantityUnits: null,
    minContainers: null,
    minHouses: null,
  },
  consultationRequired: { conditions: [] },
}

// =============================================================================
// PRODUCT CATALOG
// =============================================================================

export const PRODUCTS: ProductConfig[] = [
  // ─── LAWN & TURF ──────────────────────────────────────────────────────
  {
    handle: 'genesis',
    name: 'Genesis',
    segment: 'lawn',
    applicationMethod: 'Hose-end sprayer, pump sprayer, or boom sprayer',
    useCases: [
      { id: 'residential', label: 'Residential Lawn', scope: 'single_application' },
      {
        id: 'new-construction',
        label: 'New Construction / Depleted Soil',
        description: 'Double rate for first 2 applications',
        scope: 'first_2_applications',
      },
      { id: 'golf-sports', label: 'Golf Course / Sports Turf', scope: 'single_application' },
    ],
    rates: [
      {
        useCase: 'residential',
        rate: 3.5,
        rateUnit: 'oz',
        perArea: 1000,
        perAreaUnit: 'sqft',
        rateMin: 3,
        rateMax: 4,
        frequency: 'Every 4-6 weeks during growing season',
        notes: 'Water in lightly within 24 hours. Soil temp above 55°F for best results.',
        rateSource: 'recommended',
      },
      {
        useCase: 'new-construction',
        rate: 7,
        rateUnit: 'oz',
        perArea: 1000,
        perAreaUnit: 'sqft',
        rateMin: 6,
        rateMax: 8,
        frequency: 'First 2 applications, then return to standard rate',
        notes:
          'Double rate to jump-start soil biology. Return to standard rate after soil establishes.',
        rateSource: 'condition_adjusted',
      },
      {
        useCase: 'golf-sports',
        rate: 1.5,
        rateUnit: 'gal',
        perArea: 1,
        perAreaUnit: 'acres',
        rateMin: 1,
        rateMax: 2,
        frequency: 'Integrated into spray schedule',
        notes: 'Tank-mix compatible with most fertility programs.',
        rateSource: 'recommended',
      },
    ],
    containers: [
      oz('Quart', 32, 19.0, 'gid://shopify/ProductVariant/17534092676'),
      gal('1 Gallon', 128, 46.0, 'gid://shopify/ProductVariant/14943159364'),
      gal('2.5 Gallon', 320, 92.0, 'gid://shopify/ProductVariant/14943159428'),
    ],
    defaultUnit: 'sqft',
    presets: [
      {
        id: 'genesis-quarter',
        label: '1/4 Acre Lawn',
        description: '10,890 sq ft — most suburban lots',
        area: 10890,
        unit: 'sqft',
      },
      {
        id: 'genesis-half',
        label: '1/2 Acre Lawn',
        description: '21,780 sq ft',
        area: 21780,
        unit: 'sqft',
      },
      {
        id: 'genesis-acre',
        label: '1 Acre Commercial',
        description: '43,560 sq ft',
        area: 1,
        unit: 'acres',
        useCase: 'golf-sports',
      },
    ],
    thresholds: LAWN_THRESHOLDS,
    mixableWith: ['jump-start-soil-conditioner'],
    disclaimers: ['Apply in morning or evening to avoid UV stress on microbes.'],
    showAlternatives: true,
    maxContainerCount: 10,
  },
  {
    handle: 'jump-start-soil-conditioner',
    name: 'Jump Start',
    segment: 'lawn',
    applicationMethod: 'Hose-end sprayer, pump sprayer, or boom sprayer',
    useCases: [
      { id: 'residential', label: 'Lawns & Gardens', scope: 'single_application' },
      {
        id: 'new-construction',
        label: 'New Construction / Depleted Soil',
        description: 'Double rate for first 2 applications',
        scope: 'first_2_applications',
      },
      { id: 'crops', label: 'Crops & Large Areas', scope: 'single_application' },
    ],
    rates: [
      {
        useCase: 'residential',
        rate: 2.5,
        rateUnit: 'oz',
        perArea: 1000,
        perAreaUnit: 'sqft',
        rateMin: 2,
        rateMax: 3,
        frequency: 'Every 4-6 weeks during growing season',
        notes: 'Water in lightly after application.',
        rateSource: 'recommended',
      },
      {
        useCase: 'new-construction',
        rate: 5,
        rateUnit: 'oz',
        perArea: 1000,
        perAreaUnit: 'sqft',
        rateMin: 4,
        rateMax: 6,
        frequency: 'First 2 applications, then return to standard rate',
        notes: 'Follow with Genesis for biological rebuild.',
        rateSource: 'condition_adjusted',
      },
      {
        useCase: 'crops',
        rate: 1.5,
        rateUnit: 'qt',
        perArea: 1,
        perAreaUnit: 'acres',
        rateMin: 1,
        rateMax: 2,
        frequency: 'Per growing season',
        notes: 'Tank-mix compatible with liquid fertilizers.',
        rateSource: 'recommended',
      },
    ],
    containers: [
      oz('Quart', 32, 16.0, 'gid://shopify/ProductVariant/1219252332'),
      gal('1 Gallon', 128, 31.0, 'gid://shopify/ProductVariant/1219252288'),
      gal('2.5 Gallon', 320, 73.0, 'gid://shopify/ProductVariant/1219252340'),
    ],
    defaultUnit: 'sqft',
    presets: [
      {
        id: 'js-quarter',
        label: '1/4 Acre Lawn',
        description: '10,890 sq ft',
        area: 10890,
        unit: 'sqft',
      },
      {
        id: 'js-half',
        label: '1/2 Acre Lawn',
        description: '21,780 sq ft',
        area: 21780,
        unit: 'sqft',
      },
    ],
    thresholds: LAWN_THRESHOLDS,
    mixableWith: ['genesis'],
    disclaimers: [],
    showAlternatives: true,
    maxContainerCount: 10,
  },
  {
    handle: 'torched-all-natural-weed-killer',
    name: 'Torched',
    segment: 'lawn',
    applicationMethod: 'Spray bottle (RTU) or pump sprayer (concentrate)',
    useCases: [
      {
        id: 'concentrate',
        label: 'Concentrate (pump sprayer)',
        description: 'Mix 4-6 oz per gallon of water',
        scope: 'single_application',
      },
    ],
    rates: [
      {
        useCase: 'concentrate',
        rate: 5,
        rateUnit: 'oz',
        perArea: 1,
        perAreaUnit: 'sqft', // per gallon of spray mix — area input = gallons
        rateMin: 4,
        rateMax: 6,
        frequency: 'Reapply after 7-10 days for stubborn weeds',
        notes:
          'Apply on dry, sunny day. Avoid drift onto desirable plants. Needs 2-4 hours dry time.',
        rateSource: 'recommended',
      },
    ],
    containers: [
      gal('1 Gallon Concentrate', 128, 74.0, 'gid://shopify/ProductVariant/43855976661237'),
      gal('2.5 Gallon Concentrate', 320, 149.0, 'gid://shopify/ProductVariant/29065856417890'),
    ],
    defaultUnit: 'sqft',
    presets: [
      {
        id: 'torched-2gal',
        label: '2 Gallons Spray Mix',
        description: 'Small yard spot treatment',
        area: 2,
        unit: 'sqft',
      },
      {
        id: 'torched-5gal',
        label: '5 Gallons Spray Mix',
        description: 'Full pump sprayer',
        area: 5,
        unit: 'sqft',
      },
    ],
    thresholds: LAWN_THRESHOLDS,
    mixableWith: [],
    disclaimers: ['Non-selective — kills any green plant it contacts. Targeted use only.'],
    showAlternatives: true,
    maxContainerCount: 5,
  },
  {
    handle: 'soil-sulfur',
    name: 'Soil Sulfur',
    segment: 'lawn',
    applicationMethod: 'Hand broadcast or rotary spreader',
    useCases: [
      {
        id: 'ph-reduction',
        label: 'General pH Reduction',
        description: 'Depends on current pH and target',
        scope: 'single_application',
      },
    ],
    rates: [
      {
        useCase: 'ph-reduction',
        rate: 7.5,
        rateUnit: 'lb',
        perArea: 1000,
        perAreaUnit: 'sqft',
        rateMin: 5,
        rateMax: 10,
        frequency: 'One-time application, retest in 6-12 weeks',
        notes: 'Do not exceed 10 lbs per 1,000 sq ft. Sandy soils need less than clay.',
        rateSource: 'recommended',
      },
    ],
    containers: [lbs('5 lb Bag', 5, 24.0, 'gid://shopify/ProductVariant/43256971297013')],
    defaultUnit: 'sqft',
    presets: [
      {
        id: 'ss-quarter',
        label: '1/4 Acre',
        description: '10,890 sq ft',
        area: 10890,
        unit: 'sqft',
      },
    ],
    thresholds: LAWN_THRESHOLDS,
    mixableWith: [],
    disclaimers: ['Always test soil pH before and after application.'],
    showAlternatives: true,
    maxContainerCount: 10,
  },
  {
    handle: 'chicken-manure-fertilizer',
    name: 'Chicken Manure Fertilizer',
    segment: 'lawn',
    applicationMethod: 'Broadcast spreader, hand application, or soil incorporation',
    useCases: [
      { id: 'lawn', label: 'Lawn Application', scope: 'single_application' },
      { id: 'garden', label: 'Garden & Landscape Beds', scope: 'single_application' },
      { id: 'new-sod-seed', label: 'New Sod or Seed', scope: 'single_application' },
    ],
    rates: [
      {
        useCase: 'lawn',
        rate: 12.5,
        rateUnit: 'lb',
        perArea: 1000,
        perAreaUnit: 'sqft',
        rateMin: 10,
        rateMax: 15,
        frequency: 'Spring and fall for warm-season grasses',
        notes: 'Water in lightly after application.',
        rateSource: 'recommended',
      },
      {
        useCase: 'garden',
        rate: 7.5,
        rateUnit: 'lb',
        perArea: 100,
        perAreaUnit: 'sqft',
        frequency: 'Before planting + mid-season side-dress at 2-3 lbs/100 sq ft',
        rateSource: 'recommended',
      },
      {
        useCase: 'new-sod-seed',
        rate: 10,
        rateUnit: 'lb',
        perArea: 1000,
        perAreaUnit: 'sqft',
        frequency: 'At planting, then again at 6-8 weeks',
        notes: 'Incorporate into top 2-3 inches before laying sod/seeding.',
        rateSource: 'recommended',
      },
    ],
    containers: [
      lbs('5 lb Bag', 5, 7.0, 'gid://shopify/ProductVariant/43439909077237', {
        availableForSale: false,
      }),
      lbs('35 lb Box', 35, 35.0, 'gid://shopify/ProductVariant/43439908978933', {
        availableForSale: false,
      }),
    ],
    defaultUnit: 'sqft',
    presets: [
      {
        id: 'cmf-quarter',
        label: '1/4 Acre Lawn',
        description: '10,890 sq ft',
        area: 10890,
        unit: 'sqft',
      },
      {
        id: 'cmf-garden',
        label: '200 sq ft Garden',
        description: 'Typical raised bed area',
        area: 200,
        unit: 'sqft',
        useCase: 'garden',
      },
    ],
    thresholds: LAWN_THRESHOLDS,
    mixableWith: [],
    disclaimers: [],
    showAlternatives: false,
    maxContainerCount: 15,
  },
  {
    handle: 'c-fix-biochar-soil-amendment',
    name: 'C-Fix Biochar',
    segment: 'lawn',
    applicationMethod: 'Soil incorporation or top-dressing',
    useCases: [
      { id: 'lawn', label: 'Lawn Top-Dressing', scope: 'single_application' },
      { id: 'garden', label: 'Gardens & Raised Beds', scope: 'single_application' },
    ],
    rates: [
      {
        useCase: 'lawn',
        rate: 4,
        rateUnit: 'lb',
        perArea: 100,
        perAreaUnit: 'sqft',
        rateMin: 3,
        rateMax: 5,
        frequency: 'One-time application',
        notes: 'Rake or water in. Pair with overseeding for best results.',
        rateSource: 'recommended',
      },
      {
        useCase: 'garden',
        rate: 7.5,
        rateUnit: 'lb',
        perArea: 100,
        perAreaUnit: 'sqft',
        rateMin: 5,
        rateMax: 10,
        frequency: 'Mix into top 4-6 inches before planting',
        notes:
          'Works best "charged" — pre-mixed with compost or humic acid (already included in C-Fix).',
        rateSource: 'recommended',
      },
    ],
    containers: [
      lbs('8 lb Bag', 8, 9.0, 'gid://shopify/ProductVariant/45562298532085'),
      lbs('35 lb Box', 35, 39.0, 'gid://shopify/ProductVariant/45562298564853'),
    ],
    defaultUnit: 'sqft',
    presets: [
      {
        id: 'cfix-garden',
        label: '100 sq ft Garden',
        description: 'Typical raised bed',
        area: 100,
        unit: 'sqft',
        useCase: 'garden',
      },
      {
        id: 'cfix-lawn',
        label: '1,000 sq ft Lawn',
        description: 'Small lawn section',
        area: 1000,
        unit: 'sqft',
      },
    ],
    thresholds: LAWN_THRESHOLDS,
    mixableWith: [],
    disclaimers: [],
    showAlternatives: true,
    maxContainerCount: 10,
  },

  // ─── POULTRY ──────────────────────────────────────────────────────────
  {
    handle: 'poultry-probiotic',
    name: 'Big Ole Bird',
    segment: 'poultry',
    applicationMethod: 'Water line (medicator or proportioner)',
    useCases: [
      {
        id: 'broiler-standard',
        label: 'Broilers (Standard Protocol)',
        description: 'Heavy dose days 1-3, maintenance days 4-14, then every 3rd day',
        scope: 'full_flock',
        showEstimateDisclaimer: true,
      },
      {
        id: 'layers-turkeys',
        label: 'Layers / Turkeys',
        description: 'Daily for 14 days, then 2x/week maintenance',
        scope: 'full_flock',
        showEstimateDisclaimer: true,
      },
    ],
    rates: [
      {
        useCase: 'broiler-standard',
        // Per-flock per-house: Days 1-3 (1oz/100gal × 3d) + Days 4-14 (0.5oz/100gal × 11d)
        // + Days 15-42 (0.5oz/100gal × ~10 doses). At 400 gal/house:
        // = 4×3 + 2×11 + 2×10 = 12+22+20 = 54 oz ≈ 0.42 gal/house/flock
        // Using 0.45 as recommended midpoint with safety margin
        rate: 0.45,
        rateUnit: 'gal',
        perArea: 1,
        perAreaUnit: 'houses',
        frequency: 'Per flock (42-day grow-out)',
        notes:
          'Days 1-3: 1 oz/100 gal daily. Days 4-14: 0.5 oz/100 gal daily. Day 15+: 0.5 oz/100 gal every 3rd day. Based on 400 gal/house water system.',
        rateSource: 'recommended',
      },
      {
        useCase: 'layers-turkeys',
        rate: 0.5,
        rateUnit: 'gal',
        perArea: 1,
        perAreaUnit: 'houses',
        frequency: 'Per month (ongoing maintenance)',
        notes:
          'First 14 days: 1 oz/100 gal daily. Maintenance: 0.5 oz/100 gal 2x/week. Based on 400 gal/house water system.',
        rateSource: 'recommended',
      },
    ],
    containers: [
      gal('1 Gallon', 128, 43.0, 'gid://shopify/ProductVariant/13288245764', {
        preferSingleSku: true,
      }),
      gal('2.5 Gallon', 320, 102.0, 'gid://shopify/ProductVariant/13288284804'),
    ],
    defaultUnit: 'houses',
    presets: [
      {
        id: 'bob-4house',
        label: '4-House Broiler',
        description: 'Standard 4-house operation',
        area: 4,
        unit: 'houses',
      },
      {
        id: 'bob-2house',
        label: '2-House Operation',
        description: '2 houses',
        area: 2,
        unit: 'houses',
      },
      {
        id: 'bob-6house',
        label: '6-House Operation',
        description: '6 houses',
        area: 6,
        unit: 'houses',
      },
    ],
    thresholds: POULTRY_THRESHOLDS,
    mixableWith: [],
    disclaimers: [
      'This is an estimate — always follow label instructions for your specific operation.',
      'Water system capacity varies by house. Verify with your service tech.',
    ],
    showAlternatives: false,
    maxContainerCount: 10,
  },
  {
    handle: 'poultry-litter-amendment',
    name: 'Litter Life',
    segment: 'poultry',
    applicationMethod: 'Pump sprayer or boom sprayer',
    useCases: [
      { id: 'new-litter', label: 'New Litter', scope: 'single_application' },
      {
        id: 'reused-litter',
        label: 'Reused Litter',
        description: 'Higher rate at decake + bird placement',
        scope: 'single_application',
      },
      {
        id: 'heavy-ammonia',
        label: 'Heavy Ammonia Situation',
        description: 'Double initial rate — test at 24 and 48 hours',
        scope: 'single_application',
      },
    ],
    rates: [
      {
        useCase: 'new-litter',
        rate: 2,
        rateUnit: 'gal',
        perArea: 1,
        perAreaUnit: 'houses',
        frequency: 'Before bird placement + mid-flock reapply',
        notes: 'Spray evenly over litter. Reapply at day 21-28 for broilers.',
        rateSource: 'label_default',
      },
      {
        useCase: 'reused-litter',
        rate: 3,
        rateUnit: 'gal',
        perArea: 1,
        perAreaUnit: 'houses',
        frequency: 'At decake + bird placement + mid-flock',
        notes: '1.5 gal/10,000 sq ft at decake + second application at placement.',
        rateSource: 'label_default',
      },
      {
        useCase: 'heavy-ammonia',
        rate: 4,
        rateUnit: 'gal',
        perArea: 1,
        perAreaUnit: 'houses',
        frequency: 'Double initial + ongoing based on ammonia readings',
        notes: 'Test ammonia at 24 and 48 hours. Adjust ongoing rate based on readings.',
        rateSource: 'condition_adjusted',
      },
    ],
    containers: [
      gal('1 Gallon', 128, 31.0, 'gid://shopify/ProductVariant/1219351704'),
      gal('2.5 Gallon', 320, 73.0, 'gid://shopify/ProductVariant/1219351716'),
    ],
    defaultUnit: 'houses',
    presets: [
      {
        id: 'll-4new',
        label: '4 Houses (New Litter)',
        description: 'Standard 4-house farm',
        area: 4,
        unit: 'houses',
      },
      {
        id: 'll-4reused',
        label: '4 Houses (Reused)',
        description: 'Reused litter',
        area: 4,
        unit: 'houses',
        useCase: 'reused-litter',
      },
      {
        id: 'll-6house',
        label: '6 Houses',
        description: '6-house operation',
        area: 6,
        unit: 'houses',
      },
    ],
    thresholds: POULTRY_THRESHOLDS,
    mixableWith: ['poultry-probiotic'],
    disclaimers: [
      'This is an estimate — always follow label instructions for your specific operation.',
    ],
    showAlternatives: true,
    maxContainerCount: 12,
  },
  {
    handle: 'catalyst-poultry-vitamin',
    name: 'Catalyst',
    segment: 'poultry',
    applicationMethod: 'Water line (medicator or proportioner)',
    useCases: [
      {
        id: 'heat-stress',
        label: 'Heat Stress Protocol',
        description: '24 hours before + during + 24 hours after',
        scope: 'single_application',
        showEstimateDisclaimer: true,
      },
      {
        id: 'vaccination',
        label: 'Vaccination Support',
        description: 'Day of vaccination + 3 days post',
        scope: 'single_application',
        showEstimateDisclaimer: true,
      },
      {
        id: 'chick-placement',
        label: 'Chick Placement (First 48 Hours)',
        scope: 'single_application',
        showEstimateDisclaimer: true,
      },
    ],
    rates: [
      {
        useCase: 'heat-stress',
        rate: 0.15,
        rateUnit: 'gal',
        perArea: 1,
        perAreaUnit: 'houses',
        frequency: 'Per heat event (3-5 day protocol)',
        notes: '1 oz per 100 gallons. Begin 24 hours before anticipated heat event.',
        rateSource: 'recommended',
      },
      {
        useCase: 'vaccination',
        rate: 0.1,
        rateUnit: 'gal',
        perArea: 1,
        perAreaUnit: 'houses',
        frequency: 'Per vaccination (4-day protocol)',
        notes: '1 oz per 100 gallons starting day of vaccination, 3 days post.',
        rateSource: 'recommended',
      },
      {
        useCase: 'chick-placement',
        rate: 0.1,
        rateUnit: 'gal',
        perArea: 1,
        perAreaUnit: 'houses',
        frequency: 'First 48 hours of placement',
        notes: '2 oz/100 gal for first 24 hrs, then 1 oz/100 gal next 24 hrs.',
        rateSource: 'recommended',
      },
    ],
    containers: [
      lbs('800 Grams', 1.76, 38.0, 'gid://shopify/ProductVariant/43101814927', {
        preferSingleSku: true,
        packageUnit: 'lbs',
      }),
    ],
    defaultUnit: 'houses',
    presets: [
      {
        id: 'cat-4heat',
        label: '4 Houses (Heat Stress)',
        description: 'Standard farm, one heat event',
        area: 4,
        unit: 'houses',
      },
    ],
    thresholds: POULTRY_THRESHOLDS,
    mixableWith: ['poultry-probiotic'],
    disclaimers: [
      'This is an estimate — always follow label instructions for your specific operation.',
    ],
    showAlternatives: false,
    maxContainerCount: 5,
  },
  {
    handle: 'natural-mite-control-livestock-poultry',
    name: 'Desecticide',
    segment: 'poultry',
    applicationMethod: 'Pump sprayer or boom sprayer',
    useCases: [
      {
        id: 'cleanout',
        label: 'Between-Flock Cleanout',
        description: 'Full house treatment — calculate for one scenario at a time',
        scope: 'single_application',
      },
      {
        id: 'during-production',
        label: 'During Production (Perimeter)',
        description: 'Perimeter treatment while birds are present — not additive with cleanout',
        scope: 'single_application',
      },
    ],
    rates: [
      {
        useCase: 'cleanout',
        rate: 2.5,
        rateUnit: 'gal',
        perArea: 1,
        perAreaUnit: 'houses',
        rateMin: 2,
        rateMax: 3,
        frequency: 'Between each flock',
        notes:
          'Mix 1 gal concentrate per 20 gal water. Spray litter, walls, posts, under equipment. Concentrate only — dilution water is additional.',
        rateSource: 'recommended',
      },
      {
        useCase: 'during-production',
        rate: 1.5,
        rateUnit: 'gal',
        perArea: 1,
        perAreaUnit: 'houses',
        rateMin: 1,
        rateMax: 2,
        frequency: 'Every 2-3 weeks during heavy infestations',
        notes:
          'Mix 1 gal per 30 gal water. Spray perimeter walls, posts, beetle congregation areas. Concentrate only — dilution water is additional.',
        rateSource: 'recommended',
      },
    ],
    containers: [
      oz('Quart', 32, 20.0, 'gid://shopify/ProductVariant/42507477352693'),
      gal('1 Gallon', 128, 40.0, 'gid://shopify/ProductVariant/46277304399'),
      gal('2.5 Gallon', 320, 82.0, 'gid://shopify/ProductVariant/42507477287157'),
    ],
    defaultUnit: 'houses',
    presets: [
      {
        id: 'des-4cleanout',
        label: '4 Houses (Cleanout)',
        description: 'Between-flock treatment',
        area: 4,
        unit: 'houses',
      },
      {
        id: 'des-4prod',
        label: '4 Houses (Production)',
        description: 'During production',
        area: 4,
        unit: 'houses',
        useCase: 'during-production',
      },
    ],
    thresholds: POULTRY_THRESHOLDS,
    mixableWith: [],
    disclaimers: [
      'Concentrate only — dilution water is additional.',
      'This is an estimate — always follow label instructions for your specific operation.',
    ],
    showAlternatives: true,
    maxContainerCount: 8,
  },
  {
    handle: 'hen-helper',
    name: 'Hen Helper',
    segment: 'poultry',
    applicationMethod: 'Drinking water (waterer or nipple system)',
    useCases: [
      { id: 'backyard-standard', label: 'Backyard Flock (Standard)', scope: 'annual_maintenance' },
      {
        id: 'backyard-stress',
        label: 'Backyard Flock (Stress Events)',
        description: 'Double dose for 3-5 days',
        scope: 'single_application',
      },
    ],
    rates: [
      {
        useCase: 'backyard-standard',
        // 1 tbsp (0.5oz) per gallon of water per day. Small flock drinks ~1 gal/day.
        // Monthly: ~15 oz. Yearly: ~180 oz.
        // But simpler for user: 1 oz per day of supply (covers ~2 gal/day flock)
        rate: 15,
        rateUnit: 'oz',
        perArea: 1,
        perAreaUnit: 'sqft', // using sqft as "months" proxy
        frequency: 'Daily — 1 tablespoon per gallon of drinking water',
        notes: 'Replace treated water every 2-3 days.',
        rateSource: 'recommended',
      },
      {
        useCase: 'backyard-stress',
        rate: 30,
        rateUnit: 'oz',
        perArea: 1,
        perAreaUnit: 'sqft', // per event
        frequency: 'Double dose for 3-5 days during stress events',
        notes: 'Extreme heat, new birds, predator scares.',
        rateSource: 'condition_adjusted',
      },
    ],
    containers: [
      oz('Quart', 32, 22.0, 'gid://shopify/ProductVariant/31816319500386'),
      gal('1 Gallon', 128, 43.0, 'gid://shopify/ProductVariant/15018107043938'),
      gal('2.5 Gallon', 320, 102.0, 'gid://shopify/ProductVariant/15018147512418'),
    ],
    defaultUnit: 'sqft',
    presets: [
      {
        id: 'hh-3month',
        label: '3 Month Supply',
        description: 'Small backyard flock',
        area: 3,
        unit: 'sqft',
      },
      { id: 'hh-6month', label: '6 Month Supply', description: 'Half year', area: 6, unit: 'sqft' },
    ],
    thresholds: HOME_THRESHOLDS,
    mixableWith: [],
    disclaimers: [],
    showAlternatives: true,
    maxContainerCount: 8,
  },

  // ─── HOME ─────────────────────────────────────────────────────────────
  {
    handle: 'pour-the-port-septic-tank-treatment',
    name: 'Pour the Port',
    segment: 'home',
    applicationMethod: 'Pour into toilet and flush',
    useCases: [{ id: 'monthly', label: 'Monthly Maintenance', scope: 'annual_maintenance' }],
    rates: [
      {
        useCase: 'monthly',
        // 1 bottle/month + 1 extra first month
        // So for N months: N + 1 bottles
        rate: 1,
        rateUnit: 'bottle',
        perArea: 1,
        perAreaUnit: 'sqft', // "months" input masquerading as sqft
        frequency: 'One bottle per month',
        notes:
          'Flush before bed for 8+ hours low-flow time. Use 2 bottles first month to establish bacterial population.',
        rateSource: 'label_default',
      },
    ],
    containers: [bottle('Quart + 3x8 oz', 28.0, 'gid://shopify/ProductVariant/42616731533557')],
    defaultUnit: 'sqft',
    presets: [
      {
        id: 'ptp-6mo',
        label: '6 Month Supply',
        description: '7 bottles (2 first month + 5)',
        area: 6,
        unit: 'sqft',
      },
      {
        id: 'ptp-12mo',
        label: '1 Year Supply',
        description: '13 bottles (2 first month + 11)',
        area: 12,
        unit: 'sqft',
      },
    ],
    thresholds: HOME_THRESHOLDS,
    mixableWith: [],
    disclaimers: [
      'Avoid pouring bleach or antibacterial cleaners down drains for 24 hours after treatment.',
    ],
    showAlternatives: false,
    maxContainerCount: 15,
  },
]

// =============================================================================
// SEGMENT GROUPING
// =============================================================================

export const SEGMENTS: { id: Segment; label: string; description: string }[] = [
  { id: 'lawn', label: 'Lawn & Turf', description: 'Soil biology, fertilizer, weed control' },
  { id: 'poultry', label: 'Poultry', description: 'Probiotics, litter, beetle control' },
  { id: 'home', label: 'Home', description: 'Septic treatment' },
]

// =============================================================================
// HELPERS
// =============================================================================

export function getProduct(handle: string): ProductConfig | undefined {
  return PRODUCTS.find((p) => p.handle === handle)
}

export function getProductsBySegment(segment: Segment): ProductConfig[] {
  return PRODUCTS.filter((p) => p.segment === segment)
}
