/**
 * Persona Scoring Worker Types
 *
 * Type definitions for visitor data, signals, persona scores,
 * and journey stages.
 *
 * Two-tier identity: SegmentId (3+general) layered over PersonaId (10+general).
 */

// Persona IDs — 10 personas + general fallback
export type PersonaId =
  | 'bill'
  | 'betty'
  | 'bob'
  | 'tom'
  | 'greg'
  | 'taylor'
  | 'gary'
  | 'hannah'
  | 'maggie'
  | 'sam'
  | 'general'

// Segment IDs — homepage-level routing
export type SegmentId = 'poultry' | 'turf' | 'waste' | 'general'

// Persona → Segment mapping
export const PERSONA_TO_SEGMENT: Record<PersonaId, SegmentId> = {
  bill: 'poultry',
  betty: 'poultry',
  bob: 'poultry',
  tom: 'poultry',
  greg: 'poultry',
  taylor: 'turf',
  gary: 'turf',
  hannah: 'turf',
  maggie: 'turf',
  sam: 'waste',
  general: 'general',
}

// Journey stages from the CDP Playbook (10 stages)
export type JourneyStage =
  | 'unaware'
  | 'aware'
  | 'receptive'
  | 'zmot'
  | 'objections'
  | 'test_prep'
  | 'challenge'
  | 'success'
  | 'commitment'
  | 'evangelist'

// Signal types that indicate persona/stage
export type SignalType =
  | 'page_view'
  | 'search_query'
  | 'product_view'
  | 'collection_view'
  | 'add_to_cart'
  | 'purchase'
  | 'email_signup'
  | 'content_engagement'
  | 'decision_engine'
  | 'survey_response'
  | 'phone_call'
  | 'return_visit'

// Individual behavioral signal
export interface Signal {
  type: SignalType
  value: string
  timestamp: string
  metadata?: Record<string, unknown>
}

// Persona scores (probabilities that sum to 1)
export type PersonaScores = Record<PersonaId, number>

// Segment scores (probabilities that sum to 1)
export type SegmentScores = Record<SegmentId, number>

// All persona IDs for iteration
export const ALL_PERSONA_IDS: PersonaId[] = [
  'bill',
  'betty',
  'bob',
  'tom',
  'greg',
  'taylor',
  'gary',
  'hannah',
  'maggie',
  'sam',
  'general',
]

// All segment IDs for iteration
export const ALL_SEGMENT_IDS: SegmentId[] = ['poultry', 'turf', 'waste', 'general']

// Visitor data stored in KV
export interface VisitorData {
  // Identity
  anonymous_id: string
  customer_id?: string
  email?: string

  // Signals collected
  signals: Signal[]

  // Computed persona
  persona_scores: PersonaScores
  predicted_persona: PersonaId
  persona_confidence: number

  // Explicit choice (from Decision Engine or hub page)
  explicit_persona?: PersonaId

  // Computed segment
  segment_scores: SegmentScores
  predicted_segment: SegmentId

  // Explicit segment (from homepage segment selector)
  explicit_segment?: SegmentId

  // Journey stage
  current_stage: JourneyStage
  stage_confidence: number
  stage_history: Array<{
    stage: JourneyStage
    entered_at: string
  }>

  // Metadata
  first_seen: string
  last_updated: string
  session_count: number
  total_signals: number
}

// Incoming pixel event
export interface PixelEvent {
  event: string
  anonymous_id: string
  customer_id?: string
  session_id: string
  timestamp: string

  // Context
  page_url: string
  page_title: string
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string

  // Event properties
  properties?: Record<string, unknown>
}

// Worker environment bindings
export interface Env {
  VISITOR_KV: KVNamespace
  BRAND_ID: string
  BIGQUERY_WEBHOOK_URL?: string
}

// Response from the worker
export interface ScoringResponse {
  success: boolean
  visitor_id: string
  persona: PersonaId
  persona_confidence: number
  segment: SegmentId
  segment_confidence: number
  stage: JourneyStage
  stage_confidence: number
  explicit_choice?: PersonaId
  explicit_segment?: SegmentId
}
