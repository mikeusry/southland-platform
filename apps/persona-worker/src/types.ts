/**
 * Persona Scoring Worker Types
 *
 * Type definitions for visitor data, signals, persona scores,
 * and journey stages.
 */

// Persona IDs matching the CDP system
export type PersonaId = 'backyard' | 'commercial' | 'lawn' | 'general'

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
export interface PersonaScores {
  backyard: number
  commercial: number
  lawn: number
  general: number
}

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

  // Explicit choice (from Decision Engine)
  explicit_persona?: PersonaId

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
  stage: JourneyStage
  stage_confidence: number
  explicit_choice?: PersonaId
}
