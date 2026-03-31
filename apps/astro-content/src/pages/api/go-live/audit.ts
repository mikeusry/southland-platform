/**
 * Go-Live Audit API
 *
 * POST /api/go-live/audit
 * Body: { path: "/poultry/commercial/", archetype: "storybrand-landing", persona: "bill", referencePage: null }
 *
 * Fetches rendered HTML from the local dev/preview server, runs the audit pipeline.
 */
import type { APIRoute } from 'astro'
import { runAudit } from '../../../lib/services/page-audit'
import type { PageArchetype, PersonaId } from '../../../lib/services/page-audit'

interface AuditRequest {
  path: string
  archetype: PageArchetype
  persona: PersonaId
  referencePage: string | null
}

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()

  try {
    const body = (await request.json()) as AuditRequest

    if (!body.path || !body.archetype) {
      return new Response(
        JSON.stringify({ error: true, message: 'Missing path or archetype' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Fetch the rendered HTML from ourselves
    const origin = new URL(request.url).origin
    const pageUrl = new URL(body.path, origin).toString()
    const res = await fetch(pageUrl, { headers: { Accept: 'text/html' } })

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: true,
          message: `Page returned ${res.status}: ${body.path}`,
          httpStatus: res.status,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const html = await res.text()

    // Run audit
    const result = runAudit(html, {
      path: body.path,
      archetype: body.archetype,
      persona: body.persona || 'general',
      referencePage: body.referencePage,
    })

    const duration = Date.now() - startTime
    console.log(`[go-live] audited ${body.path}: ${result.overallGrade} (${result.verdict}) in ${duration}ms`)

    return new Response(
      JSON.stringify({ ...result, duration }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[go-live] audit error:', err)
    return new Response(
      JSON.stringify({ error: true, message: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
