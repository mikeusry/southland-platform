-- Southland AI Worker — D1 Schema
-- Database: southland-ai
-- Purpose: Query logs, chunk manifests, classification feedback, exact-match aliases

-- ─── Search Events (Analytics) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  exact_match INTEGER NOT NULL DEFAULT 0,
  top_result_type TEXT,
  clicked_result_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_search_events_created ON search_events(created_at);
CREATE INDEX IF NOT EXISTS idx_search_events_zero ON search_events(results_count) WHERE results_count = 0;

-- ─── Classification Events ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classification_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_preview TEXT,
  categories TEXT NOT NULL, -- JSON array
  business_units TEXT,      -- JSON array
  confidence TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  -- Staff override tracking (filled by Nexus callback)
  was_overridden INTEGER NOT NULL DEFAULT 0,
  final_categories TEXT,    -- JSON array (after staff correction)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_classification_created ON classification_events(created_at);
CREATE INDEX IF NOT EXISTS idx_classification_overrides ON classification_events(was_overridden) WHERE was_overridden = 1;

-- ─── Chunk Manifests ────────────────────────────────────────────────────────
-- Track which chunk IDs belong to each source document
-- Needed for cleanup when documents are updated or deleted
CREATE TABLE IF NOT EXISTS chunk_manifests (
  doc_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  chunk_ids TEXT NOT NULL,    -- JSON array of chunk IDs in Vectorize
  chunk_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (doc_type, source_id)
);

-- ─── Product Aliases (Exact Match) ──────────────────────────────────────────
-- SKU, title, and common name aliases for exact-match search bypass
CREATE TABLE IF NOT EXISTS product_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias_upper TEXT NOT NULL,  -- Normalized uppercase for matching
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'product',
  business_unit TEXT NOT NULL DEFAULT '',
  UNIQUE(alias_upper)
);

CREATE INDEX IF NOT EXISTS idx_product_aliases_upper ON product_aliases(alias_upper);
