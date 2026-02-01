/**
 * Semantic Search API
 *
 * POST /api/search
 * Body: { query: string, options?: { contentTypes?, maxResults? } }
 *
 * Returns blended results from content and products using vector similarity.
 */

import type { APIRoute } from 'astro';
import { semanticSearch } from '../../lib/search';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { query, options = {} } = body;

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Perform semantic search
    const results = await semanticSearch(query.trim(), {
      contentTypes: options.contentTypes,
      matchThreshold: options.matchThreshold ?? 0.65,
      maxContentResults: options.maxContentResults ?? 5,
      maxProductResults: options.maxProductResults ?? 3,
    });

    // Log to BigQuery (non-blocking)
    logSearchEvent(results.searchId, query, results.totalCount).catch(console.error);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return new Response(
      JSON.stringify({ error: 'Search failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// GET handler for simple queries
export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q');

  if (!query) {
    return new Response(
      JSON.stringify({ error: 'Query parameter "q" is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const results = await semanticSearch(query.trim());

    // Log to BigQuery (non-blocking)
    logSearchEvent(results.searchId, query, results.totalCount).catch(console.error);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return new Response(
      JSON.stringify({ error: 'Search failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * Log search event to BigQuery via webhook
 */
async function logSearchEvent(
  searchId: string,
  query: string,
  resultsCount: number
): Promise<void> {
  const webhookUrl = import.meta.env.BIGQUERY_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'search_events',
        row: {
          search_id: searchId,
          query,
          results_count: resultsCount,
          timestamp: new Date().toISOString(),
          source: 'website',
        },
      }),
    });
  } catch (err) {
    console.error('Failed to log search event:', err);
  }
}
