/**
 * Accept a Dash admin ticket and keep a site cookie.
 * Same SITE_SSO_SECRET as pd-dashboard. See src/lib/site-sso.ts there.
 */

const TEXT = new TextEncoder()
const COOKIE = 'pd_admin'
const SESSION_TTL_SECONDS = 60 * 60 * 12

type TicketPayload = {
  v: 1
  b: string
  e: string
  x: number
}

type CookieJar = {
  get(name: string): { value: string } | undefined
  set(
    name: string,
    value: string,
    options?: {
      path?: string
      httpOnly?: boolean
      sameSite?: 'lax' | 'strict' | 'none'
      secure?: boolean
      maxAge?: number
    }
  ): void
}

function bytesToB64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

function b64urlToString(value: string): string {
  const b64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  return atob(b64 + pad)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

async function hmac(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    TEXT.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, TEXT.encode(body)))
  return bytesToB64url(sig)
}

async function signSiteTicket(
  secret: string,
  brand: string,
  email: string,
  ttlSeconds: number
): Promise<string> {
  const payload: TicketPayload = {
    v: 1,
    b: brand,
    e: email,
    x: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const body = bytesToB64url(TEXT.encode(JSON.stringify(payload)))
  return `${body}.${await hmac(secret, body)}`
}

async function verifySiteTicket(
  secret: string,
  token: string,
  brand: string
): Promise<{ email: string } | null> {
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!body || !sig) return null
  if (!timingSafeEqual(sig, await hmac(secret, body))) return null

  let payload: TicketPayload
  try {
    payload = JSON.parse(b64urlToString(body)) as TicketPayload
  } catch {
    return null
  }
  if (payload.v !== 1 || payload.b !== brand) return null
  if (!payload.e || typeof payload.x !== 'number') return null
  if (payload.x < Math.floor(Date.now() / 1000)) return null
  return { email: payload.e }
}

export function readServerEnv(
  locals: unknown,
  key: 'SITE_SSO_SECRET' | 'DASH_ORIGIN'
): string | undefined {
  const runtime = (locals as { runtime?: { env?: Record<string, string | undefined> } } | null)
    ?.runtime?.env?.[key]
  if (typeof runtime === 'string' && runtime) return runtime
  const meta =
    key === 'SITE_SSO_SECRET' ? import.meta.env.SITE_SSO_SECRET : import.meta.env.DASH_ORIGIN
  if (typeof meta === 'string' && meta) return meta
  if (typeof process !== 'undefined' && typeof process.env[key] === 'string' && process.env[key]) {
    return process.env[key]
  }
  return undefined
}

export function dashOrigin(locals: unknown): string {
  const configured = readServerEnv(locals, 'DASH_ORIGIN')
  if (configured) return configured.replace(/\/$/, '')
  if (import.meta.env.DEV) return 'http://localhost:3450'
  return 'https://dash.point.dog'
}

export async function gateAdmin(input: {
  request: Request
  url: URL
  locals: unknown
  cookies: CookieJar
  brand: string
  extraPrefixes?: string[]
}): Promise<Response | null> {
  const path = input.url.pathname
  const extras = input.extraPrefixes ?? []
  const protectedPath =
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/api/admin' ||
    path.startsWith('/api/admin/') ||
    extras.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  if (!protectedPath) return null

  const secret = readServerEnv(input.locals, 'SITE_SSO_SECRET')
  if (!secret) {
    return new Response('Admin sign-in is not configured', { status: 503 })
  }

  const ticket = input.url.searchParams.get('pd_ticket')
  if (ticket) {
    const proof = await verifySiteTicket(secret, ticket, input.brand)
    if (proof) {
      const session = await signSiteTicket(secret, input.brand, proof.email, SESSION_TTL_SECONDS)
      input.cookies.set(COOKIE, session, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: input.url.protocol === 'https:',
        maxAge: SESSION_TTL_SECONDS,
      })
      const clean = new URL(input.url)
      clean.searchParams.delete('pd_ticket')
      return Response.redirect(clean.toString(), 302)
    }
  }

  const existing = input.cookies.get(COOKIE)?.value
  if (existing && (await verifySiteTicket(secret, existing, input.brand))) {
    return null
  }

  const wantsHtml = (input.request.headers.get('accept') ?? '').includes('text/html')
  if (!wantsHtml || path.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const back = new URL(input.url)
  back.searchParams.delete('pd_ticket')
  back.hash = ''
  const login = new URL('/auth/site', dashOrigin(input.locals))
  login.searchParams.set('brand', input.brand)
  login.searchParams.set('return', back.toString())
  return Response.redirect(login.toString(), 302)
}
