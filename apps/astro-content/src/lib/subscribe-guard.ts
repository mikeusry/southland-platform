/**
 * Guards for POST /api/subscribe.
 *
 * wrangler.toml for this app has no KV or D1 binding, so the rate limits are
 * in-memory and best-effort: they hold for the life of one isolate and reset
 * when that isolate goes away. Do not add a Cloudflare resource for this.
 */

import { parseSubscribeEmail, type EmailVerdict } from './subscribe-email'
import { getServerEnv } from './server-env'

export type { EmailVerdict }

export const SUBSCRIBE_IP_LIMIT = 20
export const SUBSCRIBE_IP_WINDOW_MS = 60 * 60 * 1000
export const SUBSCRIBE_EMAIL_LIMIT = 1
export const SUBSCRIBE_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000
/** Shared cap for IP and successful-signup buckets. Oldest key is evicted. */
export const SUBSCRIBE_BUCKET_CAP = 5000

const MX_LOOKUP_TIMEOUT_MS = 1500
const DOH_URL = 'https://cloudflare-dns.com/dns-query'

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

type Bucket = { count: number; reset: number }

/** One map so the hard cap covers IP buckets and successful-signup buckets together. */
const buckets = new Map<string, Bucket>()

let clock = (): number => Date.now()

/** Test hook. Production code leaves the clock on Date.now. */
export function setSubscribeClock(fn: () => number): void {
  clock = fn
}

export function resetSubscribeGuards(): void {
  buckets.clear()
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
 * Localhost is local dev. A *.pages.dev request host is not preview by itself:
 * southland-website.pages.dev is a live production alias, and a missing
 * CF_PAGES_BRANCH is production too. Preview origins are allowed only for
 * localhost, or when CF_PAGES_BRANCH is set and is not main/master (including
 * a preview deploy on a custom hostname).
 */
export function deploymentAllowsPreview(request: Request, locals: unknown): boolean {
  const reqHost = hostnameOf(request.url)
  if (reqHost && isLocalHost(reqHost)) return true
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

/** Null when neither Cloudflare nor the platform supplied an address. Do not share a bucket. */
export function clientIp(request: Request, clientAddress?: string | null): string | null {
  const cf = request.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const addr = clientAddress?.trim()
  if (addr) return addr
  return null
}

function evictOldest(): void {
  const oldest = buckets.keys().next().value
  if (oldest !== undefined) buckets.delete(oldest)
}

function ensureRoom(key: string): void {
  if (buckets.has(key)) return
  while (buckets.size >= SUBSCRIBE_BUCKET_CAP) evictOldest()
}

function freshBucket(key: string, windowMs: number): Bucket {
  const existing = buckets.get(key)
  if (existing) buckets.delete(key)
  ensureRoom(key)
  const created: Bucket = { count: 0, reset: clock() + windowMs }
  buckets.set(key, created)
  return created
}

/**
 * Counts one validated attempt. A missing IP does not limit anyone.
 * Returns limited when this attempt exceeds the hourly cap.
 */
export function consumeIpBudget(ip: string | null): { limited: boolean; retryAfter: number } {
  if (!ip) return { limited: false, retryAfter: 0 }
  const key = `ip:${ip}`
  const t = clock()
  const existing = buckets.get(key)
  if (!existing || t >= existing.reset) {
    const created = freshBucket(key, SUBSCRIBE_IP_WINDOW_MS)
    created.count = 1
    return { limited: false, retryAfter: 0 }
  }
  existing.count += 1
  if (existing.count > SUBSCRIBE_IP_LIMIT) {
    return { limited: true, retryAfter: Math.max(1, Math.ceil((existing.reset - t) / 1000)) }
  }
  return { limited: false, retryAfter: 0 }
}

/** True when this address already completed its one successful signup today. */
export function successfulSignupLimited(email: string): { limited: boolean; retryAfter: number } {
  const existing = buckets.get(`em:${email}`)
  const t = clock()
  if (!existing || t >= existing.reset || existing.count < SUBSCRIBE_EMAIL_LIMIT) {
    return { limited: false, retryAfter: 0 }
  }
  return { limited: true, retryAfter: Math.max(1, Math.ceil((existing.reset - t) / 1000)) }
}

/** Call only after Customer.io accepted the identify. Other addresses are untouched. */
export function recordSuccessfulSignup(email: string): void {
  const key = `em:${email}`
  const t = clock()
  const existing = buckets.get(key)
  if (!existing || t >= existing.reset) {
    const created = freshBucket(key, SUBSCRIBE_EMAIL_WINDOW_MS)
    created.count = 1
    return
  }
  existing.count += 1
}

function isBlockedDomain(domain: string): boolean {
  for (const blocked of BLOCKED_DOMAINS) {
    if (domain === blocked || domain.endsWith(`.${blocked}`)) return true
  }
  return false
}

/**
 * Strict syntax, then the blocklist. Apostrophes, `&`, leading or trailing
 * `_`/`-`, plus-tags, and IDN domains still pass. `domain` is ASCII (punycode)
 * for the DNS lookup.
 */
export function validateSubscribeEmail(raw: string): EmailVerdict {
  const parsed = parseSubscribeEmail(raw)
  if (!parsed.ok) return parsed
  if (isBlockedDomain(parsed.domain)) return { ok: false }
  const at = parsed.email.lastIndexOf('@')
  const typedDomain = at >= 0 ? parsed.email.slice(at + 1) : ''
  if (typedDomain !== parsed.domain && isBlockedDomain(typedDomain)) return { ok: false }
  return parsed
}

interface DnsAnswer {
  type?: number
  data?: string
}

interface DnsJson {
  Status?: number
  Answer?: DnsAnswer[]
}

function isNullMx(data: string): boolean {
  const parts = data.trim().split(/\s+/)
  const exchange = parts[parts.length - 1] ?? ''
  return exchange === '.'
}

type DohResult = { ok: true; data: DnsJson } | { ok: false }

async function dohQuery(name: string, type: 'MX' | 'A' | 'AAAA'): Promise<DohResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MX_LOOKUP_TIMEOUT_MS)
  try {
    const url = `${DOH_URL}?name=${encodeURIComponent(name)}&type=${type}`
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
      signal: controller.signal,
    })
    if (!res.ok) return { ok: false }
    const data = (await res.json()) as DnsJson
    if (typeof data?.Status !== 'number') return { ok: false }
    return { ok: true, data }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(timer)
  }
}

function mxData(data: DnsJson): string[] {
  const answers = Array.isArray(data.Answer) ? data.Answer : []
  return answers
    .filter((answer) => answer?.type === 15 && typeof answer.data === 'string')
    .map((answer) => answer.data as string)
}

function hasAddressRecord(data: DnsJson): boolean {
  const answers = Array.isArray(data.Answer) ? data.Answer : []
  return answers.some((answer) => answer?.type === 1 || answer?.type === 28)
}

/** Static message only. The lookup URL contains the domain, which is the address. */
function failOpenMx(): true {
  console.warn('[subscribe] MX lookup failed open')
  return true
}

/** NOERROR or NXDOMAIN. SERVFAIL, REFUSED, and anything else are not a verdict. */
function isDefinitiveDns(status: number | undefined): boolean {
  return status === 0 || status === 3
}

/**
 * DNS-over-HTTPS via cloudflare-dns.com (1.1.1.1 is often refused from Workers).
 * Reject NXDOMAIN, a null MX, and a definitive answer with no MX and no A/AAAA.
 * No MX plus an A or AAAA record is deliverable.
 * Lookup errors, timeouts, SERVFAIL, and REFUSED allow the signup.
 */
export async function domainHasMx(domain: string): Promise<boolean> {
  const mx = await dohQuery(domain, 'MX')
  if (!mx.ok) return failOpenMx()
  if (mx.data.Status === 3) return false
  if (mx.data.Status !== 0) return failOpenMx()

  const records = mxData(mx.data)
  if (records.some((record) => !isNullMx(record))) return true
  if (records.length > 0) return false

  const ipv4 = await dohQuery(domain, 'A')
  if (!ipv4.ok) return failOpenMx()
  if (hasAddressRecord(ipv4.data)) return true
  if (!isDefinitiveDns(ipv4.data.Status)) return failOpenMx()

  const ipv6 = await dohQuery(domain, 'AAAA')
  if (!ipv6.ok) return failOpenMx()
  if (hasAddressRecord(ipv6.data)) return true
  if (!isDefinitiveDns(ipv6.data.Status)) return failOpenMx()
  return false
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

function readPageTarget(value: unknown, request: Request, locals: unknown): string {
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

function pathOnly(value: string): string {
  if (!value) return ''
  const cut = value.search(/[?#]/)
  return cut >= 0 ? value.slice(0, cut) : value
}

/** Path plus query, for UTM parsing. Not stored on the profile. */
export function resolveSignupSignal(
  signupPage: unknown,
  request: Request,
  locals: unknown
): string {
  const fromForm = readPageTarget(signupPage, request, locals)
  if (fromForm) return fromForm
  return readPageTarget(request.headers.get('referer'), request, locals)
}

/** Form page first, then the Referer. Query string is stripped. */
export function resolveSignupPage(signupPage: unknown, request: Request, locals: unknown): string {
  return pathOnly(resolveSignupSignal(signupPage, request, locals))
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

export type SignupUtmInput = {
  utm_source?: unknown
  utm_medium?: unknown
  utm_campaign?: unknown
  utm_content?: unknown
  utm_term?: unknown
}

export function collectSignupUtm(payload: SignupUtmInput, page: string): Record<string, string> {
  const q = page.indexOf('?')
  const params = q >= 0 ? new URLSearchParams(page.slice(q + 1)) : null
  const utm: Record<string, string> = {}
  for (const key of UTM_KEYS) {
    const value = cleanUtm(payload[key]) || cleanUtm(params?.get(key) ?? undefined)
    if (value) utm[key] = value
  }
  return utm
}
