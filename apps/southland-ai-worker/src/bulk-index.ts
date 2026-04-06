import type { Env, ChunkMetadata } from './types'
import { embedText } from './lib/embeddings'
import { upsertVectors } from './lib/vectorize'
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
    // Fetch from Nexus API
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
          url: product.url,
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

  // Step 4: Populate product aliases for exact-match search
  try {
    // Clear existing aliases
    await env.DB.prepare('DELETE FROM product_aliases WHERE doc_type = ?').bind('product').run()

    for (const product of products) {
      // Add SKU as alias
      await env.DB.prepare(
        `INSERT OR IGNORE INTO product_aliases (alias_upper, source_id, title, url, doc_type, business_unit)
         VALUES (?, ?, ?, ?, 'product', ?)`
      )
        .bind(product.sku.toUpperCase(), product.sku, product.name, product.url, product.business_unit)
        .run()

      // Add product name as alias
      await env.DB.prepare(
        `INSERT OR IGNORE INTO product_aliases (alias_upper, source_id, title, url, doc_type, business_unit)
         VALUES (?, ?, ?, ?, 'product', ?)`
      )
        .bind(product.name.toUpperCase(), product.sku, product.name, product.url, product.business_unit)
        .run()
    }
  } catch (err) {
    console.error('Alias population error:', err)
  }

  const elapsed = Date.now() - start

  return json(
    {
      status: 'complete',
      products_fetched: count,
      vectors_upserted: totalUpserted,
      errors: totalErrors,
      aliases_created: products.length * 2, // SKU + name per product
      latency_ms: elapsed,
      timestamp: new Date().toISOString(),
    },
    env,
    origin
  )
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
