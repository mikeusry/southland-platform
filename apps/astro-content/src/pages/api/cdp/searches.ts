/**
 * CDP Search Queries API Endpoint
 *
 * GET /api/cdp/searches?limit=20
 *
 * Returns top search queries with result counts.
 */

import type { APIRoute } from 'astro';
import type { SearchQuery } from '../../../components/dashboard/types';

const mockSearches: SearchQuery[] = [
  { query: 'big ole bird', count: 342, avgResults: 5, zeroResultRate: 0 },
  { query: 'litter life', count: 287, avgResults: 4, zeroResultRate: 0 },
  { query: 'chicken sick', count: 156, avgResults: 12, zeroResultRate: 2.1 },
  { query: 'fcr improvement', count: 134, avgResults: 8, zeroResultRate: 0 },
  { query: 'broiler house', count: 98, avgResults: 15, zeroResultRate: 0 },
  { query: 'backyard chickens', count: 87, avgResults: 24, zeroResultRate: 0 },
  { query: 'gut health', count: 76, avgResults: 6, zeroResultRate: 0 },
  { query: 'ammonia control', count: 65, avgResults: 4, zeroResultRate: 5.2 },
  { query: 'organic fertilizer', count: 54, avgResults: 8, zeroResultRate: 0 },
  { query: 'water treatment', count: 48, avgResults: 3, zeroResultRate: 0 },
  { query: 'hen helper', count: 45, avgResults: 3, zeroResultRate: 0 },
  { query: 'poultry probiotics', count: 42, avgResults: 7, zeroResultRate: 0 },
  { query: 'lawn care organic', count: 38, avgResults: 5, zeroResultRate: 0 },
  { query: 'layer health', count: 35, avgResults: 9, zeroResultRate: 0 },
  { query: 'soil amendment', count: 32, avgResults: 4, zeroResultRate: 3.1 },
];

export const GET: APIRoute = async ({ url }) => {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

  try {
    const searches = mockSearches.slice(0, limit);

    return new Response(JSON.stringify({
      searches,
      totalUniqueQueries: 1247,
      totalSearches: 4823,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch searches' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
