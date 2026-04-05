import type { Env, IndexMessage } from './types'
import { embedText } from './lib/embeddings'
import { upsertVectors, deleteVectors } from './lib/vectorize'
import { chunkProduct, chunkDocument, chunkPodcast } from './lib/chunker'
import type { ProductData, DocumentData, PodcastData } from './lib/chunker'

// ─── Index Worker (Queue Consumer) ──────────────────────────────────────────
// Layer 2: Processes index update messages from the queue
// Fetches content from Nexus API, chunks, embeds, upserts to Vectorize

export async function handleIndex(message: IndexMessage, env: Env): Promise<void> {
  console.log(`Indexing: ${message.type}:${message.id} (${message.action})`)

  if (message.action === 'delete') {
    await handleDelete(message, env)
    return
  }

  // Fetch content from Nexus API based on type
  const chunks = await fetchAndChunk(message, env)
  if (!chunks || chunks.length === 0) {
    console.log(`No chunks generated for ${message.type}:${message.id}`)
    return
  }

  // Embed all chunks in batch
  const texts = chunks.map((c) => c.text)
  const { vectors } = await embedText(texts, env)

  // Upsert to Vectorize
  const records = chunks.map((chunk, i) => ({
    id: chunk.id,
    values: vectors[i],
    metadata: chunk.metadata,
  }))

  const result = await upsertVectors(env, records)
  console.log(`Indexed ${result.count} chunks for ${message.type}:${message.id}`)

  // Update chunk manifest in D1
  await updateManifest(env, message, chunks.map((c) => c.id))
}

// ─── Delete Handler ─────────────────────────────────────────────────────────

async function handleDelete(message: IndexMessage, env: Env): Promise<void> {
  // Read chunk manifest to find all chunk IDs for this document
  try {
    const manifest = await env.DB.prepare(
      'SELECT chunk_ids FROM chunk_manifests WHERE doc_type = ? AND source_id = ?'
    )
      .bind(message.type, message.id)
      .first()

    if (manifest?.chunk_ids) {
      const ids = JSON.parse(String(manifest.chunk_ids)) as string[]
      await deleteVectors(env, ids)
      console.log(`Deleted ${ids.length} chunks for ${message.type}:${message.id}`)
    }

    // Remove manifest entry
    await env.DB.prepare(
      'DELETE FROM chunk_manifests WHERE doc_type = ? AND source_id = ?'
    )
      .bind(message.type, message.id)
      .run()
  } catch (err) {
    console.error(`Delete failed for ${message.type}:${message.id}:`, err)
  }
}

// ─── Fetch & Chunk ──────────────────────────────────────────────────────────

async function fetchAndChunk(
  message: IndexMessage,
  env: Env
): Promise<ReturnType<typeof chunkProduct> | null> {
  const baseUrl = env.NEXUS_API_URL

  switch (message.type) {
    case 'product': {
      const res = await fetch(`${baseUrl}/api/products/${message.id}`, {
        headers: { Authorization: `Bearer ${env.NEXUS_API_KEY}` },
      })
      if (!res.ok) {
        console.error(`Failed to fetch product ${message.id}: ${res.status}`)
        return null
      }
      const data = (await res.json()) as ProductData
      return chunkProduct(data)
    }

    case 'blog':
    case 'sop':
    case 'document':
    case 'faq':
    case 'policy': {
      const endpoint = message.type === 'sop' ? 'sops' : message.type === 'blog' ? 'blog' : 'documents'
      const res = await fetch(`${baseUrl}/api/${endpoint}/${message.id}`, {
        headers: { Authorization: `Bearer ${env.NEXUS_API_KEY}` },
      })
      if (!res.ok) {
        console.error(`Failed to fetch ${message.type} ${message.id}: ${res.status}`)
        return null
      }
      const data = (await res.json()) as DocumentData
      return chunkDocument(data)
    }

    case 'episode': {
      const res = await fetch(`${baseUrl}/api/episodes/${message.id}`, {
        headers: { Authorization: `Bearer ${env.NEXUS_API_KEY}` },
      })
      if (!res.ok) {
        console.error(`Failed to fetch episode ${message.id}: ${res.status}`)
        return null
      }
      const data = (await res.json()) as PodcastData
      return chunkPodcast(data)
    }

    default:
      console.error(`Unknown content type: ${message.type}`)
      return null
  }
}

// ─── Chunk Manifest ─────────────────────────────────────────────────────────
// Track which chunk IDs belong to each document (needed for deletions/updates)

async function updateManifest(
  env: Env,
  message: IndexMessage,
  chunkIds: string[]
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO chunk_manifests (doc_type, source_id, chunk_ids, chunk_count, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT (doc_type, source_id) DO UPDATE SET
         chunk_ids = excluded.chunk_ids,
         chunk_count = excluded.chunk_count,
         updated_at = excluded.updated_at`
    )
      .bind(message.type, message.id, JSON.stringify(chunkIds), chunkIds.length)
      .run()
  } catch (err) {
    console.error(`Failed to update manifest for ${message.type}:${message.id}:`, err)
  }
}
