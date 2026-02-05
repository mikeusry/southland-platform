/**
 * CDP Metrics API Endpoint
 *
 * GET /api/cdp/metrics?range=7d|30d|90d
 *
 * Returns aggregated CDP metrics for the dashboard.
 */

import type { APIRoute } from 'astro'
import type { CDPMetrics, TimeRange } from '../../../components/dashboard/types'

// Mock data generator - replace with BigQuery/KV fetch in production
function generateMockMetrics(range: TimeRange): CDPMetrics {
  // Scale factors based on time range
  const multiplier = range === '7d' ? 0.25 : range === '30d' ? 1 : 3

  return {
    lastUpdated: new Date().toISOString(),
    range,

    tunnels: {
      betty: {
        id: 'backyard',
        label: 'Backyard Betty',
        views: Math.round(12450 * multiplier),
        conversions: Math.round(847 * multiplier),
        conversionRate: 6.8,
        revenue: Math.round(65219 * multiplier),
        avgOrderValue: 77,
        trend: 12.3,
      },
      bill: {
        id: 'commercial',
        label: 'Broiler Bill',
        views: Math.round(3280 * multiplier),
        conversions: Math.round(156 * multiplier),
        conversionRate: 4.75,
        revenue: Math.round(140868 * multiplier),
        avgOrderValue: 903,
        trend: 8.7,
      },
      taylor: {
        id: 'lawn',
        label: 'Turf Pro Taylor',
        views: Math.round(2100 * multiplier),
        conversions: Math.round(89 * multiplier),
        conversionRate: 4.24,
        revenue: Math.round(12460 * multiplier),
        avgOrderValue: 140,
        trend: -2.1,
      },
    },

    abTests: {
      tunnelVsGeneric: {
        testId: 'homepage-tunnel-ab',
        status: 'running',
        startDate: '2025-01-15',
        sampleSize: Math.round(18500 * multiplier),
        control: {
          variant: 'generic',
          visitors: Math.round(9250 * multiplier),
          conversions: Math.round(324 * multiplier),
          conversionRate: 3.5,
          revenue: Math.round(24948 * multiplier),
        },
        treatment: {
          variant: 'tunnel',
          visitors: Math.round(9250 * multiplier),
          conversions: Math.round(509 * multiplier),
          conversionRate: 5.5,
          revenue: Math.round(44287 * multiplier),
          lift: 57.1,
        },
        confidence: 98.7,
        winner: 'treatment',
      },
    },

    personaDistribution: [
      {
        persona: 'backyard',
        label: 'Backyard Betty',
        count: Math.round(5234 * multiplier),
        percentage: 42,
        color: '#f59e0b',
      },
      {
        persona: 'commercial',
        label: 'Broiler Bill',
        count: Math.round(5483 * multiplier),
        percentage: 44,
        color: '#22c55e',
      },
      {
        persona: 'lawn',
        label: 'Turf Pro Taylor',
        count: Math.round(997 * multiplier),
        percentage: 8,
        color: '#10b981',
      },
      {
        persona: 'general',
        label: 'Unassigned',
        count: Math.round(747 * multiplier),
        percentage: 6,
        color: '#94a3b8',
      },
    ],

    journeyFunnel: [
      {
        stage: 'unaware',
        label: 'New Visitors',
        count: Math.round(18500 * multiplier),
        percentage: 100,
      },
      {
        stage: 'aware',
        label: 'Problem Aware',
        count: Math.round(12950 * multiplier),
        percentage: 70,
      },
      {
        stage: 'receptive',
        label: 'Learning',
        count: Math.round(7400 * multiplier),
        percentage: 40,
      },
      { stage: 'zmot', label: 'Researching', count: Math.round(4625 * multiplier), percentage: 25 },
      {
        stage: 'objections',
        label: 'Has Questions',
        count: Math.round(2775 * multiplier),
        percentage: 15,
      },
      {
        stage: 'test_prep',
        label: 'Ready to Try',
        count: Math.round(1850 * multiplier),
        percentage: 10,
      },
      {
        stage: 'challenge',
        label: 'New Customer',
        count: Math.round(1092 * multiplier),
        percentage: 5.9,
      },
      {
        stage: 'success',
        label: 'Seeing Results',
        count: Math.round(555 * multiplier),
        percentage: 3,
      },
      {
        stage: 'commitment',
        label: 'Loyal Customer',
        count: Math.round(277 * multiplier),
        percentage: 1.5,
      },
      {
        stage: 'evangelist',
        label: 'Advocates',
        count: Math.round(92 * multiplier),
        percentage: 0.5,
      },
    ],
  }
}

export const GET: APIRoute = async ({ url }) => {
  const range = (url.searchParams.get('range') || '30d') as TimeRange

  if (!['7d', '30d', '90d'].includes(range)) {
    return new Response(JSON.stringify({ error: 'Invalid range. Use 7d, 30d, or 90d' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // TODO: Replace with real data fetch from BigQuery/KV
    const metrics = generateMockMetrics(range)

    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (error) {
    console.error('CDP Metrics API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch metrics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
