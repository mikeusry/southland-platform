/**
 * Batch Blog Persona Scoring
 *
 * POST /api/site-audit/scan-blog
 *
 * Scores all blog posts through Mothership persona vectors.
 * Stores results alongside tag heuristic for comparison.
 * Used to build persona-blog-map.json.
 */
import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { scorePersonas } from '../../../lib/services/mothership'
import { inferPersonaFromBlog } from '../../../lib/persona-inference'

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()

  try {
    const { limit = 20, offset = 0 } = (await request.json().catch(() => ({}))) as {
      limit?: number
      offset?: number
    }

    let entries: any[] = []
    try {
      entries = await getCollection('blog', ({ data }: any) => data.draft !== true)
    } catch {
      entries = await getCollection('blog')
    }

    // Sort by date desc for consistent ordering
    entries.sort((a: any, b: any) =>
      new Date(b.data.publishDate).getTime() - new Date(a.data.publishDate).getTime()
    )

    const total = entries.length
    const batch = entries.slice(offset, offset + limit)
    const results: any[] = []

    for (const entry of batch) {
      const slug = entry.id.replace(/\.mdx?$/, '')
      const contentText = `${entry.data.title}\n\n${entry.data.description || ''}\n\n${(entry.body || '').slice(0, 4000)}`

      // Tag heuristic
      const heuristic = inferPersonaFromBlog(entry.data.tags || [], entry.data.segment || 'general')

      // Vector scoring
      let vector = null
      try {
        const raw = await scorePersonas(contentText)
        if (raw) {
          vector = {
            primary: raw.primary.name,
            primarySlug: raw.primary.slug,
            score: Math.round(raw.primary.score * 100),
            scores: {
              bill: Math.round(raw.scores.broilerBill * 100),
              betty: Math.round(raw.scores.backyardBetty * 100),
              taylor: Math.round(raw.scores.turfTaylor * 100),
            },
            aligned: raw.aligned,
          }
        }
      } catch (err) {
        console.error(`[scan-blog] scorePersonas failed for ${slug}:`, err)
      }

      results.push({
        slug,
        title: entry.data.title,
        tags: entry.data.tags || [],
        segment: entry.data.segment || 'general',
        publishDate: entry.data.publishDate,
        heuristic: heuristic ? { persona: heuristic.persona, source: heuristic.source } : null,
        vector,
      })

      // Small delay to avoid rate limiting
      if (batch.indexOf(entry) < batch.length - 1) {
        await new Promise((r) => setTimeout(r, 200))
      }
    }

    const duration = Date.now() - startTime
    console.log(`[scan-blog] scored ${results.length} posts in ${duration}ms (offset=${offset}, limit=${limit}, total=${total})`)

    return new Response(
      JSON.stringify({
        total,
        offset,
        limit,
        scored: results.length,
        remaining: total - offset - results.length,
        duration,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[scan-blog] error:', err)
    return new Response(
      JSON.stringify({ error: true, message: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
