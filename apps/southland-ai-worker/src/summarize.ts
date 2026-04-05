import type { Env } from './types'
import { generate, parseJSON } from './lib/llm'
import { SUMMARIZE_PROMPT } from './prompts/summarize-conversation'

// ─── Summarize Handler ──────────────────────────────────────────────────────
// POST /summarize — Generate a structured summary of a support conversation.
// Called by Nexus when a conversation is resolved or closed.

interface SummarizeRequest {
  messages: Array<{
    direction: string // inbound | outbound | note
    sender_name: string | null
    body_text: string
    created_at: string
  }>
  subject: string
  category: string | null
  contact_name: string | null
}

interface ConversationSummary {
  summary: string
  tags: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
  resolution_type: string
  customer_state: string
  products_discussed: string[]
  action_taken: string
}

export async function handleSummarize(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'POST required' }, env, origin, 405)
  }

  const body = (await request.json()) as SummarizeRequest
  if (!body.messages?.length) {
    return json({ error: 'No messages to summarize' }, env, origin, 400)
  }

  const start = Date.now()

  // Build conversation thread for the LLM
  const thread = body.messages
    .filter((m) => m.direction !== 'note') // Exclude internal notes
    .map((m) => {
      const role = m.direction === 'inbound' ? 'Customer' : 'Agent'
      const name = m.sender_name || role
      return `${name}: ${m.body_text}`
    })
    .join('\n\n')

  const context = `Subject: ${body.subject}\nCategory: ${body.category || 'uncategorized'}\nCustomer: ${body.contact_name || 'Unknown'}\n\n${thread}`

  const { text, model, latency_ms } = await generate(env, SUMMARIZE_PROMPT, context, {
    model: 'fast',
    temperature: 0.1,
    max_tokens: 300,
  })

  const summary = parseJSON<ConversationSummary>(text)

  if (!summary) {
    return json(
      {
        summary: {
          summary: 'Unable to generate summary',
          tags: [],
          sentiment: 'neutral',
          resolution_type: 'unknown',
          customer_state: 'unknown',
          products_discussed: [],
          action_taken: 'unknown',
        },
        model,
        latency_ms: Date.now() - start,
      },
      env,
      origin
    )
  }

  return json(
    {
      summary,
      model,
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
