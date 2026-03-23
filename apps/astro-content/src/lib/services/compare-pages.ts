/**
 * Compare Pages — Live vs New Site Comparison
 *
 * Fetches live page data from Southland Supabase (crawled),
 * fetches new page rendered HTML, computes deltas and verdict.
 */
// =============================================================================
// TYPES
// =============================================================================

export interface PageData {
  url: string
  title: string
  wordCount: number
  metaDescription: string
  productHandles: string[]
  primaryProduct: string | null
  schemaTypes: string[]
  h1: string
  headings: { h2: number; h3: number }
  internalLinks: number
  externalLinks: number
  imageCount: number
  pageType: string
  hasEmbedding: boolean
}

export interface ComparisonDelta {
  wordCountDelta: number
  titleChanged: boolean
  metaDescChanged: boolean
  pageTypeChanged: boolean
  pageTypeNote: string
  productsKept: string[]
  productsLost: string[]
  productsAdded: string[]
  primaryProductKept: boolean
  schemaKept: string[]
  schemaLost: string[]
  schemaAdded: string[]
  linksGained: number
  semanticSimilarity: number | null
}

export interface Verdict {
  score: number
  status: 'green' | 'amber' | 'red'
  issues: string[]
  improvements: string[]
  warnings: string[]
}

export interface ComparisonResult {
  livePath: string
  newPath: string
  live: PageData | null
  new_: PageData | null
  delta: ComparisonDelta | null
  verdict: Verdict
  reviewedAt: string | null
  reviewNote: string | null
  reviewStatus: string | null
}

// =============================================================================
// REDIRECT MAP — old URLs to new URLs
// =============================================================================

export const REDIRECT_MAP: Record<string, string> = {
  '/collections/poultry-broilers': '/poultry/commercial/',
  '/collections/backyard-birds': '/poultry/backyard/',
  '/collections/poultry': '/poultry/',
  '/collections/poultry-breeders': '/poultry/breeders/',
  '/collections/turkey': '/poultry/turkey/',
  '/collections/game-birds': '/poultry/game-birds/',
  '/collections/hydroseeders': '/hydroseeders/',
  '/collections/golf-courses': '/lawn/golf-courses/',
  '/collections/homeowners': '/lawn/homeowners/',
  '/collections/landscapers': '/lawn/landscapers/',
  '/collections/turf': '/lawn/turf-pros/',
  '/collections/crops': '/agriculture/crops/',
  '/collections/produce': '/agriculture/produce/',
  '/collections/pig-and-swine-supplements': '/livestock/swine/',
  '/collections/sanitizers': '/products/sanitizers/',
  '/collections/waste': '/products/waste-treatment/',
  '/collections/other': '/',
  '/pages/why-southland': '/about/',
  '/pages/about-us': '/about/',
  '/pages/contact-us': '/contact/',
  '/pages/distribution': '/distribution/',
  '/pages/store-locator': '/store-locator/',
  '/pages/build-a-case': '/build-a-case/',
  '/pages/hydroseeding': '/hydroseeders/',
}

// =============================================================================
// FETCH LIVE PAGE DATA
// =============================================================================

export async function fetchLivePageData(urlPath: string): Promise<PageData | null> {
  // Fetch the ACTUAL live page from www.southlandorganics.com
  // This gives us real metrics instead of relying on stale/incomplete crawl data
  const liveUrl = `https://www.southlandorganics.com${urlPath.startsWith('/') ? urlPath : '/' + urlPath}`

  try {
    const res = await fetch(liveUrl, {
      headers: {
        'User-Agent': 'Southland-GoLive-Compare/1.0',
        Accept: 'text/html',
      },
      redirect: 'follow',
    })

    if (!res.ok) {
      console.warn(`[compare] Live page ${liveUrl} returned ${res.status}`)
      return null
    }

    const html = await res.text()
    return extractPageData(html, liveUrl, urlPath)
  } catch (err) {
    console.error(`[compare] Failed to fetch live page ${liveUrl}:`, err)
    return null
  }
}

function extractPageData(html: string, url: string, urlPath: string): PageData {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''

  const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i)
  const metaDescription = metaDescMatch ? metaDescMatch[1] : ''

  const bodyMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const rawBody = bodyMatch ? bodyMatch[1] : html
  const bodyText = rawBody
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const h1 = h1Match ? h1Match[1].trim() : ''
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length
  const h3Count = (html.match(/<h3[\s>]/gi) || []).length
  const imgCount = (html.match(/<img\s/gi) || []).length

  const productLinks = html.match(/\/products\/([a-z0-9-]+)/gi) || []
  const productHandles = [...new Set(productLinks.map(l => l.replace('/products/', '')))]

  const allLinks = html.match(/<a\s[^>]*href=["']([^"']+)["']/gi) || []
  let internalLinks = 0
  let externalLinks = 0
  for (const link of allLinks) {
    const hrefMatch = link.match(/href=["']([^"']+)["']/i)
    if (hrefMatch) {
      const href = hrefMatch[1]
      if (href.startsWith('http') && !href.includes('southlandorganics.com')) externalLinks++
      else if (href.startsWith('/') || href.includes('southlandorganics.com')) internalLinks++
    }
  }

  const schemaTypes: string[] = []
  const ldJsonMatches = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const block of ldJsonMatches) {
    const content = block.replace(/<[^>]+>/g, '')
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        for (const item of parsed) { if (item['@type']) schemaTypes.push(item['@type']) }
      } else if (parsed['@type']) schemaTypes.push(parsed['@type'])
    } catch { /* ignore */ }
  }

  let pageType = 'page'
  if (urlPath.includes('/collections/')) pageType = 'collection'
  else if (urlPath.includes('/products/')) pageType = 'product'
  else if (urlPath.includes('/blogs/')) pageType = 'blog'
  else if (urlPath === '/' || urlPath === '') pageType = 'homepage'

  return {
    url,
    title,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    metaDescription,
    productHandles,
    primaryProduct: productHandles[0] || null,
    schemaTypes,
    h1,
    headings: { h2: h2Count, h3: h3Count },
    internalLinks,
    externalLinks,
    imageCount: imgCount,
    pageType,
    hasEmbedding: false,
  }
}

// =============================================================================
// FETCH NEW PAGE DATA (from rendered HTML)
// =============================================================================

export async function fetchNewPageData(urlPath: string, origin: string): Promise<PageData | null> {
  try {
    const url = new URL(urlPath, origin).toString()
    const res = await fetch(url, { headers: { Accept: 'text/html' } })
    if (!res.ok) return null

    const html = await res.text()

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''

    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i)
    const metaDescription = metaDescMatch ? metaDescMatch[1] : ''

    const bodyMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const rawBody = bodyMatch ? bodyMatch[1] : html
    const bodyText = rawBody.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<nav[\s\S]*?<\/nav>/gi, '').replace(/<footer[\s\S]*?<\/footer>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    const h1 = h1Match ? h1Match[1].trim() : ''
    const h2Count = (html.match(/<h2[\s>]/gi) || []).length
    const h3Count = (html.match(/<h3[\s>]/gi) || []).length
    const imgCount = (html.match(/<img\s/gi) || []).length

    // Extract product handles from links
    const productLinks = html.match(/\/products\/([a-z0-9-]+)/gi) || []
    const productHandles = [...new Set(productLinks.map(l => l.replace('/products/', '')))]

    // Count links
    const allLinks = html.match(/<a\s[^>]*href=["']([^"']+)["']/gi) || []
    let internalLinks = 0
    let externalLinks = 0
    for (const link of allLinks) {
      const hrefMatch = link.match(/href=["']([^"']+)["']/i)
      if (hrefMatch) {
        const href = hrefMatch[1]
        if (href.startsWith('http') && !href.includes('southlandorganics.com')) externalLinks++
        else if (href.startsWith('/') || href.includes('southlandorganics.com')) internalLinks++
      }
    }

    // Detect schema types
    const schemaTypes: string[] = []
    const ldJsonMatches = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
    for (const block of ldJsonMatches) {
      const content = block.replace(/<[^>]+>/g, '')
      try {
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item['@type']) schemaTypes.push(item['@type'])
          }
        } else if (parsed['@type']) {
          schemaTypes.push(parsed['@type'])
        }
      } catch { /* ignore */ }
    }

    // Detect page type
    let pageType = 'page'
    if (urlPath.startsWith('/blog/')) pageType = 'blog'
    else if (urlPath.startsWith('/products/')) pageType = 'product'
    else if (urlPath.includes('/collections/') || urlPath.startsWith('/lawn/') || urlPath.startsWith('/agriculture/') || urlPath.startsWith('/livestock/')) pageType = 'collection'
    else if (urlPath.startsWith('/poultry/') && urlPath !== '/poultry/') pageType = 'landing'
    else if (urlPath === '/') pageType = 'homepage'

    return {
      url: urlPath,
      title,
      wordCount: bodyText.split(/\s+/).filter(Boolean).length,
      metaDescription,
      productHandles,
      primaryProduct: productHandles[0] || null,
      schemaTypes,
      h1,
      headings: { h2: h2Count, h3: h3Count },
      internalLinks,
      externalLinks,
      imageCount: imgCount,
      pageType,
      hasEmbedding: false,
    }
  } catch (err) {
    console.error('[compare] Failed to fetch new page:', urlPath, err)
    return null
  }
}

// =============================================================================
// COMPUTE DELTA
// =============================================================================

export function computeDelta(live: PageData, new_: PageData): ComparisonDelta {
  const productsKept = live.productHandles.filter(h => new_.productHandles.includes(h))
  const productsLost = live.productHandles.filter(h => !new_.productHandles.includes(h))
  const productsAdded = new_.productHandles.filter(h => !live.productHandles.includes(h))

  const schemaKept = live.schemaTypes.filter(s => new_.schemaTypes.includes(s))
  const schemaLost = live.schemaTypes.filter(s => !new_.schemaTypes.includes(s))
  const schemaAdded = new_.schemaTypes.filter(s => !live.schemaTypes.includes(s))

  const pageTypeChanged = live.pageType !== new_.pageType
  const pageTypeNote = pageTypeChanged ? `${live.pageType} → ${new_.pageType}` : ''

  const primaryProductKept = !live.primaryProduct || new_.productHandles.includes(live.primaryProduct)

  return {
    wordCountDelta: new_.wordCount - live.wordCount,
    titleChanged: live.title !== new_.title,
    metaDescChanged: live.metaDescription !== new_.metaDescription,
    pageTypeChanged,
    pageTypeNote,
    productsKept,
    productsLost,
    productsAdded,
    primaryProductKept,
    schemaKept,
    schemaLost,
    schemaAdded,
    linksGained: new_.internalLinks - live.internalLinks,
    semanticSimilarity: null, // computed separately if embeddings available
  }
}

// =============================================================================
// COMPUTE VERDICT
// =============================================================================

export function computeVerdict(live: PageData | null, new_: PageData | null, delta: ComparisonDelta | null): Verdict {
  // No new page mapped
  if (!new_) {
    return {
      score: 0,
      status: 'red',
      issues: ['No new URL mapped — this page will 404 after DNS flip'],
      improvements: [],
      warnings: [],
    }
  }

  // No live page to compare (new page only)
  if (!live || !delta) {
    return {
      score: 85,
      status: 'green',
      issues: [],
      improvements: ['New page with no live equivalent — net new content'],
      warnings: [],
    }
  }

  let score = 0
  const issues: string[] = []
  const improvements: string[] = []
  const warnings: string[] = []

  // Semantic similarity (if available)
  if (delta.semanticSimilarity !== null) {
    if (delta.semanticSimilarity > 0.80) score += 25
    else if (delta.semanticSimilarity > 0.70) score += 15
    else score += 5
  } else {
    score += 15 // neutral if no embedding
  }

  // Primary product
  if (delta.primaryProductKept) {
    score += 25
  } else {
    score -= 30
    issues.push(`Primary product lost: ${live.primaryProduct}`)
  }

  // Secondary products
  if (delta.productsLost.length === 0) {
    score += 10
  } else {
    score -= delta.productsLost.length * 10
    issues.push(`Products lost: ${delta.productsLost.join(', ')}`)
  }
  if (delta.productsAdded.length > 0) {
    improvements.push(`Products added: ${delta.productsAdded.join(', ')}`)
  }

  // Critical schema
  const criticalSchema = ['Product', 'FAQPage', 'BreadcrumbList']
  const critSchemaLost = delta.schemaLost.filter(s => criticalSchema.includes(s))
  if (critSchemaLost.length === 0) {
    score += 15
  } else {
    score -= critSchemaLost.length * 5
    warnings.push(`Schema lost: ${critSchemaLost.join(', ')}`)
  }

  // Word count
  if (delta.wordCountDelta >= 0) {
    score += 10
    if (delta.wordCountDelta > 500) improvements.push(`+${delta.wordCountDelta} words (more comprehensive)`)
  } else if (delta.wordCountDelta < -(live.wordCount * 0.5) && (delta.semanticSimilarity === null || delta.semanticSimilarity < 0.70)) {
    score -= 15
    issues.push(`Word count dropped ${Math.abs(delta.wordCountDelta)} words (${Math.round(Math.abs(delta.wordCountDelta) / live.wordCount * 100)}% reduction)`)
  }

  // Meta description
  if (new_.metaDescription) {
    score += 10
  } else {
    warnings.push('Missing meta description')
  }

  // Internal links
  if (delta.linksGained >= 0) {
    score += 5
    if (delta.linksGained > 3) improvements.push(`+${delta.linksGained} internal links`)
  }

  // Page type change (informational, not penalized)
  if (delta.pageTypeChanged) {
    warnings.push(`Page type changed: ${delta.pageTypeNote}`)
  }

  // Title change
  if (delta.titleChanged) {
    warnings.push('Title changed — may affect SERP ranking temporarily')
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  const status = score >= 90 ? 'green' : score >= 60 ? 'amber' : 'red'

  return { score, status, issues, improvements, warnings }
}

// =============================================================================
// GET ALL LIVE URLS
// =============================================================================

export async function getAllLiveUrls(): Promise<{ url: string; urlPath: string; pageType: string; title: string; wordCount: number; crawlTimestamp: string }[]> {
  const client = getSouthlandClient()
  if (!client) return []

  const { data, error } = await client
    .from('website_content')
    .select('url, url_path, page_type, title, word_count, crawl_timestamp')
    .order('page_type')
    .order('url')

  if (error || !data) {
    console.error('[compare] Failed to fetch live URLs:', error)
    return []
  }

  return data.map((r: any) => ({
    url: r.url,
    urlPath: r.url_path || new URL(r.url).pathname,
    pageType: r.page_type || 'unknown',
    title: r.title || '',
    wordCount: r.word_count || 0,
    crawlTimestamp: r.crawl_timestamp,
  }))
}

// =============================================================================
// RESOLVE NEW PATH
// =============================================================================

export function resolveNewPath(livePath: string): string {
  // Check redirect map
  const cleanPath = livePath.replace(/\/$/, '')
  if (REDIRECT_MAP[cleanPath]) return REDIRECT_MAP[cleanPath]

  // Shopify blog URLs → Astro blog URLs
  // /blogs/poultry-biosecurity/some-slug → /blog/some-slug/
  const blogMatch = livePath.match(/\/blogs\/[^/]+\/(.+)/)
  if (blogMatch) return `/blog/${blogMatch[1]}/`

  // /pages/slug → /slug/ (some info pages)
  const pageMatch = livePath.match(/\/pages\/(.+)/)
  if (pageMatch) return `/${pageMatch[1]}/`

  // Same path (products, etc.)
  return livePath
}
