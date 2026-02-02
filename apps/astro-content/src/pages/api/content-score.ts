/**
 * Content Score API Endpoint
 *
 * POST /api/content-score
 *
 * Analyzes content for quality scoring:
 * - Persona alignment (via Mothership vectors)
 * - Content gap detection
 * - Originality check (Originality.ai - future)
 * - AI detection (Originality.ai - future)
 * - SEO analysis (DataforSEO - future)
 * - Quality metrics (computed locally)
 */
import type { APIRoute } from 'astro';
import type {
  ContentScoreRequest,
  ContentScoreResponse,
  ContentScoreError,
  PersonaScores,
  GapStatus,
  OriginalityScore,
  AIDetectionScore,
  SEOScore,
  QualityMetrics,
  SCORE_THRESHOLDS,
} from '../../lib/content-score.types';

// Generate unique request ID
function generateRequestId(): string {
  return `cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Count words in text
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Extract links from MDX content
function extractLinks(body: string): { internal: number; external: number } {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let internal = 0;
  let external = 0;
  let match;

  while ((match = linkRegex.exec(body)) !== null) {
    const url = match[2];
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (url.includes('southlandorganics.com')) {
        internal++;
      } else {
        external++;
      }
    } else {
      internal++; // Relative links are internal
    }
  }

  return { internal, external };
}

// Compute local quality metrics
function computeQualityMetrics(
  body: string,
  description?: string,
  featuredImage?: string
): QualityMetrics {
  const wordCount = countWords(body);
  const links = extractLinks(body);
  const descLength = description?.length || 0;

  return {
    wordCount,
    readingTime: Math.ceil(wordCount / 200), // ~200 words per minute
    hasFeaturedImage: Boolean(featuredImage),
    hasMetaDescription: Boolean(description),
    metaDescriptionOptimal: descLength >= 120 && descLength <= 160,
    hasInternalLinks: links.internal > 0,
    hasExternalLinks: links.external > 0,
    linkCount: links,
  };
}

// Mock persona scoring (will be replaced with Mothership API call)
function mockPersonaScores(segment?: string): PersonaScores {
  // Default scores - will be computed via vector similarity
  const scores = {
    broilerBill: 0.3,
    backyardBetty: 0.4,
    turfTaylor: 0.2,
  };

  // Adjust based on segment hint
  if (segment === 'poultry') {
    scores.broilerBill = 0.7;
    scores.backyardBetty = 0.6;
    scores.turfTaylor = 0.1;
  } else if (segment === 'turf') {
    scores.turfTaylor = 0.75;
    scores.broilerBill = 0.1;
    scores.backyardBetty = 0.2;
  }

  // Find primary persona
  const entries = Object.entries(scores) as [keyof typeof scores, number][];
  const [primaryKey, primaryScore] = entries.reduce((a, b) => a[1] > b[1] ? a : b);

  const nameMap: Record<string, string> = {
    broilerBill: 'Broiler Bill',
    backyardBetty: 'Backyard Betty',
    turfTaylor: 'Turf Taylor',
  };

  return {
    primary: {
      name: nameMap[primaryKey] as PersonaScores['primary']['name'],
      slug: primaryKey.replace(/([A-Z])/g, '-$1').toLowerCase(),
      score: primaryScore,
    },
    scores,
    aligned: primaryScore >= 0.6,
    recommendation: primaryScore < 0.6
      ? 'Content does not strongly align with any persona. Consider focusing on specific pain points.'
      : undefined,
  };
}

// Mock gap status (will query Mothership SQL)
function mockGapStatus(): GapStatus {
  return {
    status: 'OK',
    message: 'Content fills an identified gap in the content strategy.',
    stage: 'aware',
  };
}

// Mock originality score (will call Originality.ai API)
function mockOriginalityScore(wordCount: number): OriginalityScore {
  if (wordCount < 100) {
    return {
      score: 0,
      passed: false,
      skipped: true,
      skipReason: 'Content too short for originality check (minimum 100 words)',
    };
  }

  return {
    score: 95,
    passed: true,
    sources: [],
  };
}

// Mock AI detection (will call Originality.ai API)
function mockAIDetection(wordCount: number): AIDetectionScore {
  if (wordCount < 100) {
    return {
      aiProbability: 0,
      humanProbability: 0,
      classification: 'human',
      passed: true,
      skipped: true,
      skipReason: 'Content too short for AI detection (minimum 100 words)',
    };
  }

  return {
    aiProbability: 15,
    humanProbability: 85,
    classification: 'human',
    passed: true,
  };
}

// Mock SEO score (will call DataforSEO API)
function mockSEOScore(
  body: string,
  wordCount: number,
  targetKeyword?: string
): SEOScore {
  // Count headings
  const h1Count = (body.match(/^# /gm) || []).length;
  const h2Count = (body.match(/^## /gm) || []).length;
  const h3Count = (body.match(/^### /gm) || []).length;

  const recommendations: string[] = [];

  if (wordCount < 300) {
    recommendations.push('Content is too short. Aim for at least 300 words.');
  }
  if (wordCount > 3000) {
    recommendations.push('Content is very long. Consider breaking into multiple articles.');
  }
  if (h1Count > 1) {
    recommendations.push('Multiple H1 headings found. Use only one H1 per page.');
  }
  if (h2Count < 2) {
    recommendations.push('Add more H2 subheadings to improve structure.');
  }

  // Calculate base score
  let score = 70;
  if (wordCount < 300) score -= 20;
  if (wordCount > 3000) score -= 10;
  if (h1Count > 1) score -= 10;
  if (h2Count < 2) score -= 10;

  return {
    score: Math.max(0, Math.min(100, score)),
    wordCount,
    headings: {
      h1Count,
      h2Count,
      h3Count,
      hasProperStructure: h1Count <= 1 && h2Count >= 2,
    },
    recommendations,
    keywordDensity: targetKeyword ? {
      keyword: targetKeyword,
      density: 1.5,
      recommendation: 'optimal',
    } : undefined,
    readability: {
      fleschKincaid: 65,
      gradeLevel: '8th-9th grade',
    },
  };
}

// Calculate overall score from components
function calculateOverallScore(
  persona: PersonaScores,
  gap: GapStatus,
  originality: OriginalityScore,
  aiDetection: AIDetectionScore,
  seo: SEOScore,
  quality: QualityMetrics
): { score: number; publishable: boolean; blockers: string[] } {
  const blockers: string[] = [];

  // Weight factors
  const weights = {
    persona: 0.2,
    originality: 0.25,
    aiDetection: 0.15,
    seo: 0.25,
    quality: 0.15,
  };

  // Persona score (0-100 scale)
  const personaScore = persona.aligned ? persona.primary.score * 100 : persona.primary.score * 60;
  if (!persona.aligned) {
    blockers.push('Content does not align with any target persona (score < 60%)');
  }

  // Originality score
  let originalityScore = originality.skipped ? 100 : originality.score;
  if (!originality.passed && !originality.skipped) {
    blockers.push(`Originality score too low (${originality.score}%, minimum 90%)`);
  }

  // AI detection score (invert - lower AI probability is better)
  let aiScore = aiDetection.skipped ? 100 : (100 - aiDetection.aiProbability);
  if (!aiDetection.passed && !aiDetection.skipped) {
    blockers.push(`AI probability too high (${aiDetection.aiProbability}%, maximum 50%)`);
  }

  // SEO score
  if (seo.score < 60) {
    blockers.push(`SEO score too low (${seo.score}%, minimum 60%)`);
  }

  // Quality score
  let qualityScore = 100;
  if (quality.wordCount < 300) qualityScore -= 30;
  if (!quality.hasMetaDescription) qualityScore -= 20;
  if (!quality.hasInternalLinks) qualityScore -= 10;

  // Weighted average
  const overallScore = Math.round(
    personaScore * weights.persona +
    originalityScore * weights.originality +
    aiScore * weights.aiDetection +
    seo.score * weights.seo +
    qualityScore * weights.quality
  );

  return {
    score: overallScore,
    publishable: blockers.length === 0,
    blockers,
  };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as ContentScoreRequest;

    // Validate required fields
    if (!body.title || !body.body) {
      const error: ContentScoreError = {
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields: title and body are required',
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const requestId = generateRequestId();

    // Compute quality metrics (local, no API needed)
    const quality = computeQualityMetrics(body.body, body.description);

    // Get scores (currently mocked, will be replaced with real APIs)
    const persona = mockPersonaScores(body.segment);
    const gap = mockGapStatus();
    const originality = mockOriginalityScore(quality.wordCount);
    const aiDetection = mockAIDetection(quality.wordCount);
    const seo = mockSEOScore(body.body, quality.wordCount, body.targetKeyword);

    // Calculate overall score
    const { score, publishable, blockers } = calculateOverallScore(
      persona,
      gap,
      originality,
      aiDetection,
      seo,
      quality
    );

    const response: ContentScoreResponse = {
      requestId,
      analyzedAt: new Date().toISOString(),
      overallScore: score,
      publishable,
      blockers,
      persona,
      gap,
      originality,
      aiDetection,
      seo,
      quality,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const error: ContentScoreError = {
      error: true,
      code: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error occurred',
    };
    return new Response(JSON.stringify(error), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Also support GET for testing
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    endpoint: '/api/content-score',
    method: 'POST',
    description: 'Analyze content for quality scoring',
    requiredFields: ['title', 'body'],
    optionalFields: ['url', 'description', 'tags', 'segment', 'targetKeyword'],
    example: {
      title: 'How to Improve Chicken Health',
      body: '# Introduction\n\nYour chickens deserve the best...',
      segment: 'poultry',
      targetKeyword: 'chicken health',
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
