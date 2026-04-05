import type { Env } from '../types'

// ─── Model Configuration ────────────────────────────────────────────────────
// Dual model strategy: 8B for speed, 70B for safety

// Workers AI model IDs — types package may lag behind actual availability.
// Cast through string to avoid type errors when CF adds new models.
export const LLM_MODELS = {
  fast: '@cf/meta/llama-3.1-8b-instruct' as string,    // Drafts, chat, classification, answerability
  quality: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as string, // Verify, escalation, autonomy QA
}

export type ModelTier = 'fast' | 'quality'

// ─── Generate Text ──────────────────────────────────────────────────────────

export interface LLMOptions {
  model?: ModelTier
  temperature?: number // Default 0.2 for support, 0.7 for chat
  max_tokens?: number // Default 300
  stream?: boolean
}

export interface LLMResult {
  text: string
  model: string
  latency_ms: number
}

export async function generate(
  env: Env,
  system: string,
  user: string,
  options: LLMOptions = {}
): Promise<LLMResult> {
  const { model = 'fast', temperature = 0.2, max_tokens = 300 } = options
  const modelId = LLM_MODELS[model]
  const start = Date.now()

  const result = await env.AI.run(
    modelId as keyof AiModels,
    {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens,
    }
  ) as { response?: string }

  const text = result?.response ? String(result.response) : ''

  return {
    text,
    model: modelId,
    latency_ms: Date.now() - start,
  }
}

// ─── Generate Streaming (SSE) ───────────────────────────────────────────────
// For chat widget (Phase 5.4)

export async function generateStream(
  env: Env,
  system: string,
  user: string,
  options: LLMOptions = {}
): Promise<ReadableStream> {
  const { model = 'fast', temperature = 0.3, max_tokens = 300 } = options
  const modelId = LLM_MODELS[model]

  const stream = await env.AI.run(
    modelId as keyof AiModels,
    {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens,
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
