import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import {
  NEXUS_NEWSLETTER_URL,
  resetNexusMintTimeoutMs,
  setNexusMintTimeoutMs,
} from './subscribe-nexus'
import { POST } from '../pages/api/subscribe'

const CIO_BASE = 'https://track.customer.io/api/v1'

function makeLocals(env: Record<string, string | undefined>) {
  return { runtime: { env } }
}

function jsonRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

type FetchInit = {
  method?: string
  headers?: Record<string, string> | Headers
  body?: string
  signal?: AbortSignal
}

type FetchCall = { url: string; init?: FetchInit }

function postContext(body: Record<string, unknown>, locals: ReturnType<typeof makeLocals>) {
  return {
    request: jsonRequest(body),
    locals,
    clientAddress: '',
    cookies: new Map(),
    params: {},
    preferredLocale: undefined,
    redirect: () => new Response(),
    site: undefined as never,
    generator: '',
    url: new URL('http://localhost/api/subscribe'),
  } as Parameters<typeof POST>[0]
}

function abortError(): Error {
  const err = new Error('The operation was aborted')
  err.name = 'AbortError'
  return err
}

describe('POST /api/subscribe', () => {
  let fetchCalls: FetchCall[]

  beforeEach(() => {
    fetchCalls = []
    resetNexusMintTimeoutMs()
    mock.method(console, 'warn', () => {})
    mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: FetchInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      fetchCalls.push({ url, init })
      return new Response('{}', { status: 200 })
    })
  })

  afterEach(() => {
    mock.restoreAll()
    resetNexusMintTimeoutMs()
  })

  it('calls Customer.io PUT, then Nexus, then newsletter_signup event', async () => {
    const locals = makeLocals({
      CUSTOMERIO_SITE_ID: 'cio-site',
      CUSTOMERIO_TRACK_API_KEY: 'cio-key',
      NEWSLETTER_MINT_SECRET: 'mint-secret-value',
    })

    const res = await POST(
      postContext(
        {
          email: 'farmer@example.com',
          source: 'footer',
          first_name: 'Bill',
          signupPage: '/podcast/',
          episodeSlug: 'ep-1',
        },
        locals
      )
    )

    assert.equal(res.status, 200)
    assert.equal(fetchCalls.length, 3)

    const [putCall, nexusCall, eventCall] = fetchCalls
    assert.equal(putCall.url, `${CIO_BASE}/customers/farmer%40example.com`)
    assert.equal(putCall.init?.method, 'PUT')
    const putAuth = (putCall.init?.headers as Record<string, string>).Authorization
    assert.equal(putAuth, `Basic ${btoa('cio-site:cio-key')}`)
    const putBody = JSON.parse(putCall.init?.body as string)
    assert.equal(putBody.email, 'farmer@example.com')
    assert.equal(putBody.newsletter_subscriber, true)
    assert.equal(putBody.newsletter_signup_source, 'footer')
    assert.equal(putBody.podcast_subscriber, true)

    assert.equal(nexusCall.url, NEXUS_NEWSLETTER_URL)
    assert.equal(nexusCall.init?.method, 'POST')
    assert.ok(nexusCall.init?.signal)
    const nexusHeaders = nexusCall.init?.headers as Record<string, string>
    assert.equal(nexusHeaders.Authorization, 'Bearer mint-secret-value')
    assert.equal(nexusHeaders.Origin, 'https://southlandorganics.com')
    assert.equal(nexusHeaders['Content-Type'], 'application/json')
    const nexusBody = JSON.parse(nexusCall.init?.body as string)
    assert.deepEqual(nexusBody, {
      email: 'farmer@example.com',
      source: 'footer',
      company_website: '',
      first_name: 'Bill',
    })

    assert.equal(eventCall.url, `${CIO_BASE}/customers/farmer%40example.com/events`)
    assert.equal(eventCall.init?.method, 'POST')
    const eventBody = JSON.parse(eventCall.init?.body as string)
    assert.equal(eventBody.name, 'newsletter_signup')
    assert.deepEqual(eventBody.data, {
      source: 'footer',
      signup_page: '/podcast/',
      podcast: true,
    })
  })

  it('omits Nexus Authorization when NEWSLETTER_MINT_SECRET is missing', async () => {
    const locals = makeLocals({
      CUSTOMERIO_SITE_ID: 'cio-site',
      CUSTOMERIO_TRACK_API_KEY: 'cio-key',
    })

    const res = await POST(postContext({ email: 'betty@example.com', source: 'blog' }, locals))

    assert.equal(res.status, 200)
    const nexusCall = fetchCalls.find((c) => c.url === NEXUS_NEWSLETTER_URL)
    assert.ok(nexusCall)
    const nexusHeaders = nexusCall.init?.headers as Record<string, string>
    assert.equal(nexusHeaders.Authorization, undefined)
    const nexusBody = JSON.parse(nexusCall.init?.body as string)
    assert.deepEqual(nexusBody, {
      email: 'betty@example.com',
      source: 'blog',
      company_website: '',
    })
  })

  it('still succeeds when Nexus returns 429 or 500', async () => {
    const locals = makeLocals({
      CUSTOMERIO_SITE_ID: 'cio-site',
      CUSTOMERIO_TRACK_API_KEY: 'cio-key',
      NEWSLETTER_MINT_SECRET: 'mint',
    })

    for (const status of [429, 500] as const) {
      fetchCalls = []
      mock.restoreAll()
      mock.method(console, 'warn', () => {})
      mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: FetchInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        fetchCalls.push({ url, init })
        if (url === NEXUS_NEWSLETTER_URL) {
          return new Response('error', { status })
        }
        return new Response('{}', { status: 200 })
      })

      const res = await POST(postContext({ email: 'taylor@example.com' }, locals))

      assert.equal(res.status, 200, `expected success for Nexus ${status}`)
      const body = await res.json()
      assert.deepEqual(body, { success: true })
      const eventCall = fetchCalls.find((c) => c.url.endsWith('/events'))
      assert.ok(eventCall, 'newsletter_signup event should still post')
    }
  })

  it('does not log Nexus error response bodies', async () => {
    const locals = makeLocals({
      CUSTOMERIO_SITE_ID: 'cio-site',
      CUSTOMERIO_TRACK_API_KEY: 'cio-key',
      NEWSLETTER_MINT_SECRET: 'super-secret-mint-token',
    })

    mock.restoreAll()
    const logged: unknown[][] = []
    mock.method(console, 'warn', (...args: unknown[]) => {
      logged.push(args)
    })
    mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url === NEXUS_NEWSLETTER_URL) {
        return new Response('leaked super-secret-mint-token in body', { status: 500 })
      }
      return new Response('{}', { status: 200 })
    })

    await POST(postContext({ email: 'quiet@example.com' }, locals))

    const joined = logged.map((row) => row.join(' ')).join('\n')
    assert.match(joined, /Nexus newsletter failed: 500/)
    assert.doesNotMatch(joined, /super-secret-mint-token/)
    assert.doesNotMatch(joined, /leaked/)
  })

  it('aborts Nexus fetch at configured timeout and still posts newsletter_signup', async () => {
    setNexusMintTimeoutMs(40)
    const locals = makeLocals({
      CUSTOMERIO_SITE_ID: 'cio-site',
      CUSTOMERIO_TRACK_API_KEY: 'cio-key',
      NEWSLETTER_MINT_SECRET: 'mint',
    })

    mock.restoreAll()
    mock.method(console, 'warn', () => {})
    fetchCalls = []
    mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: FetchInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      fetchCalls.push({ url, init })
      if (url === NEXUS_NEWSLETTER_URL) {
        assert.ok(init?.signal, 'Nexus fetch must pass AbortSignal')
        return new Promise<Response>((_, reject) => {
          const signal = init!.signal!
          if (signal.aborted) {
            reject(abortError())
            return
          }
          signal.addEventListener('abort', () => reject(abortError()), { once: true })
        })
      }
      return new Response('{}', { status: 200 })
    })

    const started = Date.now()
    const res = await POST(postContext({ email: 'timeout@example.com' }, locals))
    const elapsed = Date.now() - started

    assert.equal(res.status, 200)
    assert.ok(elapsed >= 35 && elapsed < 500, `expected ~40ms abort, got ${elapsed}ms`)
    assert.equal(fetchCalls.length, 3)
    assert.equal(fetchCalls[1].url, NEXUS_NEWSLETTER_URL)
    assert.ok(fetchCalls[1].init?.signal)
    assert.equal(fetchCalls[2].url, `${CIO_BASE}/customers/timeout%40example.com/events`)
  })

  it('defaults unknown signup source to website in the Nexus payload', async () => {
    const locals = makeLocals({
      CUSTOMERIO_SITE_ID: 's',
      CUSTOMERIO_TRACK_API_KEY: 'k',
    })

    await POST(postContext({ email: 'a@b.co', source: 'not-a-real-source' }, locals))

    const nexusBody = JSON.parse(
      fetchCalls.find((c) => c.url === NEXUS_NEWSLETTER_URL)!.init?.body as string
    )
    assert.equal(nexusBody.source, 'website')
  })
})
