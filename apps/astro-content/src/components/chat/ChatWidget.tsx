import { useState, useRef, useEffect, useCallback } from 'react'

const AI_WORKER_URL = 'https://southland-ai-worker.point-dog-digital.workers.dev'

// Intents that require customer identity
const ACCOUNT_INTENTS = [
  'order', 'tracking', 'shipment', 'delivery', 'subscription',
  'cancel', 'return', 'refund', 'invoice', 'billing', 'payment',
  'my account', 'my order', 'where is', 'where\'s',
]

function detectsAccountIntent(query: string): boolean {
  const lower = query.toLowerCase()
  return ACCOUNT_INTENTS.some((intent) => lower.includes(intent))
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: Array<{ title: string; url: string; doc_type: string }>
  confidence?: string
  action?: 'ask_email' | 'tool_activity'
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [customerEmail, setCustomerEmail] = useState<string | null>(null)
  const [pendingQuery, setPendingQuery] = useState<string | null>(null)
  const [escalated, setEscalated] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

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
          content: 'I\'d love to help with that! What email address did you use for your account or order?',
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
      // Re-send the original query with the email
      setPendingQuery(null)
      await doAskWithRetry(pendingQuery, email)
      return
    }

    setMessages((prev) => [...prev, { role: 'user', content: query }])
    setLoading(true)

    await doAsk(query, overrideEmail || customerEmail)
  }

  const doAsk = async (query: string, email: string | null) => {
    setLoading(true)
    try {
      const payload: Record<string, unknown> = { query, context: 'chat' }
      if (email) payload.customer_email = email

      // Add conversation history (last 5 turns)
      const history = messages
        .filter((m) => m.role !== 'system' && !m.action)
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
        // Remove "Looking up your account..." if present
        const filtered = prev.filter((m) => m.action !== 'tool_activity')
        return [
          ...filtered,
          {
            role: 'assistant' as const,
            content: data.answer || "I couldn't find an answer. Please try rephrasing or contact us directly.",
            sources: data.sources?.slice(0, 3),
            confidence: data.confidence,
          },
        ]
      })
    } catch (_err) {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.action !== 'tool_activity')
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

  const doAskWithRetry = async (query: string, email: string) => {
    await doAsk(query, email)
  }

  const handleEscalate = async () => {
    if (escalated) return
    setEscalated(true)

    const emailToUse = customerEmail || input.includes('@') ? input : null

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
        content: "I've connected you with our team. You'll hear back via email shortly. In the meantime, I can still help with product questions!",
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: '#2c5234' }}
        aria-label="Ask a question"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    )
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      style={{ height: '520px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: '#2c5234' }}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">S</div>
          <div>
            <div className="text-sm font-semibold">Southland Assistant</div>
            <div className="text-[10px] opacity-75">Ask about our products</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-full p-1 transition-colors hover:bg-white/20" aria-label="Close chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <p className="mb-3 text-sm text-gray-500">How can I help you today?</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['How do I use Litter Life?', 'What helps with ammonia?', 'Where is my order?'].map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user' ? 'text-white' : 'border border-gray-100 bg-gray-50 text-gray-800'
              }`}
              style={msg.role === 'user' ? { backgroundColor: '#44883e' } : undefined}
            >
              {/* Activity indicator */}
              {msg.action === 'tool_activity' ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs">{msg.content}</span>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-gray-200 pt-2">
                  {msg.sources.map((s, j) => (
                    <a
                      key={j}
                      href={s.url}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-500 shadow-sm transition-colors hover:text-gray-700"
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                        s.doc_type === 'product' ? 'bg-green-400' : s.doc_type === 'sop' ? 'bg-blue-400' : 'bg-amber-400'
                      }`} />
                      {s.title.length > 35 ? s.title.slice(0, 35) + '...' : s.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-3 py-3">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex items-center gap-2">
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
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
