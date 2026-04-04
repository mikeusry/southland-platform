/**
 * BigQuery client for Astro admin analytics (storefront telemetry)
 *
 * Queries cdp.pixel_events for sessions, page views, conversions.
 * Supports GCP_SERVICE_ACCOUNT_JSON (Cloudflare Workers) and
 * GOOGLE_APPLICATION_CREDENTIALS (local development).
 */

import { BigQuery } from '@google-cloud/bigquery'

const PROJECT_ID = 'southland-warehouse'

let _client: BigQuery | null = null

function getClient(): BigQuery | null {
  if (_client) return _client

  const jsonCreds = import.meta.env.GCP_SERVICE_ACCOUNT_JSON || process.env.GCP_SERVICE_ACCOUNT_JSON
  if (jsonCreds) {
    try {
      const credentials = JSON.parse(jsonCreds)
      _client = new BigQuery({ projectId: PROJECT_ID, credentials })
      return _client
    } catch { return null }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    _client = new BigQuery({ projectId: PROJECT_ID })
    return _client
  }

  return null
}

export interface DailySessionStats {
  date: string
  sessions: number
  pageViews: number
  uniqueVisitors: number
}

export interface TopPage {
  path: string
  views: number
  uniqueVisitors: number
  avgScrollDepth: number | null
}

export interface ConversionFunnel {
  pageViews: number
  productViews: number
  addToCart: number
  beginCheckout: number
  purchases: number
  purchaseValue: number
}

export interface TrafficSource {
  source: string
  medium: string
  sessions: number
  pageViews: number
  conversions: number
}

export interface AnalyticsData {
  dailySessions: DailySessionStats[]
  topPages: TopPage[]
  funnel: ConversionFunnel
  trafficSources: TrafficSource[]
  totalSessions7d: number
  totalSessions30d: number
  available: boolean
}

export async function fetchAnalytics(days: number = 30): Promise<AnalyticsData> {
  const bq = getClient()
  if (!bq) {
    return {
      dailySessions: [], topPages: [], funnel: { pageViews: 0, productViews: 0, addToCart: 0, beginCheckout: 0, purchases: 0, purchaseValue: 0 },
      trafficSources: [], totalSessions7d: 0, totalSessions30d: 0, available: false,
    }
  }

  try {
    const since = `DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)`

    const [dailyRows, pageRows, funnelRows, sourceRows] = await Promise.all([
      // Daily sessions
      bq.query({
        query: `
          SELECT
            DATE(event_timestamp) as date,
            COUNT(DISTINCT session_id) as sessions,
            COUNT(*) as page_views,
            COUNT(DISTINCT pd_user_id) as unique_visitors
          FROM \`${PROJECT_ID}.cdp.pixel_events\`
          WHERE DATE(event_timestamp) >= ${since}
            AND event_type = 'page_view'
            AND brand_id = 'southland'
          GROUP BY date
          ORDER BY date DESC
        `,
      }).then(r => r[0]),

      // Top pages
      bq.query({
        query: `
          SELECT
            page_path as path,
            COUNT(*) as views,
            COUNT(DISTINCT pd_user_id) as unique_visitors,
            AVG(scroll_depth) as avg_scroll_depth
          FROM \`${PROJECT_ID}.cdp.pixel_events\`
          WHERE DATE(event_timestamp) >= ${since}
            AND event_type = 'page_view'
            AND brand_id = 'southland'
          GROUP BY page_path
          ORDER BY views DESC
          LIMIT 20
        `,
      }).then(r => r[0]),

      // Conversion funnel
      bq.query({
        query: `
          SELECT
            COUNTIF(event_type = 'page_view') as page_views,
            COUNTIF(event_type = 'product_view') as product_views,
            COUNTIF(event_type = 'add_to_cart') as add_to_cart,
            COUNTIF(event_type = 'begin_checkout') as begin_checkout,
            COUNTIF(event_type = 'purchase') as purchases,
            SUM(IF(event_type = 'purchase', order_value, 0)) as purchase_value
          FROM \`${PROJECT_ID}.cdp.pixel_events\`
          WHERE DATE(event_timestamp) >= ${since}
            AND brand_id = 'southland'
        `,
      }).then(r => r[0]),

      // Traffic sources
      bq.query({
        query: `
          SELECT
            COALESCE(utm_source, CASE
              WHEN referrer LIKE '%google%' THEN 'google'
              WHEN referrer LIKE '%facebook%' THEN 'facebook'
              WHEN referrer LIKE '%bing%' THEN 'bing'
              WHEN referrer IS NULL OR referrer = '' THEN '(direct)'
              ELSE 'referral'
            END) as source,
            COALESCE(utm_medium, 'organic') as medium,
            COUNT(DISTINCT session_id) as sessions,
            COUNT(*) as page_views,
            COUNTIF(event_type = 'purchase') as conversions
          FROM \`${PROJECT_ID}.cdp.pixel_events\`
          WHERE DATE(event_timestamp) >= ${since}
            AND brand_id = 'southland'
          GROUP BY source, medium
          ORDER BY sessions DESC
          LIMIT 15
        `,
      }).then(r => r[0]),
    ])

    const dailySessions: DailySessionStats[] = dailyRows.map((r: any) => ({
      date: r.date?.value || r.date,
      sessions: Number(r.sessions) || 0,
      pageViews: Number(r.page_views) || 0,
      uniqueVisitors: Number(r.unique_visitors) || 0,
    }))

    const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const sessions7d = dailySessions.filter(d => d.date >= d7).reduce((s, d) => s + d.sessions, 0)
    const sessions30d = dailySessions.reduce((s, d) => s + d.sessions, 0)

    const topPages: TopPage[] = pageRows.map((r: any) => ({
      path: r.path || '/',
      views: Number(r.views) || 0,
      uniqueVisitors: Number(r.unique_visitors) || 0,
      avgScrollDepth: r.avg_scroll_depth ? Math.round(Number(r.avg_scroll_depth)) : null,
    }))

    const f = funnelRows[0] || {}
    const funnel: ConversionFunnel = {
      pageViews: Number(f.page_views) || 0,
      productViews: Number(f.product_views) || 0,
      addToCart: Number(f.add_to_cart) || 0,
      beginCheckout: Number(f.begin_checkout) || 0,
      purchases: Number(f.purchases) || 0,
      purchaseValue: Math.round((Number(f.purchase_value) || 0) * 100) / 100,
    }

    const trafficSources: TrafficSource[] = sourceRows.map((r: any) => ({
      source: r.source || '(unknown)',
      medium: r.medium || 'none',
      sessions: Number(r.sessions) || 0,
      pageViews: Number(r.page_views) || 0,
      conversions: Number(r.conversions) || 0,
    }))

    return { dailySessions, topPages, funnel, trafficSources, totalSessions7d: sessions7d, totalSessions30d: sessions30d, available: true }
  } catch (err) {
    console.error('[analytics] BigQuery query failed:', err)
    return {
      dailySessions: [], topPages: [], funnel: { pageViews: 0, productViews: 0, addToCart: 0, beginCheckout: 0, purchases: 0, purchaseValue: 0 },
      trafficSources: [], totalSessions7d: 0, totalSessions30d: 0, available: false,
    }
  }
}
