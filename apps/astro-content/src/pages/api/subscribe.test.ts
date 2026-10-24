import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { NEXUS_NEWSLETTER_URL } from './subscribe-nexus'
import { POST } from './subscribe'

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

describe('POST /api/subscribe', () => {
  let fetchCalls: FetchCall[]

  beforeEach(() => {
    fetchCalls = []
    mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: FetchInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      fetchCalls.push({ url, init })
      return new Response('{}', { status: 200 })
    })
  })

  afterEach(() => {
    mock.restoreAll()
  })

  it('calls Customer.io PUT, then Nexus, then newsletter_signup event', async () => {
    const locals = makeLocals({
      CUSTOMERIO_SITE_ID: 'cio-site',
      CUSTOMERIO_TRACK_API_KEY: 'cio-key',
      NEWSLETTER_MINT_SECRET: 'mint-secret-value',
    })

    const res = await POST({
      request: jsonRequest({
        email: 'farmer@example.com',
        source: 'footer',
        first_name: 'Bill',
        signupPage: '/podcast/',
        episodeSlug: 'ep-1',
      }),
      locals,
      clientAddress: '',
      cookies: new Map(),
      params: {},
      preferredLocale: undefined,
      redirect: () => new Response(),
      site: undefined as never,
      generator: '',
      url: new URL('http://localhost/api/subscribe'),
    })

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

    const res = await POST({
      request: jsonRequest({ email: 'betty@example.com', source: 'blog' }),
      locals,
      clientAddress: '',
      cookies: new Map(),
      params: {},
      preferredLocale: undefined,
      redirect: () => new Response(),
      site: undefined as never,
      generator: '',
      url: new URL('http://localhost/api/subscribe'),
    })

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

  it('still succeeds when Nexus returns 429, 500, or times out', async () => {
    const locals = makeLocals({
      CUSTOMERIO_SITE_ID: 'cio-site',
      CUSTOMERIO_TRACK_API_KEY: 'cio-key',
      NEWSLETTER_MINT_SECRET: 'mint',
    })

    for (const scenario of ['429', '500', 'timeout'] as const) {
      fetchCalls = []
      mock.restoreAll()
      mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: FetchInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        fetchCalls.push({ url, init })
        if (url === NEXUS_NEWSLETTER_URL) {
          if (scenario === 'timeout') {
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            return Promise.reject(err)
          }
          return new Response('error', { status: Number(scenario) })
        }
        return new Response('{}', { status: 200 })
      })

      const res = await POST({
        request: jsonRequest({ email: 'taylor@example.com' }),
        locals,
        clientAddress: '',
        cookies: new Map(),
        params: {},
        preferredLocale: undefined,
        redirect: () => new Response(),
        site: undefined as never,
        generator: '',
        url: new URL('http://localhost/api/subscribe'),
      })

      assert.equal(res.status, 200, `expected success for Nexus ${scenario}`)
      const body = await res.json()
      assert.deepEqual(body, { success: true })
    }
  })

  it('maps invalid source to website for Nexus and Customer.io', async () => {
    const locals = makeLocals({
      CUSTOMERIO_SITE_ID: 's',
      CUSTOMERIO_TRACK_API_KEY: 'k',
    })

    await POST({
      request: jsonRequest({ email: 'a@b.co', source: 'not-a-real-source' }),
      locals,
      clientAddress: '',
      cookies: new Map(),
      params: {},
      preferredLocale: undefined,
      redirect: () => new Response(),
      site: undefined as never,
      generator: '',
      url: new URL('http://localhost/api/subscribe'),
    })

    const nexusBody = JSON.parse(
      fetchCalls.find((c) => c.url === NEXUS_NEWSLETTER_URL)!.init?.body as string
    )
    assert.equal(nexusBody.source, 'website')
  })
})
