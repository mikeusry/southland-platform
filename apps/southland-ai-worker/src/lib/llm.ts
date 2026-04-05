import type { Env } from '../types'

// ─── Model Configuration ────────────────────────────────────────────────────
// Primary: OpenAI GPT-4o-mini (frontier-small, best price/quality for RAG chat)
// Fallback: Workers AI Llama 3.3 70B (if OpenAI is down)
// Legacy: Workers AI Llama 3.1 8B (tool selection only — fast, cheap)

export const OPENAI_MODELS = {
  fast: 'gpt-4o-mini',           // Customer chat, staff copilot, support drafts
  quality: 'gpt-4o-mini',       // Same for now — upgrade to gpt-4o if needed
} as const

// Workers AI fallback models
export const WORKERS_AI_MODELS = {
  fast: '@cf/meta/llama-3.1-8b-instruct-fp8' as string,
  quality: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as string,
}

export type ModelTier = 'fast' | 'quality'

// ─── Generate Text ──────────────────────────────────────────────────────────

export interface LLMOptions {
  model?: ModelTier
  temperature?: number
  max_tokens?: number
  stream?: boolean
  provider?: 'openai' | 'workers-ai' // Force a provider (default: auto)
}

export interface LLMResult {
  text: string
  model: string
  latency_ms: number
}

/**
 * Generate text — routes to OpenAI (primary) with Workers AI fallback.
 *
 * Uses direct fetch to OpenAI API (no SDK needed).
 * Falls back to Workers AI if:
 *   - OPENAI_API_KEY is not set
 *   - OpenAI returns an error
 *   - provider: 'workers-ai' is explicitly set
 */
export async function generate(
  env: Env,
  system: string,
  user: string,
  options: LLMOptions = {}
): Promise<LLMResult> {
  const { model = 'fast', temperature = 0.2, max_tokens = 300, provider } = options

  // Use Workers AI if explicitly requested or no OpenAI key
  if (provider === 'workers-ai' || !env.OPENAI_API_KEY) {
    return generateWorkersAI(env, system, user, { model, temperature, max_tokens })
  }

  // Primary: OpenAI
  try {
    return await generateOpenAI(env, system, user, { model, temperature, max_tokens })
  } catch (err) {
    console.error('OpenAI generation failed, falling back to Workers AI:', err)
    return generateWorkersAI(env, system, user, { model, temperature, max_tokens })
  }
}

// ─── OpenAI Direct Fetch ───────────────────────────────────────────────────

async function generateOpenAI(
  env: Env,
  system: string,
  user: string,
  options: { model: ModelTier; temperature: number; max_tokens: number }
): Promise<LLMResult> {
  const modelId = OPENAI_MODELS[options.model]
  const start = Date.now()

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI ${res.status}: ${errText}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
    model: string
  }

  const text = data.choices?.[0]?.message?.content || ''

  return {
    text,
    model: data.model || modelId,
    latency_ms: Date.now() - start,
  }
}

// ─── OpenAI Streaming ──────────────────────────────────────────────────────

export async function generateStream(
  env: Env,
  system: string,
  user: string,
  options: LLMOptions = {}
): Promise<ReadableStream> {
  const { model = 'fast', temperature = 0.3, max_tokens = 600 } = options

  // Use OpenAI streaming if key available
  if (env.OPENAI_API_KEY) {
    try {
      return await generateOpenAIStream(env, system, user, { model, temperature, max_tokens })
    } catch (err) {
      console.error('OpenAI streaming failed, falling back to Workers AI:', err)
    }
  }

  // Fallback: Workers AI streaming
  return generateWorkersAIStream(env, system, user, { model, temperature, max_tokens })
}

async function generateOpenAIStream(
  env: Env,
  system: string,
  user: string,
  options: { model: ModelTier; temperature: number; max_tokens: number }
): Promise<ReadableStream> {
  const modelId = OPENAI_MODELS[options.model]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: true,
    }),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text()
    throw new Error(`OpenAI stream ${res.status}: ${errText}`)
  }

  // Transform OpenAI SSE stream into plain text stream
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') {
          controller.close()
          return
        }
        try {
          const parsed = JSON.parse(data) as {
            choices: Array<{ delta: { content?: string } }>
          }
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            controller.enqueue(new TextEncoder().encode(content))
          }
        } catch {
          // Skip malformed chunks
        }
      }
    },
  })
}

// ─── Workers AI (Fallback) ─────────────────────────────────────────────────

async function generateWorkersAI(
  env: Env,
  system: string,
  user: string,
  options: { model: ModelTier; temperature: number; max_tokens: number }
): Promise<LLMResult> {
  const modelId = WORKERS_AI_MODELS[options.model]
  const start = Date.now()

  const useGateway = env.AI_GATEWAY_SLUG && env.ENVIRONMENT !== 'gateway-disabled'
  const gatewayOpts = useGateway
    ? { gateway: { id: env.AI_GATEWAY_SLUG, skipCache: false, cacheTtl: 0 } }
    : undefined

  const result = await env.AI.run(
    modelId as keyof AiModels,
    {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    },
    gatewayOpts
  ) as { response?: string }

  const text = result?.response ? String(result.response) : ''

  return {
    text,
    model: modelId,
    latency_ms: Date.now() - start,
  }
}

async function generateWorkersAIStream(
  env: Env,
  system: string,
  user: string,
  options: { model: ModelTier; temperature: number; max_tokens: number }
): Promise<ReadableStream> {
  const modelId = WORKERS_AI_MODELS[options.model]

  const stream = await env.AI.run(
    modelId as keyof AiModels,
    {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: true,
    }
  )

  return stream as unknown as ReadableStream
}

// ─── Parse JSON from LLM Output ─────────────────────────────────────────────
// LLMs sometimes wrap JSON in markdown code fences

export function parseJSON<T>(text: string): T | null {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```json?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Try to extract JSON from surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T
      } catch {
        return null
      }
    }
    return null
  }
}
