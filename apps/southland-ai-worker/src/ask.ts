import type { Env, AskRequest, AskResponse } from './types'
import { embedQuery } from './lib/embeddings'
import { queryVectorize } from './lib/vectorize'
import { generate, generateStream } from './lib/llm'
import { rerank } from './lib/rerank'
import type { RerankCandidate } from './lib/rerank'
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

  const relevantSources = filterSourcesForContext(prepared.results, prepared.context)

  // Extract product cards from search results when products are mentioned
  let productCards: AskResponse['product_cards']
  if (prepared.context === 'chat') {
    productCards = extractProductCards(answer, prepared.results, env)
  }

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
    product_cards: productCards,
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
  const relevantSources = filterSourcesForContext(prepared.results, context)
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

      try {
        // Read all text chunks from the LLM stream
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = new TextDecoder().decode(value)
          fullAnswer += text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`))
        }

        // Generate follow-ups and product cards from the accumulated answer
        const suggestedQuestions = context === 'chat'
          ? generateFollowUps(body.query, fullAnswer, prepared.results)
          : undefined
        const productCards = context === 'chat'
          ? extractProductCards(fullAnswer, prepared.results, env)
          : undefined

        // Send final metadata event
        const topScore = prepared.results[0]?.score || 0
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'done',
          latency_ms: Date.now() - start,
          confidence: topScore > 0.7 ? 'high' : topScore > 0.5 ? 'medium' : 'low',
          suggested_questions: suggestedQuestions,
          product_cards: productCards,
        })}\n\n`))

        // Log async
        ctx.waitUntil(logAskEvent(env, body, {
          answer: fullAnswer,
          sources: relevantSources,
          confidence: topScore > 0.7 ? 'high' : topScore > 0.5 ? 'medium' : 'low',
          answerable: true,
          latency_ms: Date.now() - start,
          model: 'gpt-4o-mini',
        }))
      } catch (err) {
        console.error('Streaming error:', err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text: 'Sorry, something went wrong. Please try again or call us at (800) 608-3755.' })}\n\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
      }

      controller.close()
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

  // Step 1: Hybrid retrieval — dense (Vectorize) + lexical (D1 aliases) in parallel
  const supportOnly = context === 'support_draft' || context === 'chat'

  const [{ vector }, aliasHits] = await Promise.all([
    embedQuery(body.query, env),
    findAliasMatches(env, body.query),
  ])

  const rawResults = await queryVectorize(env, {
    vector,
    topK: 20,
    filter: {
      tenant,
      ...(supportOnly ? { support_relevant: true } : {}),
    },
  })

  // Step 2: Fuse results — inject alias hits at top, deduplicate by ID
  const seenIds = new Set<string>()
  const candidates: RerankCandidate[] = []

  // Alias hits first (lexical match = high signal for exact product/SKU queries)
  for (const alias of aliasHits) {
    const chunkId = `product:${alias.source_id}:0`
    if (seenIds.has(chunkId)) continue
    seenIds.add(chunkId)
    const cached = await env.CACHE.get(`chunk:${chunkId}`)
    candidates.push({
      id: chunkId,
      text: cached || alias.title,
      title: alias.title,
      score: 0.95, // High score for exact match
      url: alias.url,
      doc_type: alias.doc_type,
      business_unit: alias.business_unit,
    })
  }

  // Dense results
  for (const result of rawResults) {
    if (seenIds.has(result.id)) continue
    seenIds.add(result.id)
    const cached = await env.CACHE.get(`chunk:${result.id}`)
    candidates.push({
      id: result.id,
      text: cached || result.title,
      title: result.title,
      score: result.score,
      url: result.url,
      doc_type: result.doc_type,
      business_unit: result.business_unit,
    })
  }

  // Step 3: Rerank fused candidates (Cohere Rerank v3.5 → top 6)
  const reranked = await rerank(env, body.query, candidates, 6)

  // Convert reranked results back to SearchResult format for downstream compatibility
  const results = reranked.map((r) => ({
    id: r.id,
    score: r.relevance_score,
    title: r.title,
    url: r.url,
    doc_type: r.doc_type,
    snippet: '',
    business_unit: r.business_unit,
  }))

  // Build context from reranked chunk text with structured source blocks
  // Filter out SOPs for customer chat — internal docs should never influence customer answers
  const contextParts: string[] = []
  let sourceNum = 0
  for (const r of reranked) {
    // Skip internal SOPs in customer-facing chat
    if (context === 'chat' && (r.doc_type === 'sop' || r.doc_type === 'sops' || r.id.startsWith('sop:'))) continue
    sourceNum++
    if (r.text && r.text !== r.title) {
      contextParts.push(`[SOURCE ${sourceNum}: ${r.title} (${r.doc_type}) — relevance: ${r.relevance_score.toFixed(2)}]\n${r.text}`)
    } else {
      contextParts.push(`[SOURCE ${sourceNum}: ${r.title} — ${r.doc_type} in ${r.business_unit}]`)
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

// ─── Product Card Extraction ───────────────────────────────────────────────
// When the bot mentions products, return structured cards for rich rendering.

function extractProductCards(
  answer: string,
  results: VectorSearchResult[],
  _env: Env
): AskResponse['product_cards'] {
  const answerLower = answer.toLowerCase()

  // Find product results whose titles appear in the answer
  const productResults = results.filter(
    (r) => r.doc_type === 'product' && r.score > 0.5
  )

  const cards: NonNullable<AskResponse['product_cards']> = []
  for (const r of productResults) {
    // Check if the product name appears in the answer
    const nameLower = r.title.toLowerCase()
    if (answerLower.includes(nameLower) || answerLower.includes(nameLower.replace(/\s+/g, ''))) {
      cards.push({
        name: r.title,
        url: r.url.startsWith('http') ? r.url : `https://southlandorganics.com${r.url}`,
        description: '', // Populated from chunk text below
        category: r.business_unit,
      })
    }
  }

  // If no exact name matches, check for common product keywords in the answer
  if (cards.length === 0) {
    const PRODUCT_KEYWORDS: Record<string, string> = {
      'litter life': '/products/litter-life',
      'big ole bird': '/products/big-ole-bird',
      'fertalive': '/products/fertalive',
      'dog spot': '/products/dog-spot-solution',
      'd2 biological': '/products/d2-biological-solution',
      'hen helper': '/products/hen-helper',
      'ignition': '/products/ignition',
      'south40': '/products/south40',
      'catalyst': '/products/catalyst',
    }

    for (const [keyword, url] of Object.entries(PRODUCT_KEYWORDS)) {
      if (answerLower.includes(keyword)) {
        const displayName = keyword.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        cards.push({
          name: displayName,
          url: `https://southlandorganics.com${url}`,
          description: '',
          category: '',
        })
      }
    }
  }

  return cards.length > 0 ? cards.slice(0, 2) : undefined
}

// ─── Follow-up Question Generation ─────────────────────────────────────────
// Deterministic — no extra LLM call. Maps query topics to relevant follow-ups.

interface VectorSearchResult {
  score: number
  title: string
  doc_type: string
  business_unit: string
  url: string
  id: string
}

function generateFollowUps(query: string, answer: string, results: VectorSearchResult[]): string[] {
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

// ─── Lexical / Alias Matching (Hybrid Retrieval) ───────────────────────────
// Checks D1 product_aliases for exact and prefix matches on query keywords.
// Catches product names, SKUs, and terms that dense search might miss.

interface AliasHit {
  source_id: string
  title: string
  url: string
  doc_type: string
  business_unit: string
}

async function findAliasMatches(env: Env, query: string): Promise<AliasHit[]> {
  const normalized = query.trim().toUpperCase()
  const words = normalized.split(/\s+/).filter((w) => w.length > 2)
  if (words.length === 0) return []

  const hits: AliasHit[] = []
  const seen = new Set<string>()

  try {
    // Exact match on full query
    const exact = await env.DB.prepare(
      'SELECT source_id, title, url, doc_type, business_unit FROM product_aliases WHERE alias_upper = ? LIMIT 1'
    )
      .bind(normalized)
      .first()

    if (exact && !seen.has(String(exact.source_id))) {
      seen.add(String(exact.source_id))
      hits.push({
        source_id: String(exact.source_id),
        title: String(exact.title),
        url: String(exact.url),
        doc_type: String(exact.doc_type),
        business_unit: String(exact.business_unit || ''),
      })
    }

    // Prefix match on individual words (catches "Litter Life" from "how do I use Litter Life")
    for (const word of words) {
      if (word.length < 4) continue // Skip short words
      const prefix = await env.DB.prepare(
        'SELECT source_id, title, url, doc_type, business_unit FROM product_aliases WHERE alias_upper LIKE ? LIMIT 2'
      )
        .bind(`%${word}%`)
        .all()

      for (const row of prefix.results || []) {
        const sid = String(row.source_id)
        if (seen.has(sid)) continue
        seen.add(sid)
        hits.push({
          source_id: sid,
          title: String(row.title),
          url: String(row.url),
          doc_type: String(row.doc_type),
          business_unit: String(row.business_unit || ''),
        })
      }

      if (hits.length >= 3) break // Cap at 3 alias hits
    }
  } catch (err) {
    console.error('Alias search error (non-blocking):', err)
  }

  return hits
}

// ─── Source Filtering ──────────────────────────────────────────────────────
// CRITICAL: SOPs are internal docs — NEVER show to customers.
// Only show sources that resolve on the public southlandorganics.com site.

function filterSourcesForContext(
  results: Array<{ score: number; url: string; doc_type: string; title: string; id: string; snippet: string; business_unit: string }>,
  context: AskRequest['context']
) {
  return results
    .filter((r) => {
      if (r.score <= 0.4 || !r.url) return false

      if (context === 'chat') {
        // NEVER show SOPs to customers — internal-only docs, 404 on public site
        if (r.doc_type === 'sop' || r.doc_type === 'sops') return false
        if (r.url.startsWith('/sops')) return false
        // Only show URLs that exist on the public site
        if (!r.url.startsWith('/blog') && !r.url.startsWith('/products') && !r.url.startsWith('http')) return false
      }

      return true
    })
    .slice(0, 4)
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
