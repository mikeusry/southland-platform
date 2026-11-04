/**
 * Guards for POST /api/subscribe.
 *
 * wrangler.toml for this app has no KV or D1 binding, so the rate limits are
 * in-memory and best-effort: they hold for the life of one isolate and reset
 * when that isolate goes away. Do not add a Cloudflare resource for this.
 */

import { getServerEnv } from './server-env'

export const SUBSCRIBE_IP_LIMIT = 5
export const SUBSCRIBE_IP_WINDOW_MS = 60 * 60 * 1000
export const SUBSCRIBE_EMAIL_LIMIT = 3
export const SUBSCRIBE_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000

const MX_LOOKUP_TIMEOUT_MS = 1500
const DOH_MX_URL = 'https://1.1.1.1/dns-query'

/** Audiences a visitor can subscribe from. Maps to a Customer.io attribute. */
export const SIGNUP_SOURCES = [
  'website',
  'episode_page',
  'hub',
  'footer',
  'blog',
  'biosecurity',
  'lawn',
  'case-study',
] as const

const VALID_SOURCES = new Set<string>(SIGNUP_SOURCES)

/** Domains seen on bombed "website" signups. Exact match and subdomains. */
const BLOCKED_DOMAINS = ['colsed.us', 'cscolu.us', 'cdus.us', 'columcen.us']

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

const PRODUCTION_HOSTS = new Set(['southlandorganics.com', 'www.southlandorganics.com'])

const LOCAL_RE = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?$/
const DOMAIN_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

type Bucket = { count: number; reset: number }

const ipHits = new Map<string, Bucket>()
const emailHits = new Map<string, Bucket>()

let clock = (): number => Date.now()

/** Test hook. Production code leaves the clock on Date.now. */
export function setSubscribeClock(fn: () => number): void {
  clock = fn
}

export function resetSubscribeGuards(): void {
  ipHits.clear()
  emailHits.clear()
  clock = () => Date.now()
}

export function isHoneypotFilled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== ''
  return value !== undefined && value !== null && value !== false
}

function hostnameOf(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return null
  }
}

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}

function isPreviewHost(host: string): boolean {
  return host === 'pages.dev' || host.endsWith('.pages.dev')
}

function isProductionHost(host: string): boolean {
  return PRODUCTION_HOSTS.has(host)
}

/**
 * Localhost and *.pages.dev are accepted only when this deployment is dev or
 * preview. The request URL host is set by the server, not the Origin header.
 * A non-main CF_PAGES_BRANCH covers preview deploys on a custom hostname.
 */
export function deploymentAllowsPreview(request: Request, locals: unknown): boolean {
  const reqHost = hostnameOf(request.url)
  if (reqHost && (isLocalHost(reqHost) || isPreviewHost(reqHost))) return true
  const branch = getServerEnv(locals, 'CF_PAGES_BRANCH')
  return !!branch && branch !== 'main' && branch !== 'master'
}

function isHostAllowed(host: string, request: Request, locals: unknown): boolean {
  if (isProductionHost(host)) return true
  if (!deploymentAllowsPreview(request, locals)) return false
  return isLocalHost(host) || isPreviewHost(host)
}

/** Origin, then Referer. Missing or foreign hosts are rejected. */
export function isAllowedSubscribeOrigin(request: Request, locals: unknown): boolean {
  const presented =
    hostnameOf(request.headers.get('origin')) ?? hostnameOf(request.headers.get('referer'))
  if (!presented) return false
  return isHostAllowed(presented, request, locals)
}

export function clientIp(request: Request, clientAddress?: string | null): string {
  const cf = request.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const addr = clientAddress?.trim()
  if (addr) return addr
  return 'unknown'
}

function prune(map: Map<string, Bucket>): void {
  if (map.size < 2000) return
  const t = clock()
  for (const [key, entry] of map) {
    if (t >= entry.reset) map.delete(key)
  }
}

function consume(
  map: Map<string, Bucket>,
  key: string,
  limit: number,
  windowMs: number
): { limited: boolean; retryAfter: number } {
  prune(map)
  const t = clock()
  const entry = map.get(key)
  if (!entry || t >= entry.reset) {
    map.set(key, { count: 1, reset: t + windowMs })
    return { limited: false, retryAfter: 0 }
  }
  entry.count += 1
  if (entry.count > limit) {
    return { limited: true, retryAfter: Math.max(1, Math.ceil((entry.reset - t) / 1000)) }
  }
  return { limited: false, retryAfter: 0 }
}

export function consumeIpBudget(ip: string): { limited: boolean; retryAfter: number } {
  return consume(ipHits, ip || 'unknown', SUBSCRIBE_IP_LIMIT, SUBSCRIBE_IP_WINDOW_MS)
}

export function consumeEmailBudget(email: string): { limited: boolean; retryAfter: number } {
  return consume(emailHits, email, SUBSCRIBE_EMAIL_LIMIT, SUBSCRIBE_EMAIL_WINDOW_MS)
}

function isBlockedDomain(domain: string): boolean {
  for (const blocked of BLOCKED_DOMAINS) {
    if (domain === blocked || domain.endsWith(`.${blocked}`)) return true
  }
  return false
}

export type EmailVerdict = { ok: true; email: string; domain: string } | { ok: false }

/**
 * Practical RFC subset. Rejects `|`, `=`, spaces, quoted locals, and other
 * characters that showed up on bombed signups. Plus-addressing stays allowed.
 */
export function validateSubscribeEmail(raw: string): EmailVerdict {
  const email = raw.trim().toLowerCase()
  if (!email || email.length > 254) return { ok: false }
  if (email.includes('|') || email.includes('=')) return { ok: false }
  const at = email.lastIndexOf('@')
  if (at <= 0 || at !== email.indexOf('@')) return { ok: false }
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length > 64 || local.includes('..')) return { ok: false }
  if (!LOCAL_RE.test(local) || !DOMAIN_RE.test(domain)) return { ok: false }
  const labels = domain.split('.')
  if (labels[labels.length - 1].length < 2) return { ok: false }
  if (isBlockedDomain(domain)) return { ok: false }
  return { ok: true, email, domain }
}

interface DnsAnswer {
  type?: number
  data?: string
}

interface DnsJson {
  Status?: number
  Answer?: DnsAnswer[]
}

function isUsableMx(data: string): boolean {
  const parts = data.trim().split(/\s+/)
  const exchange = parts[parts.length - 1] ?? ''
  return exchange !== '' && exchange !== '.'
}

/** True when the domain published a usable MX. Fail open only when the lookup itself failed. */
export function mxAnswerAcceptsMail(data: DnsJson | null | undefined): boolean {
  if (typeof data?.Status !== 'number') return true
  if (data.Status === 3) return false
  if (data.Status !== 0) return true
  const answers = Array.isArray(data.Answer) ? data.Answer : []
  const mx = answers.filter((a) => a?.type === 15 && typeof a.data === 'string')
  if (mx.length === 0) return false
  return mx.some((a) => isUsableMx(a.data as string))
}

/** DNS-over-HTTPS MX lookup against 1.1.1.1. Lookup errors and timeouts allow the signup. */
export async function domainHasMx(domain: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MX_LOOKUP_TIMEOUT_MS)
  try {
    const url = `${DOH_MX_URL}?name=${encodeURIComponent(domain)}&type=MX`
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
      signal: controller.signal,
    })
    if (!res.ok) return true
    const data = (await res.json()) as DnsJson
    return mxAnswerAcceptsMail(data)
  } catch {
    return true
  } finally {
    clearTimeout(timer)
  }
}

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 31 || code === 127) return true
  }
  return false
}

function cleanUtm(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 200) return undefined
  if (hasControlChar(trimmed) || /[|=<>]/.test(trimmed)) return undefined
  return trimmed
}

const MAX_PAGE_LEN = 500

function sanitizePage(value: unknown, request: Request, locals: unknown): string {
  if (typeof value !== 'string') return ''
  const raw = value.trim()
  if (!raw || raw.length > 2000) return ''
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw.slice(0, MAX_PAGE_LEN)
  const host = hostnameOf(raw)
  if (!host || !isHostAllowed(host, request, locals)) return ''
  try {
    const url = new URL(raw)
    return `${url.pathname}${url.search}`.slice(0, MAX_PAGE_LEN)
  } catch {
    return ''
  }
}

/** Form page first, then the Referer path and query. */
export function resolveSignupPage(signupPage: unknown, request: Request, locals: unknown): string {
  const fromForm = sanitizePage(signupPage, request, locals)
  if (fromForm) return fromForm
  return sanitizePage(request.headers.get('referer'), request, locals)
}

function inferSource(page: string): string {
  const path = page.split('?')[0].toLowerCase()
  if (path.includes('biosecurity')) return 'biosecurity'
  if (path.includes('case-study') || path.includes('case-studies')) return 'case-study'
  if (path === '/podcast' || path === '/podcast/') return 'hub'
  if (path.startsWith('/podcast/')) return 'episode_page'
  if (path.startsWith('/lawn')) return 'lawn'
  if (path.startsWith('/blog')) return 'blog'
  return 'website'
}

export function resolveSignupSource(source: unknown, page: string): string {
  if (typeof source === 'string' && VALID_SOURCES.has(source)) return source
  return inferSource(page)
}

export function collectSignupUtm(
  payload: Record<string, unknown>,
  page: string
): Record<string, string> {
  const q = page.indexOf('?')
  const params = q >= 0 ? new URLSearchParams(page.slice(q + 1)) : null
  const utm: Record<string, string> = {}
  for (const key of UTM_KEYS) {
    const value = cleanUtm(payload[key]) || cleanUtm(params?.get(key) ?? undefined)
    if (value) utm[key] = value
  }
  return utm
}
