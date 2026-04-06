import type { Env } from './types'

// ─── Chat Feedback Handler ─────────────────────────────────────────────────
// POST /feedback — thumbs up/down with reason codes
//
// Captures per-message feedback for continuous improvement.
// Weekly review of thumbs-down conversations reveals:
//   - Bad retrieval (right content exists, wasn't found)
//   - Bad ranking (right chunk retrieved, wrong one used)
//   - Bad generation (right context, wrong answer)
//   - Content gap (answer doesn't exist in knowledge base)

interface FeedbackRequest {
  message_id?: string      // Optional client-generated message ID
  query: string            // The user's question
  answer: string           // The bot's response
  rating: 'up' | 'down'
  reason?: 'wrong_answer' | 'didnt_answer' | 'wrong_product' | 'other'
  reason_text?: string     // Optional free text
  page_url?: string
  session_id?: string
}

export async function handleFeedback(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'POST required' }, env, origin, 405)
  }

  const body = (await request.json()) as FeedbackRequest

  if (!body.query || !body.answer || !body.rating) {
    return json({ error: 'Missing required fields: query, answer, rating' }, env, origin, 400)
  }

  try {
    await env.DB.prepare(
      `INSERT INTO chat_feedback (query, answer, rating, reason, reason_text, page_url, session_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        body.query.slice(0, 500),
        body.answer.slice(0, 2000),
        body.rating,
        body.reason || null,
        body.reason_text?.slice(0, 500) || null,
        body.page_url || null,
        body.session_id || null
      )
      .run()

    // Also log to Nexus for AI Review dashboard (fire-and-forget)
    if (body.session_id && env.NEXUS_API_URL && env.NEXUS_API_KEY) {
      ctx.waitUntil(
        fetch(`${env.NEXUS_API_URL}/api/ai/log-feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.NEXUS_API_KEY}`,
          },
          body: JSON.stringify({
            session_id: body.session_id,
            rating: body.rating,
            reason: body.reason,
          }),
        }).catch((err) => console.error('Nexus feedback log error:', err))
      )
    }

    return json({ status: 'ok' }, env, origin)
  } catch (err) {
    console.error('Feedback save error:', err)
    return json({ error: 'Failed to save feedback' }, env, origin, 500)
  }
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
