/**
 * Video Transcript Search API
 * Searches raw_transcript text in voice_videos table
 *
 * GET /api/video-search?q=water+lines
 */
import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q')?.trim()

  if (!query) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = import.meta.env.MOTHERSHIP_SUPABASE_URL
  const supabaseKey = import.meta.env.MOTHERSHIP_SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Search transcripts using ilike for each word (AND logic)
  const words = query.split(/\s+/).filter(Boolean)
  let queryBuilder = supabase
    .from('voice_videos')
    .select('id, title, raw_transcript')
    .eq('source_platform', 'mux')
    .not('raw_transcript', 'is', null)

  for (const word of words) {
    queryBuilder = queryBuilder.ilike('raw_transcript', `%${word}%`)
  }

  const { data, error } = await queryBuilder.limit(50)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Extract snippets around the first match
  const results = (data || []).map((row) => {
    const transcript = row.raw_transcript || ''
    const lowerTranscript = transcript.toLowerCase()
    const firstWord = words[0].toLowerCase()
    const idx = lowerTranscript.indexOf(firstWord)
    const start = Math.max(0, idx - 60)
    const end = Math.min(transcript.length, idx + firstWord.length + 100)
    const snippet = transcript.slice(start, end).trim()

    return {
      video_id: row.id,
      title: row.title,
      snippet,
    }
  })

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
