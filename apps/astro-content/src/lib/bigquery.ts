/**
 * BigQuery REST API client for Cloudflare Workers / Astro SSR
 *
 * Uses raw fetch() + JWT auth instead of @google-cloud/bigquery
 * (which requires Node.js fs/child_process not available in Workers).
 *
 * Auth: GCP_SERVICE_ACCOUNT_JSON env var → self-signed JWT → access token
 */

const PROJECT_ID = 'southland-warehouse'
const BQ_API = 'https://bigquery.googleapis.com/bigquery/v2'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/bigquery.readonly'

interface ServiceAccount {
  client_email: string
  private_key: string
  token_uri: string
}

let _cachedToken: { token: string; expires: number } | null = null

function base64url(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function createJWT(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }

  const headerB64 = base64url(JSON.stringify(header))
  const payloadB64 = base64url(JSON.stringify(payload))
  const unsigned = `${headerB64}.${payloadB64}`

  // Import private key and sign
  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  )

  const sigB64 = base64url(String.fromCharCode(...new Uint8Array(signature)))
  return `${unsigned}.${sigB64}`
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (_cachedToken && _cachedToken.expires > Date.now()) {
    return _cachedToken.token
  }

  const jwt = await createJWT(sa)

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!resp.ok) {
    throw new Error(`Token exchange failed: ${resp.status} ${await resp.text()}`)
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number }
  _cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  }
  return data.access_token
}

async function query(sql: string, sa: ServiceAccount): Promise<any[]> {
  const token = await getAccessToken(sa)

  const resp = await fetch(`${BQ_API}/projects/${PROJECT_ID}/queries`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: sql,
      useLegacySql: false,
      maxResults: 1000,
    }),
  })

  if (!resp.ok) {
    throw new Error(`BigQuery query failed: ${resp.status} ${await resp.text()}`)
  }

  const result = (await resp.json()) as any

  if (!result.rows) return []

  const fields = result.schema.fields.map((f: any) => f.name)
  return result.rows.map((row: any) =>
    Object.fromEntries(fields.map((f: string, i: number) => [f, row.f[i].v]))
  )
}

// ============================================================================
// Public API
// ============================================================================

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

function getServiceAccount(): ServiceAccount | null {
  const json =
    import.meta.env.GCP_SERVICE_ACCOUNT_JSON ||
    (typeof process !== 'undefined' && process.env?.GCP_SERVICE_ACCOUNT_JSON)
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export async function fetchAnalytics(days: number = 30): Promise<AnalyticsData> {
  const sa = getServiceAccount()
  if (!sa) {
    return {
      dailySessions: [],
      topPages: [],
      funnel: {
        pageViews: 0,
        productViews: 0,
        addToCart: 0,
        beginCheckout: 0,
        purchases: 0,
        purchaseValue: 0,
      },
      trafficSources: [],
      totalSessions7d: 0,
      totalSessions30d: 0,
      available: false,
    }
  }

  try {
    const since = `DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)`

    const [dailyRows, pageRows, funnelRows, sourceRows] = await Promise.all([
      query(
        `
        SELECT
          FORMAT_DATE('%Y-%m-%d', DATE(event_timestamp)) as date,
          COUNT(DISTINCT session_id) as sessions,
          COUNT(*) as page_views,
          COUNT(DISTINCT pd_user_id) as unique_visitors
        FROM \`${PROJECT_ID}.cdp.pixel_events\`
        WHERE DATE(event_timestamp) >= ${since}
          AND event_type = 'page_view' AND brand_id = 'southland'
        GROUP BY date ORDER BY date DESC
      `,
        sa
      ),

      query(
        `
        SELECT
          page_path as path, COUNT(*) as views,
          COUNT(DISTINCT pd_user_id) as unique_visitors,
          AVG(scroll_depth) as avg_scroll_depth
        FROM \`${PROJECT_ID}.cdp.pixel_events\`
        WHERE DATE(event_timestamp) >= ${since}
          AND event_type = 'page_view' AND brand_id = 'southland'
        GROUP BY page_path ORDER BY views DESC LIMIT 20
      `,
        sa
      ),

      query(
        `
        SELECT
          COUNTIF(event_type = 'page_view') as page_views,
          COUNTIF(event_type = 'product_view') as product_views,
          COUNTIF(event_type = 'add_to_cart') as add_to_cart,
          COUNTIF(event_type = 'begin_checkout') as begin_checkout,
          COUNTIF(event_type = 'purchase') as purchases,
          SUM(IF(event_type = 'purchase', order_value, 0)) as purchase_value
        FROM \`${PROJECT_ID}.cdp.pixel_events\`
        WHERE DATE(event_timestamp) >= ${since} AND brand_id = 'southland'
      `,
        sa
      ),

      query(
        `
        SELECT
          COALESCE(utm_source, CASE
            WHEN referrer LIKE '%google%' THEN 'google'
            WHEN referrer LIKE '%facebook%' THEN 'facebook'
            WHEN referrer IS NULL OR referrer = '' THEN '(direct)'
            ELSE 'referral'
          END) as source,
          COALESCE(utm_medium, 'organic') as medium,
          COUNT(DISTINCT session_id) as sessions,
          COUNT(*) as page_views,
          COUNTIF(event_type = 'purchase') as conversions
        FROM \`${PROJECT_ID}.cdp.pixel_events\`
        WHERE DATE(event_timestamp) >= ${since} AND brand_id = 'southland'
        GROUP BY source, medium ORDER BY sessions DESC LIMIT 15
      `,
        sa
      ),
    ])

    const dailySessions: DailySessionStats[] = dailyRows.map((r: any) => ({
      date: r.date,
      sessions: Number(r.sessions) || 0,
      pageViews: Number(r.page_views) || 0,
      uniqueVisitors: Number(r.unique_visitors) || 0,
    }))

    const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const sessions7d = dailySessions.filter((d) => d.date >= d7).reduce((s, d) => s + d.sessions, 0)
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

    return {
      dailySessions,
      topPages,
      funnel,
      trafficSources,
      totalSessions7d: sessions7d,
      totalSessions30d: sessions30d,
      available: true,
    }
  } catch (err) {
    console.error('[analytics] BigQuery query failed:', err)
    return {
      dailySessions: [],
      topPages: [],
      funnel: {
        pageViews: 0,
        productViews: 0,
        addToCart: 0,
        beginCheckout: 0,
        purchases: 0,
        purchaseValue: 0,
      },
      trafficSources: [],
      totalSessions7d: 0,
      totalSessions30d: 0,
      available: false,
    }
  }
}
