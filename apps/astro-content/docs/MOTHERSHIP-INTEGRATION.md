# Mothership Content Quality Integration

## Overview

Integrate Mothership's persona scoring, content gap analysis, and external APIs (Originality.ai, DataforSEO) into TinaCMS via a decoupled API architecture.

**Key Principles:**
- Mothership is the **primary scorer** (persona + gap + basic SEO)
- Originality.ai + DataforSEO are **augmenters** (triggered on-demand or pre-publish)
- Two scan modes: **Light** (cheap, auto) and **Full** (expensive, manual)
- Graceful degradation: panel works even if external APIs are down

**Policy:**
- AI detection is **advisory only** - we do not auto-reject based on AI probability
- Only 3 hard blockers: no persona (<40%), orphan+no links+no meta, missing content
- Everything else (originality, SEO, AI %) is a warning that editors can override

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TinaCMS Editor                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Quality Panel (React Component)                                 │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │ LIGHT MODE (auto, 2s debounce)                              ││   │
│  │  │ - Persona alignment gauge (all scores visible)              ││   │
│  │  │ - Gap status + canonical URL suggestion                     ││   │
│  │  │ - Local SEO (word count, headings, links)                   ││   │
│  │  └─────────────────────────────────────────────────────────────┘│   │
│  │                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │ FULL MODE (manual button OR pre-publish)                    ││   │
│  │  │ - Originality check                                          ││   │
│  │  │ - AI detection                                                ││   │
│  │  │ - DataforSEO analysis                                         ││   │
│  │  └─────────────────────────────────────────────────────────────┘│   │
│  │                                                                   │   │
│  │  [ Run Full Scan ]  [ Publish Blockers: 0 ]                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ POST /api/content-score
                                    │ { mode: "light" | "full" }
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Astro API (astro-content)                            │
│  src/pages/api/content-score.ts                                         │
│                                                                         │
│  1. Compute contentHash = hash(title + body)                            │
│  2. Check cache: content-score:{brand}:{hash}:{mode}                    │
│  3. If cache miss:                                                      │
│     - ALWAYS: Mothership (persona + gap) + local SEO                    │
│     - IF mode=full: Originality.ai + DataforSEO                         │
│  4. Return unified ContentScoreResponse                                 │
└─────────────────────────────────────────────────────────────────────────┘
                │                    │                    │
                │ ALWAYS             │ mode=full only     │ mode=full only
                ▼                    ▼                    ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────────┐
│  Mothership API   │  │  Originality.ai   │  │      DataforSEO           │
│  (point.dog)      │  │                   │  │                           │
│                   │  │  - Plagiarism     │  │  - Content Analysis       │
│  - Persona score  │  │  - AI detection   │  │  - SERP competitors       │
│  - Content gaps   │  │                   │  │  - Keyword density        │
│  - Similar pages  │  │                   │  │  - Readability            │
└───────────────────┘  └───────────────────┘  └───────────────────────────┘
        │
        ▼
┌───────────────────┐
│  Supabase         │
│  (point.dog DB)   │
│                   │
│  - personas       │
│  - brand_knowledge│
│  - pages (NLP)    │
│  - pgvector       │
└───────────────────┘
```

---

## Request/Response Contract

### Request

```typescript
interface ContentScoreRequest {
  // Required
  title: string;
  body: string;

  // Optional context
  url?: string;              // Existing URL if editing
  description?: string;
  tags?: string[];
  segment?: string;          // "poultry" | "turf" | "agriculture"
  targetKeyword?: string;    // For SEO analysis

  // Mode control
  mode?: 'light' | 'full';   // Default: "light"
  brandSlug?: string;        // Optional on client; server applies DEFAULT_BRAND_SLUG
}

// Server-side: always resolve brandSlug
const brandSlug = request.brandSlug || process.env.DEFAULT_BRAND_SLUG || 'southland-organics';
```

> **Multisite support:** Keep `brandSlug` optional in the client request, but the API always resolves it server-side. This makes future multisite support easy without requiring client changes.
```

### Response

```typescript
interface ContentScoreResponse {
  // Metadata
  requestId: string;
  analyzedAt: string;        // ISO timestamp of this analysis
  contentHash: string;       // For cache busting
  mode: 'light' | 'full';

  // Timestamps for UI "last scanned" indicator
  lightScanAt?: string;      // When light scan was last run
  fullScanAt?: string;       // When full scan was last run (may be from cache)

  // Summary
  overallScore: number;      // 0-100
  publishable: boolean;
  blockers: string[];        // Hard blocks only
  warnings: string[];        // Advisory issues

  // Always included (Mothership + local)
  persona: PersonaScores;
  gap: GapStatus;
  quality: QualityMetrics;

  // Only in mode=full (or cached from previous full scan)
  originality?: OriginalityScore;
  aiDetection?: AIDetectionScore;
  seo?: SEOScore;
}
```

---

## Persona Scoring

### Request to Mothership

```typescript
// POST /api/persona/score
interface PersonaScoreRequest {
  brandSlug: string;
  content: string;
  segment?: string;
}
```

### Response from Mothership

```typescript
interface PersonaScoreResponse {
  // Full distribution (always surface all scores)
  scores: {
    [personaSlug: string]: {
      name: string;           // "Broiler Bill"
      score: number;          // 0.0 - 1.0
      keywords: string[];     // Matching keywords found
    }
  };

  // Primary match
  primary: {
    slug: string;
    name: string;
    score: number;
  };

  // Status
  aligned: boolean;           // primary.score >= threshold
  confused: boolean;          // Multiple high scores (e.g., 0.58 Bill / 0.55 Betty)
  recommendation?: string;
}
```

### Thresholds (Configurable per Brand)

```typescript
// Stored in Mothership brand_settings
interface PersonaThresholds {
  aligned: number;            // Default: 0.6 - "aligned" cutoff
  strong: number;             // Default: 0.75 - "strong" alignment
  confused: number;           // Default: 0.05 - if top 2 within this delta = confused
  minimum: number;            // Default: 0.4 - below this = BLOCKER
}
```

### SQL Implementation

```sql
SELECT
  p.slug,
  p.name,
  1 - (p.embedding <=> $content_embedding) as similarity,
  p.keywords
FROM personas p
WHERE p.brand_id = $brand_id
  AND p.status = 'approved'
ORDER BY similarity DESC;
```

---

## Content Gap Analysis

### Request to Mothership

```typescript
// POST /api/content/gap
interface ContentGapRequest {
  brandSlug: string;
  title: string;
  content: string;
  url?: string;
}
```

### Response from Mothership

```typescript
interface ContentGapResponse {
  status: 'ORPHAN' | 'WEAK' | 'CONFUSED' | 'OK';
  message: string;

  // Actionable guidance
  canonicalUrl?: string;      // For WEAK/CONFUSED: where to link/consolidate
  suggestions?: string[];

  // Journey stage (simplified for panel UI)
  stage?: 'awareness' | 'consideration' | 'decision' | 'post-purchase';
  stageConfidence?: number;

  // Similar existing content
  existingContent?: {
    url: string;
    title: string;
    similarity: number;
    persona?: string;
    stage?: string;
  }[];
}
```

### Gap Classifications

| Status | Meaning | Action | Blocker? |
|--------|---------|--------|----------|
| ORPHAN | No similar content, unclear fit | Add internal links, clarify persona | Only if + no links + no meta |
| WEAK | Low similarity to existing content | Link to canonicalUrl, strengthen topic | No |
| CONFUSED | High similarity to multiple topics | Focus on one persona/stage | No |
| OK | Good fit in content strategy | Ready to publish | No |

---

## Publish Blockers vs Warnings

### Hard Blockers (Prevent Publish)

These are the **only** conditions that block publishing:

```typescript
const blockers: string[] = [];

// 1. No persona alignment at all
if (persona.primary.score < 0.4) {
  blockers.push('Content does not align with any target persona (score < 40%)');
}

// 2. Orphan + no links + no metadata (triple fail)
if (gap.status === 'ORPHAN' && !quality.hasInternalLinks && !quality.hasMetaDescription) {
  blockers.push('Orphan content: add internal links and meta description');
}

// 3. Title or body missing
if (!title || !body || body.length < 100) {
  blockers.push('Content too short (minimum 100 characters)');
}
```

### Warnings (Advisory Only)

Everything else is a warning, including:
- Originality score < 90%
- AI detection > 50%
- SEO score < 60%
- WEAK or CONFUSED gap status
- Missing featured image
- Suboptimal meta description length

```typescript
const warnings: string[] = [];

if (originality && originality.score < 90) {
  warnings.push(`Originality score ${originality.score}% (target: 90%+)`);
}

if (aiDetection && aiDetection.aiProbability > 50) {
  warnings.push(`AI probability ${aiDetection.aiProbability}% (target: <50%)`);
}

// POLICY: AI detection is ADVISORY ONLY - never auto-reject based on AI probability
// This prevents it from becoming an unspoken hard rule

if (seo && seo.score < 60) {
  warnings.push(`SEO score ${seo.score}% (target: 60%+)`);
}

if (gap.status === 'CONFUSED') {
  warnings.push(`Content may overlap with: ${gap.canonicalUrl}`);
}
```

---

## External API Integration

### Originality.ai

**When to call:** `mode === 'full'` only (manual trigger or pre-publish)

```typescript
async function getOriginalityScore(content: string): Promise<OriginalityScore> {
  if (!process.env.ENABLE_ORIGINALITY_CHECK) {
    return { skipped: true, skipReason: 'Disabled by feature flag' };
  }

  if (content.split(/\s+/).length < 100) {
    return { skipped: true, skipReason: 'Content too short (min 100 words)' };
  }

  const response = await fetch('https://api.originality.ai/api/v1/scan/ai', {
    method: 'POST',
    headers: {
      'X-OAI-API-KEY': process.env.ORIGINALITY_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      aiModelVersion: '1',
      storeScan: false,
    }),
  });

  const data = await response.json();

  return {
    score: Math.round((1 - data.score.ai) * 100), // Invert: higher = more original
    aiProbability: Math.round(data.score.ai * 100),
    humanProbability: Math.round(data.score.original * 100),
    classification: data.score.ai > 0.5 ? 'ai' : 'human',
    passed: data.score.ai < 0.5,
  };
}
```

**Cost:** ~$0.01 per 100 words

---

### DataforSEO Content Analysis

**When to call:** `mode === 'full'` only

**Cache key:** `seo:{brandSlug}:{url}:{targetKeyword}:{contentHash}` (7 days)

```typescript
async function getSEOScore(
  content: string,
  targetKeyword?: string,
  url?: string
): Promise<SEOScore> {
  if (!process.env.ENABLE_DATAFORSEO) {
    return computeLocalSEO(content); // Fallback to basic local analysis
  }

  // Check cache first
  const cacheKey = `seo:${brandSlug}:${url}:${targetKeyword}:${contentHash}`;
  const cached = await getCached(cacheKey);
  if (cached) return { ...cached, cachedAt: cached.timestamp };

  const response = await fetch(
    'https://api.dataforseo.com/v3/content_analysis/summary/live',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(
          `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
        )}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keyword: targetKeyword,
          page_content: content,
        },
      ]),
    }
  );

  const data = await response.json();
  const result = data.tasks?.[0]?.result?.[0];

  const seoScore: SEOScore = {
    score: result?.content_info?.content_quality_score ?? 70,
    wordCount: result?.content_info?.word_count ?? content.split(/\s+/).length,
    keywordDensity: targetKeyword
      ? {
          keyword: targetKeyword,
          density: result?.check?.keyword_density?.density ?? 0,
          recommendation: getDensityRecommendation(
            result?.check?.keyword_density?.density
          ),
        }
      : undefined,
    readability: {
      fleschKincaid: result?.check?.readability?.flesch_kincaid?.reading_ease ?? 65,
      gradeLevel: `${Math.round(
        result?.check?.readability?.flesch_kincaid?.grade_level ?? 8
      )}th grade`,
    },
    recommendations: [],
  };

  // Cache for 7 days
  await setCache(cacheKey, seoScore, 7 * 24 * 60 * 60);

  return seoScore;
}
```

**Cost:** ~$0.002 per request

---

## Caching Strategy

### Cache Keys

```
content-score:{brandSlug}:{contentHash}:light     # Light mode results
content-score:{brandSlug}:{contentHash}:full      # Full mode results
seo:{brandSlug}:{url}:{targetKeyword}:{hash}      # DataforSEO results
persona-model:{brandSlug}:{version}               # Persona model version
```

### Cache Durations

| Data | Duration | Bust When |
|------|----------|-----------|
| Light scan results | 1 hour | Content changes (new hash) |
| Full scan results | 24 hours | Content changes |
| SEO analysis | 7 days | URL + keyword + content changes |
| Persona scores | 1 hour | Content changes OR persona model update |

### Cache Busting

Include `personaModelVersion` in persona cache key so updating personas in Mothership invalidates old scores:

```typescript
const cacheKey = `persona:${brandSlug}:${contentHash}:${personaModelVersion}`;
```

---

## Environment Variables

```bash
# Mothership (point.dog)
MOTHERSHIP_API_URL=https://api.point.dog
MOTHERSHIP_API_KEY=sk_...

# Originality.ai
ORIGINALITY_API_KEY=oai_...

# DataforSEO
DATAFORSEO_LOGIN=login@example.com
DATAFORSEO_PASSWORD=...

# Feature flags
ENABLE_ORIGINALITY_CHECK=true    # Gate expensive API
ENABLE_DATAFORSEO=true           # Gate expensive API
ENABLE_MOTHERSHIP=true           # Allow local-only mode

# Defaults
DEFAULT_BRAND_SLUG=southland-organics
```

---

## TinaCMS Quality Panel Component

> **Note:** Use Tina's `useForm` hook or pass form values via props rather than relying on `cms.api.tina.getDocument()`, which may not be available in all contexts.

```typescript
// tina/components/QualityPanel.tsx
import { useForm } from 'tinacms';
import { useEffect, useState, useCallback } from 'react';
import { debounce } from 'lodash';

interface QualityPanelProps {
  form: any; // Pass form from parent, or use useForm() hook
}

export function QualityPanel({ form }: QualityPanelProps) {
  const [lightScore, setLightScore] = useState<ContentScoreResponse | null>(null);
  const [fullScore, setFullScore] = useState<ContentScoreResponse | null>(null);
  const [loading, setLoading] = useState<'light' | 'full' | null>(null);

  // Get values from form (more reliable than getDocument)
  const values = form?.values;

  // Light scan - auto-debounced
  const runLightScan = useCallback(
    debounce(async (vals: any) => {
      if (!vals?.title || !vals?.body) return;

      setLoading('light');
      try {
        const response = await fetch('/api/content-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'light',
            title: vals.title,
            body: vals.body,
            description: vals.description,
            segment: vals.segment,
          }),
        });
        setLightScore(await response.json());
      } catch (e) {
        console.error('Light scan failed:', e);
      }
      setLoading(null);
    }, 2000),
    []
  );

  // Full scan - manual trigger
  const runFullScan = async () => {
    if (!values?.title || !values?.body) return;

    setLoading('full');
    try {
      const response = await fetch('/api/content-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'full',
          title: values.title,
          body: values.body,
          description: values.description,
          segment: values.segment,
          targetKeyword: values.targetKeyword,
        }),
      });
      setFullScore(await response.json());
    } catch (e) {
      console.error('Full scan failed:', e);
    }
    setLoading(null);
  };

  // Auto-run light scan on content change
  useEffect(() => {
    if (values) {
      runLightScan(values);
    }
  }, [values?.body, values?.title]);

  // Helper: format relative time
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const score = fullScore || lightScore;
  if (!score) return <div className="quality-panel">Start typing to analyze...</div>;

  return (
    <div className="quality-panel">
      <header>
        <h3>Content Quality</h3>
        <span className={`badge ${score.publishable ? 'green' : 'red'}`}>
          {score.overallScore}/100
        </span>
      </header>

      {/* Last scanned indicator */}
      <div className="scan-status">
        {score.lightScanAt && (
          <span>Light: {timeAgo(score.lightScanAt)}</span>
        )}
        {score.fullScanAt && (
          <span>Full: {timeAgo(score.fullScanAt)}</span>
        )}
      </div>

      {/* Persona - always show full distribution */}
      <section>
        <h4>Persona Fit</h4>
        {Object.entries(score.persona.scores).map(([slug, data]) => (
          <div key={slug} className="persona-bar">
            <span>{data.name}</span>
            <progress value={data.score} max={1} />
            <span>{Math.round(data.score * 100)}%</span>
          </div>
        ))}
        {score.persona.confused && (
          <Alert type="warning">
            Content appeals to multiple personas. Consider focusing on one.
          </Alert>
        )}
      </section>

      {/* Gap Status */}
      <section>
        <h4>Content Strategy</h4>
        <StatusBadge status={score.gap.status} />
        <p>{score.gap.message}</p>
        {score.gap.canonicalUrl && (
          <a href={score.gap.canonicalUrl} target="_blank">
            Related: {score.gap.canonicalUrl}
          </a>
        )}
      </section>

      {/* Full scan results (if available) */}
      {fullScore && (
        <>
          <section>
            <h4>Originality</h4>
            <Meter
              label="Original"
              value={fullScore.originality?.score || 0}
              threshold={90}
            />
            <Meter
              label="Human-written"
              value={fullScore.aiDetection?.humanProbability || 0}
              threshold={50}
            />
          </section>

          <section>
            <h4>SEO</h4>
            <Meter label="SEO Score" value={fullScore.seo?.score || 0} threshold={60} />
            {fullScore.seo?.recommendations?.map((rec, i) => (
              <Alert key={i} type="info">{rec}</Alert>
            ))}
          </section>
        </>
      )}

      {/* Actions */}
      <footer>
        <button
          onClick={runFullScan}
          disabled={loading === 'full'}
          className="full-scan-btn"
        >
          {loading === 'full' ? 'Scanning...' : 'Run Full Scan'}
        </button>

        {score.blockers.length > 0 && (
          <div className="blockers">
            <h4>Publish Blockers</h4>
            {score.blockers.map((b, i) => (
              <Alert key={i} type="error">{b}</Alert>
            ))}
          </div>
        )}

        {score.warnings.length > 0 && (
          <details>
            <summary>{score.warnings.length} warnings</summary>
            {score.warnings.map((w, i) => (
              <Alert key={i} type="warning">{w}</Alert>
            ))}
          </details>
        )}
      </footer>
    </div>
  );
}
```

### Register Panel in TinaCMS

```typescript
// tina/config.ts
import { QualityPanel } from './components/QualityPanel';

export default defineConfig({
  // ... existing config

  cmsCallback: (cms) => {
    // Register quality panel in sidebar
    // Pass form via wrapper component or context
    cms.sidebar.add({
      name: 'quality-panel',
      Component: QualityPanel,
      position: 'right',
    });

    // Pre-publish hook: run full scan and show blockers as user-friendly modal
    cms.events.subscribe('form:submit', async ({ form }) => {
      if (form.collection === 'blog') {
        const fullScan = await fetch('/api/content-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'full',
            ...form.values,
          }),
        }).then(r => r.json());

        if (fullScan.blockers.length > 0) {
          // Surface as user-friendly modal, not console error
          cms.alerts.error({
            title: 'Cannot Publish',
            message: fullScan.blockers.join('\n'),
            timeout: 10000, // Show for 10 seconds
          });
          throw new Error('Publish blocked by quality check');
        }

        // Show warnings as info toast (non-blocking)
        if (fullScan.warnings.length > 0) {
          cms.alerts.warn({
            title: `${fullScan.warnings.length} warnings`,
            message: 'Check Quality Panel for details',
            timeout: 5000,
          });
        }
      }
    });

    return cms;
  },
});
```

> **UX Note:** Always surface blockers as a modal or inline error that editors can read and act on. Never just throw to console or show a generic "publish failed" message.

---

## Implementation Phases

### Phase 1: Local Quality ✅ CURRENT
- [x] Types defined (`content-score.types.ts`)
- [x] API endpoint skeleton (`api/content-score.ts`)
- [x] Local quality metrics (word count, links, headings)
- [ ] Add `mode` parameter support
- [ ] Add `contentHash` computation
- [ ] Test endpoint with curl

### Phase 2: Mothership Persona Scoring
**Priority: Build persona scoring first - most useful day-to-day signal**

- [ ] Build `POST /api/persona/score` in Mothership
- [ ] Add persona thresholds to brand_settings table
- [ ] Wire Astro API to call Mothership persona endpoint
- [ ] Add confused detection (top 2 scores within delta)
- [ ] Add 1-hour caching with personaModelVersion

### Phase 3: Mothership Gap Analysis
- [ ] Build `POST /api/content/gap` in Mothership
- [ ] Add canonicalUrl to response
- [ ] Simplify buyer stages to 4 for panel UI
- [ ] Wire Astro API to call gap endpoint

### Phase 4: External APIs
- [ ] Integrate Originality.ai (mode=full only)
- [ ] Integrate DataforSEO (mode=full only)
- [ ] Add feature flags for cost control
- [ ] Add 7-day caching for SEO results

### Phase 5: TinaCMS Panel
- [ ] Create React component with light/full modes
- [ ] Start with manual "Analyze" button only
- [ ] Register with `cmsCallback`
- [ ] Add 2s debounce for light scans (after testing latency)
- [ ] Add pre-publish hook for automatic full scan
- [ ] Style to match TinaCMS

### Phase 6: Production
- [ ] Add rate limiting
- [ ] Add monitoring/logging
- [ ] Document for content team
- [ ] Deploy to Cloudflare

---

## Cost Estimates

| Service | Cost | Trigger | Usage Estimate | Monthly |
|---------|------|---------|----------------|---------|
| Originality.ai | $0.01/100 words | Full scan only | 100 scans × 1000 words | $10 |
| DataforSEO | $0.002/request | Full scan only | 100 requests | $0.20 |
| OpenAI Embeddings | $0.00002/1K tokens | Every light scan | 500 × 2K tokens | $0.02 |
| **Total** | | | | **~$10/month** |

**Cost controls:**
- Light scans are cheap (Mothership + local only)
- Full scans gated behind manual button OR pre-publish
- Feature flags to disable expensive APIs entirely

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Persona threshold | 0.6 (60%) - configurable per brand in Mothership |
| Buyer stages in panel | 4 stages: awareness, consideration, decision, post-purchase |
| What blocks publish? | Only: no persona (<40%), orphan+no links+no meta, missing content |
| What warns? | Everything else (originality, AI, SEO, gap status) |
| Persona cache duration | 1 hour, keyed by contentHash + personaModelVersion |
| Originality.ai trigger | Full scan only (manual or pre-publish) |
| Panel auto-scan | Start with manual button, add 2s debounce after testing |
