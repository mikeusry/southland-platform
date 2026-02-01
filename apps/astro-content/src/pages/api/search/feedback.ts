/**
 * Search Feedback API
 *
 * POST /api/search/feedback
 * Body: { searchId: string, helpful: boolean, query?: string }
 *
 * Captures "Was this helpful?" feedback for search results.
 */

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { searchId, helpful, query } = body;

    if (!searchId || typeof helpful !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'searchId and helpful (boolean) are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log to BigQuery
    await logFeedback(searchId, helpful, query);

    // Fire analytics event via pixel (client-side will also do this)
    // This is a backup for server-side tracking

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Feedback API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to record feedback' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * Log search feedback to BigQuery via webhook
 */
async function logFeedback(
  searchId: string,
  helpful: boolean,
  query?: string
): Promise<void> {
  const webhookUrl = import.meta.env.BIGQUERY_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('Search feedback (no webhook):', { searchId, helpful, query });
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'search_feedback',
        row: {
          search_id: searchId,
          helpful,
          query: query || null,
          timestamp: new Date().toISOString(),
        },
      }),
    });
  } catch (err) {
    console.error('Failed to log search feedback:', err);
  }
}
