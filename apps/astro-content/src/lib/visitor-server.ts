/**
 * Server-side visitor read (Astro SSR).
 *
 * Reads the persona the measurement engine scored for this anonymous visitor,
 * so the homepage can render persona-flavored copy server-side (no flash of
 * default content). Phase 1 of the persona activation plan.
 *
 * The id is the `_pd_uid` cookie set by the pd-pixel client (cookie-first,
 * localStorage fallback). It keys `visitor:{id}` in the consumer worker's KV.
 *
 * Design contract: ANY failure (no cookie, 404, timeout, bad JSON, low
 * confidence) returns null → the caller renders the generic homepage. A first
 * time visitor, an article-reader with no clear intent, or a worker outage all
 * degrade to the same clean default. Personalization only kicks in for a
 * confidently-scored visitor.
 */

const CONSUMER_URL =
  import.meta.env.PUBLIC_PERSONA_WORKER_URL ||
  'https://persona-consumer.point-dog-digital.workers.dev'

// Match hasConfidentPersona()'s default. A visitor must clear this before we
// swap the homepage; everyone below it gets the generic page.
const CONFIDENCE_THRESHOLD = 0.6

// Don't let a slow/dead worker delay the page. If it can't answer in time the
// visitor gets the generic homepage — the correct fallback anyway. Set above
// the worker's observed warm+cold latency (~0.4s cold) with headroom, but low
// enough not to meaningfully hurt TTFB on a confident-persona render.
const FETCH_TIMEOUT_MS = 1500

export type DetectedPersona =
  | 'bill'
  | 'betty'
  | 'bob'
  | 'tom'
  | 'greg'
  | 'taylor'
  | 'gary'
  | 'hannah'
  | 'maggie'
  | 'sam'
  | 'general'

interface VisitorResponse {
  predicted_persona: DetectedPersona
  persona_confidence: number
  explicit_persona?: DetectedPersona
  predicted_segment?: string
  current_stage?: string
}

/**
 * Resolve the persona to render for this request, or null for the generic
 * homepage. Explicit choice (Decision Engine) always wins over a detected
 * one; otherwise the detected persona must clear the confidence threshold.
 */
export async function resolveHomepagePersona(
  anonId: string | undefined
): Promise<DetectedPersona | null> {
  if (!anonId) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(`${CONSUMER_URL}/visitor/${encodeURIComponent(anonId)}`, {
      signal: controller.signal,
    })
    if (!res.ok) return null // 404 = not scored yet → generic

    const visitor = (await res.json()) as VisitorResponse

    // Explicit choice (homepage segment selector / Decision Engine) overrides.
    const explicit = visitor.explicit_persona
    if (explicit && explicit !== 'general') return explicit

    const persona = visitor.predicted_persona
    if (!persona || persona === 'general') return null
    if (visitor.persona_confidence < CONFIDENCE_THRESHOLD) return null

    return persona
  } catch {
    // Timeout, network error, bad JSON — all degrade to generic.
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Map a detected persona to the homepage copy variant key. Returns null for
 * personas with no dedicated homepage copy (they get the default copy but may
 * still get a flavored product grid upstream if the caller wants it).
 *
 * The homepage content collection only ships three persona copy variants today
 * (backyard/commercial/lawn). Personas roll up to the nearest available one by
 * segment: poultry→commercial or backyard, turf→lawn. Waste (sam) has no
 * variant yet → default.
 */
export function personaToCopyVariant(
  persona: DetectedPersona | null
): 'backyard' | 'commercial' | 'lawn' | null {
  switch (persona) {
    case 'betty':
      return 'backyard'
    case 'bill':
    case 'bob':
    case 'tom':
    case 'greg':
      return 'commercial'
    case 'taylor':
    case 'gary':
    case 'hannah':
    case 'maggie':
      return 'lawn'
    default:
      return null
  }
}
