import type { Env } from './types'
import { generate } from './lib/llm'

// ─── Escalation Handler ────────────────────────────────────────────────────
// POST /escalate — Creates a Nexus support conversation from chat transcript
// Generates structured handoff packet for the human agent.

interface EscalateRequest {
  messages: Array<{ role: string; content: string }>
  customer_email?: string
  customer_name?: string
  identity_level?: string
  source: 'chat_widget' | 'inbound_email'
  intent?: string
  tool_attempts?: Array<{ tool: string; result: string }>
}

export async function handleEscalate(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'POST required' }, env, origin, 405)
  }

  const body = (await request.json()) as EscalateRequest
  if (!body.messages?.length) {
    return json({ error: 'No messages to escalate' }, env, origin, 400)
  }

  const start = Date.now()

  // Step 1: Generate AI summary of the conversation
  const thread = body.messages
    .map((m) => `${m.role === 'user' ? 'Customer' : 'AI'}: ${m.content}`)
    .join('\n')

  let aiSummary = ''
  let draftReply = ''
  let detectedIntent = body.intent || 'unknown'
  let sentiment = 'neutral'

  try {
    const { text } = await generate(
      env,
      `Summarize this customer chat for a human support agent. Output JSON:
{
  "summary": "1-2 sentence summary of what the customer needs",
  "intent": "order_issue | shipping | product_question | billing | returns | subscription | account | other",
  "sentiment": "positive | neutral | frustrated",
  "draft_reply": "A suggested first reply the agent could send",
  "priority": "low | normal | high | urgent"
}
Output ONLY the JSON.`,
      thread,
      { model: 'fast', temperature: 0.1, max_tokens: 300 }
    )

    const parsed = JSON.parse(
      text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    ) as Record<string, string>

    if (parsed) {
      aiSummary = parsed.summary || ''
      detectedIntent = parsed.intent || detectedIntent
      sentiment = parsed.sentiment || sentiment
      draftReply = parsed.draft_reply || ''
    }
  } catch {
    aiSummary = `Customer chat with ${body.messages.length} messages. Manual review needed.`
  }

  // Step 2: Determine business hours for response promise
  const now = new Date()
  const etHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours()
  const etDay = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay()
  const isBusinessHours = etDay >= 1 && etDay <= 5 && etHour >= 8 && etHour < 17

  let responsePromise: string
  if (isBusinessHours) {
    responsePromise = "You'll hear back from our team via email within 4 hours."
  } else if (etDay === 0 || etDay === 6) {
    responsePromise = "Our team will respond first thing Monday morning."
  } else {
    responsePromise = "Our team will respond first thing tomorrow morning."
  }

  // Step 3: Build handoff packet
  const handoffPacket = {
    messages: body.messages,
    identity_level: body.identity_level || 'anonymous',
    customer_email: body.customer_email || null,
    customer_name: body.customer_name || null,
    intent: detectedIntent,
    ai_summary: aiSummary,
    sentiment,
    draft_reply: draftReply,
    tool_attempts: body.tool_attempts || [],
    source: body.source,
    sla_priority: sentiment === 'frustrated' ? 'high' : 'normal',
    response_promise: responsePromise,
    escalated_at: new Date().toISOString(),
  }

  // Step 4: Send to Nexus
  let conversationId: string | null = null
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (env.NEXUS_API_KEY) headers['Authorization'] = `Bearer ${env.NEXUS_API_KEY}`

    const res = await fetch(`${env.NEXUS_API_URL}/api/ai/escalate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(handoffPacket),
    })

    if (res.ok) {
      const data = (await res.json()) as { conversation_id?: string; seq_number?: number }
      conversationId = data.conversation_id || null
    }
  } catch (err) {
    console.error('Escalation to Nexus failed:', err)
  }

  return json(
    {
      ok: true,
      escalated: true,
      conversation_id: conversationId,
      response_promise: responsePromise,
      latency_ms: Date.now() - start,
    },
    env,
    origin
  )
}

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
