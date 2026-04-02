/**
 * Persona Scoring Worker
 *
 * Cloudflare Worker that receives pixel events, computes persona scores,
 * detects journey stages, caches results in KV, and forwards to BigQuery.
 *
 * Entry points:
 * - POST /event - Receive and process pixel event
 * - GET /visitor/:id - Get visitor data from KV
 * - POST /batch - Process multiple events
 */

import type { Env, PixelEvent, VisitorData, ScoringResponse, PersonaId, SegmentId } from './types'
import { ALL_PERSONA_IDS, ALL_SEGMENT_IDS, PERSONA_TO_SEGMENT } from './types'
import { extractSignals } from './signals'
import {
  computePersonaScores,
  computeSegmentScores,
  getPredictedPersona,
  getPredictedSegment,
  calculateConfidence,
  getEffectivePersona,
  getEffectiveSegment,
} from './scoring'
import { detectJourneyStage, calculateStageConfidence, updateStageHistory } from './stages'

// KV expiration: 30 days
const KV_TTL_SECONDS = 30 * 24 * 60 * 60

// Max signals to keep per visitor
const MAX_SIGNALS = 100

// Default persona scores for new visitors (anchored to observed distribution)
const DEFAULT_PERSONA_SCORES = {
  bill: 0.15,
  betty: 0.12,
  bob: 0.05,
  tom: 0.05,
  greg: 0.04,
  taylor: 0.08,
  gary: 0.05,
  hannah: 0.06,
  maggie: 0.04,
  sam: 0.06,
  general: 0.3,
}

const DEFAULT_SEGMENT_SCORES = {
  poultry: 0.45,
  turf: 0.25,
  waste: 0.15,
  general: 0.15,
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // CORS headers for cross-origin requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // Route: POST /event - Process single pixel event
      if (request.method === 'POST' && url.pathname === '/event') {
        const event = (await request.json()) as PixelEvent
        const result = await processEvent(event, env)
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      // Route: GET /visitor/:id - Get visitor data
      if (request.method === 'GET' && url.pathname.startsWith('/visitor/')) {
        const visitorId = url.pathname.split('/visitor/')[1]
        const visitor = await getVisitor(visitorId, env)
        if (!visitor) {
          return new Response(JSON.stringify({ error: 'Visitor not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        return new Response(JSON.stringify(visitor), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      // Route: POST /batch - Process multiple events
      if (request.method === 'POST' && url.pathname === '/batch') {
        const events = (await request.json()) as PixelEvent[]
        const results = await Promise.all(events.map((event) => processEvent(event, env)))
        return new Response(JSON.stringify({ results }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      // Route: GET /health - Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      return new Response('Not found', { status: 404 })
    } catch (error) {
      console.error('Worker error:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
  },
}

/**
 * Process a single pixel event
 */
async function processEvent(event: PixelEvent, env: Env): Promise<ScoringResponse> {
  const visitorId = event.anonymous_id

  // Get or create visitor (with migration for old format)
  let visitor = await getVisitor(visitorId, env)
  if (!visitor) {
    visitor = createNewVisitor(visitorId)
  }

  // Extract signals from event
  const newSignals = extractSignals(event)

  // Update visitor signals (keep last N)
  visitor.signals = [...visitor.signals, ...newSignals].slice(-MAX_SIGNALS)
  visitor.total_signals = visitor.signals.length
  visitor.session_count = (visitor.session_count || 0) + 1

  // Check for explicit persona choice in event
  if (event.event === 'persona_selected' && event.properties?.persona) {
    const persona = event.properties.persona as string
    if (ALL_PERSONA_IDS.includes(persona as PersonaId)) {
      visitor.explicit_persona = persona as PersonaId
    }
  }

  // Check for explicit segment choice in event
  if (event.event === 'segment_path_selected' && event.properties?.segment_id) {
    const segment = event.properties.segment_id as string
    if (ALL_SEGMENT_IDS.includes(segment as SegmentId)) {
      visitor.explicit_segment = segment as SegmentId
    }
  }

  // Compute persona scores
  visitor.persona_scores = computePersonaScores(visitor)
  visitor.predicted_persona = getPredictedPersona(visitor.persona_scores)
  visitor.persona_confidence = calculateConfidence(visitor.persona_scores)

  // Compute segment scores (rolled up from persona scores)
  visitor.segment_scores = computeSegmentScores(visitor.persona_scores)
  visitor.predicted_segment = getPredictedSegment(visitor.segment_scores)

  // Detect journey stage
  const newStage = detectJourneyStage(visitor)
  visitor.stage_history = updateStageHistory(visitor, newStage)
  visitor.current_stage = newStage
  visitor.stage_confidence = calculateStageConfidence(visitor, newStage)

  // Update timestamps
  visitor.last_updated = new Date().toISOString()

  // Save to KV
  await saveVisitor(visitor, env)

  // Forward to BigQuery (non-blocking)
  forwardToBigQuery(event, visitor, env).catch(console.error)

  return {
    success: true,
    visitor_id: visitorId,
    persona: getEffectivePersona(visitor),
    persona_confidence: visitor.persona_confidence,
    segment: getEffectiveSegment(visitor),
    segment_confidence: calculateConfidence(visitor.segment_scores),
    stage: visitor.current_stage,
    stage_confidence: visitor.stage_confidence,
    explicit_choice: visitor.explicit_persona,
    explicit_segment: visitor.explicit_segment,
  }
}

/**
 * Get visitor from KV, with migration for old 4-key format
 */
async function getVisitor(id: string, env: Env): Promise<VisitorData | null> {
  try {
    const data = await env.VISITOR_KV.get(`visitor:${id}`, 'json')
    if (!data) return null

    const visitor = data as VisitorData

    // Migrate old 4-key format to new 11-key format
    if (visitor.persona_scores && !('bill' in visitor.persona_scores)) {
      visitor.persona_scores = migratePersonaScores(visitor.persona_scores as any)
      visitor.predicted_persona = migratePersonaId(visitor.predicted_persona as any)
      if (visitor.explicit_persona) {
        visitor.explicit_persona = migratePersonaId(visitor.explicit_persona as any)
      }
    }

    // Add segment fields if missing
    if (!visitor.segment_scores) {
      visitor.segment_scores = computeSegmentScores(visitor.persona_scores)
      visitor.predicted_segment = getPredictedSegment(visitor.segment_scores)
    }

    return visitor
  } catch {
    return null
  }
}

/**
 * Save visitor to KV
 */
async function saveVisitor(visitor: VisitorData, env: Env): Promise<void> {
  await env.VISITOR_KV.put(`visitor:${visitor.anonymous_id}`, JSON.stringify(visitor), {
    expirationTtl: KV_TTL_SECONDS,
  })
}

/**
 * Create new visitor record
 */
function createNewVisitor(id: string): VisitorData {
  const now = new Date().toISOString()
  return {
    anonymous_id: id,
    signals: [],
    persona_scores: { ...DEFAULT_PERSONA_SCORES } as any,
    predicted_persona: 'general',
    persona_confidence: 0,
    segment_scores: { ...DEFAULT_SEGMENT_SCORES } as any,
    predicted_segment: 'general',
    current_stage: 'unaware',
    stage_confidence: 0,
    stage_history: [{ stage: 'unaware', entered_at: now }],
    first_seen: now,
    last_updated: now,
    session_count: 1,
    total_signals: 0,
  }
}

// =============================================================================
// KV MIGRATION — old 4-key format → new 11-key format
// =============================================================================

const LEGACY_PERSONA_MAP: Record<string, PersonaId> = {
  backyard: 'betty',
  commercial: 'bill',
  lawn: 'taylor',
}

/**
 * Migrate old 4-key persona scores to new 11-key format
 */
function migratePersonaScores(old: Record<string, number>): any {
  const migrated = { ...DEFAULT_PERSONA_SCORES }

  // Map old keys to new keys and distribute weight
  if (old.backyard) migrated.betty = old.backyard
  if (old.commercial) migrated.bill = old.commercial
  if (old.lawn) migrated.taylor = old.lawn
  if (old.general) migrated.general = old.general

  return migrated
}

/**
 * Migrate old persona ID to new format
 */
function migratePersonaId(old: string): PersonaId {
  return LEGACY_PERSONA_MAP[old] ?? (old as PersonaId)
}

/**
 * Forward event + visitor data to BigQuery via webhook
 */
async function forwardToBigQuery(event: PixelEvent, visitor: VisitorData, env: Env): Promise<void> {
  if (!env.BIGQUERY_WEBHOOK_URL) return

  try {
    await fetch(env.BIGQUERY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'pixel_events_enriched',
        row: {
          // Original event
          event_type: event.event,
          anonymous_id: event.anonymous_id,
          customer_id: event.customer_id || null,
          session_id: event.session_id,
          timestamp: event.timestamp,
          page_url: event.page_url,
          page_title: event.page_title,
          referrer: event.referrer || null,
          utm_source: event.utm_source || null,
          utm_medium: event.utm_medium || null,
          utm_campaign: event.utm_campaign || null,
          properties: JSON.stringify(event.properties || {}),

          // Enriched with persona
          predicted_persona: visitor.predicted_persona,
          persona_confidence: visitor.persona_confidence,
          explicit_persona: visitor.explicit_persona || null,

          // Enriched with segment
          predicted_segment: visitor.predicted_segment,
          explicit_segment: visitor.explicit_segment || null,
          segment_scores: JSON.stringify(visitor.segment_scores),

          // Journey stage
          current_stage: visitor.current_stage,
          stage_confidence: visitor.stage_confidence,
          persona_scores: JSON.stringify(visitor.persona_scores),

          // Visitor metadata
          visitor_first_seen: visitor.first_seen,
          visitor_session_count: visitor.session_count,
          visitor_total_signals: visitor.total_signals,

          // Processing metadata
          processed_at: new Date().toISOString(),
          brand_id: env.BRAND_ID,
        },
      }),
    })
  } catch (error) {
    console.error('BigQuery forward failed:', error)
  }
}
