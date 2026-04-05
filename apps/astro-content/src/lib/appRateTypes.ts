/**
 * Application Rate Calculator — Type Definitions (v2)
 *
 * Core separation: ApplicationResult (agronomic math) is distinct from
 * PurchaseRecommendation (packaging/ecommerce). Both are transparent.
 */

// ---------------------------------------------------------------------------
// Enums & Unions
// ---------------------------------------------------------------------------

export type Unit = 'sqft' | 'acres' | 'houses'

export type Segment = 'lawn' | 'poultry' | 'home'

export type BuyingPath = 'direct' | 'direct_with_note' | 'rep_recommended' | 'consultation_required'

export type ConfidenceLevel = 'high' | 'moderate' | 'needs_consultation'

export type RateSource = 'recommended' | 'label_default' | 'condition_adjusted'

export type RecommendationScope =
  | 'single_application'
  | 'first_2_applications'
  | 'full_flock'
  | 'annual_maintenance'

// ---------------------------------------------------------------------------
// Product Config
// ---------------------------------------------------------------------------

export interface UseCase {
  id: string
  label: string
  description?: string
  scope: RecommendationScope
  /** If true, user is told this is an estimate not a label replacement */
  showEstimateDisclaimer?: boolean
}

export interface RateRule {
  useCase: string
  rate: number
  rateUnit: string
  perArea: number
  perAreaUnit: Unit
  rateMin?: number
  rateMax?: number
  frequency?: string
  notes?: string
  /** What the rate source is for transparency */
  rateSource?: RateSource
}

export interface ContainerSize {
  label: string
  /** Size in the rate unit (e.g. 128 oz, 25 lbs) */
  amount: number
  /** Neutral unit for math — 'oz' for liquids, 'lbs' for granular, 'count' for bottles */
  packageUnit: string
  price: number
  priceAsOf: string
  /** Shopify variant GID for Add to Cart */
  variantGid: string | null
  availableForSale: boolean
  /** Bias toward multiples of this size when costs are close */
  preferSingleSku: boolean
}

export interface Preset {
  id: string
  label: string
  description: string
  area: number
  unit: Unit
  useCase?: string
}

export interface ThresholdConfig {
  repRecommended: {
    minCost: number | null
    minQuantityUnits: number | null
    minContainers: number | null
    minHouses: number | null
  }
  consultationRequired: {
    conditions: string[]
  }
}

export interface ProductConfig {
  handle: string
  name: string
  segment: Segment
  applicationMethod: string
  useCases: UseCase[]
  rates: RateRule[]
  containers: ContainerSize[]
  defaultUnit: Unit
  presets: Preset[]
  thresholds: ThresholdConfig
  mixableWith: string[]
  disclaimers: string[]
  showAlternatives: boolean
  maxContainerCount: number
  techSheetUrl?: string
}

// ---------------------------------------------------------------------------
// Calculation Results — Separated: Application Math vs Purchase
// ---------------------------------------------------------------------------

export interface Assumption {
  label: string
  editable: boolean
  inputKey: string | null
}

export interface ApplicationResult {
  totalNeeded: number
  totalNeededUnit: string
  rateUsed: number
  rateLabel: string
  rateSource: RateSource
  rateRange: { min: string; max: string; label: string } | null
  scope: RecommendationScope
  scopeExplanation: string
  assumptions: Assumption[]
  calculationSteps: string[]
  notes: string[]
}

export interface ContainerRecommendation {
  label: string
  quantity: number
  priceEach: number
  subtotal: number
  variantGid: string | null
  availableForSale: boolean
}

export interface PurchaseRecommendation {
  containers: ContainerRecommendation[]
  estimatedCost: number
  excessAmount: number
  excessUnit: string
  excessNote: string
  alternativeOption: ContainerRecommendation[] | null
}

export interface AppRateResult {
  productName: string
  productHandle: string
  segment: Segment
  application: ApplicationResult
  purchase: PurchaseRecommendation | null
  frequency: string | null
  buyingPath: BuyingPath
  buyingPathReason: string
  confidenceLevel: ConfidenceLevel
  confidenceNote: string | null
  cartLines: { variantGid: string; quantity: number }[]
  sufficientOnHand: boolean
  isCommercial: boolean
}

// ---------------------------------------------------------------------------
// Lead Metadata (structured payload for Nexus)
// ---------------------------------------------------------------------------

export interface LeadMetadata {
  segment: Segment
  product_handle: string
  buying_path: BuyingPath
  estimated_spend: number | null
  total_quantity: number
  total_quantity_unit: string
  container_count: number
  recommendation_scope: RecommendationScope
  threshold_triggered: boolean
  saw_results: boolean
  clicked_add_to_cart: boolean
  condition: string | null
  house_count: number | null
  area_sq_ft: number | null
  confidence_level: ConfidenceLevel
}
