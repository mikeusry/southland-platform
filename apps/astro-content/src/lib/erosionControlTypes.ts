// Erosion Control Seed Calculator — Type Definitions
// No logic here. All shapes for inputs, outputs, and config.

export type Slope = 'flat' | 'mild' | 'moderate' | 'steep'
export type Sun = 'full-sun' | 'part-sun' | 'shade'
export type Soil = 'red-clay' | 'loam' | 'sandy' | 'disturbed'
export type Goal =
  | 'quick-cover'
  | 'quick-long-term'
  | 'mowable-turf'
  | 'low-maintenance'
  | 'hydroseeding'
export type Season = 'spring' | 'summer' | 'fall' | 'winter'
export type Region =
  | 'georgia-southeast'
  | 'mid-atlantic'
  | 'midwest'
  | 'northeast'
  | 'south-central'
  | 'mountain-west'
  | 'pacific-northwest'
export type Method = 'broadcast' | 'hydroseed' | 'drill'
export type Confidence = 'standard' | 'custom-review'

export interface CalculatorInputs {
  area: number
  slope: Slope
  sun: Sun
  soil: Soil
  compost: boolean
  goal: Goal
  season: Season
  region: Region
  method: Method
}

export interface SpeciesBreakdown {
  name: string
  percentMin: number
  percentMax: number
}

export interface ProductRecommendation {
  name: string
  slug: string
  reason: string
  required: boolean
}

export interface CalculatorResult {
  mixName: string
  summary: string
  speciesBreakdown: SpeciesBreakdown[]
  ratePer1000: number
  totalLbs: number
  roundedTotalLbs: number
  mulchRecommendation: string
  blanketRequired: boolean
  blanketReason: string | null
  notes: string[]
  warnings: string[]
  productRecommendations: ProductRecommendation[]
  confidence: Confidence
  isHydroseedOverlay: boolean
}

export interface InputOption {
  value: string
  label: string
  description?: string
}

export interface MixConfig {
  id: string
  name: string
  matchGoal: Goal
  species: SpeciesBreakdown[]
  ratePer1000: number
  summary: string
}

export interface SlopeOverride {
  blanketRequired: boolean
  blanketReason: string | null
  notes: string[]
}

export interface SoilOverride {
  notes: string[]
  compostYesNote: string | null
  compostNoNote: string | null
  strengthensBlanket: boolean
}

export interface SunOverride {
  warnings: string[]
  confidence: Confidence
}

export interface SeasonOverride {
  warnings: string[]
  notes: string[]
}

export interface MethodOverride {
  notes: string[]
  productRecommendations: ProductRecommendation[]
}

export interface RegionOverride {
  notes: string[]
  warnings: string[]
  confidence: Confidence
}

export interface ProductCatalogEntry {
  name: string
  slug: string
  defaultReason: string
}
