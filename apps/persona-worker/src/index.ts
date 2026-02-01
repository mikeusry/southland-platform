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

import type {
  Env,
  PixelEvent,
  VisitorData,
  ScoringResponse,
  PersonaId,
} from './types';
import { extractSignals } from './signals';
import {
  computePersonaScores,
  getPredictedPersona,
  calculateConfidence,
  getEffectivePersona,
} from './scoring';
import {
  detectJourneyStage,
  calculateStageConfidence,
  updateStageHistory,
} from './stages';

// KV expiration: 30 days
const KV_TTL_SECONDS = 30 * 24 * 60 * 60;

// Max signals to keep per visitor
const MAX_SIGNALS = 100;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for cross-origin requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route: POST /event - Process single pixel event
      if (request.method === 'POST' && url.pathname === '/event') {
        const event = (await request.json()) as PixelEvent;
        const result = await processEvent(event, env);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Route: GET /visitor/:id - Get visitor data
      if (request.method === 'GET' && url.pathname.startsWith('/visitor/')) {
        const visitorId = url.pathname.split('/visitor/')[1];
        const visitor = await getVisitor(visitorId, env);
        if (!visitor) {
          return new Response(JSON.stringify({ error: 'Visitor not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        return new Response(JSON.stringify(visitor), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Route: POST /batch - Process multiple events
      if (request.method === 'POST' && url.pathname === '/batch') {
        const events = (await request.json()) as PixelEvent[];
        const results = await Promise.all(
          events.map((event) => processEvent(event, env))
        );
        return new Response(JSON.stringify({ results }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Route: GET /health - Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
  },
};

/**
 * Process a single pixel event
 */
async function processEvent(event: PixelEvent, env: Env): Promise<ScoringResponse> {
  const visitorId = event.anonymous_id;

  // Get or create visitor
  let visitor = await getVisitor(visitorId, env);
  if (!visitor) {
    visitor = createNewVisitor(visitorId);
  }

  // Extract signals from event
  const newSignals = extractSignals(event);

  // Update visitor signals (keep last N)
  visitor.signals = [...visitor.signals, ...newSignals].slice(-MAX_SIGNALS);
  visitor.total_signals = visitor.signals.length;
  visitor.session_count = (visitor.session_count || 0) + 1;

  // Check for explicit persona choice in event
  if (event.event === 'persona_selected' && event.properties?.persona) {
    visitor.explicit_persona = event.properties.persona as PersonaId;
  }

  // Compute persona scores
  visitor.persona_scores = computePersonaScores(visitor);
  visitor.predicted_persona = getPredictedPersona(visitor.persona_scores);
  visitor.persona_confidence = calculateConfidence(visitor.persona_scores);

  // Detect journey stage
  const newStage = detectJourneyStage(visitor);
  visitor.stage_history = updateStageHistory(visitor, newStage);
  visitor.current_stage = newStage;
  visitor.stage_confidence = calculateStageConfidence(visitor, newStage);

  // Update timestamps
  visitor.last_updated = new Date().toISOString();

  // Save to KV
  await saveVisitor(visitor, env);

  // Forward to BigQuery (non-blocking)
  forwardToBigQuery(event, visitor, env).catch(console.error);

  return {
    success: true,
    visitor_id: visitorId,
    persona: getEffectivePersona(visitor),
    persona_confidence: visitor.persona_confidence,
    stage: visitor.current_stage,
    stage_confidence: visitor.stage_confidence,
    explicit_choice: visitor.explicit_persona,
  };
}

/**
 * Get visitor from KV
 */
async function getVisitor(id: string, env: Env): Promise<VisitorData | null> {
  try {
    const data = await env.VISITOR_KV.get(`visitor:${id}`, 'json');
    return data as VisitorData | null;
  } catch {
    return null;
  }
}

/**
 * Save visitor to KV
 */
async function saveVisitor(visitor: VisitorData, env: Env): Promise<void> {
  await env.VISITOR_KV.put(
    `visitor:${visitor.anonymous_id}`,
    JSON.stringify(visitor),
    { expirationTtl: KV_TTL_SECONDS }
  );
}

/**
 * Create new visitor record
 */
function createNewVisitor(id: string): VisitorData {
  const now = new Date().toISOString();
  return {
    anonymous_id: id,
    signals: [],
    persona_scores: {
      backyard: 0.25,
      commercial: 0.25,
      lawn: 0.25,
      general: 0.25,
    },
    predicted_persona: 'general',
    persona_confidence: 0,
    current_stage: 'unaware',
    stage_confidence: 0,
    stage_history: [{ stage: 'unaware', entered_at: now }],
    first_seen: now,
    last_updated: now,
    session_count: 1,
    total_signals: 0,
  };
}

/**
 * Forward event + visitor data to BigQuery via webhook
 */
async function forwardToBigQuery(
  event: PixelEvent,
  visitor: VisitorData,
  env: Env
): Promise<void> {
  if (!env.BIGQUERY_WEBHOOK_URL) return;

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

          // Enriched with persona/stage
          predicted_persona: visitor.predicted_persona,
          persona_confidence: visitor.persona_confidence,
          explicit_persona: visitor.explicit_persona || null,
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
    });
  } catch (error) {
    console.error('BigQuery forward failed:', error);
  }
}
