# CDP Analytics Dashboard

Real-time analytics dashboard for Customer Data Platform performance, built with Tremor.so.

## Overview

The CDP Dashboard displays:
- Tunnel performance (Betty/Bill/Taylor conversions, revenue, trends)
- A/B test results (Tunnel vs Generic homepage)
- Persona distribution
- Customer journey funnel
- Live event stream
- Top search queries

## Components

### CDPDashboard.tsx

Main dashboard container using Tremor.so components:

```tsx
import {
  Card, Metric, AreaChart, DonutChart, BarList, Table, BadgeDelta
} from '@tremor/react';
```

### types.ts

TypeScript interfaces for dashboard data:

```typescript
interface CDPMetrics {
  tunnels: {
    betty: TunnelMetrics;
    bill: TunnelMetrics;
    taylor: TunnelMetrics;
  };
  abTests: { tunnelVsGeneric: ABTestResult };
  personaDistribution: PersonaCount[];
  journeyFunnel: JourneyStage[];
}
```

## API Endpoints

All endpoints are in `src/pages/api/cdp/`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cdp/metrics` | GET | Tunnel + A/B + persona + funnel data |
| `/api/cdp/events` | GET | Recent CDP events stream |
| `/api/cdp/searches` | GET | Top search queries |

### Query Parameters

**metrics:**
- `range`: Time range (`7d`, `30d`, `90d`)

**events:**
- `limit`: Number of events (default: 20)

**searches:**
- `limit`: Number of queries (default: 10)

## Dashboard Sections

### KPI Cards Row
Four cards with top-line metrics:
- Total Visitors (with delta badge)
- Conversions
- Revenue
- Avg Conversion Rate

### Visitors by Tunnel Chart
Area chart showing daily visitors by persona tunnel over time.

### A/B Test Results
Progress bars comparing tunnel vs generic homepage conversion rates with confidence interval.

### Tunnel Performance Cards
Three gradient cards (amber/emerald/cyan) showing per-tunnel:
- Conversion rate
- Trend delta
- Views, conversions, revenue

### Bottom Row
- Persona Distribution (DonutChart)
- Customer Journey (BarList funnel)
- Top Searches (BarList)

### Recent Events Table
Live event stream with type, persona, stage, and time.

## Tremor.so Patterns Used

```tsx
// Card with decoration
<Card decoration="top" decorationColor="amber">

// Delta badges
<BadgeDelta deltaType="increase">+12.3%</BadgeDelta>

// Area chart
<AreaChart
  data={chartData}
  index="date"
  categories={['Backyard Betty', 'Broiler Bill']}
  colors={['amber', 'emerald']}
  curveType="monotone"
/>

// Gradient backgrounds
<Card className="bg-gradient-to-br from-amber-50 to-orange-50">
```

## Auto-Refresh

Dashboard refreshes every 2 minutes:

```tsx
useEffect(() => {
  fetchData();
  const interval = setInterval(fetchData, 120000);
  return () => clearInterval(interval);
}, [range]);
```

## Access

Dashboard is at `/admin/cdp/` (password protected via AdminLayout).

**Password:** `southland2024`

## Data Sources

Currently using mock data. Future integration:
- BigQuery for historical analytics
- Cloudflare KV for real-time persona data
- Shopify for revenue/conversion data

## Dependencies

```bash
pnpm add @tremor/react recharts
```

Tailwind config must include Tremor paths:
```js
content: [
  './node_modules/@tremor/**/*.{js,ts,jsx,tsx}'
]
```

## Related Files

- `src/pages/admin/cdp/index.astro` - Dashboard page
- `src/layouts/AdminLayout.astro` - Admin layout with nav
- `apps/persona-worker/` - Persona scoring backend
- `docs/SOUTHLAND-CDP-PLAYBOOK.md` - CDP strategy
