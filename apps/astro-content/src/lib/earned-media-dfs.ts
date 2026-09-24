/**
 * DataForSEO competitor article links for earned-media intake.
 * Credentials from Cloudflare runtime env (getServerEnv), not Vite build.
 */

import { getServerEnv } from './server-env'
import {
  candidatesFromArticleLinks,
  filterGapCandidates,
  normalizeDomain,
  type CompetitorArticleLink,
  type GapCandidate,
} from '@pointdog/admin-core'

const API_BASE = 'https://api.dataforseo.com/v3'

type Locals = unknown

type BacklinkItem = {
  domain_from?: string
  domain_from_rank?: number
  url_from?: string
  page_from_title?: string | null
  dofollow?: boolean
}

function authHeader(login: string, password: string): string {
  return `Basic ${btoa(`${login}:${password}`)}`
}

export function dataForSeoConfigured(locals: Locals): boolean {
  const login = getServerEnv(locals, 'DATAFORSEO_LOGIN')
  const password = getServerEnv(locals, 'DATAFORSEO_PASSWORD')
  return Boolean(login && password)
}

async function backlinks(auth: string, task: Record<string, unknown>): Promise<BacklinkItem[]> {
  const response = await fetch(`${API_BASE}/backlinks/backlinks/live`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      {
        mode: 'one_per_domain',
        backlinks_status_type: 'live',
        exclude_internal_backlinks: true,
        ...task,
      },
    ]),
  })
  if (!response.ok) {
    throw new Error(`DataForSEO HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`)
  }
  const data = (await response.json()) as {
    tasks?: Array<{
      status_code?: number
      status_message?: string
      result?: Array<{ items?: BacklinkItem[] | null }>
    }>
  }
  const result = data.tasks?.[0]
  if (result?.status_code && result.status_code >= 40000) {
    throw new Error(result.status_message || `DataForSEO task ${result.status_code}`)
  }
  return result?.result?.[0]?.items ?? []
}

/**
 * Articles that cite a competitor in the body, on domains that never link to us.
 * One call per competitor plus one exclusion call (~$0.025 each).
 */
export async function fetchCompetitorGaps(
  locals: Locals,
  input: {
    ourDomain: string
    competitors: string[]
    minRank: number
    limit?: number
  }
): Promise<{ candidates: GapCandidate[]; error?: string }> {
  const login = getServerEnv(locals, 'DATAFORSEO_LOGIN')
  const password = getServerEnv(locals, 'DATAFORSEO_PASSWORD')
  if (!login || !password) {
    return {
      candidates: [],
      error: 'DataForSEO credentials are not configured on this environment.',
    }
  }

  const ourDomain = normalizeDomain(input.ourDomain)
  const competitors = input.competitors.map(normalizeDomain).filter(Boolean).slice(0, 6)
  if (!ourDomain || competitors.length === 0) {
    return { candidates: [], error: 'Need our domain and at least one competitor.' }
  }

  const auth = authHeader(login, password)
  const limit = Math.min(Math.max(input.limit ?? 25, 5), 50)

  try {
    const perCompetitor = await Promise.all(
      competitors.map(async (competitor) => {
        const items = await backlinks(auth, {
          target: competitor,
          filters: [
            ['semantic_location', '=', 'article'],
            'and',
            ['domain_from_rank', '>=', input.minRank],
          ],
          order_by: ['domain_from_rank,desc'],
          limit: 60,
        })
        return items.map(
          (item): CompetitorArticleLink => ({
            competitor,
            domainFrom: item.domain_from ?? '',
            domainFromRank: item.domain_from_rank ?? 0,
            urlFrom: item.url_from ?? '',
            pageTitle: item.page_from_title ?? null,
            dofollow: Boolean(item.dofollow),
          })
        )
      })
    )
    const links = perCompetitor.flat().filter((link) => link.domainFrom && link.urlFrom)
    const domains = [...new Set(links.map((link) => link.domainFrom))]

    const linkingToUs =
      domains.length === 0
        ? []
        : await backlinks(auth, {
            target: ourDomain,
            filters: ['domain_from', 'in', domains],
            limit: 1000,
          })

    const candidates = candidatesFromArticleLinks(
      links,
      linkingToUs.map((item) => item.domain_from ?? '')
    )
    return { candidates: filterGapCandidates(candidates, { minRank: input.minRank, limit }) }
  } catch (caught) {
    return {
      candidates: [],
      error: caught instanceof Error ? caught.message : 'DataForSEO request failed',
    }
  }
}
