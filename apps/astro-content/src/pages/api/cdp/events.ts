/**
 * CDP Events API Endpoint
 *
 * GET /api/cdp/events?limit=50&offset=0&type=persona_path_selected
 *
 * Returns recent CDP events.
 */

import type { APIRoute } from 'astro';
import type { CDPEvent } from '../../../components/dashboard/types';

const eventTypes = [
  'persona_path_selected',
  'tunnel_viewed',
  'ab_test_exposure',
  'ab_test_conversion',
  'sales_outcome_logged',
  'survey_submitted',
  'search_performed',
  'product_clicked',
  'hero_cta_clicked',
];

const personas = ['backyard', 'commercial', 'lawn', null];
const stages = ['aware', 'receptive', 'zmot', 'objections', 'test_prep', 'challenge'];

function generateMockEvents(limit: number): CDPEvent[] {
  return Array.from({ length: limit }, (_, i) => ({
    id: `evt_${Date.now()}_${i}`,
    timestamp: new Date(Date.now() - i * 60000 * Math.random() * 10).toISOString(),
    type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
    persona: personas[Math.floor(Math.random() * personas.length)],
    stage: stages[Math.floor(Math.random() * stages.length)],
    properties: {
      page_url: ['/poultry/backyard/', '/shop/', '/products/hen-helper/', '/'][Math.floor(Math.random() * 4)],
      variant: Math.random() > 0.5 ? 'tunnel' : 'generic',
    },
  })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export const GET: APIRoute = async ({ url }) => {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const type = url.searchParams.get('type');

  try {
    let events = generateMockEvents(limit + offset + 20);

    if (type) {
      events = events.filter(e => e.type === type);
    }

    return new Response(JSON.stringify({
      events: events.slice(offset, offset + limit),
      total: events.length,
      hasMore: events.length > offset + limit,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch events' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
