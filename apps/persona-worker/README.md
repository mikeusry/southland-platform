# Persona Scoring Worker

Cloudflare Worker that provides real-time persona scoring and journey stage detection for Southland Organics visitors.

## Overview

This worker:
1. Receives pixel events from the point.dog pixel
2. Extracts behavioral signals (page views, searches, cart actions, purchases)
3. Computes persona probability scores (backyard, commercial, lawn, general)
4. Detects journey stage (unaware → evangelist)
5. Caches results in Cloudflare KV for edge access
6. Forwards enriched events to BigQuery

## Endpoints

### POST /event
Process a single pixel event and update visitor scoring.

```bash
curl -X POST https://southland-persona-worker.workers.dev/event \
  -H "Content-Type: application/json" \
  -d '{
    "event": "page_viewed",
    "anonymous_id": "abc123",
    "session_id": "sess_456",
    "timestamp": "2024-01-15T12:00:00Z",
    "page_url": "/poultry/commercial/",
    "page_title": "Commercial Poultry Solutions"
  }'
```

Response:
```json
{
  "success": true,
  "visitor_id": "abc123",
  "persona": "commercial",
  "persona_confidence": 0.72,
  "stage": "aware",
  "stage_confidence": 0.65,
  "explicit_choice": null
}
```

### GET /visitor/:id
Retrieve visitor data from KV cache.

```bash
curl https://southland-persona-worker.workers.dev/visitor/abc123
```

### POST /batch
Process multiple events at once.

### GET /health
Health check endpoint.

## Persona Scoring

Signals are weighted by type and recency:

| Signal Type | Weight |
|-------------|--------|
| decision_engine (explicit choice) | 10 |
| purchase | 8 |
| phone_call | 7 |
| survey_response | 6 |
| add_to_cart | 6 |
| search_query | 5 |
| product_view | 4 |
| collection_view | 3 |
| content_engagement | 3 |
| email_signup | 2 |
| return_visit | 2 |
| page_view | 1 |

Recency multipliers:
- Last hour: 1.5x
- Last 24 hours: 1.0x
- Last 72 hours: 0.7x
- Older: 0.3x

## Journey Stages

| Stage | Indicators |
|-------|------------|
| unaware | Minimal engagement |
| aware | Viewed products/collections |
| receptive | Engaged with content (blog, podcast) |
| zmot | Multiple product views, searches |
| objections | Viewed FAQ, contact, guarantees |
| test_prep | Added to cart |
| challenge | First purchase |
| success | Purchased + returned |
| commitment | 2+ purchases |
| evangelist | 3+ purchases + review |

## Development

```bash
# Install dependencies
pnpm install

# Run locally
pnpm dev

# Deploy to staging
pnpm deploy:staging

# Deploy to production
pnpm deploy:production
```

## Configuration

Before deploying, update `wrangler.toml` with your KV namespace IDs:

```toml
[[kv_namespaces]]
binding = "VISITOR_KV"
id = "your-actual-kv-namespace-id"
```

Create KV namespaces:
```bash
wrangler kv:namespace create "VISITOR_KV"
wrangler kv:namespace create "VISITOR_KV" --preview
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BRAND_ID` | Brand identifier (southland) |
| `BIGQUERY_WEBHOOK_URL` | Webhook URL for BigQuery ingestion |

## Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────┐
│   Website   │────▶│  Persona Worker      │────▶│   KV Cache  │
│  (Pixel)    │     │                      │     │ (30d TTL)   │
└─────────────┘     │  1. Extract signals  │     └─────────────┘
                    │  2. Score persona    │            │
                    │  3. Detect stage     │            ▼
                    │  4. Cache in KV      │     ┌─────────────┐
                    │  5. Forward BigQuery │────▶│  BigQuery   │
                    └──────────────────────┘     └─────────────┘
```

## Related Files

- `apps/astro-content/src/lib/visitor.ts` - Client-side API
- `apps/astro-content/src/lib/persona.ts` - Persona utilities
- `apps/astro-content/src/components/cdp/` - CDP components
