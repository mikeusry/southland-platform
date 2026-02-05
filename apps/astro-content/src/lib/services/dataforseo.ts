/**
 * DataForSEO Service
 * Content analysis, readability, and SEO scoring
 */
import type { SEOScore } from '../content-score.types'

const API_BASE = 'https://api.dataforseo.com/v3'

/**
 * Analyze content for SEO metrics using DataForSEO
 */
export async function analyzeContentSEO(
  content: string,
  targetKeyword?: string
): Promise<SEOScore> {
  const login = import.meta.env.DATAFORSEO_LOGIN
  const password = import.meta.env.DATAFORSEO_PASSWORD
  const enabled = import.meta.env.ENABLE_DATAFORSEO === 'true'

  // Calculate local metrics first (always available)
  const localMetrics = computeLocalSEOMetrics(content, targetKeyword)

  // Check if DataForSEO is enabled
  if (!enabled || !login || !password) {
    return {
      ...localMetrics,
      recommendations: [
        ...localMetrics.recommendations,
        'DataForSEO analysis disabled - using local metrics only',
      ],
    }
  }

  try {
    const authHeader = 'Basic ' + btoa(`${login}:${password}`)

    const response = await fetch(`${API_BASE}/content_analysis/summary/live`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keyword: targetKeyword,
          page_content: content.slice(0, 50000), // API limit
        },
      ]),
    })

    if (!response.ok) {
      console.error('DataForSEO API error:', response.status)
      return localMetrics
    }

    const data = await response.json()
    const result = data.tasks?.[0]?.result?.[0]

    if (!result) {
      console.warn('DataForSEO returned no results')
      return localMetrics
    }

    // Merge DataForSEO results with local metrics
    const contentInfo = result.content_info || {}
    const contentScore = contentInfo.content_quality_score || localMetrics.score
    const wordCount = contentInfo.word_count || localMetrics.wordCount

    // Build recommendations
    const recommendations: string[] = []

    // Word count recommendations
    if (wordCount < 300) {
      recommendations.push('Content is too short. Aim for at least 300 words for SEO.')
    } else if (wordCount < 600) {
      recommendations.push(
        'Content is short. Consider expanding to 600+ words for better rankings.'
      )
    } else if (wordCount > 3000) {
      recommendations.push('Content is very long. Consider breaking into multiple articles.')
    }

    // Readability from DataForSEO
    const readability = result.check?.readability
    if (readability?.flesch_kincaid?.reading_ease < 50) {
      recommendations.push('Content may be difficult to read. Consider simplifying language.')
    }

    // Keyword density
    const keywordData = result.check?.keyword_density
    let keywordDensity: SEOScore['keywordDensity']
    if (targetKeyword && keywordData) {
      const density = keywordData.density || 0
      keywordDensity = {
        keyword: targetKeyword,
        density: density,
        recommendation: density < 0.5 ? 'too_low' : density > 3 ? 'too_high' : 'optimal',
      }

      if (density < 0.5) {
        recommendations.push(
          `Target keyword "${targetKeyword}" density is low (${density.toFixed(1)}%). Consider using it more.`
        )
      } else if (density > 3) {
        recommendations.push(
          `Target keyword "${targetKeyword}" may be overused (${density.toFixed(1)}%). Avoid keyword stuffing.`
        )
      }
    }

    // Heading structure from local analysis
    if (!localMetrics.headings?.hasProperStructure) {
      if ((localMetrics.headings?.h1Count || 0) > 1) {
        recommendations.push('Multiple H1 headings found. Use only one H1 per page.')
      }
      if ((localMetrics.headings?.h2Count || 0) < 2) {
        recommendations.push('Add more H2 subheadings to improve content structure.')
      }
    }

    return {
      score: Math.round(contentScore),
      wordCount,
      headings: localMetrics.headings,
      keywordDensity,
      readability: readability?.flesch_kincaid
        ? {
            fleschKincaid: Math.round(readability.flesch_kincaid.reading_ease),
            gradeLevel: `${Math.round(readability.flesch_kincaid.grade_level || 8)}th grade`,
          }
        : localMetrics.readability,
      recommendations,
    }
  } catch (error) {
    console.error('DataForSEO request failed:', error)
    return {
      ...localMetrics,
      recommendations: [
        ...localMetrics.recommendations,
        `DataForSEO analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    }
  }
}

/**
 * Compute local SEO metrics without external API
 */
export function computeLocalSEOMetrics(content: string, targetKeyword?: string): SEOScore {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length

  // Count headings from markdown
  const h1Count = (content.match(/^# [^\n]+/gm) || []).length
  const h2Count = (content.match(/^## [^\n]+/gm) || []).length
  const h3Count = (content.match(/^### [^\n]+/gm) || []).length

  const recommendations: string[] = []
  let score = 70

  // Word count scoring
  if (wordCount < 300) {
    score -= 20
    recommendations.push('Content is too short. Aim for at least 300 words.')
  } else if (wordCount < 600) {
    score -= 10
    recommendations.push('Content is short. Consider expanding to 600+ words.')
  } else if (wordCount > 1500) {
    score += 10 // Longer content tends to rank better
  }

  // Heading structure
  if (h1Count > 1) {
    score -= 10
    recommendations.push('Multiple H1 headings found. Use only one H1 per page.')
  }
  if (h2Count < 2) {
    score -= 10
    recommendations.push('Add more H2 subheadings to improve structure.')
  }
  if (h2Count >= 3 && h3Count >= 2) {
    score += 5 // Good structure
  }

  // Keyword density (basic check)
  let keywordDensity: SEOScore['keywordDensity']
  if (targetKeyword) {
    const keywordRegex = new RegExp(targetKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const keywordCount = (content.match(keywordRegex) || []).length
    const density = (keywordCount / wordCount) * 100

    keywordDensity = {
      keyword: targetKeyword,
      density: parseFloat(density.toFixed(2)),
      recommendation: density < 0.5 ? 'too_low' : density > 3 ? 'too_high' : 'optimal',
    }

    if (density < 0.5) {
      score -= 5
      recommendations.push(`Target keyword "${targetKeyword}" appears infrequently.`)
    } else if (density > 3) {
      score -= 10
      recommendations.push(`Target keyword "${targetKeyword}" may be overused.`)
    }
  }

  // Estimate readability (simplified Flesch-Kincaid approximation)
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0).length
  const avgWordsPerSentence = sentences > 0 ? wordCount / sentences : 0
  const fleschKincaid = Math.round(206.835 - 1.015 * avgWordsPerSentence - 10) // Simplified

  return {
    score: Math.max(0, Math.min(100, score)),
    wordCount,
    headings: {
      h1Count,
      h2Count,
      h3Count,
      hasProperStructure: h1Count <= 1 && h2Count >= 2,
    },
    keywordDensity,
    readability: {
      fleschKincaid: Math.max(0, Math.min(100, fleschKincaid)),
      gradeLevel:
        avgWordsPerSentence > 20
          ? '11th-12th grade'
          : avgWordsPerSentence > 15
            ? '9th-10th grade'
            : '7th-8th grade',
    },
    recommendations,
  }
}

/**
 * Get SERP competitors for a keyword (more expensive, use sparingly)
 */
export async function getSERPCompetitors(
  keyword: string,
  location: string = 'United States'
): Promise<SEOScore['competitors']> {
  const login = import.meta.env.DATAFORSEO_LOGIN
  const password = import.meta.env.DATAFORSEO_PASSWORD
  const enabled = import.meta.env.ENABLE_DATAFORSEO === 'true'

  if (!enabled || !login || !password) {
    return undefined
  }

  try {
    const authHeader = 'Basic ' + btoa(`${login}:${password}`)

    const response = await fetch(`${API_BASE}/serp/google/organic/live/regular`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keyword,
          location_name: location,
          language_name: 'English',
          depth: 10,
        },
      ]),
    })

    if (!response.ok) {
      console.error('DataForSEO SERP error:', response.status)
      return undefined
    }

    const data = await response.json()
    const items = data.tasks?.[0]?.result?.[0]?.items || []

    return items
      .filter((item: any) => item.type === 'organic')
      .slice(0, 5)
      .map((item: any, index: number) => ({
        position: index + 1,
        url: item.url,
        title: item.title,
        wordCount: 0, // Would need to fetch each page to get word count
      }))
  } catch (error) {
    console.error('SERP analysis failed:', error)
    return undefined
  }
}
