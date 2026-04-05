import type { Env, BenchmarkResult } from './types'

// ─── Benchmark Handler ──────────────────────────────────────────────────────
// Phase 0: Measure real latency of bge-base vs bge-small
// Decision gate: if bge-base P99 > 500ms, fall back to bge-small
//
// Usage: GET /benchmark?queries=50
// Requires: AI binding configured

const TEST_QUERIES = [
  'how to reduce ammonia in chicken house',
  'poultry litter treatment application rate',
  'golf course turf disease organic solution',
  'lawn care natural fertilizer',
  'BioWash dilution ratio',
  'Poultry Guard per 1000 square feet',
  'organic soil amendment for agriculture',
  'D2 sanitizer commercial use',
  'pond odor control treatment',
  'shipping tracking order status',
  'what product for smelly chicken coop',
  'best fertilizer for bermuda grass golf course',
  'how often to apply litter treatment',
  'organic pest control for crops',
  'water treatment for golf course ponds',
]

const MODELS = {
  base: '@cf/baai/bge-base-en-v1.5',
  small: '@cf/baai/bge-small-en-v1.5',
} as const

export async function handleBenchmark(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  const url = new URL(request.url)
  const queryCount = Math.min(parseInt(url.searchParams.get('queries') || '20'), 100)
  const modelFilter = url.searchParams.get('model') // 'base', 'small', or null (both)

  const results: BenchmarkResult[] = []

  for (const [name, modelId] of Object.entries(MODELS)) {
    if (modelFilter && modelFilter !== name) continue

    const latencies: number[] = []
    let errors = 0

    for (let i = 0; i < queryCount; i++) {
      const query = TEST_QUERIES[i % TEST_QUERIES.length]
      const start = Date.now()

      try {
        await env.AI.run(modelId as '@cf/baai/bge-base-en-v1.5', { text: [query] })
        latencies.push(Date.now() - start)
      } catch (err) {
        errors++
        console.error(`Benchmark error for ${name}:`, err)
      }
    }

    if (latencies.length > 0) {
      latencies.sort((a, b) => a - b)
      const p50Index = Math.floor(latencies.length * 0.5)
      const p99Index = Math.floor(latencies.length * 0.99)

      results.push({
        model: `${name} (${modelId})`,
        queries: queryCount,
        p50_ms: latencies[p50Index],
        p99_ms: latencies[Math.min(p99Index, latencies.length - 1)],
        avg_ms: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
        errors,
      })
    }
  }

  // Decision recommendation
  const baseResult = results.find((r) => r.model.includes('base'))
  const smallResult = results.find((r) => r.model.includes('small'))
  let recommendation = 'Insufficient data for recommendation'

  if (baseResult && baseResult.p99_ms <= 500) {
    recommendation = `✅ USE bge-base-en-v1.5 — P99 ${baseResult.p99_ms}ms is within 500ms gate`
  } else if (baseResult && baseResult.p99_ms > 500 && smallResult) {
    recommendation = `⚠️ FALL BACK to bge-small-en-v1.5 — bge-base P99 ${baseResult.p99_ms}ms exceeds 500ms gate. bge-small P99: ${smallResult.p99_ms}ms`
  } else if (baseResult) {
    recommendation = `⚠️ bge-base P99 ${baseResult.p99_ms}ms exceeds 500ms gate. Run with ?model=small to test fallback.`
  }

  const allowed = env.ALLOWED_ORIGINS.split(',')
  const isAllowed = origin && allowed.includes(origin)

  return new Response(
    JSON.stringify({
      results,
      recommendation,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': isAllowed ? origin! : '',
      },
    }
  )
}
