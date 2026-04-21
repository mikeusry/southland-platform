import type { Env, IndexMessage, SummaryMessage } from './types'
import { handleSearch } from './search'
import { handleClassify } from './classify'
import { handleAsk, handleAskStream } from './ask'
import { handleBenchmark } from './benchmark'
import { handleIndex } from './index-worker'
import { handleBulkIndex } from './bulk-index'
import { handleSummarize } from './summarize'
import { handleContentGaps } from './content-gaps'
import { handleEscalate } from './escalate'
import { handleFeedback } from './feedback'

// ─── CORS ───────────────────────────────────────────────────────────────────

function normalizeOrigin(origin: string): string {
  // Strip www. so both variants match the same allowlist entry
  return origin.replace('://www.', '://')
}

function corsHeaders(env: Env, origin: string | null): HeadersInit {
  const allowed = env.ALLOWED_ORIGINS.split(',').map(normalizeOrigin)
  const isAllowed = origin && allowed.includes(normalizeOrigin(origin))
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function corsResponse(env: Env, origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(env, origin) })
}

function jsonResponse(data: unknown, env: Env, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env, origin),
    },
  })
}

// ─── Router ─────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(env, origin)
    }

    try {
      switch (url.pathname) {
        // Layer 3: Site Search
        case '/search':
          return handleSearch(request, env, ctx, origin)

        // Layer 4: Classification
        case '/classify':
          return handleClassify(request, env, ctx, origin)

        // Layer 5+6: RAG (support drafts, staff copilot, chat)
        case '/ask':
          return handleAsk(request, env, ctx, origin)

        // Layer 5+6: Streaming RAG (SSE for chat widget)
        case '/ask/stream':
          return handleAskStream(request, env, ctx, origin)

        // Layer 5.3: Conversation summaries
        case '/summarize':
          return handleSummarize(request, env, ctx, origin)

        // Layer 3.3: Content gap mining
        case '/content-gaps':
          return handleContentGaps(request, env, ctx, origin)

        // Phase 3: Chat → human escalation
        case '/escalate':
          return handleEscalate(request, env, ctx, origin)

        // Feedback: thumbs up/down per message
        case '/feedback':
          return handleFeedback(request, env, ctx, origin)

        // Benchmark: Phase 0 — model latency testing
        case '/benchmark':
          return handleBenchmark(request, env, ctx, origin)

        // Bulk indexing (initial population)
        case '/index/products':
        case '/index/sops':
        case '/index/blog':
          return handleBulkIndex(request, env, ctx, origin)

        // Health check
        case '/health':
          return jsonResponse(
            {
              status: 'ok',
              environment: env.ENVIRONMENT,
              timestamp: new Date().toISOString(),
            },
            env,
            origin
          )

        default:
          return jsonResponse({ error: 'Not found' }, env, origin, 404)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error'
      console.error('Worker error:', message)
      return jsonResponse({ error: message }, env, origin, 500)
    }
  },

  // ─── Queue Consumers ────────────────────────────────────────────────────

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const body = message.body as Record<string, unknown>

        if ('type' in body && 'action' in body) {
          await handleIndex(body as unknown as IndexMessage, env)
        } else if ('conversationId' in body) {
          console.log('Summary request for:', body.conversationId)
        }

        message.ack()
      } catch (err) {
        console.error('Queue processing error:', err)
        message.retry()
      }
    }
  },
} satisfies ExportedHandler<Env>
