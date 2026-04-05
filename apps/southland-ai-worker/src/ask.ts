import type { Env, AskRequest, AskResponse } from './types'
import { embedQuery } from './lib/embeddings'
import { queryVectorize } from './lib/vectorize'
import { generate } from './lib/llm'
// import { verifyAnswer } from './lib/verify' // Disabled for latency — enable for autonomy only
import { DRAFT_REPLY_PROMPT, STAFF_COPILOT_PROMPT, CHAT_PROMPT } from './prompts/draft-reply'
import { selectVoiceExamples, formatVoiceExamples } from './prompts/voice-examples'
import { READ_TOOLS, executeTool, buildToolSelectionPrompt } from './tools'
import { parseJSON } from './lib/llm'

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

  // Step 3: Resolve customer identity + fetch account snapshot
  let customerContext = ''
  let identityLevel: import('./types').IdentityLevel = 'anonymous'

  // Auto-extract order number from query for staff context
  let orderNumber = body.order_number
  if (!orderNumber && (context === 'staff' || context === 'support_draft')) {
    const orderMatch = body.query.match(/(?:SH-|D2-|#)?(\d{4,6})/i)
    if (orderMatch) orderNumber = orderMatch[0]
  }

  if (body.customer_email || orderNumber) {
    // Fetch live customer context from Nexus
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (env.NEXUS_API_KEY) headers['Authorization'] = `Bearer ${env.NEXUS_API_KEY}`

      const ctxRes = await fetch(`${env.NEXUS_API_URL}/api/ai/customer-context`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: body.customer_email,
          order_number: orderNumber,
        }),
      })

      if (ctxRes.ok) {
        const snapshot = (await ctxRes.json()) as import('./types').CustomerSnapshot
        identityLevel = snapshot.identity_level || 'anonymous'

        if (snapshot.customer_id && identityLevel !== 'anonymous') {
          const parts: string[] = []
          parts.push(`Customer: ${snapshot.display_name || 'Unknown'}`)

          if (snapshot.recent_orders?.length) {
            parts.push('Recent orders:')
            for (const o of snapshot.recent_orders.slice(0, 3)) {
              let line = `  - ${o.number}: ${o.status}`
              if (o.tracking) line += ` (tracking: ${o.tracking}, ${o.carrier || 'unknown carrier'})`
              if (o.delivery_status) line += ` — ${o.delivery_status}`
              parts.push(line)
            }
          }

          if (snapshot.active_subscriptions?.length) {
            parts.push('Active subscriptions:')
            for (const s of snapshot.active_subscriptions) {
              parts.push(`  - ${s.product}: ${s.status}, next billing: ${s.next_billing || 'unknown'}`)
            }
          }

          if (snapshot.shipping_exceptions?.length) {
            parts.push('Shipping issues:')
            for (const e of snapshot.shipping_exceptions) {
              parts.push(`  - Order ${e.order_number}: ${e.status} (${e.carrier} ${e.tracking})`)
            }
          }

          // Customer memory: past interactions + open commitments
          const interactions = (snapshot as unknown as Record<string, unknown>).previous_interactions as Array<{
            summary: string; products: string[]; date: string
          }> | undefined
          if (interactions?.length) {
            parts.push('Previous interactions:')
            for (const int of interactions.slice(0, 3)) {
              parts.push(`  - ${int.summary}${int.products?.length ? ` (products: ${int.products.join(', ')})` : ''}`)
            }
          }

          const commitments = (snapshot as unknown as Record<string, unknown>).open_commitments as Array<{
            type: string; description: string; due_date: string
          }> | undefined
          if (commitments?.length) {
            parts.push('Open commitments:')
            for (const c of commitments) {
              parts.push(`  - ${c.description}${c.due_date ? ` (due: ${c.due_date})` : ''}`)
            }
          }

          customerContext = '\n\nCUSTOMER ACCOUNT DATA:\n' + parts.join('\n')
        }
      }
    } catch (err) {
      console.error('Customer context fetch failed (non-blocking):', err)
    }
  } else if (body.customer_context?.orders?.length) {
    // Legacy: pre-built context from support detail page
    customerContext = '\n\nCUSTOMER ORDER DATA:\n' + body.customer_context.orders
      .map((o) => `- Order ${o.number}: ${o.status} (${o.date})`)
      .join('\n')
  }

  // Step 4: Tool routing (read-only, one turn max)
  let toolResult = ''
  if (identityLevel !== 'anonymous') {
    // Check if the query needs a tool (order lookup, tracking, etc.)
    const lower = body.query.toLowerCase()
    const needsTool = lower.includes('order') || lower.includes('track') || lower.includes('ship') ||
      lower.includes('subscri') || lower.includes('return') || lower.includes('refund') ||
      lower.includes('where is') || lower.includes('where\'s') || lower.includes('status')

    if (needsTool) {
      try {
        // Ask LLM to select a tool
        const toolPrompt = buildToolSelectionPrompt(READ_TOOLS)
        const { text: toolSelection } = await generate(env, toolPrompt, body.query, {
          model: 'fast',
          temperature: 0.0,
          max_tokens: 100,
        })

        const selection = parseJSON<{ tool: string; arguments?: Record<string, string>; question?: string }>(toolSelection)

        if (selection && selection.tool && selection.tool !== 'none') {
          if (selection.tool === 'ask_user') {
            // LLM needs more info — pass the question through as the answer
            toolResult = `\n\nTOOL NOTE: More information needed from customer: ${selection.question || 'Please provide your order number.'}`
          } else if (selection.arguments) {
            // Execute the tool
            const result = await executeTool(env, selection.tool, selection.arguments, identityLevel)
            if (result.status === 'success') {
              toolResult = `\n\nTOOL RESULT (${selection.tool}):\n${JSON.stringify(result.data, null, 2)}`
            } else if (result.status === 'unauthorized') {
              toolResult = '\n\nTOOL NOTE: Customer identity needs to be verified further before accessing account details.'
            } else {
              toolResult = `\n\nTOOL NOTE: Could not retrieve data — ${result.data?.error || 'service temporarily unavailable'}.`
            }
          }
        }
      } catch (err) {
        console.error('Tool routing error (non-blocking):', err)
      }
    }
  }

  // Step 5: Build the full prompt
  // Build system prompt with scenario-specific voice examples
  let systemPrompt = SYSTEM_PROMPTS[context]
  if (context === 'chat' || context === 'support_draft' || context === 'staff') {
    // Classify intents from query for voice example selection
    const intentKeywords: string[] = []
    const lower = body.query.toLowerCase()
    if (lower.includes('order') || lower.includes('ship') || lower.includes('track') || lower.includes('deliver')) intentKeywords.push('shipping', 'order_issue')
    if (lower.includes('return') || lower.includes('refund') || lower.includes('damaged')) intentKeywords.push('returns')
    if (lower.includes('subscri') || lower.includes('cancel') || lower.includes('skip')) intentKeywords.push('subscription')
    if (lower.includes('how') || lower.includes('use') || lower.includes('apply') || lower.includes('rate')) intentKeywords.push('product_question')
    if (lower.includes('bill') || lower.includes('invoice') || lower.includes('payment')) intentKeywords.push('billing')
    if (!intentKeywords.length) intentKeywords.push('product_question') // default

    const examples = selectVoiceExamples(intentKeywords, 2)
    systemPrompt += formatVoiceExamples(examples)
  }
  const fullContext = contextParts.join('\n\n') + customerContext + toolResult

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

  // Confidence from retrieval scores
  const topScore = results[0]?.score || 0
  let confidence: AskResponse['confidence'] = 'low'
  if (topScore > 0.7) confidence = 'high'
  else if (topScore > 0.5) confidence = 'medium'

  // Check answerability from refusal phrases (lightweight, no extra LLM call)
  const refusalPhrases = [
    "don't have specific information",
    "couldn't find that",
    "connect you with",
    "check with",
    "not in our documentation",
  ]
  const answerable = !refusalPhrases.some((p) => answer.toLowerCase().includes(p))

  // NOTE: Full 4-layer verification (lib/verify.ts) is available but disabled
  // for latency reasons. Enable for autonomous sends only (Layer 5.5).
  // To enable: uncomment verifyAnswer() call below.
  // const verification = await verifyAnswer(env, body.query, answer, contextParts, context)

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
