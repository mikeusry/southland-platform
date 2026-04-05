#!/usr/bin/env npx tsx
/**
 * Index blog posts from Astro content directory into the AI Worker.
 * Reads MDX files, extracts frontmatter + content, pushes in batches.
 *
 * Usage:
 *   cd apps/southland-ai-worker
 *   npx tsx scripts/index-blog.ts
 *   npx tsx scripts/index-blog.ts --dry-run    # Preview only
 */

import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BLOG_DIR = join(__dirname, '../../astro-content/src/content/blog')
const WORKER_URL = process.env.WORKER_URL || 'https://southland-ai-worker.point-dog-digital.workers.dev'
const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 20

interface BlogPost {
  slug: string
  title: string
  content: string
  category: string
  tags: string[]
  business_unit: string
  url: string
  tenant: string
  support_relevant: boolean
  answer_type: 'factual' | 'procedural' | 'policy' | 'comparison'
  word_count: number
  updated_at: string
}

// Simple frontmatter parser for MDX
function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, content: raw }

  const fm: Record<string, unknown> = {}
  const lines = match[1].split('\n')
  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (kv) {
      let value: unknown = kv[2].trim()
      // Strip quotes
      if (typeof value === 'string' && value.startsWith("'") && value.endsWith("'")) {
        value = (value as string).slice(1, -1)
      }
      // Parse arrays like ['tag1', 'tag2']
      if (typeof value === 'string' && value.startsWith('[')) {
        try {
          value = JSON.parse(value.replace(/'/g, '"'))
        } catch {
          // Keep as string
        }
      }
      // Parse booleans
      if (value === 'true') value = true
      if (value === 'false') value = false
      fm[kv[1]] = value
    }
  }

  return { frontmatter: fm, content: match[2].trim() }
}

function mapToBusinessUnit(segment: string, tags: string[], title: string): string {
  const text = `${segment} ${tags.join(' ')} ${title}`.toLowerCase()
  if (text.includes('poultry') || text.includes('chicken') || text.includes('broiler') || text.includes('layer')) return 'poultry'
  if (text.includes('golf') || text.includes('turf') || text.includes('superintendent')) return 'golf'
  if (text.includes('lawn') || text.includes('garden') || text.includes('yard') || text.includes('dog')) return 'lawn'
  if (text.includes('sanitiz') || text.includes('hocl') || text.includes('d2')) return 'ancillary'
  if (text.includes('septic') || text.includes('compost') || text.includes('odor') || text.includes('waste')) return 'agriculture'
  if (text.includes('farm') || text.includes('soil') || text.includes('organic')) return 'agriculture'
  return 'agriculture'
}

function isSupportRelevant(tags: string[], title: string): boolean {
  const text = `${tags.join(' ')} ${title}`.toLowerCase()
  // How-to articles and product-related content is support-relevant
  if (text.includes('how') || text.includes('guide') || text.includes('tip')) return true
  if (text.includes('application') || text.includes('use') || text.includes('dosage')) return true
  return true // Most blog content is useful for support
}

async function main() {
  console.log(`Reading blog posts from ${BLOG_DIR}...`)

  const files = await readdir(BLOG_DIR)
  const mdxFiles = files.filter((f) => f.endsWith('.mdx'))
  console.log(`Found ${mdxFiles.length} MDX files`)

  const posts: BlogPost[] = []
  let skipped = 0

  for (const file of mdxFiles) {
    const raw = await readFile(join(BLOG_DIR, file), 'utf-8')
    const { frontmatter: fm, content } = parseFrontmatter(raw)

    // Skip drafts
    if (fm.draft === true) {
      skipped++
      continue
    }

    const title = String(fm.title || file.replace('.mdx', ''))
    const slug = String(fm.shopifyHandle || file.replace('.mdx', ''))
    const segment = String(fm.segment || 'general')
    const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : []
    const description = String(fm.description || '')

    // Strip MDX/JSX imports and components from content
    const cleanContent = content
      .replace(/^import\s+.*$/gm, '')
      .replace(/<[A-Z][^>]*\/>/g, '')
      .replace(/<[A-Z][^>]*>[\s\S]*?<\/[A-Z][^>]*>/g, '')
      .trim()

    const wordCount = cleanContent.split(/\s+/).length

    posts.push({
      slug,
      title,
      content: description + '\n\n' + cleanContent,
      category: segment,
      tags,
      business_unit: mapToBusinessUnit(segment, tags, title),
      url: `/blog/${slug}`,
      tenant: 'southland',
      support_relevant: isSupportRelevant(tags, title),
      answer_type: 'factual',
      word_count: wordCount,
      updated_at: String(fm.publishDate || new Date().toISOString()),
    })
  }

  console.log(`Parsed ${posts.length} posts (${skipped} drafts skipped)`)

  // Show distribution
  const buCounts: Record<string, number> = {}
  for (const p of posts) {
    buCounts[p.business_unit] = (buCounts[p.business_unit] || 0) + 1
  }
  console.log('Business units:', buCounts)
  console.log(`Total words: ${posts.reduce((s, p) => s + p.word_count, 0).toLocaleString()}`)

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would index these posts. Sample:')
    for (const p of posts.slice(0, 5)) {
      console.log(`  ${p.slug.slice(0, 50).padEnd(50)} ${p.business_unit.padEnd(12)} ${p.word_count} words`)
    }
    return
  }

  // Push in batches to Worker
  console.log(`\nPushing to ${WORKER_URL}/index/blog in batches of ${BATCH_SIZE}...`)

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE)
    const res = await fetch(`${WORKER_URL}/index/blog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sops: batch, count: batch.length }),
    })

    if (res.ok) {
      const data = await res.json() as Record<string, unknown>
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} posts → ${data.total_chunks} chunks (${data.latency_ms}ms)`)
    } else {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${res.status} ${await res.text()}`)
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
