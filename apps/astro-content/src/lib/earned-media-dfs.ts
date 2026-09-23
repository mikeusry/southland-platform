/**
 * DataForSEO backlink domain intersection for earned-media intake.
 * Credentials from Cloudflare runtime env (getServerEnv), not Vite build.
 */

import { getServerEnv } from './server-env'
import {
  filterGapCandidates,
  normalizeDomain,
  type GapCandidate,
} from '@pointdog/admin-core'

const API_BASE = 'https://api.dataforseo.com/v3'

type Locals = unknown

function authHeader(login: string, password: string): string {
  return `Basic ${btoa(`${login}:${password}`)}`
}

export function dataForSeoConfigured(locals: Locals): boolean {
  const login = getServerEnv(locals, 'DATAFORSEO_LOGIN')
  const password = getServerEnv(locals, 'DATAFORSEO_PASSWORD')
  return Boolean(login && password)
}

/**
 * Domains that link to one or more competitors but not us.
 * Cap is intentional — intake, not a backlink warehouse.
 */
export async function fetchCompetitorGaps(
  locals: Locals,
  input: {
    ourDomain: string
    competitors: string[]
    limit?: number
  },
): Promise<{ candidates: GapCandidate[]; error?: string }> {
  const login = getServerEnv(locals, 'DATAFORSEO_LOGIN')
  const password = getServerEnv(locals, 'DATAFORSEO_PASSWORD')
  if (!login || !password) {
    return { candidates: [], error: 'DataForSEO credentials are not configured on this environment.' }
  }

  const ourDomain = normalizeDomain(input.ourDomain)
  const competitors = input.competitors.map(normalizeDomain).filter(Boolean).slice(0, 10)
  if (!ourDomain || competitors.length === 0) {
    return { candidates: [], error: 'Need our domain and at least one competitor.' }
  }

  const targets: Record<string, string> = {}
  competitors.forEach((comp, i) => {
    targets[String(i + 1)] = comp
  })

  const limit = Math.min(Math.max(input.limit ?? 20, 5), 40)

  try {
    const response = await fetch(`${API_BASE}/backlinks/domain_intersection/live`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(login, password),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          targets,
          exclude_targets: [ourDomain],
          limit: Math.min(limit * 5, 100),
          order_by: ['1.rank,desc'],
          exclude_internal_backlinks: true,
          backlinks_status_type: 'live',
        },
      ]),
    })

    if (!response.ok) {
      const body = await response.text()
      return { candidates: [], error: `DataForSEO HTTP ${response.status}: ${body.slice(0, 200)}` }
    }

    const data = (await response.json()) as {
      tasks?: Array<{
        status_code?: number
        status_message?: string
        result?: Array<{ items?: Array<Record<string, unknown>> }>
      }>
    }
    const task = data.tasks?.[0]
    if (task?.status_code && task.status_code >= 40000) {
      return { candidates: [], error: task.status_message || `DataForSEO task ${task.status_code}` }
    }

    const items = task?.result?.[0]?.items ?? []
    const mapped: GapCandidate[] = items.map((item) => {
      const intersection = (item.domain_intersection || {}) as Record<
        string,
        { target?: string; rank?: number; backlinks?: number } | undefined
      >
      let domain = ''
      let rank = 0
      let totalBacklinks = 0
      const linksTo: string[] = []

      for (const [idx, entry] of Object.entries(intersection)) {
        if (!entry) continue
        if (!domain) {
          domain = entry.target || ''
          rank = entry.rank || 0
        }
        totalBacklinks += entry.backlinks || 0
        const compIdx = Number(idx) - 1
        if (competitors[compIdx]) linksTo.push(competitors[compIdx])
      }

      // Some payloads put the referring domain on the item root
      if (!domain && typeof item.target === 'string') domain = item.target

      return {
        domain,
        rank,
        backlinks: totalBacklinks,
        linksTo: [...new Set(linksTo)],
        sampleUrl: null,
      }
    })

    return { candidates: filterGapCandidates(mapped, { minRank: 15, limit }) }
  } catch (caught) {
    return {
      candidates: [],
      error: caught instanceof Error ? caught.message : 'DataForSEO request failed',
    }
  }
}
