import type { Env, AskRequest, AskResponse } from './types'
import { embedQuery } from './lib/embeddings'
import { queryVectorize } from './lib/vectorize'
import { generate } from './lib/llm'
import { DRAFT_REPLY_PROMPT, STAFF_COPILOT_PROMPT, CHAT_PROMPT } from './prompts/draft-reply'

// ─── Ask Handler ────────────────────────────────────────────────────────────
// Layer 5+6: Shared RAG endpoint for support drafts, staff copilot, chat.
// One pipeline, three contexts.
//
// Flow:
//   1. Embed query
//   2. Retrieve relevant chunks from Vectorize
//   3. (Optional) Inject customer order data for order-specific queries
//   4. Answerability check — is the answer in the context?
//   5. Generate grounded response
//   6. Return with source citations

const SYSTEM_PROMPTS: Record<AskRequest['context'], string> = {
  support_draft: DRAFT_REPLY_PROMPT,
  staff: STAFF_COPILOT_PROMPT,
  chat: CHAT_PROMPT,
}

export async function handleAsk(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'POST required' }, env, origin, 405)
  }

  const body = (await request.json()) as AskRequest
  if (!body.query?.trim()) {
    return json({ error: 'Missing query field' }, env, origin, 400)
  }

  const start = Date.now()
  const context = body.context || 'staff'
  const tenant = body.tenant || 'southland'

  // Step 1: Embed the query
  const { vector, model: embeddingModel } = await embedQuery(body.query, env)

  // Step 2: Retrieve relevant chunks from Vectorize
  const supportOnly = context === 'support_draft' || context === 'chat'
  const results = await queryVectorize(env, {
    vector,
    topK: 8,
    filter: {
      tenant,
      ...(supportOnly ? { support_relevant: true } : {}),
    },
  })

  // Build context from retrieved chunks
  // We need the actual text — but Vectorize only stores metadata.
  // For now, use title + doc_type as context. In production, store chunk text
  // in D1 or KV alongside the vector ID.
  // TODO: Store chunk text in D1 chunk_manifests.chunk_text for richer context.
  const retrievedContext = results
    .map((r, i) => `[Source ${i + 1}: ${r.title} (${r.doc_type})]`)
    .join('\n')

  // For richer context, check if we have chunk text cached in KV
  const contextParts: string[] = []
  for (const result of results.slice(0, 5)) {
    const cached = await env.CACHE.get(`chunk:${result.id}`)
    if (cached) {
      contextParts.push(`[Source: ${result.title}]\n${cached}`)
    } else {
      contextParts.push(`[Source: ${result.title} — ${result.doc_type} in ${result.business_unit}]`)
    }
  }

  // Step 3: Inject customer order data for order-specific queries
  let orderContext = ''
  if (body.customer_context?.orders?.length) {
    orderContext = '\n\nCUSTOMER ORDER DATA:\n' + body.customer_context.orders
      .map((o) => `- Order ${o.number}: ${o.status} (${o.date})`)
      .join('\n')
  }
  if (body.customer_context?.subscriptions?.length) {
    orderContext += '\n\nCUSTOMER SUBSCRIPTIONS:\n' + body.customer_context.subscriptions
      .map((s) => `- Subscription ${s.id}: ${s.status}`)
      .join('\n')
  }

  // Step 4: Build the full prompt
  const systemPrompt = SYSTEM_PROMPTS[context]
  const fullContext = contextParts.join('\n\n') + orderContext

  const userMessage = `CONTEXT:\n${fullContext}\n\nQUESTION: ${body.query}`

  // Add conversation history if provided (last 3-5 turns)
  let conversationPrefix = ''
  if (body.conversation_history?.length) {
    const recent = body.conversation_history.slice(-5)
    conversationPrefix = 'CONVERSATION HISTORY:\n' +
      recent.map((m) => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`).join('\n') +
      '\n\n'
  }

  // Step 5: Generate response
  const { text: answer, model: llmModel, latency_ms: genLatency } = await generate(
    env,
    systemPrompt,
    conversationPrefix + userMessage,
    {
      model: 'fast', // 8B for drafts — upgrade to 'quality' for autonomous sends
      temperature: context === 'chat' ? 0.3 : 0.2,
      max_tokens: context === 'chat' ? 200 : 400,
    }
  )

  // Step 6: Determine if answerable (did the model refuse?)
  const refusalPhrases = [
    "don't have specific information",
    "couldn't find that",
    "connect you with",
    "check with",
    "not in our documentation",
    "I'm not sure about that",
  ]
  const answerable = !refusalPhrases.some((p) => answer.toLowerCase().includes(p))

  // Compute confidence from retrieval scores + answerability
  const topScore = results[0]?.score || 0
  let confidence: AskResponse['confidence'] = 'low'
  if (answerable && topScore > 0.7) confidence = 'high'
  else if (answerable && topScore > 0.5) confidence = 'medium'

  const response: AskResponse = {
    answer,
    sources: results.slice(0, 5).map((r) => ({
      title: r.title,
      url: r.url,
      doc_type: r.doc_type,
      relevance: r.score,
    })),
    confidence,
    answerable,
    latency_ms: Date.now() - start,
    model: llmModel,
  }

  // Log ask event async
  ctx.waitUntil(logAskEvent(env, body, response))

  return json(response, env, origin)
}

// ─── Logging ────────────────────────────────────────────────────────────────

async function logAskEvent(env: Env, request: AskRequest, response: AskResponse): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO search_events (query, results_count, latency_ms, model, exact_match, top_result_type, created_at)
       VALUES (?, ?, ?, ?, 0, ?, datetime('now'))`
    )
      .bind(
        `[${request.context}] ${request.query.slice(0, 200)}`,
        response.sources.length,
        response.latency_ms,
        response.model,
        response.sources[0]?.doc_type || null
      )
      .run()
  } catch {
    console.error('Failed to log ask event')
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function json(data: unknown, env: Env, origin: string | null, status = 200): Response {
  const allowed = env.ALLOWED_ORIGINS.split(',')
  const isAllowed = origin && allowed.includes(origin)
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': isAllowed ? origin! : '',
    },
  })
}
