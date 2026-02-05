/**
 * Sales Outcome Log Submission API Endpoint
 *
 * POST /api/sales-log/submit
 *
 * Receives sales team outcome logs and:
 * 1. Validates the submission
 * 2. Enriches with server-side data
 * 3. Forwards to BigQuery webhook (if configured)
 * 4. Sends to point.dog CDP (if configured)
 */

import type { APIRoute } from 'astro'

interface SalesLogSubmission {
  log_id: string
  sales_rep: string
  call_date: string
  call_type: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  company_name?: string
  operation_type?: string
  integrator?: string
  house_count?: number
  bird_capacity?: string
  outcome_type: string
  outcome_details?: string
  fcr_before?: number
  fcr_after?: number
  fcr_improvement_pct?: number
  mortality_before?: number
  mortality_after?: number
  mortality_reduction_pct?: number
  order_value?: number
  products_mentioned?: string[]
  follow_up_needed?: boolean
  follow_up_notes?: string
  logged_at: string
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data: SalesLogSubmission = await request.json()

    // Validate required fields
    if (!data.sales_rep || !data.call_date || !data.outcome_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sales_rep, call_date, outcome_type' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Enrich with server-side metadata
    const enrichedData = {
      ...data,
      _meta: {
        received_at: new Date().toISOString(),
        source: 'sales_log_form',
      },
    }

    // Log for development/debugging
    console.log(
      '[Sales Log Submission]',
      JSON.stringify({
        log_id: enrichedData.log_id,
        sales_rep: enrichedData.sales_rep,
        outcome_type: enrichedData.outcome_type,
        received_at: enrichedData._meta.received_at,
      })
    )

    // Forward to BigQuery webhook if configured
    const bigqueryWebhook = import.meta.env.BIGQUERY_SALES_LOG_WEBHOOK
    if (bigqueryWebhook) {
      try {
        await fetch(bigqueryWebhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.BIGQUERY_WEBHOOK_TOKEN || ''}`,
          },
          body: JSON.stringify({
            table: 'cdp.sales_outcome_logs',
            data: enrichedData,
          }),
        })
      } catch (webhookError) {
        console.error('[BigQuery Webhook Error]', webhookError)
      }
    }

    // Forward to point.dog CDP if configured
    const pointdogEndpoint = import.meta.env.POINTDOG_INGEST_ENDPOINT
    if (pointdogEndpoint) {
      try {
        await fetch(pointdogEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Brand-ID': 'southland',
          },
          body: JSON.stringify({
            event: 'sales_outcome_logged',
            properties: enrichedData,
            timestamp: enrichedData._meta.received_at,
            email: enrichedData.customer_email,
          }),
        })
      } catch (cdpError) {
        console.error('[point.dog CDP Error]', cdpError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sales outcome logged successfully',
        log_id: enrichedData.log_id,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('[Sales Log Error]', error)

    return new Response(
      JSON.stringify({
        error: 'Failed to process sales log',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

export const ALL: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      Allow: 'POST',
    },
  })
}
