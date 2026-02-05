/**
 * Originality.ai Service
 * Plagiarism detection and AI content detection
 */
import type { OriginalityScore, AIDetectionScore } from '../content-score.types'

const API_BASE = 'https://api.originality.ai/api/v1'

interface OriginalityApiResponse {
  score: {
    ai: number
    original: number
  }
  public_link?: string
  credits_used?: number
}

/**
 * Check content for originality and AI detection
 * Returns both originality score and AI detection in one API call
 */
export async function checkOriginality(
  content: string
): Promise<{ originality: OriginalityScore; aiDetection: AIDetectionScore }> {
  const apiKey = import.meta.env.ORIGINALITY_API_KEY
  const enabled = import.meta.env.ENABLE_ORIGINALITY_CHECK === 'true'

  // Check if disabled
  if (!enabled || !apiKey) {
    return {
      originality: {
        score: 100,
        passed: true,
        skipped: true,
        skipReason: !enabled
          ? 'Originality check disabled by feature flag'
          : 'Originality.ai API key not configured',
      },
      aiDetection: {
        aiProbability: 0,
        humanProbability: 100,
        classification: 'human',
        passed: true,
        skipped: true,
        skipReason: !enabled
          ? 'AI detection disabled by feature flag'
          : 'Originality.ai API key not configured',
      },
    }
  }

  // Check minimum content length
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 100) {
    return {
      originality: {
        score: 100,
        passed: true,
        skipped: true,
        skipReason: `Content too short for originality check (${wordCount} words, minimum 100)`,
      },
      aiDetection: {
        aiProbability: 0,
        humanProbability: 100,
        classification: 'human',
        passed: true,
        skipped: true,
        skipReason: `Content too short for AI detection (${wordCount} words, minimum 100)`,
      },
    }
  }

  try {
    const response = await fetch(`${API_BASE}/scan/ai`, {
      method: 'POST',
      headers: {
        'X-OAI-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content.slice(0, 25000), // API limit
        aiModelVersion: '1',
        storeScan: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Originality.ai API error:', response.status, errorText)

      // Return skipped state on API error
      return {
        originality: {
          score: 100,
          passed: true,
          skipped: true,
          skipReason: `Originality.ai API error: ${response.status}`,
        },
        aiDetection: {
          aiProbability: 0,
          humanProbability: 100,
          classification: 'human',
          passed: true,
          skipped: true,
          skipReason: `Originality.ai API error: ${response.status}`,
        },
      }
    }

    const data: OriginalityApiResponse = await response.json()

    // Calculate scores
    // Originality.ai returns ai (0-1) where 1 = AI, original (0-1) where 1 = original
    const aiProbability = Math.round(data.score.ai * 100)
    const humanProbability = Math.round(data.score.original * 100)
    const originalityScore = humanProbability // Higher original = higher score

    return {
      originality: {
        score: originalityScore,
        passed: originalityScore >= 90,
        sources: [], // Originality.ai doesn't return plagiarism sources in this endpoint
      },
      aiDetection: {
        aiProbability,
        humanProbability,
        classification: aiProbability > 50 ? 'ai' : aiProbability > 25 ? 'mixed' : 'human',
        passed: aiProbability <= 50, // 50% or less AI is considered passing
      },
    }
  } catch (error) {
    console.error('Originality.ai request failed:', error)

    return {
      originality: {
        score: 100,
        passed: true,
        skipped: true,
        skipReason: `Originality check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      aiDetection: {
        aiProbability: 0,
        humanProbability: 100,
        classification: 'human',
        passed: true,
        skipped: true,
        skipReason: `AI detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    }
  }
}

/**
 * Check only for plagiarism (separate endpoint)
 * Use this if you want plagiarism sources
 */
export async function checkPlagiarism(content: string): Promise<OriginalityScore> {
  const apiKey = import.meta.env.ORIGINALITY_API_KEY
  const enabled = import.meta.env.ENABLE_ORIGINALITY_CHECK === 'true'

  if (!enabled || !apiKey) {
    return {
      score: 100,
      passed: true,
      skipped: true,
      skipReason: 'Plagiarism check disabled or not configured',
    }
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 100) {
    return {
      score: 100,
      passed: true,
      skipped: true,
      skipReason: `Content too short for plagiarism check (${wordCount} words, minimum 100)`,
    }
  }

  try {
    const response = await fetch(`${API_BASE}/scan/plag`, {
      method: 'POST',
      headers: {
        'X-OAI-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content.slice(0, 25000),
        storeScan: false,
      }),
    })

    if (!response.ok) {
      console.error('Plagiarism check error:', response.status)
      return {
        score: 100,
        passed: true,
        skipped: true,
        skipReason: `Plagiarism API error: ${response.status}`,
      }
    }

    const data = await response.json()
    const plagScore = data.score?.plagiarism || 0
    const originalityScore = Math.round((1 - plagScore) * 100)

    return {
      score: originalityScore,
      passed: originalityScore >= 90,
      sources:
        data.matches?.map((m: any) => ({
          url: m.url,
          matchPercentage: Math.round(m.score * 100),
        })) || [],
    }
  } catch (error) {
    console.error('Plagiarism check failed:', error)
    return {
      score: 100,
      passed: true,
      skipped: true,
      skipReason: `Plagiarism check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}
