import { useCallback, useMemo, useRef, useState } from 'react'
import {
  type PlannerResult,
  PLANNER_QUESTIONS,
  buildPlannerSummary,
  getPlannerResult,
} from '../../lib/poultryWaterPlannerData'
import {
  submitLead,
  trackQuizQuestionAnswered,
  trackResultViewed,
  trackToolCompleted,
  trackToolStarted,
} from '../../lib/leadCapture'

type Phase = 'intro' | 'questions' | 'results'

export default function PoultryWaterPlanner() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<PlannerResult | null>(null)
  const [email, setEmail] = useState('')
  const [leadDone, setLeadDone] = useState(false)
  const startTime = useRef(Date.now())
  const stepTime = useRef(Date.now())

  const totalSteps = PLANNER_QUESTIONS.length
  const currentQuestion = phase === 'questions' ? PLANNER_QUESTIONS[currentStep] : null
  const progressPercent =
    phase === 'intro' ? 0 : phase === 'results' ? 100 : Math.round((currentStep / totalSteps) * 100)

  const handleStart = useCallback(() => {
    setPhase('questions')
    setCurrentStep(0)
    startTime.current = Date.now()
    stepTime.current = Date.now()
    trackToolStarted('poultry_water_planner')
  }, [])

  const handleAnswer = useCallback(
    (answerId: string) => {
      if (!currentQuestion) return
      const timeOnQuestion = Math.round((Date.now() - stepTime.current) / 1000)
      trackQuizQuestionAnswered(currentQuestion.id, answerId, timeOnQuestion)

      const newAnswers = { ...answers, [currentQuestion.id]: answerId }
      setAnswers(newAnswers)
      const nextStep = currentStep + 1

      if (nextStep >= PLANNER_QUESTIONS.length) {
        const plannerResult = getPlannerResult(newAnswers)
        setResult(plannerResult)
        setPhase('results')
        const elapsed = Math.round((Date.now() - startTime.current) / 1000)
        trackToolCompleted('poultry_water_planner', plannerResult.headline, elapsed)
        trackResultViewed(
          'poultry_water_planner',
          'actions',
          plannerResult.actions.map((a) => a.href || a.title)
        )
      } else {
        setCurrentStep(nextStep)
        stepTime.current = Date.now()
      }
    },
    [currentQuestion, answers, currentStep]
  )

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      stepTime.current = Date.now()
    } else {
      setPhase('intro')
    }
  }, [currentStep])

  const summary = useMemo(
    () => (result ? buildPlannerSummary(answers, result) : ''),
    [answers, result]
  )

  const handleEmail = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!email || !result) return
      await submitLead({
        leadType: 'product_quiz',
        email,
        message: `Poultry Water-System Planner\n${summary}`,
      })
      setLeadDone(true)
    },
    [email, result, summary]
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
              className="h-full rounded-full bg-[#44883E] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h3 className="font-heading text-2xl uppercase text-[#2C5234]">
            Plan Your Water-System Next Step
          </h3>
          <p className="mx-auto mt-3 max-w-md text-gray-600">
            Four questions. We route you to the right guides and product docs — not a disease
            diagnosis, and not invented mix rates.
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="mt-6 rounded-md bg-[#2C5234] px-8 py-3 text-sm font-semibold text-white hover:bg-green-800"
          >
            Start Planner
          </button>
          <p className="mt-3 text-xs text-gray-400">No email required to see results.</p>
        </div>
      )}

      {phase === 'questions' && currentQuestion && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h3 className="font-heading text-xl uppercase text-[#2C5234]">{currentQuestion.title}</h3>
          <div className="mt-6 space-y-3">
            {currentQuestion.answers.map((answer) => (
              <button
                key={answer.id}
                type="button"
                onClick={() => handleAnswer(answer.id)}
                className="flex w-full items-center gap-4 rounded-lg border-2 border-gray-200 p-4 text-left hover:border-[#44883E]"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-900">{answer.label}</div>
                  {answer.description && (
                    <div className="mt-0.5 text-xs text-gray-500">{answer.description}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <button type="button" onClick={handleBack} className="mt-6 text-sm text-gray-500">
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

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Next actions
            </h4>
            <div className="space-y-4">
              {result.actions.map((action) => (
                <div
                  key={action.title}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                >
                  <p className="font-semibold text-gray-900">{action.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{action.body}</p>
                  {action.href && (
                    <a
                      href={action.href}
                      className="mt-3 inline-block text-sm font-semibold text-[#44883E] hover:underline"
                    >
                      {action.hrefLabel || 'Open'} →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h4 className="text-sm font-semibold uppercase text-amber-900">Boundaries</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {result.notFor.map((line) => (
                <li key={line}>{line}</li>
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
                  placeholder="Email this plan to myself"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md bg-[#2C5234] px-4 py-2 text-sm font-semibold text-white"
                >
                  Email plan
                </button>
              </form>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setPhase('intro')
              setCurrentStep(0)
              setAnswers({})
              setResult(null)
              setLeadDone(false)
            }}
            className="text-sm text-gray-500"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  )
}
