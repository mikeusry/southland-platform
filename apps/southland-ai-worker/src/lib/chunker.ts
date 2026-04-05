import type { ChunkMetadata } from '../types'

// ─── Type-Specific Chunking ─────────────────────────────────────────────────
// Products: 1 vector per product (whole doc)
// Blogs: heading-based semantic chunks, 300-500 token fallback
// SOPs: heading/section-based chunks
// Podcasts: topic-segmented, 400-700 tokens

export interface Chunk {
  id: string // Stable ID: product:slug:0, blog:slug:3
  text: string
  metadata: ChunkMetadata
}

// ─── Product Chunking ───────────────────────────────────────────────────────
// 1 vector per product — canonical blob of title, category, problems solved,
// use cases, species/surface, application method, synonyms

export interface ProductData {
  sku: string
  name: string
  description: string
  category: string
  business_unit: string
  application_guide?: string
  problems_solved?: string[]
  target_species?: string[]
  url: string
  tenant: string
}

export function chunkProduct(product: ProductData): Chunk[] {
  const parts = [
    `Product: ${product.name}`,
    `SKU: ${product.sku}`,
    `Category: ${product.category}`,
    product.description,
  ]

  if (product.problems_solved?.length) {
    parts.push(`Problems solved: ${product.problems_solved.join(', ')}`)
  }
  if (product.target_species?.length) {
    parts.push(`Target species/surfaces: ${product.target_species.join(', ')}`)
  }
  if (product.application_guide) {
    parts.push(`Application: ${product.application_guide}`)
  }

  return [
    {
      id: `product:${product.sku}:0`,
      text: parts.join('\n'),
      metadata: {
        doc_type: 'product',
        source_id: product.sku,
        title: product.name,
        url: product.url,
        tenant: product.tenant,
        business_unit: product.business_unit,
        category: product.category,
        support_relevant: true,
        answer_type: 'factual',
        updated_at: new Date().toISOString(),
      },
    },
  ]
}

// ─── Heading-Based Chunking (Blogs, SOPs) ───────────────────────────────────
// Split by markdown headings. If a section exceeds maxTokens, split further
// with overlap.

export interface DocumentData {
  slug: string
  title: string
  content: string // markdown
  doc_type: 'blog' | 'sop' | 'document' | 'faq' | 'policy'
  url: string
  tenant: string
  business_unit: string
  category: string
  support_relevant: boolean
  answer_type: ChunkMetadata['answer_type']
}

const HEADING_REGEX = /^#{1,3}\s+.+$/gm

export function chunkDocument(doc: DocumentData, maxTokens = 500, overlapTokens = 75): Chunk[] {
  const sections = splitByHeadings(doc.content)
  const chunks: Chunk[] = []

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const tokens = estimateTokens(section.text)

    if (tokens <= maxTokens) {
      // Section fits in one chunk
      chunks.push(makeChunk(doc, chunks.length, section.text))
    } else {
      // Section too large — split with overlap
      const subChunks = splitWithOverlap(section.text, maxTokens, overlapTokens)
      for (const sub of subChunks) {
        chunks.push(makeChunk(doc, chunks.length, sub))
      }
    }
  }

  // If no sections found (no headings), treat whole doc as chunks
  if (chunks.length === 0) {
    const subChunks = splitWithOverlap(doc.content, maxTokens, overlapTokens)
    for (const sub of subChunks) {
      chunks.push(makeChunk(doc, chunks.length, sub))
    }
  }

  return chunks
}

function makeChunk(doc: DocumentData, index: number, text: string): Chunk {
  // Prepend document title so embeddings carry context about which document
  // this chunk belongs to. Critical for SOPs where sections alone are ambiguous.
  const contextPrefix = `[${doc.doc_type.toUpperCase()}: ${doc.title}]\n`
  return {
    id: `${doc.doc_type}:${doc.slug}:${index}`,
    text: contextPrefix + text,
    metadata: {
      doc_type: doc.doc_type,
      source_id: doc.slug,
      title: doc.title,
      url: doc.url,
      tenant: doc.tenant,
      business_unit: doc.business_unit,
      category: doc.category,
      support_relevant: doc.support_relevant,
      answer_type: doc.answer_type,
      updated_at: new Date().toISOString(),
    },
  }
}

// ─── Podcast Chunking ───────────────────────────────────────────────────────
// Topic-segmented, 400-700 tokens

export interface PodcastData {
  slug: string
  title: string
  transcript: string
  url: string
  tenant: string
  business_unit: string
  category: string
}

export function chunkPodcast(podcast: PodcastData): Chunk[] {
  const subChunks = splitWithOverlap(podcast.transcript, 550, 100) // midpoint of 400-700
  return subChunks.map((text, i) => ({
    id: `episode:${podcast.slug}:${i}`,
    text,
    metadata: {
      doc_type: 'episode' as const,
      source_id: podcast.slug,
      title: podcast.title,
      url: podcast.url,
      tenant: podcast.tenant,
      business_unit: podcast.business_unit,
      category: podcast.category,
      support_relevant: false,
      answer_type: 'factual' as const,
      updated_at: new Date().toISOString(),
    },
  }))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface Section {
  heading: string
  text: string
}

function splitByHeadings(markdown: string): Section[] {
  const lines = markdown.split('\n')
  const sections: Section[] = []
  let currentHeading = ''
  let currentLines: string[] = []

  for (const line of lines) {
    if (HEADING_REGEX.test(line)) {
      HEADING_REGEX.lastIndex = 0 // Reset regex state
      if (currentLines.length > 0) {
        sections.push({ heading: currentHeading, text: currentLines.join('\n').trim() })
      }
      currentHeading = line
      currentLines = [line]
    } else {
      currentLines.push(line)
    }
  }

  if (currentLines.length > 0) {
    sections.push({ heading: currentHeading, text: currentLines.join('\n').trim() })
  }

  return sections.filter((s) => s.text.length > 20) // Skip tiny sections
}

function splitWithOverlap(text: string, maxTokens: number, overlapTokens: number): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  let start = 0

  // Approximate: 1 token ≈ 0.75 words for English
  const maxWords = Math.floor(maxTokens / 0.75)
  const overlapWords = Math.floor(overlapTokens / 0.75)

  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length)
    chunks.push(words.slice(start, end).join(' '))
    start = end - overlapWords
    if (start >= words.length - overlapWords) break // Avoid tiny trailing chunk
  }

  return chunks
}

function estimateTokens(text: string): number {
  // Approximate: 1 token ≈ 4 characters for English
  return Math.ceil(text.length / 4)
}
