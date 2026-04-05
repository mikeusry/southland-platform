// ─── Worker Environment Bindings ────────────────────────────────────────────

export interface Env {
  // Workers AI (routed through AI Gateway)
  AI: Ai

  // Vectorize — shared knowledge index
  KNOWLEDGE_INDEX: VectorizeIndex

  // D1 — query logs, chunk manifests, classification feedback
  DB: D1Database

  // Queues — async pipelines
  INDEX_QUEUE: Queue<IndexMessage>
  SUMMARY_QUEUE: Queue<SummaryMessage>

  // KV — fast cache
  CACHE: KVNamespace

  // Environment variables
  NEXUS_API_URL: string
  ENVIRONMENT: string
  AI_GATEWAY_SLUG: string
  ALLOWED_ORIGINS: string

  // Secrets (set via wrangler secret put)
  NEXUS_API_KEY: string
  OPENAI_API_KEY: string // GPT-4o-mini for chat + copilot (fallback: Workers AI)
}

// ─── Queue Message Types ────────────────────────────────────────────────────

export interface IndexMessage {
  type: 'product' | 'blog' | 'sop' | 'document' | 'episode' | 'faq' | 'policy'
  action: 'upsert' | 'delete'
  id: string // source document ID (UUID or slug)
  tenant: string
}

export interface SummaryMessage {
  conversationId: string
  tenant: string
}

// ─── Vectorize Metadata ─────────────────────────────────────────────────────
// IMPORTANT: Metadata indexes must exist BEFORE first vector insert.
// Max 10 metadata indexes per Vectorize index.
// Indexed string fields truncated at 64 bytes — keep values short.
// Max 10 KiB metadata per vector.

export interface ChunkMetadata {
  doc_type: 'product' | 'blog' | 'sop' | 'document' | 'episode' | 'faq' | 'policy'
  source_id: string
  title: string
  url: string
  tenant: string
  business_unit: string // poultry | golf | lawn | agriculture | ancillary
  category: string
  support_relevant: boolean
  answer_type: 'factual' | 'procedural' | 'policy' | 'comparison'
  updated_at: string // ISO 8601
}

// ─── Search Types ───────────────────────────────────────────────────────────

export interface SearchRequest {
  q: string
  limit?: number // default 10
  type?: ChunkMetadata['doc_type'] // filter by doc type
  business_unit?: string // filter by BU
  tenant?: string // default 'southland'
}

export interface SearchResult {
  id: string
  score: number
  title: string
  url: string
  doc_type: string
  snippet: string // first ~200 chars of matched chunk
  business_unit: string
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
  total: number
  latency_ms: number
  model: string
  exact_match: boolean // true if returned from D1 alias table
}

// ─── Classification Types ───────────────────────────────────────────────────

export type SupportCategory =
  | 'order_issue'
  | 'shipping'
  | 'product_question'
  | 'billing'
  | 'returns'
  | 'subscription'
  | 'account'
  | 'other'

export type BusinessUnit = 'Poultry' | 'Golf' | 'Lawn' | 'Agriculture' | 'Ancillary'

export interface ClassifyRequest {
  text: string
  context: 'support' | 'lead' | 'content'
  metadata?: Record<string, string>
}

export interface ClassifyResponse {
  support_categories: SupportCategory[]
  business_units: BusinessUnit[]
  order_numbers: string[]
  tracking_numbers: string[]
  product_names: string[]
  reason: string
  confidence: 'high' | 'medium' | 'low'
  latency_ms: number
  prompt_version: string
}

// ─── RAG / Ask Types ────────────────────────────────────────────────────────

// Identity confidence levels
export type IdentityLevel = 'anonymous' | 'claimed' | 'verified-light' | 'verified-strong'

// Customer context from Nexus /api/ai/customer-context
export interface CustomerSnapshot {
  customer_id: string | null
  display_name: string | null
  identity_level: IdentityLevel
  identity_expires_at?: string
  recent_orders?: Array<{
    number: string
    status: string
    date: string
    total: number | null
    tracking: string | null
    carrier: string | null
    delivery_status: string | null
  }>
  active_subscriptions?: Array<{
    id: string
    shopify_contract_id: string | null
    status: string
    next_billing: string | null
    product: string
  }>
  open_cases?: number
  last_resolved_summary?: string | null
  shipping_exceptions?: Array<{
    order_number: string
    tracking: string
    carrier: string
    status: string
  }>
}

export interface AskRequest {
  query: string
  context: 'staff' | 'support_draft' | 'chat'
  conversation_id?: string
  // New: customer identity for order-aware chat
  customer_email?: string
  order_number?: string
  // Legacy: pre-built context (support detail page)
  customer_context?: {
    orders?: Array<{ id: string; number: string; status: string; date: string }>
    subscriptions?: Array<{ id: string; status: string }>
  }
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>
  page_url?: string // What page the customer is currently viewing
  tenant?: string
}

export interface AskResponse {
  answer: string
  sources: Array<{
    title: string
    url: string
    doc_type: string
    relevance: number
  }>
  confidence: 'high' | 'medium' | 'low'
  answerable: boolean // false = "I'll connect you with our team"
  latency_ms: number
  model: string
  suggested_questions?: string[] // Follow-up suggestions for chat context
  product_cards?: Array<{       // Structured product data for chat widget cards
    name: string
    url: string
    description: string
    category: string
  }>
}

// ─── Benchmark Types ────────────────────────────────────────────────────────

export interface BenchmarkResult {
  model: string
  queries: number
  p50_ms: number
  p99_ms: number
  avg_ms: number
  errors: number
}
