import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { POST } from '../pages/api/subscribe'
import { subscribeAddressIssue } from './subscribe-email'
import { NEXUS_NEWSLETTER_URL } from './subscribe-nexus'
import {
  SUBSCRIBE_BUCKET_CAP,
  SUBSCRIBE_EMAIL_LIMIT,
  SUBSCRIBE_IP_LIMIT,
  SUBSCRIBE_IP_WINDOW_MS,
  consumeIpBudget,
  resetSubscribeGuards,
  setSubscribeClock,
} from './subscribe-guard'

const CIO_BASE = 'https://track.customer.io/api/v1'
const MX_URL = 'https://cloudflare-dns.com/dns-query'

const MX_OK = { Status: 0, Answer: [{ type: 15, data: '10 mx.example.com.' }] }
const MX_NONE = { Status: 0, Answer: [] as { type: number; data: string }[] }
const MX_NULL = { Status: 0, Answer: [{ type: 15, data: '0 .' }] }
const MX_NXDOMAIN = { Status: 3, Answer: [] as { type: number; data: string }[] }
const A_OK = { Status: 0, Answer: [{ type: 1, data: '192.0.2.1' }] }
const AAAA_OK = { Status: 0, Answer: [{ type: 28, data: '2001:db8::1' }] }

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
  opts?: {
    origin?: string | null
    referer?: string
    ip?: string
    url?: string
    clientAddress?: string
  }
) {
  const url = opts?.url ?? 'http://localhost/api/subscribe'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts?.origin !== null) headers.Origin = opts?.origin ?? 'http://localhost'
  if (opts?.referer) headers.Referer = opts.referer
  if (opts?.ip) headers['cf-connecting-ip'] = opts.ip
  return {
    request: new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }),
    locals,
    clientAddress: opts?.clientAddress ?? '127.0.0.1',
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

type DnsReply = { status: number; body: unknown } | 'throw'

describe('POST /api/subscribe guards', () => {
  let fetchCalls: { url: string; init?: FetchInit }[]
  let mxResponse: DnsReply | ((url: string) => DnsReply)
  let cioPutStatus: number

  beforeEach(() => {
    fetchCalls = []
    mxResponse = { status: 200, body: MX_OK }
    cioPutStatus = 200
    resetSubscribeGuards()
    mock.method(console, 'warn', () => {})
    mock.method(console, 'error', () => {})
    mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: FetchInit) => {
      const url = urlOf(input)
      fetchCalls.push({ url, init })
      if (url.startsWith(MX_URL)) {
        const reply = typeof mxResponse === 'function' ? mxResponse(url) : mxResponse
        if (reply === 'throw') throw new Error('dns down')
        return new Response(JSON.stringify(reply.body), { status: reply.status })
      }
      if (url.startsWith(CIO_BASE) && init?.method === 'PUT' && cioPutStatus !== 200) {
        return new Response('no', { status: cioPutStatus })
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
    const warnings: string[] = []
    mock.method(console, 'warn', (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    })
    const res = await POST(
      postContext({ email: 'reader@gmail.com', hp_fax_2: 'https://spam.test' }, makeLocals(), {
        ip: '203.0.113.10',
      })
    )
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { success: true })
    assert.equal(fetchCalls.length, 0)
    const logged = warnings.join('\n')
    assert.match(logged, /honeypot filled/)
    assert.doesNotMatch(logged, /reader@gmail.com/)
    assert.doesNotMatch(logged, /@/)
  })

  it('still subscribes when the honeypot is empty or a password manager fills website', async () => {
    const empty = await POST(
      postContext({ email: 'reader@gmail.com', hp_fax_2: '   ' }, makeLocals(), {
        ip: '203.0.113.11',
      })
    )
    assert.equal(empty.status, 200)
    const filledWebsite = await POST(
      postContext({ email: 'other@gmail.com', website: 'https://autofill.example' }, makeLocals(), {
        ip: '203.0.113.111',
      })
    )
    assert.equal(filledWebsite.status, 200)
    assert.equal(cioCalls().filter((call) => call.init?.method === 'PUT').length, 2)
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
    assert.equal(putBody.signup_page, '/lawn/homeowners/')
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

  it('rejects a foreign pages.dev origin on the production pages.dev alias', async () => {
    const foreign = 'https://evil-preview.pages.dev'
    const alias = 'https://southland-website.pages.dev/api/subscribe'
    const onMain = await POST(
      postContext({ email: 'reader@gmail.com' }, makeLocals({ CF_PAGES_BRANCH: 'main' }), {
        origin: foreign,
        url: alias,
        ip: '203.0.113.19',
      })
    )
    assert.equal(onMain.status, 403)

    const unset = await POST(
      postContext({ email: 'reader@gmail.com' }, makeLocals(), {
        origin: foreign,
        url: alias,
        ip: '203.0.113.191',
      })
    )
    assert.equal(unset.status, 403)
    assert.equal(fetchCalls.length, 0)
  })

  it('allows a foreign pages.dev origin on a non-main branch', async () => {
    const res = await POST(
      postContext({ email: 'preview@gmail.com' }, makeLocals({ CF_PAGES_BRANCH: 'feature-x' }), {
        origin: 'https://abc.southland-website.pages.dev',
        url: 'https://feature-x.southland-website.pages.dev/api/subscribe',
        ip: '203.0.113.192',
      })
    )
    assert.equal(res.status, 200)
  })

  it('rate limits an IP to 20 validated requests an hour, then allows again after the window', async () => {
    let now = 1_700_000_000_000
    setSubscribeClock(() => now)
    const locals = makeLocals()
    const ip = '203.0.113.20'
    for (let i = 0; i < SUBSCRIBE_IP_LIMIT; i++) {
      const res = await POST(postContext({ email: `ip${i}@gmail.com` }, locals, { ip }))
      assert.equal(res.status, 200, `request ${i + 1} should be allowed`)
    }
    const mxBeforeBlock = fetchCalls.filter((call) => call.url.startsWith(MX_URL)).length
    const blocked = await POST(postContext({ email: 'ip-blocked@gmail.com' }, locals, { ip }))
    assert.equal(blocked.status, 429)
    assert.equal(blocked.headers.get('Retry-After'), '3600')
    assert.equal(cioCalls().filter((call) => call.url.includes('ip-blocked')).length, 0)
    assert.equal(
      fetchCalls.filter((call) => call.url.startsWith(MX_URL)).length,
      mxBeforeBlock,
      'an over-limit IP must not trigger a DNS lookup'
    )

    now += SUBSCRIBE_IP_WINDOW_MS
    const again = await POST(postContext({ email: 'ip-later@gmail.com' }, locals, { ip }))
    assert.equal(again.status, 200)
  })

  it('allows one successful signup per address per day and does not lock out others', async () => {
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

    const other = await POST(postContext({ email: 'someone-else@gmail.com' }, locals, { ip }))
    assert.equal(other.status, 200)
  })

  it('does not count invalid attempts or a missing IP toward the IP limit', async () => {
    const locals = makeLocals()
    const ip = '203.0.113.22'
    for (let i = 0; i < SUBSCRIBE_IP_LIMIT + 5; i++) {
      const res = await POST(postContext({ email: `bad|${i}@gmail.com` }, locals, { ip }))
      assert.equal(res.status, 400)
    }
    const afterJunk = await POST(postContext({ email: 'still-ok@gmail.com' }, locals, { ip }))
    assert.equal(afterJunk.status, 200)

    for (let i = 0; i < SUBSCRIBE_IP_LIMIT + 1; i++) {
      const res = await POST(
        postContext({ email: `anon${i}@gmail.com` }, locals, { clientAddress: '' })
      )
      assert.equal(res.status, 200, `missing IP request ${i + 1}`)
    }
  })

  it('does not lock an email out after failed signups', async () => {
    const locals = makeLocals()
    cioPutStatus = 502
    for (let i = 0; i < SUBSCRIBE_EMAIL_LIMIT; i++) {
      const res = await POST(
        postContext({ email: 'flaky@gmail.com' }, locals, { ip: '203.0.113.23' })
      )
      assert.equal(res.status, 502)
    }
    cioPutStatus = 200
    const res = await POST(
      postContext({ email: 'flaky@gmail.com' }, locals, { ip: '203.0.113.23' })
    )
    assert.equal(res.status, 200)
  })

  it('evicts the oldest in-memory rate-limit key at 5000 entries', () => {
    const oldest = '203.0.113.250'
    for (let i = 0; i < SUBSCRIBE_IP_LIMIT; i++) consumeIpBudget(oldest)
    assert.equal(consumeIpBudget(oldest).limited, true)
    for (let i = 0; i < SUBSCRIBE_BUCKET_CAP; i++) consumeIpBudget(`filler-${i}`)
    assert.equal(consumeIpBudget(oldest).limited, false)
  })

  it("rejects '/', ':', '?', '#', '\\', and '%' in the email domain", async () => {
    const locals = makeLocals()
    const rejected = [
      'user@example.com/path',
      'user@ex/ample.com',
      'user@example.com:25',
      'user@ex:ample.com',
      'user@example.com?q=1',
      'user@example.com#frag',
      'user@example.com\\evil',
      'user@example.com%41',
    ]
    for (const [index, email] of rejected.entries()) {
      const res = await POST(postContext({ email }, locals, { ip: `203.0.113.${80 + index}` }))
      assert.equal(res.status, 400, email)
      assert.deepEqual(await res.json(), { error: 'A valid email address is required.' })
    }
    assert.equal(fetchCalls.length, 0)
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
      'plainaddress',
      'missing-dot@localhost',
    ]
    for (const [index, email] of rejected.entries()) {
      const res = await POST(postContext({ email }, locals, { ip: `203.0.113.${30 + index}` }))
      assert.equal(res.status, 400, email)
      assert.deepEqual(await res.json(), { error: 'A valid email address is required.' })
    }
    assert.equal(fetchCalls.length, 0)
  })

  it('rejects only NXDOMAIN and null MX', async () => {
    const locals = makeLocals()
    const cases = [
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
        fetchCalls.some((call) => call.url.includes('type=MX')),
        email
      )
    }
  })

  it('accepts a domain with no MX when it has an A or AAAA record', async () => {
    const locals = makeLocals()
    mxResponse = (url) => {
      if (url.includes('type=AAAA')) return { status: 200, body: AAAA_OK }
      if (url.includes('type=A')) return { status: 200, body: A_OK }
      return { status: 200, body: MX_NONE }
    }
    const withA = await POST(
      postContext({ email: 'fallback@gmail.com' }, locals, { ip: '203.0.113.45' })
    )
    assert.equal(withA.status, 200)
    assert.ok(fetchCalls.some((call) => call.url.includes('type=A') && !call.url.includes('AAAA')))

    fetchCalls = []
    mxResponse = (url) => {
      if (url.includes('type=AAAA')) return { status: 200, body: AAAA_OK }
      return { status: 200, body: MX_NONE }
    }
    const withAAAA = await POST(
      postContext({ email: 'v6@gmail.com' }, locals, { ip: '203.0.113.46' })
    )
    assert.equal(withAAAA.status, 200)
    assert.ok(fetchCalls.some((call) => call.url.includes('type=AAAA')))
  })

  it('accepts apostrophes, ampersands, edge punctuation, plus-tags, and IDN domains', async () => {
    const locals = makeLocals()
    const accepted = [
      "o'brien@gmail.com",
      'a&b@gmail.com',
      '_lead@gmail.com',
      'trail-@gmail.com',
      '-lead@gmail.com',
      'user_@gmail.com',
      'reader+tag@gmail.com',
    ]
    for (const [index, email] of accepted.entries()) {
      const res = await POST(postContext({ email }, locals, { ip: `198.51.100.${index + 1}` }))
      assert.equal(res.status, 200, email)
    }

    fetchCalls = []
    const idn = await POST(
      postContext({ email: 'user@münchen.de' }, locals, { ip: '198.51.100.20' })
    )
    assert.equal(idn.status, 200)
    const ascii = new URL('http://münchen.de').hostname
    assert.ok(
      fetchCalls.some((call) => call.url.includes(`name=${ascii}`) && call.url.includes('type=MX'))
    )
  })

  it('fails open when the MX lookup errors and logs without the address', async () => {
    const warnings: string[] = []
    mock.method(console, 'warn', (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    })
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

    const logged = warnings.join('\n')
    assert.equal(warnings.length, 2)
    assert.match(logged, /MX lookup failed open/)
    assert.doesNotMatch(logged, /lookup-down/)
    assert.doesNotMatch(logged, /lookup-500/)
    assert.doesNotMatch(logged, /@/)
    assert.doesNotMatch(logged, /gmail/)
  })

  it('logs and allows SERVFAIL and REFUSED DNS answers', async () => {
    const warnings: string[] = []
    mock.method(console, 'warn', (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    })
    const locals = makeLocals()
    const cases = [
      ['servfail@gmail.com', 2],
      ['refused@gmail.com', 5],
    ] as const
    for (const [index, [email, status]] of cases.entries()) {
      fetchCalls = []
      mxResponse = { status: 200, body: { Status: status, Answer: [] } }
      const res = await POST(postContext({ email }, locals, { ip: `203.0.113.${52 + index}` }))
      assert.equal(res.status, 200, email)
      assert.ok(
        cioCalls().some((call) => call.init?.method === 'PUT'),
        email
      )
    }
    const logged = warnings.join('\n')
    assert.equal(warnings.length, 2)
    assert.match(logged, /MX lookup failed open/)
    assert.doesNotMatch(logged, /servfail/)
    assert.doesNotMatch(logged, /refused/)
    assert.doesNotMatch(logged, /@/)
    assert.doesNotMatch(logged, /gmail/)
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
          hp_fax_2: '',
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
    assert.equal(putBody.signup_page, '/blog/soil/')
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
      signup_page: '/blog/soil/',
      podcast: false,
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'spring',
    })
  })

  const EMAIL_ERROR = 'Enter a valid email address.'

  function addressError(suggestion?: string): string {
    return suggestion ? `${EMAIL_ERROR} Did you mean ${suggestion}?` : EMAIL_ERROR
  }

  it('rejects broken address syntax, including shapes the loose check allowed', async () => {
    const locals = makeLocals()
    const rejected = [
      'bad@@x',
      'a..b@gmail.com',
      '.lead@gmail.com',
      'lead.@gmail.com',
      'user@-gmail.com',
      'user@gmail-.com',
      'user@gmail..com',
      'a@b.c',
      'user@my_farm.com',
    ]
    for (const [index, email] of rejected.entries()) {
      const res = await POST(postContext({ email }, locals, { ip: `192.0.2.${index + 1}` }))
      assert.equal(res.status, 400, email)
      assert.deepEqual(await res.json(), { error: 'A valid email address is required.' })
    }
    assert.equal(fetchCalls.length, 0)
  })

  it('rejects common provider typos and returns a correction', async () => {
    const locals = makeLocals()
    const cases = [
      ['test@gmial.com', 'test@gmail.com'],
      ['test@gmal.com', 'test@gmail.com'],
      ['test@gamil.com', 'test@gmail.com'],
      ['test@yaho.com', 'test@yahoo.com'],
      ['test@hotmal.com', 'test@hotmail.com'],
      ['test@outlok.com', 'test@outlook.com'],
      ['test@iclod.com', 'test@icloud.com'],
      ['Test@Gmial.COM', 'test@gmail.com'],
      ['reader+flock@mail.gmial.com', 'reader+flock@mail.gmail.com'],
    ] as const
    for (const [index, [email, suggestion]] of cases.entries()) {
      fetchCalls = []
      const res = await POST(postContext({ email }, locals, { ip: `192.0.2.${20 + index}` }))
      assert.equal(res.status, 400, email)
      assert.deepEqual(await res.json(), { error: addressError(suggestion), suggestion })
      assert.equal(fetchCalls.length, 0, email)
    }
  })

  it('rejects disposable domains and their subdomains before any lookup', async () => {
    const locals = makeLocals()
    const rejected = ['x@mailinator.com', 'x@not-listed.mailinator.com', 'x@10minutemail.com']
    for (const [index, email] of rejected.entries()) {
      fetchCalls = []
      const res = await POST(postContext({ email }, locals, { ip: `192.0.2.${40 + index}` }))
      assert.equal(res.status, 400, email)
      assert.deepEqual(await res.json(), { error: EMAIL_ERROR })
      assert.equal(fetchCalls.length, 0, email)
    }
  })

  it('rejects a domain with no MX and no A or AAAA record', async () => {
    const locals = makeLocals()
    const nomx = 'x@nomx-domain-that-does-not-exist-12345.com'

    mxResponse = { status: 200, body: MX_NXDOMAIN }
    const nxdomain = await POST(postContext({ email: nomx }, locals, { ip: '192.0.2.50' }))
    assert.equal(nxdomain.status, 400)
    assert.equal(cioCalls().length, 0)

    fetchCalls = []
    mxResponse = { status: 200, body: MX_NONE }
    const nodata = await POST(
      postContext({ email: 'grower@empty-farm-mail.test' }, locals, { ip: '192.0.2.51' })
    )
    assert.equal(nodata.status, 400)
    assert.deepEqual(await nodata.json(), { error: EMAIL_ERROR })
    assert.equal(cioCalls().length, 0)
    assert.ok(fetchCalls.some((call) => call.url.includes('type=MX')))
    assert.ok(fetchCalls.some((call) => call.url.includes('type=A') && !call.url.includes('AAAA')))
    assert.ok(fetchCalls.some((call) => call.url.includes('type=AAAA')))

    fetchCalls = []
    mxResponse = (url) => {
      if (url.includes('type=AAAA')) return { status: 200, body: AAAA_OK }
      if (url.includes('type=A')) return { status: 200, body: A_OK }
      return { status: 200, body: MX_NULL }
    }
    const nullMx = await POST(
      postContext({ email: 'grower@null-mx-farm.test' }, locals, { ip: '192.0.2.52' })
    )
    assert.equal(nullMx.status, 400)
    assert.equal(cioCalls().length, 0)
  })

  it('still accepts gmail, yahoo, a farm domain, plus-addressing, and subdomains', async () => {
    // MX is mocked. oakridgepoultryfarm.com is only here to prove a non-provider domain is not blocked.
    const locals = makeLocals()
    const accepted = [
      'grower@gmail.com',
      'grower@yahoo.com',
      'pat@oakridgepoultryfarm.com',
      'pat+flock@gmail.com',
      'pat@news.oakridgepoultryfarm.com',
    ]
    for (const [index, email] of accepted.entries()) {
      const res = await POST(postContext({ email }, locals, { ip: `192.0.2.${60 + index}` }))
      assert.equal(res.status, 200, email)
    }
    assert.equal(cioCalls().filter((call) => call.init?.method === 'PUT').length, accepted.length)
  })

  it('still fails open when DNS errors after the address checks', async () => {
    const warnings: string[] = []
    mock.method(console, 'warn', (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    })
    const locals = makeLocals()
    mxResponse = 'throw'
    const thrown = await POST(
      postContext({ email: 'pat@oakridgepoultryfarm.com' }, locals, { ip: '192.0.2.70' })
    )
    assert.equal(thrown.status, 200)

    fetchCalls = []
    mxResponse = (url) => {
      if (url.includes('type=MX')) return { status: 200, body: MX_NONE }
      if (url.includes('type=A') && !url.includes('AAAA')) {
        return { status: 200, body: { Status: 2, Answer: [] } }
      }
      return { status: 200, body: MX_NONE }
    }
    const servfail = await POST(
      postContext({ email: 'pat@secondfarm.test' }, locals, { ip: '192.0.2.71' })
    )
    assert.equal(servfail.status, 200)
    assert.ok(cioCalls().some((call) => call.url.includes('pat%40secondfarm.test')))

    const logged = warnings.join('\n')
    assert.equal(warnings.length, 2)
    assert.match(logged, /MX lookup failed open/)
    assert.doesNotMatch(logged, /oakridgepoultryfarm/)
    assert.doesNotMatch(logged, /secondfarm/)
    assert.doesNotMatch(logged, /@/)
  })
})

describe('newsletter form address line', () => {
  it('uses the same syntax and typo line the server returns', () => {
    assert.equal(
      subscribeAddressIssue('test@gmial.com'),
      'Enter a valid email address. Did you mean test@gmail.com?'
    )
    assert.equal(subscribeAddressIssue('a..b@gmail.com'), 'Enter a valid email address.')
    assert.equal(subscribeAddressIssue('bad@@x'), 'Enter a valid email address.')
    assert.equal(subscribeAddressIssue("o'brien+tag@gmail.com"), null)
    assert.equal(subscribeAddressIssue('pat@gmail.com'), null)
    assert.equal(subscribeAddressIssue('pat@yahoo.com'), null)
    assert.equal(subscribeAddressIssue('pat@oakridgepoultryfarm.com'), null)
    assert.equal(subscribeAddressIssue('pat@news.oakridgepoultryfarm.com'), null)
  })
})
