/**
 * Go-Live Deep Audit API — Layers 2 + 3
 *
 * POST /api/go-live/deep-audit
 * Body: { path: "/poultry/commercial/", persona: "bill" }
 *
 * Runs external API calls:
 *   Layer 2: Originality.ai (AI detection + plagiarism)
 *   Layer 3: Mothership persona vectors + brand voice transcript similarity
 *
 * Returns AuditCategory objects for originality and voice that can be
 * merged into the existing Layer 1 audit result on the client.
 */
import type { APIRoute } from 'astro'
import type { AuditCategory, AuditCheck, Grade } from '../../../lib/services/page-audit'
import { checkOriginality } from '../../../lib/services/originality'
import { scorePersonas, scoreBrandVoice } from '../../../lib/services/mothership'

function gradeFromChecks(checks: AuditCheck[]): Grade {
  const fails = checks.filter(c => c.status === 'fail').length
  const warns = checks.filter(c => c.status === 'warn').length
  if (fails === 0 && warns === 0) return 'A'
  if (fails === 0 && warns <= 2) return 'B'
  if (fails <= 1) return 'C'
  if (fails <= 3) return 'D'
  return 'F'
}

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()

  try {
    const body = await request.json() as { path: string; persona: string; bodyText?: string }

    if (!body.path) {
      return new Response(
        JSON.stringify({ error: true, message: 'Missing path' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // If bodyText not provided, fetch the page and extract it
    let bodyText = body.bodyText
    if (!bodyText) {
      const origin = new URL(request.url).origin
      const res = await fetch(new URL(body.path, origin).toString(), { headers: { Accept: 'text/html' } })
      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: true, message: `Page returned ${res.status}` }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      const html = await res.text()
      // Extract body text
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      const rawBody = mainMatch ? mainMatch[1] : html
      bodyText = rawBody
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Run Layer 2 + 3 in parallel
    const [originalityResult, personaResult, voiceResult] = await Promise.all([
      checkOriginality(bodyText),
      scorePersonas(bodyText, undefined, 'southland-organics'),
      scoreBrandVoice(bodyText),
    ])

    // Build Layer 2: Originality — only show if actually ran (not skipped)
    const origChecks: AuditCheck[] = []
    const origSkipped = originalityResult.originality.skipped && originalityResult.aiDetection.skipped

    if (!originalityResult.originality.skipped) {
      origChecks.push({
        label: `Originality score (target: 90%+)`,
        status: originalityResult.originality.passed ? 'pass' : 'warn',
        detail: `${originalityResult.originality.score}% original`,
      })
    }

    if (!originalityResult.aiDetection.skipped) {
      origChecks.push({
        label: `AI detection (target: <50% AI)`,
        status: originalityResult.aiDetection.passed ? 'pass' : 'warn',
        detail: `${originalityResult.aiDetection.aiProbability}% AI, ${originalityResult.aiDetection.humanProbability}% human — ${originalityResult.aiDetection.classification}`,
      })
    }

    const originality: AuditCategory | null = origSkipped ? null : {
      name: 'Originality',
      grade: gradeFromChecks(origChecks),
      checks: origChecks,
    }

    // Build Layer 3: Persona + Voice alignment (vector-based)
    const voiceChecks: AuditCheck[] = []

    // Persona vector scoring
    if (personaResult) {
      const pScore = Math.round(personaResult.primary.score * 100)
      voiceChecks.push({
        label: `Persona alignment: ${personaResult.primary.name}`,
        status: pScore >= 60 ? 'pass' : pScore >= 40 ? 'warn' : 'fail',
        detail: `${pScore}% match` +
          (personaResult.recommendation ? ` — ${personaResult.recommendation}` : ''),
      })

      // Show all persona scores
      const scoreEntries = Object.entries(personaResult.scores)
        .map(([k, v]) => `${k}: ${Math.round((v as number) * 100)}%`)
        .join(', ')
      voiceChecks.push({
        label: 'Persona breakdown',
        status: 'pass',
        detail: scoreEntries,
      })
    } else {
      voiceChecks.push({
        label: 'Persona alignment',
        status: 'warn',
        detail: 'Persona scoring unavailable — check Mothership connection',
      })
    }

    // Brand voice transcript alignment
    if (voiceResult.available) {
      voiceChecks.push({
        label: `Brand voice alignment (target: 60%+)`,
        status: voiceResult.alignment >= 60 ? 'pass' : voiceResult.alignment >= 40 ? 'warn' : 'fail',
        detail: `${voiceResult.alignment}% match to Southland transcript library`,
      })

      // Top transcript matches
      if (voiceResult.topMatches.length > 0) {
        const matchList = voiceResult.topMatches
          .slice(0, 3)
          .map(m => `${m.videoTitle} (${m.similarity}%)`)
          .join('; ')
        voiceChecks.push({
          label: 'Closest voice samples',
          status: 'pass',
          detail: matchList,
        })
      }
    } else {
      voiceChecks.push({
        label: 'Brand voice alignment',
        status: 'warn',
        detail: 'Voice scoring unavailable — run embed-chunks.js in mothership',
      })
    }

    const voiceDeep: AuditCategory = {
      name: 'Voice (Deep)',
      grade: gradeFromChecks(voiceChecks),
      checks: voiceChecks,
    }

    const duration = Date.now() - startTime
    console.log(`[go-live] deep audit ${body.path}: orig=${originality?.grade ?? 'skipped'} voice=${voiceDeep.grade} in ${duration}ms`)

    return new Response(
      JSON.stringify({
        path: body.path,
        originality,
        voiceDeep,
        duration,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[go-live] deep audit error:', err)
    return new Response(
      JSON.stringify({ error: true, message: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
