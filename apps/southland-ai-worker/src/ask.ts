import type { Env, AskRequest, AskResponse } from './types'
import { embedQuery } from './lib/embeddings'
import { queryVectorize } from './lib/vectorize'
import { generate, generateStream } from './lib/llm'
import { DRAFT_REPLY_PROMPT, STAFF_COPILOT_PROMPT, CHAT_PROMPT } from './prompts/draft-reply'
import { selectVoiceExamples, formatVoiceExamples } from './prompts/voice-examples'
import { READ_TOOLS, executeTool, buildToolSelectionPrompt } from './tools'
import { parseJSON } from './lib/llm'

// ─── Ask Handler (JSON response) ───────────────────────────────────────────

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
  const prepared = await prepareContext(body, env)

  // Generate response (OpenAI GPT-4o-mini primary, Workers AI fallback)
  const { text: answer, model: llmModel } = await generate(
    env,
    prepared.systemPrompt,
    prepared.userMessage,
    {
      model: 'fast',
      temperature: prepared.context === 'chat' ? 0.3 : 0.2,
      max_tokens: prepared.context === 'chat' ? 600 : 400,
    }
  )

  // Generate follow-up suggestions for chat context
  let suggestedQuestions: string[] | undefined
  if (prepared.context === 'chat') {
    suggestedQuestions = generateFollowUps(body.query, answer, prepared.results)
  }

  const topScore = prepared.results[0]?.score || 0
  let confidence: AskResponse['confidence'] = 'low'
  if (topScore > 0.7) confidence = 'high'
  else if (topScore > 0.5) confidence = 'medium'

  const refusalPhrases = [
    "don't have specific information",
    "couldn't find that",
    "connect you with",
    "check with",
    "not in our documentation",
  ]
  const answerable = !refusalPhrases.some((p) => answer.toLowerCase().includes(p))

  const relevantSources = prepared.results
    .filter((r) => r.score > 0.4 && r.url)
    .slice(0, 4)

  const response: AskResponse = {
    answer,
    sources: relevantSources.map((r) => ({
      title: r.title,
      url: r.url,
      doc_type: r.doc_type,
      relevance: r.score,
    })),
    confidence,
    answerable,
    latency_ms: Date.now() - start,
    model: llmModel,
    suggested_questions: suggestedQuestions,
  }

  ctx.waitUntil(logAskEvent(env, body, response))

  return json(response, env, origin)
}

// ─── Ask Stream Handler (SSE response) ─────────────────────────────────────

export async function handleAskStream(
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
  const prepared = await prepareContext(body, env)
  const context = prepared.context

  // Get relevant sources for the metadata event
  const relevantSources = prepared.results
    .filter((r) => r.score > 0.4 && r.url)
    .slice(0, 4)
    .map((r) => ({
      title: r.title,
      url: r.url,
      doc_type: r.doc_type,
      relevance: r.score,
    }))

  // Get the raw text stream from OpenAI/Workers AI
  const textStream = await generateStream(
    env,
    prepared.systemPrompt,
    prepared.userMessage,
    {
      model: 'fast',
      temperature: context === 'chat' ? 0.3 : 0.2,
      max_tokens: context === 'chat' ? 600 : 400,
    }
  )

  // Wrap the text stream in SSE format with metadata events
  const encoder = new TextEncoder()
  const reader = textStream.getReader()
  let fullAnswer = ''

  const sseStream = new ReadableStream({
    async start(controller) {
      // Send sources metadata first
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources: relevantSources })}\n\n`))
    },
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        // Generate follow-ups from the accumulated answer
        const suggestedQuestions = context === 'chat'
          ? generateFollowUps(body.query, fullAnswer, prepared.results)
          : undefined

        // Send final metadata event
        const topScore = prepared.results[0]?.score || 0
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'done',
          latency_ms: Date.now() - start,
          confidence: topScore > 0.7 ? 'high' : topScore > 0.5 ? 'medium' : 'low',
          suggested_questions: suggestedQuestions,
        })}\n\n`))

        controller.close()

        // Log async
        ctx.waitUntil(logAskEvent(env, body, {
          answer: fullAnswer,
          sources: relevantSources,
          confidence: topScore > 0.7 ? 'high' : topScore > 0.5 ? 'medium' : 'low',
          answerable: true,
          latency_ms: Date.now() - start,
          model: 'gpt-4o-mini',
        }))
        return
      }

      // Decode chunk and accumulate
      const text = new TextDecoder().decode(value)
      fullAnswer += text

      // Send text chunk as SSE event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`))
    },
  })

  const allowed = env.ALLOWED_ORIGINS.split(',')
  const isAllowed = origin && allowed.includes(origin)

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': isAllowed ? origin! : '',
    },
  })
}

// ─── Shared Context Preparation ────────────────────────────────────────────

interface PreparedContext {
  context: AskRequest['context']
  systemPrompt: string
  userMessage: string
  results: import('./types').SearchResult[]
}

async function prepareContext(body: AskRequest, env: Env): Promise<PreparedContext> {
  const context = body.context || 'staff'
  const tenant = body.tenant || 'southland'

  // Step 1: Embed the query
  const { vector } = await embedQuery(body.query, env)

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

  // Build context from KV chunk text
  const contextParts: string[] = []
  for (const result of results) {
    const cached = await env.CACHE.get(`chunk:${result.id}`)
    if (cached) {
      contextParts.push(`[Source: ${result.title}]\n${cached}`)
    } else {
      contextParts.push(`[Source: ${result.title} — ${result.doc_type} in ${result.business_unit}]`)
    }
  }

  // Step 3: Customer identity + account data
  let customerContext = ''
  let identityLevel: import('./types').IdentityLevel = 'anonymous'

  let orderNumber = body.order_number
  if (!orderNumber && (context === 'staff' || context === 'support_draft')) {
    const orderMatch = body.query.match(/(?:SH-|D2-|#)?(\d{4,6})/i)
    if (orderMatch) orderNumber = orderMatch[0]
  }

  if (body.customer_email || orderNumber) {
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

          customerContext = '\n\nCUSTOMER ACCOUNT DATA:\n' + parts.join('\n')
        }
      }
    } catch (err) {
      console.error('Customer context fetch failed (non-blocking):', err)
    }
  } else if (body.customer_context?.orders?.length) {
    customerContext = '\n\nCUSTOMER ORDER DATA:\n' + body.customer_context.orders
      .map((o) => `- Order ${o.number}: ${o.status} (${o.date})`)
      .join('\n')
  }

  // Step 4: Tool routing
  let toolResult = ''
  const toolsAllowed = context === 'staff' || context === 'support_draft' || identityLevel !== 'anonymous'
  if (toolsAllowed) {
    const lower = body.query.toLowerCase()
    const needsTool = lower.includes('order') || lower.includes('track') || lower.includes('ship') ||
      lower.includes('subscri') || lower.includes('return') || lower.includes('refund') ||
      lower.includes('where is') || lower.includes('where\'s') || lower.includes('status') ||
      lower.includes('customer') || lower.includes('account') || lower.includes('who is') ||
      lower.includes('look up') || lower.includes('find')

    if (needsTool) {
      try {
        const toolPrompt = buildToolSelectionPrompt(READ_TOOLS)
        const { text: toolSelection } = await generate(env, toolPrompt, body.query, {
          model: 'fast',
          temperature: 0.0,
          max_tokens: 100,
          provider: 'workers-ai',
        })

        const selection = parseJSON<{ tool: string; arguments?: Record<string, string>; question?: string }>(toolSelection)

        if (selection && selection.tool && selection.tool !== 'none') {
          if (selection.tool === 'ask_user') {
            toolResult = `\n\nTOOL NOTE: More information needed from customer: ${selection.question || 'Please provide your order number.'}`
          } else if (selection.arguments) {
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

  // Step 5: Build prompt
  let systemPrompt = SYSTEM_PROMPTS[context]
  if (context === 'chat' || context === 'support_draft' || context === 'staff') {
    const intentKeywords: string[] = []
    const lower = body.query.toLowerCase()
    if (lower.includes('order') || lower.includes('ship') || lower.includes('track') || lower.includes('deliver')) intentKeywords.push('shipping', 'order_issue')
    if (lower.includes('return') || lower.includes('refund') || lower.includes('damaged')) intentKeywords.push('returns')
    if (lower.includes('subscri') || lower.includes('cancel') || lower.includes('skip')) intentKeywords.push('subscription')
    if (lower.includes('how') || lower.includes('use') || lower.includes('apply') || lower.includes('rate')) intentKeywords.push('product_question')
    if (lower.includes('bill') || lower.includes('invoice') || lower.includes('payment')) intentKeywords.push('billing')
    if (!intentKeywords.length) intentKeywords.push('product_question')

    const examples = selectVoiceExamples(intentKeywords, 2)
    systemPrompt += formatVoiceExamples(examples)
  }

  // Add page context if provided
  if (body.page_url && context === 'chat') {
    systemPrompt += `\n\nPAGE CONTEXT: The customer is currently viewing: ${body.page_url}. If their question seems related to this page, use that context. If they ask a general question, don't force relevance to the page.`
  }

  const fullContext = contextParts.join('\n\n') + customerContext + toolResult

  let conversationPrefix = ''
  if (body.conversation_history?.length) {
    const recent = body.conversation_history.slice(-5)
    conversationPrefix = 'CONVERSATION HISTORY:\n' +
      recent.map((m) => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`).join('\n') +
      '\n\n'
  }

  const userMessage = conversationPrefix + `CONTEXT:\n${fullContext}\n\nQUESTION: ${body.query}`

  return { context, systemPrompt, userMessage, results }
}

// ─── Follow-up Question Generation ─────────────────────────────────────────
// Deterministic — no extra LLM call. Maps query topics to relevant follow-ups.

interface SearchResult {
  score: number
  title: string
  doc_type: string
  business_unit: string
}

function generateFollowUps(query: string, answer: string, results: SearchResult[]): string[] {
  const lower = query.toLowerCase()
  const answerLower = answer.toLowerCase()
  const suggestions: string[] = []

  // Product-related follow-ups
  if (lower.includes('how') || lower.includes('use') || lower.includes('apply') || lower.includes('rate')) {
    suggestions.push('How often should I apply it?')
    if (!lower.includes('how much')) suggestions.push('How much do I need for my operation?')
    suggestions.push('What results should I expect?')
  }

  // Order/shipping follow-ups
  if (lower.includes('order') || lower.includes('ship') || lower.includes('track')) {
    suggestions.push('What are your shipping times?')
    if (!lower.includes('return')) suggestions.push('What is your return policy?')
  }

  // If answer mentions a product, suggest learning more
  const productMentions = results.filter((r) => r.doc_type === 'product')
  if (productMentions.length > 1) {
    suggestions.push('What other products do you recommend?')
  }

  // Segment-specific suggestions
  const bu = results[0]?.business_unit || ''
  if (bu === 'poultry' && !lower.includes('ammonia')) {
    suggestions.push('How do I reduce ammonia in my poultry house?')
  }
  if (bu === 'turf' && !lower.includes('brown spot')) {
    suggestions.push('How do I fix brown spots in my lawn?')
  }

  // Generic fallbacks if no specific suggestions
  if (suggestions.length === 0) {
    suggestions.push('What products would help with my situation?')
    suggestions.push('Can I talk to someone on your team?')
  }

  // Always offer human escalation as last option if not already present
  if (!suggestions.some((s) => s.includes('talk') || s.includes('someone'))) {
    suggestions.push('Can I speak with a team member?')
  }

  // Return top 3, deduplicated
  return [...new Set(suggestions)].slice(0, 3)
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
