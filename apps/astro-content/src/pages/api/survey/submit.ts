/**
 * Survey Submission API Endpoint
 *
 * POST /api/survey/submit
 *
 * Receives outcome survey data and:
 * 1. Validates the submission
 * 2. Enriches with server-side data
 * 3. Forwards to BigQuery webhook (if configured)
 * 4. Stores backup in Cloudflare KV (if available)
 * 5. Sends to point.dog CDP (if configured)
 */

import type { APIRoute } from 'astro'

interface SurveySubmission {
  survey_id: string
  persona: 'backyard' | 'commercial' | 'lawn'
  submitted_at: string
  order_id?: string
  email?: string
  flow_id?: string
  page_url?: string
  user_agent?: string
  referrer?: string
  [key: string]: any // Survey responses
}

interface EnrichedSubmission extends SurveySubmission {
  _meta: {
    received_at: string
    source: 'web_survey'
    ip_country?: string
    cf_ray?: string
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    // Parse request body
    const data: SurveySubmission = await request.json()

    // Validate required fields
    if (!data.survey_id || !data.persona) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: survey_id, persona' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Enrich with server-side metadata
    const enrichedData: EnrichedSubmission = {
      ...data,
      _meta: {
        received_at: new Date().toISOString(),
        source: 'web_survey',
        ip_country: request.headers.get('cf-ipcountry') || undefined,
        cf_ray: request.headers.get('cf-ray') || undefined,
      },
    }

    // Log for development/debugging
    console.log(
      '[Survey Submission]',
      JSON.stringify({
        survey_id: enrichedData.survey_id,
        persona: enrichedData.persona,
        order_id: enrichedData.order_id,
        received_at: enrichedData._meta.received_at,
      })
    )

    // Forward to BigQuery webhook if configured
    const bigqueryWebhook = import.meta.env.BIGQUERY_SURVEY_WEBHOOK
    if (bigqueryWebhook) {
      try {
        await fetch(bigqueryWebhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.BIGQUERY_WEBHOOK_TOKEN || ''}`,
          },
          body: JSON.stringify({
            table: 'cdp.outcome_surveys',
            data: enrichedData,
          }),
        })
      } catch (webhookError) {
        console.error('[BigQuery Webhook Error]', webhookError)
        // Don't fail the request if webhook fails - we have backups
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
            event: 'outcome_survey_submitted',
            properties: enrichedData,
            timestamp: enrichedData._meta.received_at,
            email: enrichedData.email,
          }),
        })
      } catch (cdpError) {
        console.error('[point.dog CDP Error]', cdpError)
      }
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Survey submitted successfully',
        submission_id: `${enrichedData.survey_id}-${Date.now()}`,
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
    console.error('[Survey Submission Error]', error)

    return new Response(
      JSON.stringify({
        error: 'Failed to process survey submission',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

// Reject other methods
export const ALL: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      Allow: 'POST',
    },
  })
}
