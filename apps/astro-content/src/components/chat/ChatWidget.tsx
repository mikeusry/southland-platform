import { useState, useRef, useEffect, useCallback } from 'react'

const AI_WORKER_URL = 'https://southland-ai-worker.point-dog-digital.workers.dev'

// Intents that require customer identity
const ACCOUNT_INTENTS = [
  'order',
  'tracking',
  'shipment',
  'delivery',
  'subscription',
  'cancel',
  'return',
  'refund',
  'invoice',
  'billing',
  'payment',
  'my account',
  'my order',
  'where is',
  "where's",
]

function detectsAccountIntent(query: string): boolean {
  const lower = query.toLowerCase()
  return ACCOUNT_INTENTS.some((intent) => lower.includes(intent))
}

interface ProductCard {
  name: string
  url: string
  description: string
  category: string
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: Array<{ title: string; url: string; doc_type: string }>
  confidence?: string
  suggestedQuestions?: string[]
  productCards?: ProductCard[]
  action?: 'ask_email' | 'tool_activity'
  streaming?: boolean
  statusLabel?: string // "Checking products and articles..." during pre-token gap
  sourcePreview?: string[] // Muted source type chips shown before answer
  feedback?: 'up' | 'down' | null
  feedbackReason?: string
}

// Session persistence — conversation survives page navigation
const SESSION_KEY = 'southland-chat-session'
const SESSION_TTL = 30 * 60 * 1000 // 30 minutes

function loadSession(): { messages: Message[]; email: string | null } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as { messages: Message[]; email: string | null; ts: number }
    if (Date.now() - session.ts > SESSION_TTL) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return { messages: session.messages, email: session.email }
  } catch {
    return null
  }
}

function saveSession(messages: Message[], email: string | null) {
  try {
    // Only save non-streaming, non-action messages
    const saveable = messages.filter((m) => !m.streaming && !m.action)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ messages: saveable, email, ts: Date.now() }))
  } catch {
    // localStorage full or unavailable
  }
}

// Proactive engagement — dwell time + return visitor detection
const PROACTIVE_KEY = 'southland-chat-proactive'
const VISIT_COUNT_KEY = 'southland-chat-visits'

function trackVisit(): number {
  try {
    const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1
    localStorage.setItem(VISIT_COUNT_KEY, String(count))
    return count
  } catch {
    return 1
  }
}

function hasSeenProactive(): boolean {
  try {
    const last = localStorage.getItem(PROACTIVE_KEY)
    if (!last) return false
    // Don't show again within 24 hours
    return Date.now() - parseInt(last, 10) < 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function markProactiveSeen() {
  try {
    localStorage.setItem(PROACTIVE_KEY, String(Date.now()))
  } catch {
    // ignore
  }
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [pulse, setPulse] = useState(false) // Gentle attention pulse on fab button
  const [proactiveMessage, setProactiveMessage] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>(() => {
    const session = typeof window !== 'undefined' ? loadSession() : null
    return session?.messages || []
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [customerEmail, setCustomerEmail] = useState<string | null>(() => {
    const session = typeof window !== 'undefined' ? loadSession() : null
    return session?.email || null
  })
  const [pendingQuery, setPendingQuery] = useState<string | null>(null)
  const [escalated, setEscalated] = useState(false)

  // Persist session on message changes
  useEffect(() => {
    if (messages.length > 0) saveSession(messages, customerEmail)
  }, [messages, customerEmail])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // ─── Proactive engagement ─────────────────────────────────────────────
  useEffect(() => {
    if (open || hasSeenProactive()) return // Don't trigger if already open or seen today

    const visits = trackVisit()
    const path = window.location.pathname.toLowerCase()
    const isProductPage = path.includes('/products/')

    // Return visitor on a product page: gentle pulse after 15s
    if (visits >= 2 && isProductPage) {
      const timer = setTimeout(() => {
        setPulse(true)
        setProactiveMessage('Need help choosing the right product?')
        markProactiveSeen()
        // Stop pulsing after 8 seconds
        setTimeout(() => setPulse(false), 8000)
      }, 15000)
      return () => clearTimeout(timer)
    }

    // First-time visitor: dwell 30s on product page → subtle pulse
    if (isProductPage) {
      const timer = setTimeout(() => {
        setPulse(true)
        setProactiveMessage('Questions about this product?')
        markProactiveSeen()
        setTimeout(() => setPulse(false), 8000)
      }, 30000)
      return () => clearTimeout(timer)
    }

    return undefined
  }, [open])

  // ─── Feedback ──────────────────────────────────────────────────────────
  const [feedbackShown, setFeedbackShown] = useState<number | null>(null)

  const sendFeedback = async (msgIndex: number, rating: 'up' | 'down', reason?: string) => {
    const msg = messages[msgIndex]
    const userMsg = messages
      .slice(0, msgIndex)
      .reverse()
      .find((m) => m.role === 'user')

    // Update local state immediately
    setMessages((prev) => {
      const updated = [...prev]
      updated[msgIndex] = { ...updated[msgIndex], feedback: rating, feedbackReason: reason }
      return updated
    })
    setFeedbackShown(null)

    // Send to worker (fire-and-forget)
    try {
      await fetch(`${AI_WORKER_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMsg?.content || '',
          answer: msg.content,
          rating,
          reason: reason || undefined,
          page_url: window.location.pathname,
        }),
      })
    } catch {
      // Non-blocking
    }
  }

  const sendMessage = async (overrideQuery?: string, overrideEmail?: string) => {
    const query = (overrideQuery ?? input).trim()
    if (!query || loading) return

    setInput('')

    // If this is an account-related question and we don't have email, ask for it
    if (!customerEmail && !overrideEmail && detectsAccountIntent(query)) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: query },
        {
          role: 'assistant',
          content:
            "I'd love to help with that! What email address did you use for your account or order?",
          action: 'ask_email',
        },
      ])
      setPendingQuery(query)
      return
    }

    // If user is providing email (responding to ask_email)
    if (pendingQuery && !customerEmail && query.includes('@')) {
      const email = query.trim()
      setCustomerEmail(email)
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: email },
        { role: 'assistant', content: 'Looking up your account...', action: 'tool_activity' },
      ])
      setPendingQuery(null)
      await doStreamAsk(pendingQuery, email)
      return
    }

    setMessages((prev) => [...prev, { role: 'user', content: query }])
    setLoading(true)

    await doStreamAsk(query, overrideEmail || customerEmail)
  }

  // Streaming ask — research-backed loading UX:
  // 1. Instant ack (assistant row appears immediately)
  // 2. Status label at 400ms ("Checking products and articles...")
  // 3. Source preview chips when sources arrive (before answer text)
  // 4. Sentence-buffered streaming text with live caret
  // 5. Follow-ups + product cards after stream complete
  const doStreamAsk = async (query: string, email: string | null) => {
    setLoading(true)

    // Step 1: Instant acknowledgment — assistant row appears with no content
    setMessages((prev) => {
      const filtered = prev.filter((m) => m.action !== 'tool_activity')
      return [...filtered, { role: 'assistant' as const, content: '', streaming: true }]
    })

    // Step 2: Show status label after 400ms if no content yet
    const statusTimer = setTimeout(() => {
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.streaming && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            statusLabel: 'Checking products and articles\u2026',
          }
        }
        return updated
      })
    }, 400)

    try {
      const payload: Record<string, unknown> = {
        query,
        context: 'chat',
        page_url: window.location.pathname,
      }
      if (email) payload.customer_email = email

      const history = messages
        .filter((m) => m.role !== 'system' && !m.action && !m.streaming)
        .slice(-5)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      if (history.length) payload.conversation_history = history

      const res = await fetch(`${AI_WORKER_URL}/ask/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok || !res.body) {
        clearTimeout(statusTimer)
        await doAskFallback(query, email)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let sseBuffer = ''
      let sources: Message['sources'] = []
      let suggestedQuestions: string[] | undefined
      let productCards: ProductCard[] | undefined
      let textBuffer = '' // Sentence-aware buffering
      let hasStartedText = false

      // Flush text buffer to message on punctuation boundaries
      const flushText = () => {
        if (!textBuffer) return
        const toFlush = textBuffer
        textBuffer = ''
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.streaming) {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + toFlush,
              statusLabel: undefined, // Clear status once text arrives
            }
          }
          return updated
        })
      }

      // Flush every 60ms or on punctuation
      const flushInterval = setInterval(flushText, 60)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data) continue

          try {
            const event = JSON.parse(data) as {
              type: string
              text?: string
              sources?: Message['sources']
              suggested_questions?: string[]
              product_cards?: ProductCard[]
            }

            if (event.type === 'text' && event.text) {
              if (!hasStartedText) {
                clearTimeout(statusTimer)
                hasStartedText = true
              }
              textBuffer += event.text

              // Flush immediately on sentence boundaries for natural feel
              if (/[.!?]\s*$/.test(event.text) || /\n/.test(event.text)) {
                flushText()
              }
            } else if (event.type === 'sources' && event.sources?.length) {
              sources = event.sources
              // Step 3: Show muted source preview chips before answer
              const sourceTypes = [
                ...new Set(
                  event.sources.map((s) =>
                    s.doc_type === 'blog'
                      ? 'Blog article'
                      : s.doc_type === 'product'
                        ? 'Product page'
                        : 'Guide'
                  )
                ),
              ]
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.streaming && !last.content) {
                  updated[updated.length - 1] = {
                    ...last,
                    statusLabel: 'Drafting answer\u2026',
                    sourcePreview: sourceTypes,
                  }
                }
                return updated
              })
            } else if (event.type === 'done') {
              suggestedQuestions = event.suggested_questions
              productCards = event.product_cards
            }
          } catch {
            // Skip malformed events
          }
        }
      }

      // Final flush
      clearInterval(flushInterval)
      clearTimeout(statusTimer)
      flushText()

      // Finalize the streaming message
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.streaming) {
          updated[updated.length - 1] = {
            ...last,
            streaming: false,
            statusLabel: undefined,
            sourcePreview: undefined,
            sources: sources?.length ? sources : undefined,
            suggestedQuestions,
            productCards,
          }
        }
        return updated
      })
    } catch (_err) {
      clearTimeout(statusTimer)
      await doAskFallback(query, email)
    } finally {
      setLoading(false)
    }
  }

  // Non-streaming fallback
  const doAskFallback = async (query: string, email: string | null) => {
    try {
      const payload: Record<string, unknown> = {
        query,
        context: 'chat',
        page_url: window.location.pathname,
      }
      if (email) payload.customer_email = email

      const history = messages
        .filter((m) => m.role !== 'system' && !m.action && !m.streaming)
        .slice(-5)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      if (history.length) payload.conversation_history = history

      const res = await fetch(`${AI_WORKER_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(`${res.status}`)

      const data = await res.json()
      setMessages((prev) => {
        // Remove streaming placeholder if present
        const filtered = prev.filter((m) => !m.streaming)
        return [
          ...filtered,
          {
            role: 'assistant' as const,
            content:
              data.answer ||
              "I couldn't find an answer. Please try rephrasing or contact us directly.",
            sources: data.sources?.slice(0, 3),
            confidence: data.confidence,
            suggestedQuestions: data.suggested_questions,
            productCards: data.product_cards,
          },
        ]
      })
    } catch {
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.streaming)
        return [
          ...filtered,
          {
            role: 'assistant' as const,
            content: 'Sorry, something went wrong. Please try again or call us at (800) 608-3755.',
          },
        ]
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEscalate = async () => {
    if (escalated) return
    setEscalated(true)

    const emailToUse = customerEmail || (input.includes('@') ? input : null)

    if (!emailToUse && !customerEmail) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'To connect you with our team, what email should we use to follow up?',
          action: 'ask_email',
        },
      ])
      setPendingQuery('__escalate__')
      return
    }

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content:
          "I've connected you with our team. You'll hear back via email shortly. In the meantime, I can still help with product questions!",
      },
    ])

    // Fire escalation to Worker (fire-and-forget)
    try {
      await fetch(`${AI_WORKER_URL}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          customer_email: customerEmail || emailToUse,
          source: 'chat_widget',
        }),
      })
    } catch {
      // Non-blocking
    }
  }

  // ─── Suggested questions based on page ──────────────────────────────────
  const getInitialSuggestions = () => {
    const path = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : ''

    // Septic & Waste
    if (path.includes('/septic') || path.includes('/waste') || path.includes('/port'))
      return ['How does PORT work?', 'How often do I use it?', 'Will this extend my pump-outs?']

    // Poultry
    if (
      path.includes('/poultry') ||
      path.includes('/litter-life') ||
      path.includes('/big-ole-bird') ||
      path.includes('/hen-helper') ||
      path.includes('/south40') ||
      path.includes('/catalyst')
    )
      return [
        'How do I use this product?',
        'What helps with ammonia?',
        'Which product is right for my flock?',
      ]

    // Lawn & Garden
    if (
      path.includes('/lawn') ||
      path.includes('/garden') ||
      path.includes('/fertalive') ||
      path.includes('/dog-spot') ||
      path.includes('/ignition')
    )
      return ['How do I fix brown spots?', 'When should I apply this?', 'Is this safe for pets?']

    // Sanitizers
    if (path.includes('/d2') || path.includes('/sanitiz'))
      return ['How do I dilute D2?', 'Is D2 safe for food surfaces?', 'What does D2 kill?']

    // Livestock
    if (path.includes('/livestock') || path.includes('/cattle') || path.includes('/swine'))
      return [
        'Which products work for cattle?',
        'How do I improve gut health in livestock?',
        'What helps with odor control?',
      ]

    // Any product page
    if (path.includes('/products/'))
      return ['How do I use this product?', 'How much do I need?', 'What results should I expect?']

    // Blog
    if (path.includes('/blog'))
      return [
        'What products would help with my situation?',
        'How do I get started?',
        'Can I talk to someone?',
      ]

    return ['How do I use Litter Life?', 'What helps with ammonia?', 'Where is my order?']
  }

  if (!open) {
    return (
      <div className="fixed bottom-5 right-5 z-50">
        {/* Proactive message tooltip */}
        {proactiveMessage && (
          <div
            className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-16 right-0 mb-2 w-56 rounded-xl bg-white px-3 py-2.5 text-sm text-gray-700 shadow-lg ring-1 ring-gray-100"
            onClick={() => {
              setOpen(true)
              setProactiveMessage(null)
            }}
            style={{ cursor: 'pointer' }}
          >
            {proactiveMessage}
            <div
              className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 bg-white ring-1 ring-gray-100"
              style={{ clipPath: 'polygon(0 0, 100% 100%, 100% 0)' }}
            />
          </div>
        )}
        <button
          onClick={() => {
            setOpen(true)
            setProactiveMessage(null)
          }}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 ${pulse ? 'animate-pulse ring-4 ring-green-200' : ''}`}
          style={{ backgroundColor: '#2c5234' }}
          aria-label="Ask a question"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      style={{ height: '560px' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ backgroundColor: '#2c5234' }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
            S
          </div>
          <div>
            <div className="text-sm font-semibold">Southland Assistant</div>
            <div className="text-[10px] opacity-75">Product expert &bull; Online now</div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-full p-1 transition-colors hover:bg-white/20"
          aria-label="Close chat"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2c5234"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="mb-1 text-sm font-medium text-gray-700">
              Hi! I'm Southland's product expert.
            </p>
            <p className="mb-4 text-xs text-gray-400">
              Ask me anything about our products, orders, or application tips.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {getInitialSuggestions().map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-800"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'text-white'
                    : 'border border-gray-100 bg-gray-50 text-gray-800'
                }`}
                style={msg.role === 'user' ? { backgroundColor: '#44883e' } : undefined}
              >
                {/* Activity indicator */}
                {msg.action === 'tool_activity' ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="flex gap-1">
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                    <span className="text-xs">{msg.content}</span>
                  </div>
                ) : msg.streaming && !msg.content && msg.statusLabel ? (
                  /* Pre-answer status: "Checking products and articles..." with source chips */
                  <div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="flex gap-0.5">
                        <span
                          className="h-1 w-1 animate-pulse rounded-full bg-green-400"
                          style={{ animationDelay: '0ms' }}
                        />
                        <span
                          className="h-1 w-1 animate-pulse rounded-full bg-green-400"
                          style={{ animationDelay: '400ms' }}
                        />
                        <span
                          className="h-1 w-1 animate-pulse rounded-full bg-green-400"
                          style={{ animationDelay: '800ms' }}
                        />
                      </div>
                      <span className="text-xs">{msg.statusLabel}</span>
                    </div>
                    {msg.sourcePreview && msg.sourcePreview.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {msg.sourcePreview.map((type, j) => (
                          <span
                            key={j}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] text-gray-400"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : msg.streaming && !msg.content ? (
                  /* First 400ms: empty shell, no label yet */
                  <div className="h-4" />
                ) : (
                  /* Answer text with live caret during streaming */
                  <div className="whitespace-pre-wrap">
                    {msg.content}
                    {msg.streaming && (
                      <span
                        className="ml-0.5 inline-block h-3.5 w-0.5 rounded-full bg-green-600"
                        style={{ animation: 'pulse 1.1s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                      />
                    )}
                  </div>
                )}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-gray-200 pt-2">
                    {msg.sources.map((s, j) => (
                      <a
                        key={j}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-500 shadow-sm transition-colors hover:text-gray-700"
                      >
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            s.doc_type === 'product'
                              ? 'bg-green-400'
                              : s.doc_type === 'sop'
                                ? 'bg-blue-400'
                                : 'bg-amber-400'
                          }`}
                        />
                        {s.title.length > 35 ? s.title.slice(0, 35) + '...' : s.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {/* Feedback buttons — only on assistant messages, not streaming */}
              {msg.role === 'assistant' && !msg.streaming && !msg.action && msg.content && (
                <div className="mt-1 flex items-center gap-1 pl-1">
                  {msg.feedback ? (
                    <span className="text-[10px] text-gray-400">
                      {msg.feedback === 'up' ? 'Thanks!' : 'Thanks for the feedback'}
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => sendFeedback(i, 'up')}
                        className="rounded p-0.5 text-gray-300 transition-colors hover:text-green-600"
                        aria-label="Helpful"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setFeedbackShown(feedbackShown === i ? null : i)}
                        className="rounded p-0.5 text-gray-300 transition-colors hover:text-red-500"
                        aria-label="Not helpful"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}
              {/* Feedback reason selector */}
              {feedbackShown === i && (
                <div className="mt-1 flex flex-wrap gap-1 pl-1">
                  {[
                    { code: 'wrong_answer', label: 'Wrong answer' },
                    { code: 'didnt_answer', label: "Didn't answer" },
                    { code: 'wrong_product', label: 'Wrong product' },
                  ].map((r) => (
                    <button
                      key={r.code}
                      onClick={() => sendFeedback(i, 'down', r.code)}
                      className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] text-red-600 transition-colors hover:border-red-200 hover:bg-red-100"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Product cards */}
            {msg.productCards && msg.productCards.length > 0 && !msg.streaming && (
              <div className="mt-2 flex flex-col gap-1.5 pl-1">
                {msg.productCards.map((card, j) => (
                  <a
                    key={j}
                    href={card.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-xl border border-green-100 bg-green-50/50 px-3 py-2 transition-colors hover:border-green-200 hover:bg-green-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#2c5234"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <path d="M16 10a4 4 0 0 1-8 0" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-gray-800">{card.name}</div>
                      <div className="text-[10px] text-green-700">Shop now →</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
            {/* Suggested follow-up questions */}
            {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && !msg.streaming && (
              <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
                {msg.suggestedQuestions.map((q, j) => (
                  <button
                    key={j}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-800"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {/* Standalone loading dots — only for non-streaming fallback */}
        {loading && !messages.some((m) => m.streaming) && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex gap-1">
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-3 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage()
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={pendingQuery ? 'Enter your email...' : 'Ask a question...'}
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#2c5234' }}
            aria-label="Send"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
        <div className="mt-1.5 flex items-center justify-between">
          <button
            onClick={handleEscalate}
            disabled={escalated || messages.length === 0}
            className="text-[9px] text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-30"
          >
            Talk to a person
          </button>
          <p className="text-[9px] text-gray-400">Powered by Southland AI</p>
        </div>
      </div>
    </div>
  )
}
