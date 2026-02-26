import { useState, useMemo } from 'react'

interface Video {
  id: string
  title: string
  business_unit: string
  external_id: string
  source_platform: string
  url: string
  thumbnail_url: string
  duration_seconds: number
  topics: string[] | null
  transcript_status: string
  project_name: string | null
}

interface TranscriptResult {
  video_id: string
  title: string
  snippet: string
}

interface Props {
  videos: Video[]
  businessUnits: string[]
}

const MUX_DASHBOARD_BASE =
  'https://dashboard.mux.com/organizations/mkfsqt/environments/sn2eoh/video/assets'

const UNIT_LABELS: Record<string, string> = {
  'commercial-poultry': 'Commercial Poultry',
  'lawn-garden': 'Lawn & Garden',
  'backyard-poultry': 'Backyard Poultry',
  general: 'General',
  podcast: 'Podcast',
  marketing: 'Marketing',
  testimonials: 'Testimonials',
  waste: 'Waste',
  sanitizers: 'Sanitizers',
  unknown: 'Unknown',
}

const UNIT_COLORS: Record<string, string> = {
  'commercial-poultry': '#166534',
  'lawn-garden': '#0891b2',
  'backyard-poultry': '#92400e',
  general: '#6b7280',
  podcast: '#7c3aed',
  marketing: '#be185d',
  testimonials: '#0369a1',
  waste: '#854d0e',
  sanitizers: '#1d4ed8',
  unknown: '#9ca3af',
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const PAGE_SIZE = 24

export default function VideoLibrary({ videos, businessUnits }: Props) {
  const [search, setSearch] = useState('')
  const [unit, setUnit] = useState('all')
  const [transcriptQuery, setTranscriptQuery] = useState('')
  const [transcriptResults, setTranscriptResults] = useState<TranscriptResult[] | null>(null)
  const [transcriptLoading, setTranscriptLoading] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    let result = videos

    if (unit !== 'all') {
      result = result.filter((v) => v.business_unit === unit)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((v) => v.title.toLowerCase().includes(q))
    }

    // If transcript search returned results, filter to those video IDs
    if (transcriptResults) {
      const ids = new Set(transcriptResults.map((r) => r.video_id))
      result = result.filter((v) => ids.has(v.id))
    }

    return result
  }, [videos, search, unit, transcriptResults])

  // Reset pagination when filters change
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  async function searchTranscripts() {
    if (!transcriptQuery.trim()) {
      setTranscriptResults(null)
      return
    }
    setTranscriptLoading(true)
    try {
      const res = await fetch(`/api/video-search?q=${encodeURIComponent(transcriptQuery.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setTranscriptResults(data.results)
      }
    } catch {
      // silently fail
    } finally {
      setTranscriptLoading(false)
    }
  }

  function clearTranscriptSearch() {
    setTranscriptQuery('')
    setTranscriptResults(null)
  }

  // Map transcript results to snippets by video ID
  const snippetMap = useMemo(() => {
    if (!transcriptResults) return new Map<string, string>()
    return new Map(transcriptResults.map((r) => [r.video_id, r.snippet]))
  }, [transcriptResults])

  return (
    <div>
      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.searchRow}>
          <input
            type="text"
            placeholder="Filter by title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setVisibleCount(PAGE_SIZE)
            }}
            style={styles.input}
          />
          <select
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value)
              setVisibleCount(PAGE_SIZE)
            }}
            style={styles.select}
          >
            <option value="all">All Categories ({videos.length})</option>
            {businessUnits.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u] || u} ({videos.filter((v) => v.business_unit === u).length})
              </option>
            ))}
          </select>
          <div style={styles.viewToggle}>
            <button
              onClick={() => setView('grid')}
              style={{
                ...styles.viewBtn,
                ...(view === 'grid' ? styles.viewBtnActive : {}),
              }}
              title="Grid view"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              style={{
                ...styles.viewBtn,
                ...(view === 'list' ? styles.viewBtnActive : {}),
              }}
              title="List view"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </button>
          </div>
        </div>

        {/* Transcript search */}
        <div style={styles.transcriptRow}>
          <input
            type="text"
            placeholder='Search transcripts... (e.g. "water lines", "biosecurity")'
            value={transcriptQuery}
            onChange={(e) => setTranscriptQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchTranscripts()}
            style={{ ...styles.input, flex: 1 }}
          />
          <button onClick={searchTranscripts} disabled={transcriptLoading} style={styles.searchBtn}>
            {transcriptLoading ? 'Searching...' : 'Search Transcripts'}
          </button>
          {transcriptResults && (
            <button onClick={clearTranscriptSearch} style={styles.clearBtn}>
              Clear ({transcriptResults.length} matches)
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <p style={styles.resultCount}>
        Showing {visible.length} of {filtered.length} videos
        {filtered.length !== videos.length && ` (${videos.length} total)`}
        {transcriptResults && ` — transcript search active`}
      </p>

      {/* Video grid/list */}
      {view === 'grid' ? (
        <div style={styles.grid}>
          {visible.map((video) => (
            <VideoCard key={video.id} video={video} snippet={snippetMap.get(video.id)} />
          ))}
        </div>
      ) : (
        <div style={styles.list}>
          {visible.map((video) => (
            <VideoRow key={video.id} video={video} snippet={snippetMap.get(video.id)} />
          ))}
        </div>
      )}

      {hasMore && (
        <div style={styles.loadMore}>
          <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} style={styles.loadMoreBtn}>
            Load more ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={styles.empty}>No videos found. Try adjusting your filters.</div>
      )}
    </div>
  )
}

function VideoCard({ video, snippet }: { video: Video; snippet?: string }) {
  const playbackId = video.thumbnail_url?.match(/image\.mux\.com\/([^/]+)/)?.[1]

  return (
    <div style={styles.card}>
      <a
        href={`${MUX_DASHBOARD_BASE}/${video.external_id}`}
        target="_blank"
        rel="noopener noreferrer"
        style={styles.thumbLink}
      >
        <div style={styles.thumbWrap}>
          {playbackId ? (
            <img
              src={`https://image.mux.com/${playbackId}/thumbnail.jpg?width=400&height=225&time=2`}
              alt={video.title}
              style={styles.thumb}
              loading="lazy"
            />
          ) : (
            <div style={styles.thumbPlaceholder}>No thumbnail</div>
          )}
          <span style={styles.duration}>{formatDuration(video.duration_seconds)}</span>
        </div>
      </a>
      <div style={styles.cardBody}>
        <a
          href={`${MUX_DASHBOARD_BASE}/${video.external_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.titleLink}
          title={video.title}
        >
          {video.title}
        </a>
        <div style={styles.meta}>
          <span
            style={{
              ...styles.badge,
              color: UNIT_COLORS[video.business_unit] || '#6b7280',
              background: `${UNIT_COLORS[video.business_unit] || '#6b7280'}18`,
            }}
          >
            {UNIT_LABELS[video.business_unit] || video.business_unit}
          </span>
          {video.project_name && <span style={styles.projectName}>{video.project_name}</span>}
        </div>
        {snippet && <p style={styles.snippet}>...{snippet}...</p>}
      </div>
    </div>
  )
}

function VideoRow({ video, snippet }: { video: Video; snippet?: string }) {
  const playbackId = video.thumbnail_url?.match(/image\.mux\.com\/([^/]+)/)?.[1]

  return (
    <div style={styles.row}>
      <a
        href={`${MUX_DASHBOARD_BASE}/${video.external_id}`}
        target="_blank"
        rel="noopener noreferrer"
        style={styles.rowThumbLink}
      >
        {playbackId ? (
          <img
            src={`https://image.mux.com/${playbackId}/thumbnail.jpg?width=160&height=90&time=2`}
            alt={video.title}
            style={styles.rowThumb}
            loading="lazy"
          />
        ) : (
          <div style={{ ...styles.thumbPlaceholder, width: 120, height: 68 }}>No thumb</div>
        )}
      </a>
      <div style={styles.rowBody}>
        <a
          href={`${MUX_DASHBOARD_BASE}/${video.external_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.titleLink}
        >
          {video.title}
        </a>
        {snippet && <p style={styles.snippet}>...{snippet}...</p>}
      </div>
      <span
        style={{
          ...styles.badge,
          color: UNIT_COLORS[video.business_unit] || '#6b7280',
          background: `${UNIT_COLORS[video.business_unit] || '#6b7280'}18`,
          whiteSpace: 'nowrap',
        }}
      >
        {UNIT_LABELS[video.business_unit] || video.business_unit}
      </span>
      <span style={styles.rowDuration}>{formatDuration(video.duration_seconds)}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  controls: {
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  searchRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  transcriptRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #e5e5e5',
    borderRadius: 4,
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #e5e5e5',
    borderRadius: 4,
    fontSize: 14,
    fontFamily: 'inherit',
    background: '#fff',
    cursor: 'pointer',
    minWidth: 200,
  },
  searchBtn: {
    padding: '8px 16px',
    background: '#44883e',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  },
  clearBtn: {
    padding: '8px 12px',
    background: '#f5f5f5',
    color: '#737373',
    border: '1px solid #e5e5e5',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  },
  viewToggle: {
    display: 'flex',
    gap: 2,
    border: '1px solid #e5e5e5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  viewBtn: {
    padding: '6px 8px',
    background: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    color: '#a3a3a3',
  },
  viewBtnActive: {
    background: '#f0fdf4',
    color: '#2c5234',
  },
  resultCount: {
    fontSize: 13,
    color: '#737373',
    marginBottom: 12,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: 8,
    overflow: 'hidden',
    transition: 'box-shadow 0.15s',
  },
  thumbLink: {
    display: 'block',
    textDecoration: 'none',
  },
  thumbWrap: {
    position: 'relative',
    background: '#f5f5f5',
    aspectRatio: '16/9',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#a3a3a3',
    fontSize: 13,
    background: '#f5f5f5',
  },
  duration: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    background: 'rgba(0,0,0,0.75)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    padding: '2px 6px',
    borderRadius: 3,
    fontFamily: 'SF Mono, SFMono-Regular, ui-monospace, monospace',
  },
  cardBody: {
    padding: '10px 12px 12px',
  },
  titleLink: {
    fontSize: 14,
    fontWeight: 500,
    color: '#171717',
    textDecoration: 'none',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    lineHeight: 1.35,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  badge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: 10,
  },
  projectName: {
    fontSize: 11,
    color: '#a3a3a3',
  },
  snippet: {
    fontSize: 12,
    color: '#737373',
    marginTop: 6,
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: 6,
  },
  rowThumbLink: {
    flexShrink: 0,
    textDecoration: 'none',
  },
  rowThumb: {
    width: 120,
    height: 68,
    objectFit: 'cover',
    borderRadius: 4,
    display: 'block',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowDuration: {
    fontSize: 13,
    color: '#737373',
    fontFamily: 'SF Mono, SFMono-Regular, ui-monospace, monospace',
    whiteSpace: 'nowrap',
  },
  loadMore: {
    display: 'flex',
    justifyContent: 'center',
    padding: '24px 0',
  },
  loadMoreBtn: {
    padding: '10px 24px',
    background: '#fff',
    color: '#44883e',
    border: '1px solid #44883e',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  empty: {
    textAlign: 'center',
    color: '#a3a3a3',
    padding: 48,
    fontSize: 14,
  },
}
