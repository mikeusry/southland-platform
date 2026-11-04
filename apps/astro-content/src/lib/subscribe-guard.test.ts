import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { POST } from '../pages/api/subscribe'
import { NEXUS_NEWSLETTER_URL } from './subscribe-nexus'
import {
  SUBSCRIBE_EMAIL_LIMIT,
  SUBSCRIBE_IP_LIMIT,
  SUBSCRIBE_IP_WINDOW_MS,
  resetSubscribeGuards,
  setSubscribeClock,
} from './subscribe-guard'

const CIO_BASE = 'https://track.customer.io/api/v1'
const MX_URL = 'https://1.1.1.1/dns-query'

const MX_OK = { Status: 0, Answer: [{ type: 15, data: '10 mx.example.com.' }] }
const MX_NONE = { Status: 0, Answer: [] as { type: number; data: string }[] }
const MX_NULL = { Status: 0, Answer: [{ type: 15, data: '0 .' }] }
const MX_NXDOMAIN = { Status: 3, Answer: [] as { type: number; data: string }[] }

type FetchInit = { method?: string; headers?: Record<string, string> | Headers; body?: string }

function makeLocals(env: Record<string, string | undefined> = {}) {
  return {
    runtime: {
      env: {
        CUSTOMERIO_SITE_ID: 'cio-site',
        CUSTOMERIO_TRACK_API_KEY: 'cio-key',
        NEWSLETTER_MINT_SECRET: 'mint-secret-value',
        ...env,
      },
    },
  }
}

function postContext(
  body: Record<string, unknown>,
  locals: ReturnType<typeof makeLocals>,
  opts?: { origin?: string | null; referer?: string; ip?: string; url?: string }
) {
  const url = opts?.url ?? 'http://localhost/api/subscribe'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts?.origin !== null) headers.Origin = opts?.origin ?? 'http://localhost'
  if (opts?.referer) headers.Referer = opts.referer
  if (opts?.ip) headers['cf-connecting-ip'] = opts.ip
  return {
    request: new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }),
    locals,
    clientAddress: '127.0.0.1',
    cookies: new Map(),
    params: {},
    preferredLocale: undefined,
    redirect: () => new Response(),
    site: undefined as never,
    generator: '',
    url: new URL(url),
  } as Parameters<typeof POST>[0]
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

describe('POST /api/subscribe guards', () => {
  let fetchCalls: { url: string; init?: FetchInit }[]
  let mxResponse: { status: number; body: unknown } | 'throw'

  beforeEach(() => {
    fetchCalls = []
    mxResponse = { status: 200, body: MX_OK }
    resetSubscribeGuards()
    mock.method(console, 'warn', () => {})
    mock.method(console, 'error', () => {})
    mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: FetchInit) => {
      const url = urlOf(input)
      fetchCalls.push({ url, init })
      if (url.startsWith(MX_URL)) {
        if (mxResponse === 'throw') throw new Error('dns down')
        return new Response(JSON.stringify(mxResponse.body), { status: mxResponse.status })
      }
      return new Response('{}', { status: 200 })
    })
  })

  afterEach(() => {
    mock.restoreAll()
    resetSubscribeGuards()
  })

  function cioCalls() {
    return fetchCalls.filter((call) => call.url.startsWith(CIO_BASE))
  }

  it('returns a success-looking response and does not subscribe when the honeypot is filled', async () => {
    const res = await POST(
      postContext({ email: 'reader@gmail.com', website: 'https://spam.test' }, makeLocals(), {
        ip: '203.0.113.10',
      })
    )
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { success: true })
    assert.equal(fetchCalls.length, 0)
  })

  it('still subscribes when the honeypot is empty', async () => {
    const res = await POST(
      postContext({ email: 'reader@gmail.com', website: '   ' }, makeLocals(), {
        ip: '203.0.113.11',
      })
    )
    assert.equal(res.status, 200)
    assert.ok(cioCalls().some((call) => call.init?.method === 'PUT'))
  })

  it('rejects a missing origin and referer', async () => {
    const res = await POST(
      postContext({ email: 'reader@gmail.com' }, makeLocals(), {
        origin: null,
        ip: '203.0.113.12',
      })
    )
    assert.equal(res.status, 403)
    assert.deepEqual(await res.json(), { error: 'Forbidden.' })
    assert.equal(fetchCalls.length, 0)
  })

  it('rejects a cross-origin request', async () => {
    const res = await POST(
      postContext({ email: 'reader@gmail.com' }, makeLocals(), {
        origin: 'https://evil.example',
        ip: '203.0.113.13',
      })
    )
    assert.equal(res.status, 403)
    assert.equal(fetchCalls.length, 0)
  })

  it('allows the live site, www, and a referer when Origin is absent', async () => {
    const locals = makeLocals()
    const apex = await POST(
      postContext({ email: 'apex@gmail.com' }, locals, {
        origin: 'https://southlandorganics.com',
        url: 'https://southlandorganics.com/api/subscribe',
        ip: '203.0.113.14',
      })
    )
    assert.equal(apex.status, 200)

    const www = await POST(
      postContext({ email: 'www-user@gmail.com' }, locals, {
        origin: 'https://www.southlandorganics.com',
        url: 'https://southlandorganics.com/api/subscribe',
        ip: '203.0.113.15',
      })
    )
    assert.equal(www.status, 200)

    const refererOnly = await POST(
      postContext({ email: 'ref@gmail.com' }, locals, {
        origin: null,
        referer:
          'https://www.southlandorganics.com/lawn/homeowners/?utm_source=email&utm_campaign=spring',
        url: 'https://southlandorganics.com/api/subscribe',
        ip: '203.0.113.16',
      })
    )
    assert.equal(refererOnly.status, 200)
    const put = cioCalls().find(
      (call) => call.url.includes('ref%40gmail.com') && call.init?.method === 'PUT'
    )
    const putBody = JSON.parse(put?.init?.body as string)
    assert.equal(putBody.newsletter_signup_source, 'lawn')
    assert.equal(putBody.signup_page, '/lawn/homeowners/?utm_source=email&utm_campaign=spring')
    assert.equal(putBody.utm_source, 'email')
    assert.equal(putBody.utm_campaign, 'spring')
  })

  it('rejects localhost and preview origins on the production host', async () => {
    const locals = makeLocals({ CF_PAGES_BRANCH: 'main' })
    const localhost = await POST(
      postContext({ email: 'reader@gmail.com' }, locals, {
        origin: 'http://localhost:4400',
        url: 'https://southlandorganics.com/api/subscribe',
        ip: '203.0.113.17',
      })
    )
    assert.equal(localhost.status, 403)

    const preview = await POST(
      postContext({ email: 'reader@gmail.com' }, locals, {
        origin: 'https://abc.southland-website.pages.dev',
        url: 'https://southlandorganics.com/api/subscribe',
        ip: '203.0.113.18',
      })
    )
    assert.equal(preview.status, 403)
    assert.equal(fetchCalls.length, 0)
  })

  it('allows a pages.dev origin on a preview host', async () => {
    const res = await POST(
      postContext({ email: 'preview@gmail.com' }, makeLocals(), {
        origin: 'https://abc.southland-website.pages.dev',
        url: 'https://abc.southland-website.pages.dev/api/subscribe',
        ip: '203.0.113.19',
      })
    )
    assert.equal(res.status, 200)
  })

  it('rate limits an IP to 5 requests an hour, then allows again after the window', async () => {
    let now = 1_700_000_000_000
    setSubscribeClock(() => now)
    const locals = makeLocals()
    const ip = '203.0.113.20'
    for (let i = 0; i < SUBSCRIBE_IP_LIMIT; i++) {
      const res = await POST(postContext({ email: `ip${i}@gmail.com` }, locals, { ip }))
      assert.equal(res.status, 200, `request ${i + 1} should be allowed`)
    }
    const blocked = await POST(postContext({ email: 'ip-blocked@gmail.com' }, locals, { ip }))
    assert.equal(blocked.status, 429)
    assert.equal(blocked.headers.get('Retry-After'), '3600')
    assert.equal(cioCalls().filter((call) => call.url.includes('ip-blocked')).length, 0)

    now += SUBSCRIBE_IP_WINDOW_MS
    const again = await POST(postContext({ email: 'ip-later@gmail.com' }, locals, { ip }))
    assert.equal(again.status, 200)
  })

  it('rate limits an email to 3 subscriptions a day', async () => {
    const locals = makeLocals()
    const ip = '203.0.113.21'
    for (let i = 0; i < SUBSCRIBE_EMAIL_LIMIT; i++) {
      const res = await POST(postContext({ email: 'Repeat@gmail.com' }, locals, { ip }))
      assert.equal(res.status, 200, `signup ${i + 1} should be allowed`)
    }
    const before = cioCalls().length
    const blocked = await POST(postContext({ email: 'repeat@gmail.com' }, locals, { ip }))
    assert.equal(blocked.status, 429)
    assert.ok(Number(blocked.headers.get('Retry-After')) > 0)
    assert.equal(cioCalls().length, before)
  })

  it('rejects blocklisted domains and addresses containing | or =', async () => {
    const locals = makeLocals()
    const rejected = [
      'x@colsed.us',
      'a@mail.cscolu.us',
      'a@cdus.us',
      'a@news.columcen.us',
      'bad|box@gmail.com',
      'bad=box@gmail.com',
      'user@ex|ample.com',
      'user@ex=ample.com',
      'has space@gmail.com',
    ]
    for (const [index, email] of rejected.entries()) {
      const res = await POST(postContext({ email }, locals, { ip: `203.0.113.${30 + index}` }))
      assert.equal(res.status, 400, email)
      assert.deepEqual(await res.json(), { error: 'A valid email address is required.' })
    }
    assert.equal(fetchCalls.length, 0)
  })

  it('rejects domains with no MX, NXDOMAIN, and a null MX', async () => {
    const locals = makeLocals()
    const cases = [
      ['no-mx@gmail.com', MX_NONE],
      ['missing@gmail.com', MX_NXDOMAIN],
      ['nullmx@gmail.com', MX_NULL],
    ] as const
    for (const [index, [email, body]] of cases.entries()) {
      fetchCalls = []
      mxResponse = { status: 200, body }
      const res = await POST(postContext({ email }, locals, { ip: `203.0.113.${40 + index}` }))
      assert.equal(res.status, 400, email)
      assert.equal(cioCalls().length, 0, email)
      assert.ok(
        fetchCalls.some((call) => call.url.startsWith(MX_URL)),
        email
      )
    }
  })

  it('fails open when the MX lookup errors', async () => {
    const locals = makeLocals()
    mxResponse = 'throw'
    const thrown = await POST(
      postContext({ email: 'lookup-down@gmail.com' }, locals, { ip: '203.0.113.50' })
    )
    assert.equal(thrown.status, 200)

    fetchCalls = []
    mxResponse = { status: 500, body: {} }
    const httpFail = await POST(
      postContext({ email: 'lookup-500@gmail.com' }, locals, { ip: '203.0.113.51' })
    )
    assert.equal(httpFail.status, 200)
    assert.ok(cioCalls().some((call) => call.init?.method === 'PUT'))
  })

  it('subscribes a real address from the live origin and sends source, page, and UTM', async () => {
    const res = await POST(
      postContext(
        {
          email: 'Reader+News@gmail.com',
          source: 'blog',
          first_name: 'Pat',
          signupPage: '/blog/soil/?utm_source=google&utm_medium=cpc&utm_campaign=spring',
          utm_source: 'google',
          utm_medium: 'cpc',
          utm_campaign: 'spring',
          website: '',
        },
        makeLocals(),
        {
          origin: 'https://southlandorganics.com',
          referer: 'https://southlandorganics.com/podcast/',
          url: 'https://southlandorganics.com/api/subscribe',
          ip: '203.0.113.60',
        }
      )
    )

    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { success: true })

    const put = cioCalls().find((call) => call.init?.method === 'PUT')
    assert.ok(put)
    assert.equal(put?.url, `${CIO_BASE}/customers/reader%2Bnews%40gmail.com`)
    const putBody = JSON.parse(put?.init?.body as string)
    assert.equal(putBody.email, 'reader+news@gmail.com')
    assert.equal(putBody.newsletter_subscriber, true)
    assert.equal(putBody.newsletter_signup_source, 'blog')
    assert.equal(
      putBody.signup_page,
      '/blog/soil/?utm_source=google&utm_medium=cpc&utm_campaign=spring'
    )
    assert.equal(putBody.utm_source, 'google')
    assert.equal(putBody.utm_medium, 'cpc')
    assert.equal(putBody.utm_campaign, 'spring')
    assert.equal(putBody.podcast_subscriber, undefined)

    const nexus = fetchCalls.find((call) => call.url === NEXUS_NEWSLETTER_URL)
    assert.deepEqual(JSON.parse(nexus?.init?.body as string), {
      email: 'reader+news@gmail.com',
      source: 'blog',
      company_website: '',
      first_name: 'Pat',
    })

    const event = cioCalls().find((call) => call.url.endsWith('/events'))
    const eventBody = JSON.parse(event?.init?.body as string)
    assert.equal(eventBody.name, 'newsletter_signup')
    assert.notEqual(eventBody.name, 'newsletter_subscribed')
    assert.deepEqual(eventBody.data, {
      source: 'blog',
      signup_page: '/blog/soil/?utm_source=google&utm_medium=cpc&utm_campaign=spring',
      podcast: false,
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'spring',
    })
  })
})
