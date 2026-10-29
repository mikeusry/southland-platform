import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface SqliteStatement {
  run(...params: Array<string | number | null>): { changes: number }
  all(...params: Array<string | number | null>): Array<Record<string, unknown>>
  get(...params: Array<string | number | null>): Record<string, unknown> | undefined
}

interface SqliteDatabase {
  exec(sql: string): void
  prepare(sql: string): SqliteStatement
}

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDatabase
}
import worker from './index'
import type { Env } from './types'

const schema = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../schema.sql'), 'utf8')
const SECRET = 'test-index-secret'
const NEXUS_KEY = 'nexus-test-key'

interface FeedProduct {
  id: string
  sku: string
  name: string
  description: string
  category: string
  category_slug: string
  business_unit: string
  url: string
  tenant: string
  canonical_text: string
  retail_price: number | null
  is_core: boolean
  order_count: number
  shopify_handle?: string
}

interface VectorRow {
  id: string
  values: number[]
  metadata: Record<string, unknown>
}

interface FetchCall {
  url: string
  init?: RequestInit
}

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
  props: {},
} as unknown as ExecutionContext

function feedProduct(overrides: Partial<FeedProduct> = {}): FeedProduct {
  return {
    id: 'uuid-keep',
    sku: 'KEEP',
    name: 'Keep Product',
    description: 'A product',
    category: 'Lawn',
    category_slug: 'lawn',
    business_unit: 'lawn',
    url: '/products/KEEP',
    tenant: 'southland',
    canonical_text: 'Keep Product is a lawn product',
    retail_price: null,
    is_core: true,
    order_count: 3,
    ...overrides,
  }
}

function createD1(db: SqliteDatabase): D1Database {
  const run = (sql: string, params: unknown[]) => {
    const info = db.prepare(sql).run(...(params as Array<string | number | null>))
    return { success: true, meta: { changes: info.changes } }
  }
  const all = (sql: string, params: unknown[]) => {
    const results = db.prepare(sql).all(...(params as Array<string | number | null>))
    return { success: true, results }
  }
  const first = (sql: string, params: unknown[]) => {
    return db.prepare(sql).get(...(params as Array<string | number | null>)) ?? null
  }
  const statement = (sql: string, params: unknown[]) => ({
    bind(...next: unknown[]) {
      return statement(sql, next)
    },
    async run() {
      return run(sql, params)
    },
    async all() {
      return all(sql, params)
    },
    async first<T>() {
      return first(sql, params) as T | null
    },
  })
  return {
    prepare(sql: string) {
      return statement(sql, [])
    },
  } as unknown as D1Database
}

function createHarness(options?: { secret?: string | null }) {
  const db = new DatabaseSync(':memory:')
  db.exec(schema)
  const vectors = new Map<string, VectorRow>()
  const deletedIds: string[] = []
  const fetchCalls: FetchCall[] = []
  const secret = options?.secret === undefined ? SECRET : options.secret

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      fetchCalls.push({ url, init })
      if (url.endsWith('/api/ai/products')) {
        return new Response(JSON.stringify({ products: [feedProduct()], count: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.endsWith('/api/ai/sops')) {
        return new Response(JSON.stringify({ sops: [], count: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(`unexpected fetch ${url}`, { status: 500 })
    })
  )

  const env = {
    AI: {
      async run(_model: string, input: { text: string[] }) {
        return { data: input.text.map(() => [0.01, 0.02, 0.03]) }
      },
    },
    KNOWLEDGE_INDEX: {
      async upsert(items: VectorRow[]) {
        for (const item of items) vectors.set(item.id, item)
        return { count: items.length, ids: items.map((item) => item.id) }
      },
      async deleteByIds(ids: string[]) {
        deletedIds.push(...ids)
        let count = 0
        for (const id of ids) {
          if (vectors.delete(id)) count += 1
        }
        return { count, ids }
      },
    },
    DB: createD1(db),
    CACHE: {
      async put() {},
      async get() {
        return null
      },
      async delete() {},
    },
    INDEX_QUEUE: {},
    SUMMARY_QUEUE: {},
    NEXUS_API_URL: 'https://nexus.test',
    ENVIRONMENT: 'test',
    AI_GATEWAY_SLUG: '',
    ALLOWED_ORIGINS: 'https://southlandorganics.com',
    NEXUS_API_KEY: NEXUS_KEY,
    OPENAI_API_KEY: '',
    COHERE_API_KEY: '',
    ...(secret === null ? {} : { INDEX_ADMIN_SECRET: secret }),
  } as unknown as Env

  async function call(pathname: string, init?: RequestInit): Promise<Response> {
    return worker.fetch(new Request(`https://worker.test${pathname}`, init), env, ctx)
  }

  return { db, vectors, deletedIds, fetchCalls, env, call }
}

function authHeaders(secret = SECRET): HeadersInit {
  return { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }
}

function postBody(pathname: string, products: FeedProduct[] = []): BodyInit {
  if (pathname === '/index/products') {
    return JSON.stringify({ products, count: products.length })
  }
  return JSON.stringify({ sops: [], count: 0 })
}

function seedManifest(
  db: SqliteDatabase,
  docType: string,
  sourceId: string,
  chunkIds: string[]
): void {
  db.prepare(
    `INSERT INTO chunk_manifests (doc_type, source_id, chunk_ids, chunk_count)
     VALUES (?, ?, ?, ?)`
  ).run(docType, sourceId, JSON.stringify(chunkIds), chunkIds.length)
}

function seedAlias(
  db: SqliteDatabase,
  aliasUpper: string,
  sourceId: string,
  title: string,
  url: string
): void {
  db.prepare(
    `INSERT INTO product_aliases (alias_upper, source_id, title, url, doc_type, business_unit)
     VALUES (?, ?, ?, ?, 'product', 'lawn')`
  ).run(aliasUpper, sourceId, title, url)
}

function aliasRows(db: SqliteDatabase): Array<Record<string, unknown>> {
  return db
    .prepare(
      `SELECT alias_upper, source_id, title, url, doc_type
       FROM product_aliases ORDER BY alias_upper`
    )
    .all()
    .map((row) => ({ ...row }))
}

function manifestRows(db: SqliteDatabase): Array<Record<string, unknown>> {
  return db
    .prepare(
      `SELECT doc_type, source_id, chunk_ids
       FROM chunk_manifests ORDER BY doc_type, source_id`
    )
    .all()
    .map((row) => ({ ...row }))
}

describe('index route auth', () => {
  let harness: ReturnType<typeof createHarness>

  beforeEach(() => {
    harness = createHarness()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  for (const pathname of ['/index/products', '/index/sops', '/index/blog']) {
    it(`rejects unauthenticated GET ${pathname}`, async () => {
      const res = await harness.call(pathname, { method: 'GET' })
      expect(res.status).toBe(401)
      expect(harness.fetchCalls).toHaveLength(0)
    })

    it(`rejects unauthenticated POST ${pathname}`, async () => {
      const res = await harness.call(pathname, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: postBody(pathname),
      })
      expect(res.status).toBe(401)
      await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
    })
  }

  it('rejects a POST with the wrong bearer token', async () => {
    const res = await harness.call('/index/products', {
      method: 'POST',
      headers: authHeaders('not-the-secret'),
      body: postBody('/index/products'),
    })
    expect(res.status).toBe(401)
  })

  it('fails closed with 503 when INDEX_ADMIN_SECRET is unset', async () => {
    vi.unstubAllGlobals()
    const closed = createHarness({ secret: null })
    const res = await closed.call('/index/products', {
      method: 'POST',
      headers: authHeaders('anything'),
      body: postBody('/index/products'),
    })
    expect(res.status).toBe(503)
    expect(closed.fetchCalls).toHaveLength(0)
  })

  it('fails closed with 503 when INDEX_ADMIN_SECRET is empty', async () => {
    vi.unstubAllGlobals()
    const closed = createHarness({ secret: '' })
    const res = await closed.call('/index/blog', { method: 'GET' })
    expect(res.status).toBe(503)
    expect(closed.fetchCalls).toHaveLength(0)
  })

  it('accepts a bearer token that matches INDEX_ADMIN_SECRET', async () => {
    const res = await harness.call('/index/products', {
      method: 'POST',
      headers: authHeaders(),
      body: postBody('/index/products', [feedProduct()]),
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ status: 'complete', products_fetched: 1 })
  })

  it('leaves /health and CORS preflight open', async () => {
    const health = await harness.call('/health', { method: 'GET' })
    expect(health.status).toBe(200)
    const preflight = await harness.call('/index/products', { method: 'OPTIONS' })
    expect(preflight.status).toBe(204)
    expect(harness.fetchCalls).toHaveLength(0)
  })
})

describe('product reindex', () => {
  let harness: ReturnType<typeof createHarness>

  beforeEach(() => {
    harness = createHarness()
    seedManifest(harness.db, 'product', 'STALE', ['product:STALE:0', 'product:STALE:1'])
    seedManifest(harness.db, 'product', 'KEEP', ['product:KEEP:0'])
    seedManifest(harness.db, 'sop', 'sop-1', ['sop:sop-1:0'])
    seedManifest(harness.db, 'blog', 'post-1', ['blog:post-1:0'])
    for (const id of [
      'product:STALE:0',
      'product:STALE:1',
      'product:KEEP:0',
      'sop:sop-1:0',
      'blog:post-1:0',
    ]) {
      harness.vectors.set(id, {
        id,
        values: [0.2],
        metadata: { doc_type: id.split(':')[0], source_id: id.split(':')[1], url: `/old/${id}` },
      })
    }
    seedAlias(harness.db, 'STALE', 'STALE', 'Stale Product', '/products/STALE')
    seedAlias(harness.db, 'KEEP', 'KEEP', 'Keep Product', '/products/KEEP')
    seedAlias(harness.db, 'OLD NAME', 'KEEP', 'Old Name', '/products/KEEP')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deletes product vectors and chunk-manifest rows missing from the feed', async () => {
    const res = await harness.call('/index/products', {
      method: 'POST',
      headers: authHeaders(),
      body: postBody('/index/products', [feedProduct()]),
    })
    expect(res.status).toBe(200)
    expect(harness.vectors.has('product:STALE:0')).toBe(false)
    expect(harness.vectors.has('product:STALE:1')).toBe(false)
    expect(harness.deletedIds).toEqual(
      expect.arrayContaining(['product:STALE:0', 'product:STALE:1'])
    )
    expect(harness.deletedIds).not.toEqual(expect.arrayContaining(['sop:sop-1:0', 'blog:post-1:0']))
    expect(harness.vectors.has('sop:sop-1:0')).toBe(true)
    expect(harness.vectors.has('blog:post-1:0')).toBe(true)
    expect(harness.vectors.has('product:KEEP:0')).toBe(true)

    const manifests = manifestRows(harness.db)
    expect(
      manifests.find((row) => row.doc_type === 'product' && row.source_id === 'STALE')
    ).toBeUndefined()
    expect(
      manifests.find((row) => row.doc_type === 'product' && row.source_id === 'KEEP')
    ).toBeDefined()
    expect(
      manifests.find((row) => row.doc_type === 'sop' && row.source_id === 'sop-1')
    ).toBeDefined()
    expect(
      manifests.find((row) => row.doc_type === 'blog' && row.source_id === 'post-1')
    ).toBeDefined()
  })

  it('prunes every product chunk when the feed is empty and leaves sop and blog rows', async () => {
    const res = await harness.call('/index/products', {
      method: 'POST',
      headers: authHeaders(),
      body: postBody('/index/products', []),
    })
    expect(res.status).toBe(200)
    expect(harness.vectors.has('product:STALE:0')).toBe(false)
    expect(harness.vectors.has('product:STALE:1')).toBe(false)
    expect(harness.vectors.has('product:KEEP:0')).toBe(false)
    expect(harness.vectors.has('sop:sop-1:0')).toBe(true)
    expect(harness.vectors.has('blog:post-1:0')).toBe(true)
    const productManifests = manifestRows(harness.db).filter((row) => row.doc_type === 'product')
    expect(productManifests).toEqual([])
  })

  it('does not prune when the Nexus product feed request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 }))
    )
    const res = await harness.call('/index/products', {
      method: 'GET',
      headers: { authorization: `Bearer ${SECRET}` },
    })
    expect(res.status).toBe(502)
    expect(harness.vectors.has('product:STALE:0')).toBe(true)
    expect(manifestRows(harness.db).some((row) => row.source_id === 'STALE')).toBe(true)
  })

  it('updates an existing alias url from the feed url', async () => {
    const res = await harness.call('/index/products', {
      method: 'POST',
      headers: authHeaders(),
      body: postBody('/index/products', [feedProduct({ url: '/products/keep-handle/' })]),
    })
    expect(res.status).toBe(200)
    const keep = aliasRows(harness.db).find((row) => row.alias_upper === 'KEEP')
    expect(keep).toMatchObject({
      source_id: 'KEEP',
      url: '/products/keep-handle/',
      doc_type: 'product',
    })
    expect(harness.vectors.get('product:KEEP:0')?.metadata.url).toBe('/products/keep-handle/')
  })

  it('stores /products/<shopify_handle>/ when the feed still sends a stale sku url', async () => {
    const res = await harness.call('/index/products', {
      method: 'POST',
      headers: authHeaders(),
      body: postBody('/index/products', [
        feedProduct({
          url: '/products/KEEP',
          shopify_handle: 'humic-acid',
        }),
      ]),
    })
    expect(res.status).toBe(200)
    const rows = aliasRows(harness.db)
    expect(rows.find((row) => row.alias_upper === 'KEEP')).toMatchObject({
      url: '/products/humic-acid/',
    })
    expect(rows.find((row) => row.alias_upper === 'KEEP PRODUCT')).toMatchObject({
      url: '/products/humic-acid/',
    })
    expect(harness.vectors.get('product:KEEP:0')?.metadata.url).toBe('/products/humic-acid/')
  })

  it('removes aliases for products that are no longer in the feed, including renamed names', async () => {
    const res = await harness.call('/index/products', {
      method: 'POST',
      headers: authHeaders(),
      body: postBody('/index/products', [feedProduct({ url: '/products/keep-handle/' })]),
    })
    expect(res.status).toBe(200)
    const rows = aliasRows(harness.db)
    expect(rows.find((row) => row.alias_upper === 'STALE')).toBeUndefined()
    expect(rows.find((row) => row.alias_upper === 'OLD NAME')).toBeUndefined()
    expect(rows.find((row) => row.alias_upper === 'KEEP PRODUCT')?.url).toBe(
      '/products/keep-handle/'
    )
  })

  it('overwrites an alias url when a later feed row claims the same alias', async () => {
    const res = await harness.call('/index/products', {
      method: 'POST',
      headers: authHeaders(),
      body: postBody('/index/products', [
        feedProduct({
          id: 'uuid-other',
          sku: 'OTHER',
          name: 'Humic',
          url: '/products/other-name/',
          canonical_text: 'Other product named Humic',
        }),
        feedProduct({
          id: 'uuid-humic',
          sku: 'HUMIC',
          name: 'Humic Granules',
          url: '/products/humic-granules/',
          canonical_text: 'Humic granules',
        }),
      ]),
    })
    expect(res.status).toBe(200)
    expect(aliasRows(harness.db).find((row) => row.alias_upper === 'HUMIC')).toMatchObject({
      source_id: 'HUMIC',
      url: '/products/humic-granules/',
    })
  })

  it('keeps a feed url that has no shopify handle, including an absolute url', async () => {
    const absolute = 'https://southlandorganics.com/products/humic-acid/'
    const res = await harness.call('/index/products', {
      method: 'POST',
      headers: authHeaders(),
      body: postBody('/index/products', [feedProduct({ url: absolute })]),
    })
    expect(res.status).toBe(200)
    expect(aliasRows(harness.db).find((row) => row.alias_upper === 'KEEP')?.url).toBe(absolute)
  })

  it('falls back to the feed url when shopify_handle is not a single path segment', async () => {
    const res = await harness.call('/index/products', {
      method: 'POST',
      headers: authHeaders(),
      body: postBody('/index/products', [
        feedProduct({ url: '/products/fallback/', shopify_handle: '../not-a-handle' }),
      ]),
    })
    expect(res.status).toBe(200)
    expect(aliasRows(harness.db).find((row) => row.alias_upper === 'KEEP')?.url).toBe(
      '/products/fallback/'
    )
  })

  it('still sends the Nexus feed request as Bearer NEXUS_API_KEY', async () => {
    const res = await harness.call('/index/products', {
      method: 'GET',
      headers: { authorization: `Bearer ${SECRET}` },
    })
    expect(res.status).toBe(200)
    expect(harness.fetchCalls).toHaveLength(1)
    expect(harness.fetchCalls[0]?.url).toBe('https://nexus.test/api/ai/products')
    expect(harness.fetchCalls[0]?.init?.headers).toEqual({ Authorization: `Bearer ${NEXUS_KEY}` })
  })

  it('omits the Nexus Authorization header when NEXUS_API_KEY is empty', async () => {
    harness.env.NEXUS_API_KEY = ''
    const res = await harness.call('/index/products', {
      method: 'GET',
      headers: { authorization: `Bearer ${SECRET}` },
    })
    expect(res.status).toBe(200)
    expect(harness.fetchCalls[0]?.init?.headers).toEqual({})
  })

  it('does not delete product vectors while indexing a blog post', async () => {
    const res = await harness.call('/index/blog', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        sops: [
          {
            id: 'post-1',
            slug: 'post-1',
            title: 'Soil health notes',
            content:
              'This is a long enough paragraph about soil health and humic acid for indexing.',
            category: 'lawn',
            tags: ['soil'],
            business_unit: 'lawn',
            answer_type: 'factual',
            url: '/blog/post-1',
            tenant: 'southland',
            support_relevant: true,
            word_count: 16,
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        count: 1,
      }),
    })
    expect(res.status).toBe(200)
    expect(harness.vectors.has('product:STALE:0')).toBe(true)
    expect(harness.vectors.has('product:KEEP:0')).toBe(true)
    expect(harness.deletedIds).toEqual([])
    expect(
      manifestRows(harness.db).some(
        (row) => row.doc_type === 'product' && row.source_id === 'STALE'
      )
    ).toBe(true)
  })
})
