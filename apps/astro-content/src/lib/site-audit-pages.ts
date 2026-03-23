/**
 * Site Audit — Page Registry
 *
 * Single source of truth for all routes audited by /admin/site-audit.
 * Add new routes here when they ship; the audit UI reads this file.
 */

// =============================================================================
// TYPES
// =============================================================================

export type PageType = 'lander' | 'collection' | 'pdp' | 'content' | 'hub' | 'utility'
export type Persona = 'bill' | 'betty' | 'taylor' | 'sam' | 'gary' | 'hannah' | 'maggie' | 'bob' | 'tom' | 'greg' | 'general' | null
export type FunnelStage = 'awareness' | 'consideration' | 'purchase' | 'post-purchase'
export type SearchIntent = 'informational' | 'commercial' | 'transactional' | 'navigational'
export type Blocker = 'copy' | 'dev' | 'design' | 'data' | null
export type PipelineStage =
  | 'no-copy'
  | 'copy-draft'
  | 'copy-approved'
  | 'built'
  | 'design-review'
  | 'shipped'
export type ContentType = 'dynamic' | 'index' | 'non-content'

export interface AuditPage {
  route: string
  name: string
  pageType: PageType
  persona: Persona
  funnelStage: FunnelStage
  searchIntent: SearchIntent
  primaryGoal: string
  priority: 'high' | 'medium' | 'low'
  contentType: ContentType
  scanCollection?: string
  scanSlug?: string
  pipeline?: PipelineStage
  blocker?: Blocker
  owner?: string
  /** Links to a dedicated sub-audit page (e.g. /admin/site-audit/blog) */
  auditLink?: string
}

export interface PageGroup {
  name: string
  id: string
  pages: AuditPage[]
}

/** Persona display config */
export const PERSONA_DISPLAY: Record<string, { label: string; link: string }> = {
  bill: { label: 'Broiler Bill', link: '/admin/personas/bill/' },
  betty: { label: 'Backyard Betty', link: '/admin/personas/betty/' },
  taylor: { label: 'Turf Pro Taylor', link: '/admin/personas/taylor/' },
  sam: { label: 'Septic Sam', link: '/admin/personas/sam/' },
  gary: { label: 'Golf Course Gary', link: '/admin/personas/gary/' },
  hannah: { label: 'Homeowner Hannah', link: '/admin/personas/hannah/' },
  maggie: { label: 'Market Gardener Maggie', link: '/admin/personas/maggie/' },
  bob: { label: 'Breeder Bob', link: '/admin/personas/bob/' },
  tom: { label: 'Turkey Tom', link: '/admin/personas/tom/' },
  greg: { label: 'Game Bird Greg', link: '/admin/personas/greg/' },
  general: { label: 'General', link: '' },
}

// =============================================================================
// PIPELINE + BLOCKER OPTIONS
// =============================================================================

export const PIPELINE_STAGES: { value: PipelineStage | ''; label: string }[] = [
  { value: '', label: 'Not started' },
  { value: 'no-copy', label: 'No Copy' },
  { value: 'copy-draft', label: 'Copy Draft' },
  { value: 'copy-approved', label: 'Copy Approved' },
  { value: 'built', label: 'Built' },
  { value: 'design-review', label: 'Design Review' },
  { value: 'shipped', label: 'Shipped' },
]

export const BLOCKERS: { value: string; label: string }[] = [
  { value: '', label: '--' },
  { value: 'copy', label: 'Copy' },
  { value: 'dev', label: 'Dev' },
  { value: 'design', label: 'Design' },
  { value: 'data', label: 'Data' },
]

// =============================================================================
// PAGE GROUPS
// =============================================================================

export const PAGE_GROUPS: PageGroup[] = [
  // -------------------------------------------------------------------------
  // 1. Homepage
  // -------------------------------------------------------------------------
  {
    name: 'Homepage',
    id: 'homepage',
    pages: [
      { route: '/', name: 'Homepage', pageType: 'lander', persona: 'general', funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Route to persona', priority: 'high', contentType: 'non-content', blocker: 'copy' },
    ],
  },

  // -------------------------------------------------------------------------
  // 2. Persona Landings
  // -------------------------------------------------------------------------
  {
    name: 'Persona Landings',
    id: 'persona',
    pages: [
      { route: '/poultry/', name: 'Poultry Hub', pageType: 'hub', persona: 'general', funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Route to persona', priority: 'high', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/poultry/commercial/', name: 'Broiler Bill Landing', pageType: 'lander', persona: 'bill', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Call sales', priority: 'high', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/poultry/backyard/', name: 'Backyard Betty Landing', pageType: 'lander', persona: 'betty', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Add to cart', priority: 'high', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/poultry/breeders/', name: 'Breeder Bob Landing', pageType: 'lander', persona: 'bob', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Call sales', priority: 'high', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/poultry/turkey/', name: 'Turkey Tom Landing', pageType: 'lander', persona: 'tom', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Call sales', priority: 'high', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/poultry/game-birds/', name: 'Game Bird Greg Landing', pageType: 'lander', persona: 'greg', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Call sales', priority: 'high', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/lawn/', name: 'Turf Pro Taylor Landing', pageType: 'lander', persona: 'taylor', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Build program', priority: 'high', contentType: 'non-content', blocker: 'copy' },
    ],
  },

  // -------------------------------------------------------------------------
  // 2b. Lawn & Garden Collections
  // -------------------------------------------------------------------------
  {
    name: 'Lawn & Garden',
    id: 'lawn',
    pages: [
      { route: '/lawn/golf-courses/', name: 'Golf Courses', pageType: 'collection', persona: 'taylor', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Add to cart', priority: 'high', contentType: 'dynamic', pipeline: 'shipped' },
      { route: '/lawn/homeowners/', name: 'Homeowners', pageType: 'collection', persona: 'taylor', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Add to cart', priority: 'high', contentType: 'dynamic', pipeline: 'shipped' },
      { route: '/lawn/landscapers/', name: 'Landscapers', pageType: 'collection', persona: 'taylor', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Add to cart', priority: 'high', contentType: 'dynamic', pipeline: 'shipped' },
      { route: '/lawn/turf-pros/', name: 'Turf Professionals', pageType: 'collection', persona: 'taylor', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Add to cart', priority: 'high', contentType: 'dynamic', pipeline: 'shipped' },
    ],
  },

  // -------------------------------------------------------------------------
  // 2c. Agriculture Collections
  // -------------------------------------------------------------------------
  {
    name: 'Agriculture',
    id: 'agriculture',
    pages: [
      { route: '/agriculture/crops/', name: 'Crops', pageType: 'collection', persona: 'general', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Add to cart', priority: 'high', contentType: 'dynamic', pipeline: 'shipped' },
      { route: '/agriculture/produce/', name: 'Produce', pageType: 'collection', persona: 'general', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Add to cart', priority: 'high', contentType: 'dynamic', pipeline: 'shipped' },
    ],
  },

  // -------------------------------------------------------------------------
  // 2d. Livestock Collections
  // -------------------------------------------------------------------------
  {
    name: 'Livestock',
    id: 'livestock',
    pages: [
      { route: '/livestock/swine/', name: 'Pig & Swine Supplements', pageType: 'collection', persona: 'general', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Add to cart', priority: 'high', contentType: 'dynamic', pipeline: 'shipped' },
    ],
  },

  // -------------------------------------------------------------------------
  // 3. Shop Collections
  // -------------------------------------------------------------------------
  {
    name: 'Shop Collections',
    id: 'collections',
    pages: [
      { route: '/collections/', name: 'Collections Index', pageType: 'hub', persona: 'general', funnelStage: 'consideration', searchIntent: 'navigational', primaryGoal: 'Browse products', priority: 'high', contentType: 'index', pipeline: 'built' },
      // Individual collection pages expanded at build time from shopCollections
    ],
  },

  // -------------------------------------------------------------------------
  // 4. Products
  // -------------------------------------------------------------------------
  {
    name: 'Products',
    id: 'products',
    pages: [
      { route: '/products/', name: 'Products Index', pageType: 'hub', persona: 'general', funnelStage: 'purchase', searchIntent: 'commercial', primaryGoal: 'Browse products', priority: 'high', contentType: 'index' },
      { route: '/products/', name: 'All Product Pages', pageType: 'pdp', persona: null, funnelStage: 'purchase', searchIntent: 'transactional', primaryGoal: 'Add to cart', priority: 'high', contentType: 'dynamic', auditLink: '/admin/site-audit/products' },
      { route: '/build-a-case/', name: 'Mix & Match Case Builder', pageType: 'utility', persona: 'general', funnelStage: 'purchase', searchIntent: 'transactional', primaryGoal: 'Build bundle', priority: 'high', contentType: 'non-content' },
      { route: '/products/sanitizers/', name: 'Sanitizers', pageType: 'collection', persona: 'general', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Add to cart', priority: 'high', contentType: 'dynamic', pipeline: 'shipped' },
      { route: '/products/waste-treatment/', name: 'Waste Treatment', pageType: 'collection', persona: 'general', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Add to cart', priority: 'high', contentType: 'dynamic', pipeline: 'shipped' },
    ],
  },

  // -------------------------------------------------------------------------
  // 5. Commerce
  // -------------------------------------------------------------------------
  {
    name: 'Commerce',
    id: 'commerce',
    pages: [
      { route: '/cart/', name: 'Cart', pageType: 'utility', persona: 'general', funnelStage: 'purchase', searchIntent: 'transactional', primaryGoal: 'Checkout', priority: 'medium', contentType: 'non-content' },
      { route: '/account/', name: 'Account', pageType: 'utility', persona: 'general', funnelStage: 'post-purchase', searchIntent: 'navigational', primaryGoal: 'Manage account', priority: 'low', contentType: 'non-content' },
    ],
  },

  // -------------------------------------------------------------------------
  // 6. Podcast
  // -------------------------------------------------------------------------
  {
    name: 'Podcast',
    id: 'podcast',
    pages: [
      { route: '/podcast/', name: 'Podcast Hub', pageType: 'hub', persona: 'general', funnelStage: 'awareness', searchIntent: 'informational', primaryGoal: 'Educate', priority: 'high', contentType: 'index', pipeline: 'shipped' },
      // Individual episodes expanded at build time from episodes collection
      { route: '/podcast/search', name: 'Podcast Search', pageType: 'utility', persona: null, funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Search', priority: 'medium', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/podcast/topics/', name: 'Topics Index', pageType: 'hub', persona: 'general', funnelStage: 'awareness', searchIntent: 'informational', primaryGoal: 'Browse topics', priority: 'medium', contentType: 'index', pipeline: 'shipped' },
      // Individual topics expanded at build time from topics collection
      { route: '/podcast/guests/', name: 'Guests Index', pageType: 'hub', persona: 'general', funnelStage: 'awareness', searchIntent: 'informational', primaryGoal: 'Browse guests', priority: 'low', contentType: 'index', pipeline: 'shipped' },
    ],
  },

  // -------------------------------------------------------------------------
  // 7. Blog
  // -------------------------------------------------------------------------
  {
    name: 'Blog',
    id: 'blog',
    pages: [
      { route: '/blog/', name: 'Blog Index', pageType: 'hub', persona: 'general', funnelStage: 'awareness', searchIntent: 'informational', primaryGoal: 'Educate', priority: 'high', contentType: 'index', pipeline: 'shipped' },
      { route: '/blog/', name: 'All Blog Posts (293)', pageType: 'content', persona: 'general', funnelStage: 'awareness', searchIntent: 'informational', primaryGoal: 'Educate', priority: 'high', contentType: 'dynamic', scanCollection: 'blog', pipeline: 'shipped', auditLink: '/admin/site-audit/blog' },
      { route: '/blog/category/[segment]', name: 'Category Archives', pageType: 'hub', persona: 'general', funnelStage: 'awareness', searchIntent: 'informational', primaryGoal: 'Browse category', priority: 'medium', contentType: 'non-content', pipeline: 'shipped' },
    ],
  },

  // -------------------------------------------------------------------------
  // 7b. Betty Content (Pillar Pages)
  // -------------------------------------------------------------------------
  {
    name: 'Betty Content',
    id: 'betty-content',
    pages: [
      { route: '/blog/whats-wrong-with-my-chicken-symptom-guide/', name: "What's Wrong With My Chicken?", pageType: 'content', persona: 'betty', funnelStage: 'consideration', searchIntent: 'informational', primaryGoal: 'Diagnose + recommend product', priority: 'high', contentType: 'dynamic', pipeline: 'built', owner: 'mike-usry' },
      { route: '/blog/backyard-chicken-dosing-guide/', name: 'Dosing Guide for Small Flocks', pageType: 'content', persona: 'betty', funnelStage: 'consideration', searchIntent: 'commercial', primaryGoal: 'Remove purchase barrier', priority: 'high', contentType: 'dynamic', pipeline: 'built', owner: 'mike-usry' },
      { route: '/blog/new-chicken-owner-first-30-days/', name: 'First 30 Days With Chickens', pageType: 'content', persona: 'betty', funnelStage: 'awareness', searchIntent: 'informational', primaryGoal: 'Onboard new owners', priority: 'high', contentType: 'dynamic', pipeline: 'built', owner: 'mike-usry' },
    ],
  },

  // -------------------------------------------------------------------------
  // 8. Team
  // -------------------------------------------------------------------------
  {
    name: 'Team',
    id: 'team',
    pages: [
      { route: '/team/', name: 'Team Index', pageType: 'hub', persona: 'general', funnelStage: 'awareness', searchIntent: 'informational', primaryGoal: 'Build trust', priority: 'medium', contentType: 'index', pipeline: 'shipped' },
      // Individual team members expanded at build time from team collection
    ],
  },

  // -------------------------------------------------------------------------
  // 9. Info Pages
  // -------------------------------------------------------------------------
  {
    name: 'Info Pages',
    id: 'info',
    pages: [
      { route: '/about/', name: 'About', pageType: 'utility', persona: 'general', funnelStage: 'awareness', searchIntent: 'informational', primaryGoal: 'Build trust', priority: 'medium', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/contact/', name: 'Contact', pageType: 'utility', persona: 'general', funnelStage: 'consideration', searchIntent: 'navigational', primaryGoal: 'Get in touch', priority: 'medium', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/distribution/', name: 'Distribution', pageType: 'utility', persona: 'general', funnelStage: 'awareness', searchIntent: 'informational', primaryGoal: 'Find dealers', priority: 'medium', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/store-locator/', name: 'Store Locator', pageType: 'utility', persona: 'general', funnelStage: 'purchase', searchIntent: 'navigational', primaryGoal: 'Find store', priority: 'medium', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/hydroseeders/', name: 'Hydroseeders Hub', pageType: 'hub', persona: 'taylor', funnelStage: 'awareness', searchIntent: 'informational', primaryGoal: 'Educate', priority: 'medium', contentType: 'non-content' },
    ],
  },

  // -------------------------------------------------------------------------
  // 10. Surveys
  // -------------------------------------------------------------------------
  {
    name: 'Surveys',
    id: 'surveys',
    pages: [
      { route: '/survey/backyard', name: 'Betty Outcome Survey', pageType: 'utility', persona: 'betty', funnelStage: 'post-purchase', searchIntent: 'navigational', primaryGoal: 'Collect outcomes', priority: 'medium', contentType: 'non-content', blocker: 'data' },
      { route: '/survey/commercial', name: 'Bill Outcome Survey', pageType: 'utility', persona: 'bill', funnelStage: 'post-purchase', searchIntent: 'navigational', primaryGoal: 'Collect outcomes', priority: 'medium', contentType: 'non-content', blocker: 'data' },
    ],
  },

  // -------------------------------------------------------------------------
  // 11. Admin
  // -------------------------------------------------------------------------
  {
    name: 'Admin',
    id: 'admin',
    pages: [
      { route: '/admin/', name: 'Admin Dashboard', pageType: 'utility', persona: null, funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Internal', priority: 'low', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/admin/branding', name: 'Brand Guidelines', pageType: 'utility', persona: null, funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Internal', priority: 'low', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/admin/images', name: 'Image Docs', pageType: 'utility', persona: null, funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Internal', priority: 'low', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/admin/videos/', name: 'Video Library', pageType: 'utility', persona: null, funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Internal', priority: 'low', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/admin/cdp/', name: 'CDP Analytics', pageType: 'utility', persona: null, funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Internal', priority: 'medium', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/admin/cdp-guide', name: 'CDP Guide', pageType: 'utility', persona: null, funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Internal', priority: 'low', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/admin/sales-log', name: 'Sales Log', pageType: 'utility', persona: null, funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Internal', priority: 'medium', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/admin/content-quality', name: 'Content Quality', pageType: 'utility', persona: null, funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Internal', priority: 'medium', contentType: 'non-content', pipeline: 'shipped' },
      { route: '/admin/site-audit', name: 'Site Audit', pageType: 'utility', persona: null, funnelStage: 'awareness', searchIntent: 'navigational', primaryGoal: 'Internal', priority: 'low', contentType: 'non-content', pipeline: 'shipped' },
    ],
  },
]

// =============================================================================
// HELPERS
// =============================================================================

export const TOTAL_PAGES = PAGE_GROUPS.reduce((sum, g) => sum + g.pages.length, 0)

export function computeFunnelCoverage(groups: PageGroup[]) {
  const counts = { awareness: 0, consideration: 0, purchase: 0, 'post-purchase': 0 }
  for (const g of groups) for (const p of g.pages) counts[p.funnelStage]++
  return counts
}

export function computePersonaCoverage(groups: PageGroup[]) {
  const counts: Record<string, number> = { bill: 0, betty: 0, bob: 0, tom: 0, greg: 0, taylor: 0, gary: 0, hannah: 0, maggie: 0, sam: 0, general: 0, none: 0 }
  for (const g of groups) {
    for (const p of g.pages) {
      if (p.persona && p.persona in counts) counts[p.persona]++
      else counts.none++
    }
  }
  return counts
}
