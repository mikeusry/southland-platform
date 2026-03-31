/**
 * Page Audit — HTML-based quality audits for go-live readiness
 *
 * Pure HTML parsing, no external APIs, sub-second per page.
 * Implements the Page Evaluation Agent spec (docs/PAGE-EVALUATION-AGENT.md).
 */

// =============================================================================
// TYPES
// =============================================================================

export type PageArchetype =
  | 'storybrand-landing'
  | 'hub'
  | 'utility'
  | 'content'
  | 'shop'
  | 'proxy'

export type PersonaId = 'bill' | 'betty' | 'taylor' | 'sam' | 'general'

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

export type AuditVerdict = 'ship' | 'fix' | 'rewrite'

export interface AuditCheck {
  label: string
  status: 'pass' | 'fail' | 'warn'
  detail?: string
}

export interface AuditCategory {
  name: string
  grade: Grade
  checks: AuditCheck[]
}

export interface AuditResult {
  path: string
  archetype: PageArchetype
  persona: PersonaId
  referencePage: string | null
  sourceLines: number | null
  categories: {
    architecture: AuditCategory | null
    design: AuditCategory
    seo: AuditCategory
    products: AuditCategory | null
    originality: AuditCategory | null // stub
    voice: AuditCategory | null       // stub
  }
  overallGrade: Grade
  verdict: AuditVerdict
  actions: AuditAction[]
  auditedAt: string
}

export interface AuditAction {
  index: number
  action: string
  type: 'fix' | 'rewrite' | 'add'
  impact: 'high' | 'medium' | 'low'
}

export interface PageClassification {
  path: string
  label: string
  archetype: PageArchetype
  persona: PersonaId
  referencePage: string | null
  priority: 'critical' | 'high' | 'medium' | 'low'
  group: string
  type: 'audit' | 'compare' | 'check'
  newPath?: string
}

// =============================================================================
// HTML EXTRACTION UTILITIES
// =============================================================================

export interface ExtractedPageData {
  title: string
  titleLength: number
  metaDescription: string
  metaDescLength: number
  canonical: string | null
  ogTags: Record<string, string>
  twitterTags: Record<string, string>
  schemaTypes: string[]
  schemaData: any[]
  h1: string
  h1Count: number
  h1HasFontHeading: boolean
  headings: { tag: string; text: string; hasFontHeading: boolean }[]
  headingHierarchyValid: boolean
  skippedLevels: string[]
  bodyInternalLinks: string[]
  bodyExternalLinks: number
  bodyLinkDiversity: { products: number; blog: number; hubs: number; other: number }
  imageCount: number
  imagesWithAlt: number
  imagesWithoutAlt: number
  cloudinaryOptimized: number
  cloudinaryUnoptimized: number
  wordCount: number
  hasCloudinaryHero: boolean
  hasProblemSection: boolean
  hasJtbdSection: boolean
  hasShopGrid: boolean
  hasProofBand: boolean
  hasFaqSection: boolean
  hasFinalCta: boolean
  hasHexIcons: boolean
  hasEmojiIcons: boolean
  sectionCount: number
  isGenericTemplate: boolean
  brandColors: { darkGreen: number; lightGreen: number }
  sectionRhythm: boolean
  maxWidthContainer: string | null
  productHandles: string[]
  bodyText: string
  ctaTexts: string[]
  hasTestimonials: boolean
  hasStats: boolean
  hasCaseStudies: boolean
  hasResearchCitations: boolean
  isProblemFirst: boolean
  hasSpecificCTAs: boolean
  hasGenericCTAs: boolean
  personaKeywordHits: Record<string, number>
}

/** Strip nav/header/footer from HTML to get body-only content */
function extractBody(html: string): string {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (mainMatch) return mainMatch[1]
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) {
    let body = bodyMatch[1]
    body = body.replace(/<header[\s\S]*?<\/header>/gi, '')
    body = body.replace(/<nav[\s\S]*?<\/nav>/gi, '')
    body = body.replace(/<footer[\s\S]*?<\/footer>/gi, '')
    return body
  }
  return html
}

/** Extract text content, stripping scripts/styles/tags */
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Check for emoji characters in text (Unicode ranges for common emoji) */
function hasEmoji(text: string): boolean {
  // Matches common emoji ranges
  return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{231A}\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}\u{26AB}\u{26BD}\u{26BE}\u{26C4}\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}\u{26F3}\u{26F5}\u{26FA}\u{26FD}]/u.test(text)
}

export function extractPageData(html: string): ExtractedPageData {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || ''
  const body = extractBody(html)
  const bodyText = extractText(body)

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''

  // Meta description — use separate patterns for " and ' to handle apostrophes in content
  const metaDescMatch = head.match(/<meta\s+name=["']description["']\s+content="([^"]+)"/i)
    || head.match(/<meta\s+name=["']description["']\s+content='([^']+)'/i)
    || head.match(/<meta\s+content="([^"]+)"\s+name=["']description["']/i)
    || head.match(/<meta\s+content='([^']+)'\s+name=["']description["']/i)
  const metaDescription = metaDescMatch ? metaDescMatch[1] : ''

  // Canonical
  const canonicalMatch = head.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)
    || head.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i)
  const canonical = canonicalMatch ? canonicalMatch[1] : null

  // OG tags
  const ogTags: Record<string, string> = {}
  const ogMatches = head.matchAll(/<meta\s+(?:property|name)=["'](og:[^"']+)["']\s+content=["']([^"']+)["']/gi)
  for (const m of ogMatches) ogTags[m[1]] = m[2]
  // Also try reversed attribute order
  const ogMatches2 = head.matchAll(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](og:[^"']+)["']/gi)
  for (const m of ogMatches2) ogTags[m[2]] = m[1]

  // Twitter tags
  const twitterTags: Record<string, string> = {}
  const twMatches = head.matchAll(/<meta\s+(?:property|name)=["'](twitter:[^"']+)["']\s+content=["']([^"']+)["']/gi)
  for (const m of twMatches) twitterTags[m[1]] = m[2]
  const twMatches2 = head.matchAll(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](twitter:[^"']+)["']/gi)
  for (const m of twMatches2) twitterTags[m[2]] = m[1]

  // Schema.org JSON-LD
  const schemaTypes: string[] = []
  const schemaData: any[] = []
  const ldMatches = html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of ldMatches) {
    try {
      const parsed = JSON.parse(m[1])
      schemaData.push(parsed)
      if (Array.isArray(parsed)) {
        for (const item of parsed) { if (item['@type']) schemaTypes.push(item['@type']) }
      } else if (parsed['@type']) schemaTypes.push(parsed['@type'])
    } catch { /* ignore */ }
  }

  // Detect prose containers that apply font-heading via CSS (prose-headings:font-heading)
  // Headings inside these containers inherit the font even without the class on the element.
  // We find each container's start position, then collect all headings from there until the
  // next sibling section (</section>) or end of HTML — avoids lazy </div> matching bugs.
  const proseHeadingFHContent = new Set<string>()
  const proseOpenRegex = /<div\s[^>]*class="[^"]*prose-headings:font-heading[^"]*"[^>]*>/gi
  let proseMatch
  while ((proseMatch = proseOpenRegex.exec(html)) !== null) {
    // Scan from this div's opening tag to the next </section> or end of body
    const startPos = proseMatch.index + proseMatch[0].length
    const sectionEnd = html.indexOf('</section>', startPos)
    const region = sectionEnd > -1 ? html.substring(startPos, sectionEnd) : html.substring(startPos)
    const innerHeadingRegex = /<(h[1-6])\s*[^>]*>([\s\S]*?)<\/\1>/gi
    let innerMatch
    while ((innerMatch = innerHeadingRegex.exec(region)) !== null) {
      const innerText = innerMatch[2].replace(/<[^>]+>/g, '').trim()
      proseHeadingFHContent.add(innerText)
    }
  }

  // Headings
  const headingRegex = /<(h[1-6])\s*([^>]*)>([\s\S]*?)<\/\1>/gi
  const headings: { tag: string; text: string; hasFontHeading: boolean }[] = []
  let h1 = ''
  let h1Count = 0
  let h1HasFontHeading = false
  let match
  while ((match = headingRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase()
    const attrs = match[2]
    const text = match[3].replace(/<[^>]+>/g, '').trim()
    const hasFH = /font-heading/.test(attrs) || /class=["'][^"']*font-heading/.test(match[0]) || proseHeadingFHContent.has(text)
    headings.push({ tag, text, hasFontHeading: hasFH })
    if (tag === 'h1') {
      h1Count++
      if (!h1) {
        h1 = text
        h1HasFontHeading = hasFH
      }
    }
  }

  // Heading hierarchy validation
  let headingHierarchyValid = true
  const skippedLevels: string[] = []
  let lastLevel = 0
  for (const h of headings) {
    const level = parseInt(h.tag[1])
    if (lastLevel > 0 && level > lastLevel + 1) {
      headingHierarchyValid = false
      skippedLevels.push(`${h.tag} after h${lastLevel} ("${h.text.substring(0, 40)}")`)
    }
    lastLevel = level
  }

  // Links in body (not nav/footer)
  const bodyLinks: string[] = []
  let bodyExternalLinks = 0
  const linkRegex = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>/gi
  while ((match = linkRegex.exec(body)) !== null) {
    const href = match[1]
    if (href.startsWith('http') && !href.includes('southlandorganics.com')) {
      bodyExternalLinks++
    } else if (href.startsWith('/') || href.includes('southlandorganics.com')) {
      bodyLinks.push(href)
    }
  }

  // Link diversity
  const diversity = { products: 0, blog: 0, hubs: 0, other: 0 }
  for (const link of bodyLinks) {
    if (link.includes('/products/')) diversity.products++
    else if (link.includes('/blog/')) diversity.blog++
    else if (link.match(/^\/(poultry|lawn|agriculture|livestock|podcast)\//)) diversity.hubs++
    else diversity.other++
  }

  // Images
  const imgRegex = /<img\s([^>]*)>/gi
  let imageCount = 0
  let imagesWithAlt = 0
  let imagesWithoutAlt = 0
  let cloudinaryOptimized = 0
  let cloudinaryUnoptimized = 0
  while ((match = imgRegex.exec(body)) !== null) {
    imageCount++
    const attrs = match[1]
    if (/alt=["'][^"']+["']/.test(attrs)) imagesWithAlt++
    else imagesWithoutAlt++
    if (/cloudinary/.test(attrs)) {
      if (/f_auto/.test(attrs) && /q_auto/.test(attrs)) cloudinaryOptimized++
      else cloudinaryUnoptimized++
    }
  }

  // Architecture detection (StoryBrand sections)
  // Note: check full `html` for clip-path/polygon since they may be in <style> blocks
  const hasCloudinaryHero = /CloudinaryHero|cloudinary.*hero/i.test(html) ||
    (/<div[^>]*class="[^"]*hero[^"]*"/.test(body) && /<h1/.test(body))
  const hasHexInPage = /clip-path[:\s]*polygon\(50% 0%/i.test(html)
  const hasProblemSection = (
    // Check for problem card patterns: 3-card grid with problem language
    (/problem|external.*internal.*philosophical|treadmill|guilt|frustrat/i.test(body) &&
      (body.match(/md:grid-cols-3|grid-cols-3/gi) || []).length >= 1) ||
    // Or explicit problem/challenge section with hex icons
    (/problem|challenge/i.test(body) && hasHexInPage)
  )
  const hasJtbdSection = /job|jtbd|product-card|CollectionProductCard/i.test(body) &&
    (body.match(/<img/gi) || []).length > 2
  const hasShopGrid = /product-grid|collection-grid|CollectionProductCard/i.test(body) ||
    (body.match(/\/products\//gi) || []).length >= 3
  const hasProofBand = /bg-\[#2C5234\]|bg-\[#2c5234\]/.test(body) &&
    (body.match(/\d+[+%x]/g) || []).length >= 2
  const hasFaqSection = /<details|AccordionFaq|accordion/i.test(body)
  const hasFinalCta = (() => {
    const lastThird = body.slice(Math.floor(body.length * 0.66))
    return (/bg-\[#2C5234\]|bg-\[#2c5234\]/.test(lastThird) || /bg-brand-dark/.test(lastThird)) &&
      /<a\s/.test(lastThird)
  })()

  // Hex icons — check full html since clip-path may be in <style>
  const hasHexIcons = hasHexInPage

  // Emoji in icon-like positions (sections with hex containers or icon labels)
  const hasEmojiIcons = hasEmoji(body)

  // Section count (top-level <section> tags or py-16/py-20 divs)
  const sectionCount = (body.match(/<section[\s>]/gi) || []).length +
    (body.match(/class="[^"]*py-(?:16|20)[^"]*"/gi) || []).length

  // Generic template detection: few sections + prose + grid = boring
  const isGenericTemplate = sectionCount < 5 &&
    !hasCloudinaryHero && !hasProblemSection && !hasFaqSection

  // Brand colors in classes/styles — scan full HTML since proof bands
  // and CTA sections with brand colors often sit outside <main>
  const darkGreenCount = (html.match(/#2C5234|#2c5234|brand-dark/gi) || []).length
  const lightGreenCount = (html.match(/#44883E|#44883e|brand-green/gi) || []).length

  // Section rhythm (py-16 / py-20 alternation) — scan full HTML since
  // sections with padding often sit outside <main> (e.g. proof bands, final CTA)
  const sectionRhythm = (html.match(/py-16|py-20/gi) || []).length >= 3

  // Max-width container
  const maxWidth = body.match(/max-w-(6xl|7xl)/)?.[0] || null

  // Product handles
  const productLinks = body.match(/\/products\/([a-z0-9-]+)/gi) || []
  const productHandles = [...new Set(productLinks.map(l => l.replace('/products/', '')))]

  // ── Voice / Copy analysis ──────────────────────────────────────────────────

  // CTA text extraction (buttons and styled links that look like CTAs)
  // Match: <a/button> with btn class, rounded-*/px- (Tailwind button pattern), or role="button"
  // Scan full HTML since CTAs often live in sections outside <main> (proof bands, final CTA)
  const ctaRegex = /<(?:a|button)\s[^>]*(?:class="[^"]*(?:btn|rounded-(?:lg|xl|full)[^"]*px-)[^"]*"|role="button")[^>]*>([\s\S]*?)<\/(?:a|button)>/gi
  const ctaTexts: string[] = []
  while ((match = ctaRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim()
    if (text && text.length > 2 && text.length < 80) ctaTexts.push(text)
  }

  // Generic CTAs vs specific
  const genericCtaPatterns = /^(submit|learn more|click here|read more|get started|contact us|sign up)$/i
  const hasGenericCTAs = ctaTexts.some(t => genericCtaPatterns.test(t))
  const hasSpecificCTAs = ctaTexts.some(t => !genericCtaPatterns.test(t) && t.length > 3)

  // Social proof signals
  const hasTestimonials = /testimonial|"[^"]{20,}".*—|quote|customer.*said|grower.*said/i.test(body)
  const hasStats = (bodyText.match(/\d+[+%x]|\d+\s*(?:percent|million|thousand|acres|birds|houses|flocks)/gi) || []).length >= 2
  const hasCaseStudies = /case\s*stud|success\s*stor|spotlight|real.*result/i.test(body)
  const hasResearchCitations = /university|uga|study|research|peer.*review|published|journal/i.test(bodyText)

  // Problem-first detection: does the page lead with problem before solution?
  // Check first 20% of body text
  const firstFifth = bodyText.substring(0, Math.floor(bodyText.length * 0.2)).toLowerCase()
  const problemSignals = (firstFifth.match(/problem|challenge|struggle|frustrat|worry|risk|loss|mortalit|ammonia|stress|cost|expense|fail|wrong/g) || []).length
  const solutionSignals = (firstFifth.match(/solution|product|buy|shop|order|our.*product|we offer/g) || []).length
  const isProblemFirst = problemSignals > solutionSignals || problemSignals >= 2

  // Persona keyword detection
  const personaKeywords: Record<string, RegExp[]> = {
    bill: [/fcr/i, /mortality/i, /settlement/i, /integrator/i, /broiler/i, /operation/i, /house/i, /flock/i, /grower/i],
    betty: [/backyard/i, /flock/i, /healthy.*egg/i, /coop/i, /hen/i, /chick/i, /roost/i],
    taylor: [/turf/i, /fairway/i, /application.*rate/i, /coverage/i, /green.*up/i, /soil.*test/i, /lawn/i],
    sam: [/lagoon/i, /waste/i, /swine/i, /odor/i, /sludge/i, /treatment/i],
  }
  const personaKeywordHits: Record<string, number> = {}
  for (const [persona, patterns] of Object.entries(personaKeywords)) {
    personaKeywordHits[persona] = patterns.filter(p => p.test(bodyText)).length
  }

  return {
    title,
    titleLength: title.length,
    metaDescription,
    metaDescLength: metaDescription.length,
    canonical,
    ogTags,
    twitterTags,
    schemaTypes,
    schemaData,
    h1,
    h1Count,
    h1HasFontHeading,
    headings,
    headingHierarchyValid,
    skippedLevels,
    bodyInternalLinks: bodyLinks,
    bodyExternalLinks,
    bodyLinkDiversity: diversity,
    imageCount,
    imagesWithAlt,
    imagesWithoutAlt,
    cloudinaryOptimized,
    cloudinaryUnoptimized,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    hasCloudinaryHero,
    hasProblemSection,
    hasJtbdSection,
    hasShopGrid,
    hasProofBand,
    hasFaqSection,
    hasFinalCta,
    hasHexIcons,
    hasEmojiIcons,
    sectionCount,
    isGenericTemplate,
    brandColors: { darkGreen: darkGreenCount, lightGreen: lightGreenCount },
    sectionRhythm,
    maxWidthContainer: maxWidth,
    productHandles,
    bodyText,

    // Voice / copy analysis
    ctaTexts,
    hasTestimonials,
    hasStats,
    hasCaseStudies,
    hasResearchCitations,
    isProblemFirst,
    hasSpecificCTAs,
    hasGenericCTAs,
    personaKeywordHits,
  }
}

// =============================================================================
// AUDIT FUNCTIONS
// =============================================================================

function gradeFromChecks(checks: AuditCheck[]): Grade {
  const fails = checks.filter(c => c.status === 'fail').length
  const warns = checks.filter(c => c.status === 'warn').length
  if (fails === 0 && warns === 0) return 'A'
  if (fails === 0 && warns <= 2) return 'B'
  if (fails <= 1) return 'C'
  if (fails <= 3) return 'D'
  return 'F'
}

// --- Architecture Audit (StoryBrand Landing only) ---

export function auditArchitecture(data: ExtractedPageData): AuditCategory {
  const checks: AuditCheck[] = [
    {
      label: 'CloudinaryHero with H1 overlay',
      status: data.hasCloudinaryHero ? 'pass' : 'fail',
      detail: data.hasCloudinaryHero ? undefined : 'Missing hero section with image + H1 overlay',
    },
    {
      label: 'Problem section (3 hex-icon cards)',
      status: data.hasProblemSection ? 'pass' : 'fail',
      detail: data.hasProblemSection ? undefined : 'Missing problem cards (External, Internal, Philosophical)',
    },
    {
      label: 'JTBD / Product sections',
      status: data.hasJtbdSection ? 'pass' : 'fail',
      detail: data.hasJtbdSection ? undefined : 'Missing job-to-be-done cards with product images + prices',
    },
    {
      label: 'Shop grid (filtered product cards)',
      status: data.hasShopGrid ? 'pass' : 'warn',
      detail: data.hasShopGrid ? undefined : 'No product grid found',
    },
    {
      label: 'Proof band (dark green stats)',
      status: data.hasProofBand ? 'pass' : 'fail',
      detail: data.hasProofBand ? undefined : 'Missing bg-[#2C5234] proof band with stats',
    },
    {
      label: 'FAQ / Objections accordion',
      status: data.hasFaqSection ? 'pass' : 'warn',
      detail: data.hasFaqSection ? undefined : 'No FAQ or objections section found',
    },
    {
      label: 'Final CTA band',
      status: data.hasFinalCta ? 'pass' : 'warn',
      detail: data.hasFinalCta ? undefined : 'Missing final CTA in bottom third of page',
    },
  ]

  let grade = gradeFromChecks(checks)

  // Automatic F: generic template on StoryBrand page
  if (data.isGenericTemplate) {
    grade = 'F'
    checks.unshift({
      label: 'NOT a generic template',
      status: 'fail',
      detail: 'Page uses generic prose → grid template. Needs full StoryBrand rewrite.',
    })
  }

  return { name: 'Architecture', grade, checks }
}

// --- Design Audit ---

export function auditDesign(data: ExtractedPageData): AuditCategory {
  const h1h2Headings = data.headings.filter(h => h.tag === 'h1' || h.tag === 'h2')
  const h1h2WithFontHeading = h1h2Headings.filter(h => h.hasFontHeading)
  const allH1H2HaveFH = h1h2Headings.length > 0 && h1h2WithFontHeading.length === h1h2Headings.length

  const checks: AuditCheck[] = [
    {
      label: 'H1/H2 use font-heading (Eveleth Dot)',
      status: allH1H2HaveFH ? 'pass' : 'fail',
      detail: allH1H2HaveFH ? `${h1h2WithFontHeading.length}/${h1h2Headings.length} have font-heading` :
        `${h1h2WithFontHeading.length}/${h1h2Headings.length} have font-heading. Missing: ${h1h2Headings.filter(h => !h.hasFontHeading).map(h => `${h.tag} "${h.text.substring(0, 30)}"`).join(', ')}`,
    },
    {
      label: 'No emoji in icon positions',
      status: data.hasEmojiIcons ? 'fail' : 'pass',
      detail: data.hasEmojiIcons ? 'Emoji detected — replace with SVG in hex containers' : undefined,
    },
    {
      label: 'Hex clip-path icon containers',
      status: data.hasHexIcons ? 'pass' : 'warn',
      detail: data.hasHexIcons ? undefined : 'No hex clip-path containers found',
    },
    {
      label: 'Brand colors present',
      status: (data.brandColors.darkGreen > 0 || data.brandColors.lightGreen > 0) ? 'pass' : 'warn',
      detail: `Dark green: ${data.brandColors.darkGreen}, Light green: ${data.brandColors.lightGreen}`,
    },
    {
      label: 'Section rhythm (py-16/py-20)',
      status: data.sectionRhythm ? 'pass' : 'warn',
      detail: data.sectionRhythm ? undefined : 'Inconsistent section padding rhythm',
    },
    {
      label: 'Images in body content',
      status: data.imageCount > 0 ? 'pass' : 'warn',
      detail: `${data.imageCount} images found`,
    },
    {
      label: 'Cloudinary optimization (f_auto, q_auto)',
      status: data.cloudinaryUnoptimized === 0 ? 'pass' : 'warn',
      detail: data.cloudinaryUnoptimized > 0 ? `${data.cloudinaryUnoptimized} Cloudinary images missing f_auto/q_auto` : undefined,
    },
  ]

  let grade = gradeFromChecks(checks)
  // Cap: missing font-heading → C max
  if (!allH1H2HaveFH && (grade === 'A' || grade === 'B')) grade = 'C'
  // Emoji in icons → F
  if (data.hasEmojiIcons) grade = 'F'

  return { name: 'Design', grade, checks }
}

// --- SEO Audit ---

export function auditSeo(data: ExtractedPageData): AuditCategory {
  const ogComplete = !!(data.ogTags['og:title'] && data.ogTags['og:description'] && data.ogTags['og:image'])
  const twComplete = !!(data.twitterTags['twitter:card'] || data.twitterTags['twitter:title'])
  const isPodcastDefault = data.ogTags['og:image']?.includes('podcast') || false
  const bodyLinkCount = data.bodyInternalLinks.length
  const hasDiverseLinks = (data.bodyLinkDiversity.blog > 0 ? 1 : 0) +
    (data.bodyLinkDiversity.hubs > 0 ? 1 : 0) +
    (data.bodyLinkDiversity.products > 0 ? 1 : 0) +
    (data.bodyLinkDiversity.other > 0 ? 1 : 0) >= 2

  const checks: AuditCheck[] = [
    {
      label: 'Title tag present, <60 chars',
      status: data.title && data.titleLength <= 60 ? 'pass' :
        data.title && data.titleLength > 60 ? 'warn' : 'fail',
      detail: data.title ? `"${data.title}" (${data.titleLength} chars)` : 'Missing title tag',
    },
    {
      label: 'Meta description (120-160 chars)',
      status: data.metaDescription && data.metaDescLength >= 120 && data.metaDescLength <= 160 ? 'pass' :
        data.metaDescription && data.metaDescLength > 0 ? 'warn' : 'fail',
      detail: data.metaDescription ? `${data.metaDescLength} chars` : 'Missing meta description',
    },
    {
      label: 'Canonical URL present',
      status: data.canonical ? 'pass' : 'warn',
      detail: data.canonical || 'No canonical URL',
    },
    {
      label: 'OG tags complete',
      status: ogComplete ? 'pass' : 'warn',
      detail: ogComplete ? undefined : `Missing: ${['og:title', 'og:description', 'og:image'].filter(k => !data.ogTags[k]).join(', ')}`,
    },
    {
      label: 'OG image not podcast default',
      status: !isPodcastDefault ? 'pass' : 'warn',
      detail: isPodcastDefault ? 'OG image uses podcast default on non-podcast page' : undefined,
    },
    {
      label: 'Twitter tags present',
      status: twComplete ? 'pass' : 'warn',
      detail: twComplete ? undefined : 'Missing twitter:card or twitter:title',
    },
    {
      label: 'Schema.org JSON-LD',
      status: data.schemaTypes.length > 0 ? 'pass' : 'warn',
      detail: data.schemaTypes.length > 0 ? `Types: ${data.schemaTypes.join(', ')}` : 'No JSON-LD schema found',
    },
    {
      label: 'Single H1',
      status: data.h1Count === 1 ? 'pass' : data.h1Count === 0 ? 'fail' : 'warn',
      detail: data.h1Count === 1 ? `"${data.h1}"` : `${data.h1Count} H1 tags found`,
    },
    {
      label: 'Heading hierarchy (no skipped levels)',
      status: data.headingHierarchyValid ? 'pass' : 'warn',
      detail: data.headingHierarchyValid ? undefined : `Skipped: ${data.skippedLevels.join('; ')}`,
    },
    {
      label: 'Internal links in body (5+ target)',
      status: bodyLinkCount >= 5 ? 'pass' : bodyLinkCount > 0 ? 'warn' : 'fail',
      detail: `${bodyLinkCount} internal links (products: ${data.bodyLinkDiversity.products}, blog: ${data.bodyLinkDiversity.blog}, hubs: ${data.bodyLinkDiversity.hubs}, other: ${data.bodyLinkDiversity.other})`,
    },
    {
      label: 'Link diversity (2+ categories)',
      status: hasDiverseLinks ? 'pass' : 'warn',
      detail: hasDiverseLinks ? undefined : 'All links point to same section — add mix of blog, hubs, products',
    },
    {
      label: 'Image alt text',
      status: data.imagesWithoutAlt === 0 ? 'pass' : 'warn',
      detail: data.imagesWithoutAlt > 0 ? `${data.imagesWithoutAlt} images missing alt text` : `All ${data.imagesWithAlt} images have alt text`,
    },
  ]

  let grade = gradeFromChecks(checks)
  // Zero body links → D max
  if (bodyLinkCount === 0 && (grade === 'A' || grade === 'B' || grade === 'C')) grade = 'D'

  return { name: 'SEO', grade, checks }
}

// --- Product Relevance Audit ---

// Persona → product mapping for relevance checks
// Product handles considered relevant per persona.
// Uses substring matching (case-insensitive), so 'poultry' matches 'poultry-probiotic' etc.
// Keep broad — false negatives (flagging good products as irrelevant) are worse than false positives.
const PERSONA_PRODUCT_MAP: Record<string, string[]> = {
  bill: [
    'poultry', 'big-ole-bird', 'litter', 'mite', 'desecticide', 'hen-helper',
    'catalyst', 'apple-cider-vinegar', 'coop-recuperate', 'roost',
    'alpet', 'sanitiz', 'surface', 'zeropoint', 'biosecurity',
    'backyard', 'bundle', 'torched', // cross-sell items shown in grids are fine
  ],
  betty: [
    'poultry', 'big-ole-bird', 'litter', 'mite', 'desecticide', 'hen-helper',
    'catalyst', 'apple-cider-vinegar', 'coop-recuperate', 'roost',
    'backyard', 'bundle', 'torched', 'sanitiz', 'zeropoint',
  ],
  taylor: [
    'soil', 'turf', 'humic', 'humate', 'hume', 'carbon', 'genesis', 'omega',
    'jump-start', 'fertalive', 'veridian', 'revival', 'torched',
    'compost', 'sulfur', 'elemental', 'biochar', 'c-fix', 'lawn',
    'chicken-manure', 'manure', // organic fertilizer, cross-sold on turf pages
  ],
  sam: ['lagoon', 'waste', 'swine', 'odor'],
  general: [], // no filtering for general
}

export function auditProducts(data: ExtractedPageData, persona: PersonaId): AuditCategory {
  const relevantProducts = PERSONA_PRODUCT_MAP[persona] || []
  const handles = data.productHandles

  if (handles.length === 0) {
    return {
      name: 'Products',
      grade: 'B',
      checks: [{ label: 'No products shown on page', status: 'pass', detail: 'Page may not need products' }],
    }
  }

  const checks: AuditCheck[] = []

  // Check each product for relevance
  if (persona !== 'general' && relevantProducts.length > 0) {
    const irrelevant = handles.filter(h => !relevantProducts.some(r => h.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(h.toLowerCase())))
    const relevant = handles.filter(h => relevantProducts.some(r => h.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(h.toLowerCase())))

    checks.push({
      label: 'Products match persona',
      status: irrelevant.length === 0 ? 'pass' : irrelevant.length <= 2 ? 'warn' : 'fail',
      detail: irrelevant.length > 0 ? `Irrelevant: ${irrelevant.join(', ')}` : `All ${handles.length} products relevant`,
    })

    checks.push({
      label: 'Relevant products present',
      status: relevant.length > 0 ? 'pass' : 'warn',
      detail: `${relevant.length} of ${relevantProducts.length} expected products shown`,
    })
  } else {
    checks.push({
      label: 'Products listed',
      status: 'pass',
      detail: `${handles.length} products: ${handles.join(', ')}`,
    })
  }

  // Check for JTBD curation vs raw grid dump
  checks.push({
    label: 'JTBD-curated (not raw grid dump)',
    status: data.hasJtbdSection ? 'pass' : 'warn',
    detail: data.hasJtbdSection ? 'Products appear in job-to-be-done sections' : 'Products shown as raw grid only — add JTBD curation',
  })

  return { name: 'Products', grade: gradeFromChecks(checks), checks }
}

// --- Brand Voice Audit (local text analysis) ---

export function auditVoiceLocal(data: ExtractedPageData, persona: PersonaId): AuditCategory {
  const checks: AuditCheck[] = [
    {
      label: 'Problem-first copy',
      status: data.isProblemFirst ? 'pass' : 'warn',
      detail: data.isProblemFirst ? 'Page leads with problem/challenge before solution' : 'Copy leads with solution/product — reorder to lead with the problem',
    },
    {
      label: 'Specific CTAs (not generic)',
      status: data.hasGenericCTAs ? 'warn' : data.hasSpecificCTAs ? 'pass' : 'warn',
      detail: data.ctaTexts.length > 0
        ? `CTAs: ${data.ctaTexts.slice(0, 5).join(', ')}${data.hasGenericCTAs ? ' — replace generic CTAs (Submit, Learn More)' : ''}`
        : 'No CTA buttons found',
    },
    {
      label: 'Proof points (numbers, stats)',
      status: data.hasStats ? 'pass' : 'warn',
      detail: data.hasStats ? undefined : 'Add specific data points (ppm, $/acre, FCR, %, etc.)',
    },
    {
      label: 'Social proof present',
      status: (data.hasTestimonials || data.hasCaseStudies) ? 'pass' : 'warn',
      detail: [
        data.hasTestimonials ? 'testimonials' : null,
        data.hasCaseStudies ? 'case studies' : null,
        data.hasResearchCitations ? 'research citations' : null,
      ].filter(Boolean).join(', ') || 'No testimonials, case studies, or research citations found',
    },
    {
      label: 'Research/authority citations',
      status: data.hasResearchCitations ? 'pass' : 'warn',
      detail: data.hasResearchCitations ? 'References university research or published studies' : 'Add UGA studies, research data, or authority citations',
    },
  ]

  // Persona keyword alignment (only for non-general personas)
  if (persona !== 'general') {
    const hits = data.personaKeywordHits[persona] || 0
    const totalKeywords = Object.values(data.personaKeywordHits).reduce((a, b) => a + b, 0)
    const isAligned = hits >= 3 || (totalKeywords > 0 && hits / totalKeywords > 0.4)
    checks.push({
      label: `Persona language (${persona})`,
      status: isAligned ? 'pass' : 'warn',
      detail: `${hits} keyword matches for ${persona}` +
        (totalKeywords > 0 ? ` (${Math.round(hits / totalKeywords * 100)}% of all persona signals)` : ''),
    })
  }

  return { name: 'Voice', grade: gradeFromChecks(checks), checks }
}

// =============================================================================
// OVERALL GRADING + VERDICT
// =============================================================================

function gradeToNum(g: Grade): number {
  return { A: 4, B: 3, C: 2, D: 1, F: 0 }[g]
}

function numToGrade(n: number): Grade {
  if (n >= 3.5) return 'A'
  if (n >= 2.5) return 'B'
  if (n >= 1.5) return 'C'
  if (n >= 0.5) return 'D'
  return 'F'
}

export function computeOverallGrade(categories: AuditResult['categories']): { grade: Grade; verdict: AuditVerdict } {
  const grades: Grade[] = []
  if (categories.architecture) grades.push(categories.architecture.grade)
  grades.push(categories.design.grade)
  grades.push(categories.seo.grade)
  if (categories.products) grades.push(categories.products.grade)
  if (categories.voice) grades.push(categories.voice.grade)
  // Originality is advisory — doesn't affect overall grade

  // Overall = min of non-null grades
  const minGrade = grades.reduce((min, g) => gradeToNum(g) < gradeToNum(min) ? g : min, 'A' as Grade)

  // Verdict
  let verdict: AuditVerdict
  if (grades.every(g => gradeToNum(g) >= 3)) {
    verdict = 'ship'
  } else if (categories.architecture?.grade === 'F' || grades.filter(g => gradeToNum(g) <= 1).length >= 2) {
    verdict = 'rewrite'
  } else {
    verdict = 'fix'
  }

  return { grade: minGrade, verdict }
}

// =============================================================================
// GENERATE ACTIONS
// =============================================================================

export function generateActions(categories: AuditResult['categories']): AuditAction[] {
  const actions: AuditAction[] = []
  let idx = 1

  function addFromChecks(cat: AuditCategory | null, defaultType: 'fix' | 'add') {
    if (!cat) return
    for (const check of cat.checks) {
      if (check.status === 'fail') {
        actions.push({ index: idx++, action: check.detail || check.label, type: cat.grade === 'F' ? 'rewrite' : 'fix', impact: 'high' })
      } else if (check.status === 'warn') {
        actions.push({ index: idx++, action: check.detail || check.label, type: defaultType, impact: 'medium' })
      }
    }
  }

  addFromChecks(categories.architecture, 'fix')
  addFromChecks(categories.design, 'fix')
  addFromChecks(categories.seo, 'add')
  addFromChecks(categories.products, 'fix')
  addFromChecks(categories.voice, 'add')

  // Sort by impact
  actions.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.impact] - order[b.impact]
  })

  // Re-index
  actions.forEach((a, i) => a.index = i + 1)

  return actions
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function runAudit(
  html: string,
  classification: { path: string; archetype: PageArchetype; persona: PersonaId; referencePage: string | null },
  sourceLines?: number,
): AuditResult {
  const data = extractPageData(html)

  const isStoryBrand = classification.archetype === 'storybrand-landing'
  const isShop = classification.archetype === 'shop'
  const showProducts = isStoryBrand || isShop

  const categories: AuditResult['categories'] = {
    architecture: isStoryBrand ? auditArchitecture(data) : null,
    design: auditDesign(data),
    seo: auditSeo(data),
    products: showProducts ? auditProducts(data, classification.persona) : null,
    originality: null, // Layer 2 — filled by deep audit
    voice: auditVoiceLocal(data, classification.persona),
  }

  const { grade, verdict } = computeOverallGrade(categories)
  const actions = generateActions(categories)

  return {
    path: classification.path,
    archetype: classification.archetype,
    persona: classification.persona,
    referencePage: classification.referencePage,
    sourceLines: sourceLines ?? null,
    categories,
    overallGrade: grade,
    verdict,
    actions,
    auditedAt: new Date().toISOString(),
  }
}
