import type { Env, ClassifyRequest, ClassifyResponse, SupportCategory, BusinessUnit } from './types'
import { generate, parseJSON } from './lib/llm'
import { CLASSIFY_SUPPORT_PROMPT } from './prompts/classify-support'

// ─── Classification Handler ─────────────────────────────────────────────────
// Layer 4: Auto-classify messages by category, BU, priority, intent
// Uses Llama 3.1 8B with few-shot examples (NOT zero-shot)

const PROMPT_VERSION = 'v1.0'

// Valid enums for output validation
const VALID_CATEGORIES: Set<string> = new Set([
  'order_issue', 'shipping', 'product_question', 'billing',
  'returns', 'subscription', 'account', 'other',
])
const VALID_BUS: Set<string> = new Set([
  'Poultry', 'Golf', 'Lawn', 'Agriculture', 'Ancillary',
])

export async function handleClassify(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'POST required' }, env, origin, 405)
  }

  const body = await request.json() as ClassifyRequest
  if (!body.text?.trim()) {
    return json({ error: 'Missing text field' }, env, origin, 400)
  }

  const start = Date.now()

  // Step 1: Extract structured entities with regex (order #, tracking)
  const entities = extractEntities(body.text)

  // Step 2: Short message guard — skip LLM if too short
  const tokens = estimateTokens(body.text)
  if (tokens < 15) {
    const fallback: ClassifyResponse = {
      support_categories: ['other'],
      business_units: [],
      order_numbers: entities.order_numbers,
      tracking_numbers: entities.tracking_numbers,
      product_names: [],
      reason: 'Message too short for reliable classification',
      confidence: 'low',
      latency_ms: Date.now() - start,
      prompt_version: PROMPT_VERSION,
    }
    return json(fallback, env, origin)
  }

  // Step 3: LLM classification (few-shot)
  const result = await generate(env, CLASSIFY_SUPPORT_PROMPT, body.text, {
    model: 'fast',
    temperature: 0.1,
    max_tokens: 200,
  })

  // Step 4: Parse and validate output
  const parsed = parseJSON<{
    support_categories?: string[]
    business_units?: string[]
    order_numbers?: string[]
    tracking_numbers?: string[]
    product_names?: string[]
    reason?: string
  }>(result.text)

  if (!parsed) {
    // LLM returned unparseable output — fallback
    const fallback: ClassifyResponse = {
      support_categories: ['other'],
      business_units: [],
      order_numbers: entities.order_numbers,
      tracking_numbers: entities.tracking_numbers,
      product_names: [],
      reason: 'Classification model returned invalid output',
      confidence: 'low',
      latency_ms: Date.now() - start,
      prompt_version: PROMPT_VERSION,
    }
    return json(fallback, env, origin)
  }

  // Validate categories against enum — discard invented ones
  const validCategories = (parsed.support_categories || [])
    .filter((c): c is SupportCategory => VALID_CATEGORIES.has(c))
  const validBUs = (parsed.business_units || [])
    .filter((b): b is BusinessUnit => VALID_BUS.has(b))

  // If all categories were invalid, fall back to 'other'
  const categories = validCategories.length > 0 ? validCategories : (['other'] as SupportCategory[])

  // Merge regex-extracted entities with LLM-extracted ones
  const allOrderNumbers = [...new Set([...entities.order_numbers, ...(parsed.order_numbers || [])])]
  const allTrackingNumbers = [...new Set([...entities.tracking_numbers, ...(parsed.tracking_numbers || [])])]

  // Compute confidence from output structure
  const confidence = computeConfidence(categories, tokens)

  const response: ClassifyResponse = {
    support_categories: categories,
    business_units: validBUs,
    order_numbers: allOrderNumbers,
    tracking_numbers: allTrackingNumbers,
    product_names: parsed.product_names || [],
    reason: parsed.reason || '',
    confidence,
    latency_ms: Date.now() - start,
    prompt_version: PROMPT_VERSION,
  }

  // Log classification async
  ctx.waitUntil(logClassification(env, body.text, response))

  return json(response, env, origin)
}

// ─── Entity Extraction (Regex) ──────────────────────────────────────────────
// More reliable than LLM for structured IDs

function extractEntities(text: string): { order_numbers: string[]; tracking_numbers: string[] } {
  // Order numbers: #21500, order 21500, SH-21500, etc.
  const orderMatches = text.match(/(?:#|order\s*#?\s*|SH-|D2-)(\d{4,6})/gi) || []
  const order_numbers = orderMatches.map((m) => m.replace(/^[#]|order\s*#?\s*/gi, '').replace(/^(SH|D2)-/i, ''))

  // UPS tracking: 1Z...
  const upsMatches = text.match(/1Z[A-Z0-9]{16,}/gi) || []
  // FedEx tracking: 12-34 digit numbers (loose)
  const fedexMatches = text.match(/\b\d{12,34}\b/g) || []

  return {
    order_numbers: [...new Set(order_numbers)],
    tracking_numbers: [...new Set([...upsMatches, ...fedexMatches])],
  }
}

// ─── Confidence Scoring ─────────────────────────────────────────────────────
// Output-based heuristics (no logit probabilities available)

function computeConfidence(
  categories: SupportCategory[],
  tokenCount: number
): 'high' | 'medium' | 'low' {
  // Low: short messages or fallback to 'other'
  if (tokenCount < 15) return 'low'
  if (categories.length === 1 && categories[0] === 'other') return 'low'

  // High: clear single or dual category, not 'other', message has substance
  if (categories.length <= 2 && !categories.includes('other') && tokenCount >= 15) return 'high'

  // Medium: 3+ categories or includes 'other' with real categories
  return 'medium'
}

// ─── Logging ────────────────────────────────────────────────────────────────

async function logClassification(
  env: Env,
  text: string,
  response: ClassifyResponse
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO classification_events
       (text_preview, categories, business_units, confidence, prompt_version, latency_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        text.slice(0, 200), // Don't store full text in log
        JSON.stringify(response.support_categories),
        JSON.stringify(response.business_units),
        response.confidence,
        response.prompt_version,
        response.latency_ms
      )
      .run()
  } catch {
    console.error('Failed to log classification')
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3)
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
