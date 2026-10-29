import type { Env, ChunkMetadata } from './types'
import { embedText } from './lib/embeddings'
import { deleteVectors, upsertVectors } from './lib/vectorize'
import { chunkDocument } from './lib/chunker'
import type { DocumentData } from './lib/chunker'

// ─── Bulk Index Handler ─────────────────────────────────────────────────────
// One-time bulk indexing endpoint for initial population of Vectorize.
// After initial index, use Queues for incremental updates.
//
// POST /index/products — products
// POST /index/sops — SOPs (heading-based chunking)

interface NexusProduct {
  id: string
  sku: string
  name: string
  description: string
  category: string
  category_slug: string
  business_unit: string
  url: string
  shopify_handle?: string
  tenant: string
  canonical_text: string
  retail_price: number | null
  is_core: boolean
  order_count: number
}

export async function handleBulkIndex(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  const url = new URL(request.url)
  const contentType = url.pathname.split('/').pop() // 'products', 'sops', etc.

  if (contentType === 'sops' || contentType === 'blog') {
    // 'sops' → 'sop' (singular) to match ChunkMetadata.doc_type
    return handleBulkIndexSOPs(request, env, origin, contentType === 'sops' ? 'sop' : 'blog')
  }

  if (contentType !== 'products') {
    return json({ error: `Bulk indexing for '${contentType}' not yet implemented` }, env, origin, 501)
  }

  const start = Date.now()

  // Accept product data via POST body (for local bootstrapping)
  // or fetch from Nexus API (for production cron)
  let products: NexusProduct[]
  let count: number

  if (request.method === 'POST') {
    // Products pushed directly in request body
    const body = (await request.json()) as { products: NexusProduct[]; count: number }
    products = body.products
    count = body.count
    console.log(`Received ${count} products via POST`)
  } else {
    // Fetch from Nexus API. Auth stays NEXUS_API_KEY (not INDEX_ADMIN_SECRET).
    const nexusUrl = `${env.NEXUS_API_URL}/api/ai/products`
    console.log(`Fetching products from ${nexusUrl}...`)
    const res = await fetch(nexusUrl, {
      headers: env.NEXUS_API_KEY
        ? { Authorization: `Bearer ${env.NEXUS_API_KEY}` }
        : {},
    })

    if (!res.ok) {
      const text = await res.text()
      return json({ error: `Nexus API error: ${res.status} ${text}` }, env, origin, 502)
    }

    const data = (await res.json()) as { products: NexusProduct[]; count: number }
    products = data.products
    count = data.count
    console.log(`Fetched ${count} products from Nexus`)
  }

  // An empty or suspiciously small successful feed must not delete the index.
  // Feed size is the product array we would keep, not a separate count field.
  if (!Array.isArray(products) || products.length === 0) {
    return skippedIndex(env, origin, start, {
      reason: 'empty_feed',
      message: 'Skipped prune and alias rebuild because the product feed was empty.',
      products_fetched: typeof count === 'number' ? count : 0,
    })
  }

  const manifestCount = await countProductManifests(env)
  if (manifestCount > 0 && products.length * 2 < manifestCount) {
    return skippedIndex(env, origin, start, {
      reason: 'feed_below_half_of_manifests',
      message:
        'Skipped prune and alias rebuild because the feed has fewer than half as many products as the current product manifest.',
      products_fetched: products.length,
      manifest_count: manifestCount,
    })
  }

  // Step 2: Embed in batches (Workers AI supports batch)
  // Batch size: 50 products at a time to stay within limits
  const BATCH_SIZE = 50
  let totalUpserted = 0
  let totalErrors = 0

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)
    const texts = batch.map((p) => p.canonical_text)

    try {
      // Embed batch
      const { vectors } = await embedText(texts, env)

      // Build vector records
      const records = batch.map((product, j) => ({
        id: `product:${product.sku}:0`,
        values: vectors[j],
        metadata: {
          doc_type: 'product' as const,
          source_id: product.sku,
          title: product.name,
          url: resolveProductUrl(product),
          tenant: product.tenant,
          business_unit: product.business_unit,
          category: product.category_slug,
          support_relevant: true,
          answer_type: 'factual' as const,
          updated_at: new Date().toISOString(),
        } satisfies ChunkMetadata,
      }))

      // Upsert to Vectorize
      const result = await upsertVectors(env, records)
      totalUpserted += result.count

      // Cache chunk text in KV for RAG retrieval
      for (let j = 0; j < batch.length; j++) {
        const chunkId = `product:${batch[j].sku}:0`
        await env.CACHE.put(`chunk:${chunkId}`, batch[j].canonical_text, { expirationTtl: 86400 * 90 })
      }

      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: embedded ${batch.length}, upserted ${result.count}`)
    } catch (err) {
      totalErrors += batch.length
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, err)
    }
  }

  if (totalErrors > 0) {
    return skippedIndex(env, origin, start, {
      reason: 'embed_errors',
      message:
        'Skipped prune and alias rebuild because an embed batch failed. Existing product vectors and aliases were left in place.',
      products_fetched: count,
      vectors_upserted: totalUpserted,
      errors: totalErrors,
      manifest_count: manifestCount,
    })
  }

  // Step 3: Update chunk manifests in D1
  try {
    for (const product of products) {
      await env.DB.prepare(
        `INSERT INTO chunk_manifests (doc_type, source_id, chunk_ids, chunk_count, updated_at)
         VALUES ('product', ?, ?, 1, datetime('now'))
         ON CONFLICT (doc_type, source_id) DO UPDATE SET
           chunk_ids = excluded.chunk_ids,
           chunk_count = excluded.chunk_count,
           updated_at = excluded.updated_at`
      )
        .bind(product.sku, JSON.stringify([`product:${product.sku}:0`]))
        .run()
    }
  } catch (err) {
    console.error('Manifest update error:', err)
  }

  // Step 4: Drop product vectors (and their chunk-manifest rows) that are not in this feed.
  // source_id is the SKU. Sop and blog manifests are a different doc_type and are left alone.
  const productsPruned = await pruneStaleProducts(env, products)

  // Step 5: Rebuild product aliases in one D1 batch so the delete and inserts commit together.
  await rebuildProductAliases(env, products)

  const elapsed = Date.now() - start

  return json(
    {
      status: 'complete',
      products_fetched: count,
      vectors_upserted: totalUpserted,
      errors: totalErrors,
      products_pruned: productsPruned,
      aliases_created: products.length * 2, // SKU + name per product
      latency_ms: elapsed,
      timestamp: new Date().toISOString(),
    },
    env,
    origin
  )
}

function skippedIndex(
  env: Env,
  origin: string | null,
  start: number,
  body: Record<string, unknown>
): Response {
  console.warn(`Product reindex skipped (${String(body.reason)}): ${String(body.message ?? '')}`)
  return json(
    {
      status: 'skipped',
      ...body,
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    },
    env,
    origin
  )
}

async function countProductManifests(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM chunk_manifests WHERE doc_type = 'product'`
  ).first<{ n: number | string }>()
  return Number(row?.n ?? 0)
}

async function rebuildProductAliases(env: Env, products: NexusProduct[]): Promise<void> {
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM product_aliases WHERE doc_type = ?').bind('product'),
  ]

  for (const product of products) {
    const url = resolveProductUrl(product)
    const aliases = [product.sku.toUpperCase(), product.name.toUpperCase()]
    for (const aliasUpper of aliases) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO product_aliases (alias_upper, source_id, title, url, doc_type, business_unit)
           VALUES (?, ?, ?, ?, 'product', ?)
           ON CONFLICT(alias_upper) DO UPDATE SET
             source_id = excluded.source_id,
             title = excluded.title,
             url = excluded.url,
             doc_type = excluded.doc_type,
             business_unit = excluded.business_unit`
        ).bind(aliasUpper, product.sku, product.name, url, product.business_unit)
      )
    }
  }

  await env.DB.batch(statements)
}

// Shopify handles are a single path segment. Anything else keeps the feed url as-is.
const PRODUCT_HANDLE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

export function resolveProductUrl(product: {
  url?: string
  shopify_handle?: string | null
}): string {
  const handle = typeof product.shopify_handle === 'string' ? product.shopify_handle.trim() : ''
  if (handle && PRODUCT_HANDLE.test(handle)) {
    return `/products/${handle}/`
  }
  return product.url ?? ''
}

// Product identity in chunk_manifests is source_id, which this indexer sets to the SKU.
// The existing (doc_type, source_id, chunk_ids) rows are enough to delete stale vectors.
const VECTOR_DELETE_BATCH = 500

async function pruneStaleProducts(env: Env, products: NexusProduct[]): Promise<number> {
  const keep = new Set<string>()
  for (const product of products) {
    if (product.sku) keep.add(product.sku)
  }

  const listed = await env.DB.prepare(
    `SELECT source_id, chunk_ids FROM chunk_manifests WHERE doc_type = 'product'`
  ).all()
  const rows = (listed.results ?? []) as Array<{ source_id: string; chunk_ids: unknown }>

  const staleSources: string[] = []
  const staleVectors: string[] = []
  for (const row of rows) {
    if (keep.has(row.source_id)) continue
    staleSources.push(row.source_id)
    staleVectors.push(...readChunkIds(row.chunk_ids, row.source_id))
  }

  for (let i = 0; i < staleVectors.length; i += VECTOR_DELETE_BATCH) {
    await deleteVectors(env, staleVectors.slice(i, i + VECTOR_DELETE_BATCH))
  }

  for (const sourceId of staleSources) {
    await env.DB.prepare(`DELETE FROM chunk_manifests WHERE doc_type = 'product' AND source_id = ?`)
      .bind(sourceId)
      .run()
  }

  if (staleSources.length > 0) {
    console.log(`Pruned ${staleSources.length} product chunk manifests`)
  }
  return staleSources.length
}

function readChunkIds(value: unknown, sourceId: string): string[] {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new Error(`chunk_manifests.chunk_ids for product ${sourceId} is not JSON`)
    }
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`chunk_manifests.chunk_ids for product ${sourceId} is not an array`)
  }
  return parsed.filter((id): id is string => typeof id === 'string')
}

// ─── SOP Bulk Index ─────────────────────────────────────────────────────────

interface NexusSOP {
  id: string
  slug: string
  title: string
  content: string
  category: string
  tags: string[]
  business_unit: string
  answer_type: 'factual' | 'procedural' | 'policy' | 'comparison'
  url: string
  tenant: string
  support_relevant: boolean
  word_count: number
  updated_at: string
}

async function handleBulkIndexSOPs(
  request: Request,
  env: Env,
  origin: string | null,
  docType: 'sop' | 'blog' = 'sop'
): Promise<Response> {
  const start = Date.now()

  // Accept SOPs via POST body
  let sops: NexusSOP[]
  let count: number

  if (request.method === 'POST') {
    const body = (await request.json()) as { sops: NexusSOP[]; count: number }
    sops = body.sops
    count = body.count
    console.log(`Received ${count} SOPs via POST`)
  } else {
    const nexusUrl = `${env.NEXUS_API_URL}/api/ai/sops`
    const res = await fetch(nexusUrl, {
      headers: env.NEXUS_API_KEY
        ? { Authorization: `Bearer ${env.NEXUS_API_KEY}` }
        : {},
    })
    if (!res.ok) {
      return json({ error: `Nexus API error: ${res.status}` }, env, origin, 502)
    }
    const data = (await res.json()) as { sops: NexusSOP[]; count: number }
    sops = data.sops
    count = data.count
  }

  // Chunk each SOP using heading-based chunking
  let totalChunks = 0
  let totalUpserted = 0
  let totalErrors = 0

  for (const sop of sops) {
    try {
      const docData: DocumentData = {
        slug: sop.slug,
        title: sop.title,
        content: sop.content,
        doc_type: docType,
        url: sop.url,
        tenant: sop.tenant,
        business_unit: sop.business_unit,
        category: sop.category.toLowerCase().replace(/\s+/g, '-'),
        support_relevant: sop.support_relevant,
        answer_type: sop.answer_type,
      }

      const chunks = chunkDocument(docData, 500, 75)
      totalChunks += chunks.length

      if (chunks.length === 0) continue

      // Embed all chunks for this SOP
      const texts = chunks.map((c) => c.text)
      const { vectors } = await embedText(texts, env)

      // Upsert to Vectorize
      const records = chunks.map((chunk, j) => ({
        id: chunk.id,
        values: vectors[j],
        metadata: chunk.metadata,
      }))

      const result = await upsertVectors(env, records)
      totalUpserted += result.count

      // Cache chunk text in KV for RAG retrieval
      for (const chunk of chunks) {
        await env.CACHE.put(`chunk:${chunk.id}`, chunk.text, { expirationTtl: 86400 * 90 })
      }

      // Update manifest
      await env.DB.prepare(
        `INSERT INTO chunk_manifests (doc_type, source_id, chunk_ids, chunk_count, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT (doc_type, source_id) DO UPDATE SET
           chunk_ids = excluded.chunk_ids,
           chunk_count = excluded.chunk_count,
           updated_at = excluded.updated_at`
      )
        .bind(docType, sop.slug, JSON.stringify(chunks.map((c) => c.id)), chunks.length)
        .run()

      console.log(`SOP "${sop.slug}": ${chunks.length} chunks indexed`)
    } catch (err) {
      totalErrors++
      console.error(`SOP "${sop.slug}" error:`, err)
    }
  }

  return json(
    {
      status: 'complete',
      sops_fetched: count,
      total_chunks: totalChunks,
      vectors_upserted: totalUpserted,
      errors: totalErrors,
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    },
    env,
    origin
  )
}

function json(data: unknown, env: Env, origin: string | null, status = 200): Response {
  const allowed = env.ALLOWED_ORIGINS.split(',')
  const isAllowed = origin && allowed.includes(origin)
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': isAllowed ? origin! : '',
    },
  })
}
