import { useCallback, useRef, useState } from 'react'
import {
  type SelResult,
  SELECTOR_QUESTIONS,
  getSelectorResult,
} from '../../lib/lawnWeedSelectorData'
import {
  submitLead,
  trackQuizQuestionAnswered,
  trackQuizResultProductClicked,
  trackResultViewed,
  trackToolCompleted,
  trackToolStarted,
} from '../../lib/leadCapture'

type Phase = 'intro' | 'questions' | 'results'

export default function LawnWeedSelector() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<SelResult | null>(null)
  const [email, setEmail] = useState('')
  const [leadDone, setLeadDone] = useState(false)
  const startTime = useRef(Date.now())
  const stepTime = useRef(Date.now())

  const totalSteps = SELECTOR_QUESTIONS.length
  const currentQuestion = phase === 'questions' ? SELECTOR_QUESTIONS[currentStep] : null
  const progressPercent =
    phase === 'intro' ? 0 : phase === 'results' ? 100 : Math.round((currentStep / totalSteps) * 100)

  const handleStart = useCallback(() => {
    setPhase('questions')
    setCurrentStep(0)
    startTime.current = Date.now()
    stepTime.current = Date.now()
    trackToolStarted('lawn_weed_selector')
  }, [])

  const handleAnswer = useCallback(
    (answerId: string) => {
      if (!currentQuestion) return
      trackQuizQuestionAnswered(
        currentQuestion.id,
        answerId,
        Math.round((Date.now() - stepTime.current) / 1000)
      )
      const newAnswers = { ...answers, [currentQuestion.id]: answerId }
      setAnswers(newAnswers)
      const next = currentStep + 1
      if (next >= SELECTOR_QUESTIONS.length) {
        const r = getSelectorResult(newAnswers)
        setResult(r)
        setPhase('results')
        trackToolCompleted('lawn_weed_selector', r.headline, Math.round((Date.now() - startTime.current) / 1000))
        trackResultViewed(
          'lawn_weed_selector',
          'products',
          r.products.map((p) => p.handle)
        )
      } else {
        setCurrentStep(next)
        stepTime.current = Date.now()
      }
    },
    [currentQuestion, answers, currentStep]
  )

  const handleEmail = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!email || !result) return
      submitLead({
        leadType: 'product_quiz',
        email,
        message: `Lawn Weed Selector\n${result.headline}\n${result.summary}\nProducts: ${result.products.map((p) => p.handle).join(', ') || 'none'}`,
      })
      setLeadDone(true)
    },
    [email, result]
  )

  return (
    <div className="mx-auto max-w-2xl">
      {phase !== 'intro' && (
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-xs text-gray-500">
            <span>
              {phase === 'results' ? 'Complete' : `Question ${currentStep + 1} of ${totalSteps}`}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#44883E] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h3 className="font-heading text-2xl uppercase text-[#2C5234]">Lawn & Hardscape Weed Selector</h3>
          <p className="mx-auto mt-3 max-w-md text-gray-600">
            Contact vs systemic, surface type, and animals nearby — then open the right Torched pages.
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="mt-6 rounded-md bg-[#2C5234] px-8 py-3 text-sm font-semibold text-white hover:bg-green-800"
          >
            Start selector
          </button>
        </div>
      )}

      {phase === 'questions' && currentQuestion && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h3 className="font-heading text-xl uppercase text-[#2C5234]">{currentQuestion.title}</h3>
          <div className="mt-6 space-y-3">
            {currentQuestion.answers.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleAnswer(a.id)}
                className="flex w-full rounded-lg border-2 border-gray-200 p-4 text-left hover:border-[#44883E]"
              >
                <div>
                  <div className="text-sm font-semibold">{a.label}</div>
                  {a.description && <div className="text-xs text-gray-500">{a.description}</div>}
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (currentStep > 0 ? setCurrentStep(currentStep - 1) : setPhase('intro'))}
            className="mt-6 text-sm text-gray-500"
          >
            &larr; Back
          </button>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <h3 className="font-heading text-xl uppercase text-[#2C5234]">{result.headline}</h3>
            <p className="mt-2 text-sm text-gray-600">{result.summary}</p>
          </div>

          {result.products.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h4 className="mb-4 text-sm font-semibold uppercase text-gray-500">Products to review</h4>
              {result.products.map((p, i) => (
                <div key={p.handle} className="mb-3 flex justify-between gap-4 rounded-lg bg-gray-50 p-4">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-gray-600">{p.reason}</p>
                  </div>
                  <a
                    href={`/products/${p.handle}/`}
                    onClick={() => trackQuizResultProductClicked(p.handle, i)}
                    className="shrink-0 text-sm font-semibold text-[#44883E]"
                  >
                    View →
                  </a>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold uppercase text-gray-500">Read next</h4>
            <ul className="space-y-2">
              {result.reads.map((r) => (
                <li key={r.href}>
                  <a href={r.href} className="text-sm font-semibold text-[#44883E] hover:underline">
                    {r.label} →
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            <ul className="list-disc space-y-1 pl-5">
              {result.boundaries.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            {leadDone ? (
              <p className="text-sm text-[#2C5234]">Sent — check your inbox.</p>
            ) : (
              <form onSubmit={handleEmail} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email this path to myself"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md bg-[#2C5234] px-4 py-2 text-sm font-semibold text-white"
                >
                  Email path
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
