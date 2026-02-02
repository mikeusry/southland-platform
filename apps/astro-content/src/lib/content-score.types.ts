/**
 * Content Score API Types
 * Contract between TinaCMS Quality Panel and /api/content-score endpoint
 */

// ============================================================================
// REQUEST
// ============================================================================

export interface ContentScoreRequest {
  /** Optional: existing URL for cached data lookup */
  url?: string;
  /** Content title */
  title: string;
  /** Raw MDX body content */
  body: string;
  /** Content description/excerpt */
  description?: string;
  /** Tags array */
  tags?: string[];
  /** Segment: poultry, turf, agriculture, general */
  segment?: string;
  /** Target keyword (optional, for SEO analysis) */
  targetKeyword?: string;
}

// ============================================================================
// RESPONSE
// ============================================================================

export interface ContentScoreResponse {
  /** Request ID for tracking */
  requestId: string;
  /** Timestamp of analysis */
  analyzedAt: string;
  /** Overall quality score 0-100 */
  overallScore: number;
  /** Can this content be published? */
  publishable: boolean;
  /** Blocking issues that prevent publish */
  blockers: string[];

  /** Persona alignment scores */
  persona: PersonaScores;
  /** Content gap status */
  gap: GapStatus;
  /** Originality/plagiarism check */
  originality: OriginalityScore;
  /** AI detection */
  aiDetection: AIDetectionScore;
  /** SEO analysis (DataforSEO) */
  seo: SEOScore;
  /** Content quality metrics */
  quality: QualityMetrics;
}

// ============================================================================
// PERSONA SCORING (from Mothership vectors)
// ============================================================================

export interface PersonaScores {
  /** Primary persona match */
  primary: {
    name: PersonaName;
    slug: string;
    score: number; // 0-1
  };
  /** All persona scores */
  scores: {
    broilerBill: number;    // Commercial poultry
    backyardBetty: number;  // Backyard flock
    turfTaylor: number;     // Lawn professionals
  };
  /** Is primary score above threshold (0.6)? */
  aligned: boolean;
  /** Recommendation */
  recommendation?: string;
}

export type PersonaName = 'Broiler Bill' | 'Backyard Betty' | 'Turf Taylor' | 'Unknown';

// ============================================================================
// CONTENT GAP STATUS (from Mothership SQL)
// ============================================================================

export interface GapStatus {
  /** Gap classification */
  status: 'ORPHAN' | 'WEAK' | 'CONFUSED' | 'OK';
  /** Human-readable explanation */
  message: string;
  /** Inferred buyer journey stage */
  stage?: BuyerStage;
  /** Similar content that already exists */
  existingContent?: {
    url: string;
    title: string;
    similarity: number;
  }[];
}

export type BuyerStage =
  | 'unaware'
  | 'aware'
  | 'receptive'
  | 'zmot'
  | 'objections'
  | 'test_prep'
  | 'challenge'
  | 'success'
  | 'commitment'
  | 'evangelist';

// ============================================================================
// ORIGINALITY (Originality.ai API)
// ============================================================================

export interface OriginalityScore {
  /** Overall originality percentage (100 = fully original) */
  score: number;
  /** Plagiarism sources found */
  sources?: {
    url: string;
    matchPercentage: number;
  }[];
  /** Is score above threshold (90%)? */
  passed: boolean;
  /** Skipped if content too short */
  skipped?: boolean;
  skipReason?: string;
}

// ============================================================================
// AI DETECTION (Originality.ai API)
// ============================================================================

export interface AIDetectionScore {
  /** Percentage likelihood content is AI-generated */
  aiProbability: number;
  /** Percentage likelihood content is human-written */
  humanProbability: number;
  /** Classification */
  classification: 'human' | 'ai' | 'mixed';
  /** Is AI probability below threshold (50%)? */
  passed: boolean;
  /** Skipped if content too short */
  skipped?: boolean;
  skipReason?: string;
}

// ============================================================================
// SEO ANALYSIS (DataforSEO Content Analysis API)
// ============================================================================

export interface SEOScore {
  /** Overall SEO score 0-100 */
  score: number;
  /** Keyword density for target keyword */
  keywordDensity?: {
    keyword: string;
    density: number;
    recommendation: 'too_low' | 'optimal' | 'too_high';
  };
  /** Readability metrics */
  readability?: {
    fleschKincaid: number;
    gradeLevel: string;
  };
  /** Content length */
  wordCount: number;
  /** Headings analysis */
  headings?: {
    h1Count: number;
    h2Count: number;
    h3Count: number;
    hasProperStructure: boolean;
  };
  /** SERP competitors for target keyword */
  competitors?: {
    position: number;
    url: string;
    title: string;
    wordCount: number;
  }[];
  /** Recommendations */
  recommendations: string[];
  /** Cached data age (null if fresh) */
  cachedAt?: string;
}

// ============================================================================
// CONTENT QUALITY METRICS (computed locally)
// ============================================================================

export interface QualityMetrics {
  /** Word count */
  wordCount: number;
  /** Estimated reading time in minutes */
  readingTime: number;
  /** Has featured image? */
  hasFeaturedImage: boolean;
  /** Has meta description? */
  hasMetaDescription: boolean;
  /** Description length in range? (120-160 chars) */
  metaDescriptionOptimal: boolean;
  /** Has internal links? */
  hasInternalLinks: boolean;
  /** Has external links? */
  hasExternalLinks: boolean;
  /** Link count */
  linkCount: {
    internal: number;
    external: number;
  };
}

// ============================================================================
// ERROR RESPONSE
// ============================================================================

export interface ContentScoreError {
  error: true;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// THRESHOLDS (configurable)
// ============================================================================

export const SCORE_THRESHOLDS = {
  persona: {
    aligned: 0.6,      // Minimum score to be "aligned"
    strong: 0.75,      // Strong alignment
  },
  originality: {
    minimum: 90,       // Minimum % to pass
  },
  aiDetection: {
    maximum: 50,       // Maximum AI % to pass
  },
  seo: {
    minimum: 60,       // Minimum SEO score
  },
  quality: {
    minWordCount: 300,
    maxWordCount: 3000,
    minDescriptionLength: 120,
    maxDescriptionLength: 160,
  },
} as const;
