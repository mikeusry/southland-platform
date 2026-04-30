import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type QuizResult,
  type RiskTier,
  QUIZ_QUESTIONS,
  buildQuizSummary,
  getRecommendations,
} from '../../lib/flockHealthQuizData'
import {
  isBot,
  submitLead,
  trackEmailSubmitted,
  trackQuizQuestionAnswered,
  trackQuizResultProductClicked,
  trackResultViewed,
  trackToolCompleted,
  trackToolStarted,
} from '../../lib/leadCapture'

type Phase = 'intro' | 'questions' | 'results'

const TIER_STYLE: Record<RiskTier, { label: string; tone: string; chip: string }> = {
  low: {
    label: 'Low risk',
    tone: 'Your flock is in good shape',
    chip: 'bg-emerald-100 text-emerald-800',
  },
  moderate: {
    label: 'Moderate risk',
    tone: 'A few things worth addressing',
    chip: 'bg-amber-100 text-amber-800',
  },
  high: {
    label: 'High risk',
    tone: 'Take action this week',
    chip: 'bg-red-100 text-red-800',
  },
}

export default function FlockHealthCheck() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const startTime = useRef(Date.now())
  const stepTime = useRef(Date.now())

  const activeQuestions = useMemo(
    () => QUIZ_QUESTIONS.filter((q) => !q.condition || q.condition(answers)),
    [answers]
  )

  const currentQuestion = phase === 'questions' ? activeQuestions[currentStep] : null
  const totalSteps = activeQuestions.length

  const progressPercent =
    phase === 'intro' ? 0 : phase === 'results' ? 100 : Math.round((currentStep / totalSteps) * 100)

  const handleStart = useCallback(() => {
    setPhase('questions')
    setCurrentStep(0)
    startTime.current = Date.now()
    stepTime.current = Date.now()
    trackToolStarted('flock_health_check')
  }, [])

  // Single-select: pick one and advance
  const handleSingleAnswer = useCallback(
    (answerId: string) => {
      if (!currentQuestion) return

      const timeOnQuestion = Math.round((Date.now() - stepTime.current) / 1000)
      trackQuizQuestionAnswered(currentQuestion.id, answerId, timeOnQuestion)

      const newAnswers = { ...answers, [currentQuestion.id]: answerId }
      setAnswers(newAnswers)
      advanceFromAnswers(newAnswers)
    },
    [currentQuestion, answers]
  )

  // Chip-select: toggle membership, then user clicks "Continue"
  const handleChipToggle = useCallback(
    (answerId: string) => {
      if (!currentQuestion) return
      const current = (answers[currentQuestion.id] || '').split(',').filter(Boolean)
      let next: string[]

      if (answerId === 'none') {
        next = current.includes('none') ? [] : ['none']
      } else {
        const without = current.filter((id) => id !== 'none' && id !== answerId)
        next = current.includes(answerId) ? without : [...without, answerId]
      }
      setAnswers({ ...answers, [currentQuestion.id]: next.join(',') })
    },
    [currentQuestion, answers]
  )

  const handleChipContinue = useCallback(() => {
    if (!currentQuestion) return
    const value = answers[currentQuestion.id] || ''
    const timeOnQuestion = Math.round((Date.now() - stepTime.current) / 1000)
    trackQuizQuestionAnswered(currentQuestion.id, value, timeOnQuestion)
    advanceFromAnswers(answers)
  }, [currentQuestion, answers])

  // Common advance logic — branches on whether quiz is complete
  const advanceFromAnswers = useCallback(
    (currentAnswers: Record<string, string>) => {
      const nextActive = QUIZ_QUESTIONS.filter((q) => !q.condition || q.condition(currentAnswers))
      const nextStep = currentStep + 1

      if (nextStep >= nextActive.length) {
        const quizResult = getRecommendations(currentAnswers)
        setResult(quizResult)
        setPhase('results')

        const elapsed = Math.round((Date.now() - startTime.current) / 1000)
        trackToolCompleted('flock_health_check', quizResult.diagnosisTitle, elapsed)
        trackResultViewed(
          'flock_health_check',
          quizResult.riskTier,
          quizResult.recommendations.map((r) => r.handle)
        )
      } else {
        setCurrentStep(nextStep)
        stepTime.current = Date.now()
      }
    },
    [currentStep]
  )

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      stepTime.current = Date.now()
    } else {
      setPhase('intro')
    }
  }, [currentStep])

  const handleRestart = useCallback(() => {
    setPhase('intro')
    setCurrentStep(0)
    setAnswers({})
    setResult(null)
    setLeadSubmitted(false)
  }, [])

  // Scroll the quiz card to top on phase / step changes
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [phase, currentStep])

  return (
    <div ref={cardRef} className="mx-auto max-w-2xl">
      {/* Progress Bar */}
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

      {/* INTRO */}
      {phase === 'intro' && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#44883E]/10">
            <svg
              className="h-8 w-8 text-[#44883E]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <h3 className="mt-5 font-heading text-2xl uppercase text-[#2C5234]">
            Backyard Flock Health Check
          </h3>
          <p className="mx-auto mt-3 max-w-md text-gray-600">
            Answer 7 quick questions and get a personalized care plan — risk score, recommended
            products, and a year-round prevention routine for your specific flock.
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="mt-6 rounded-md bg-[#2C5234] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
          >
            Start My Flock Check
          </button>
          <p className="mt-3 text-xs text-gray-400">
            90 seconds. No email required. See results instantly.
          </p>
        </div>
      )}

      {/* QUESTIONS */}
      {phase === 'questions' && currentQuestion && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h3 className="font-heading text-xl uppercase text-[#2C5234]">{currentQuestion.title}</h3>
          {currentQuestion.subtitle && (
            <p className="mt-1 text-sm text-gray-500">{currentQuestion.subtitle}</p>
          )}

          <div className="mt-6 space-y-3">
            {currentQuestion.type === 'chip-select' ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {currentQuestion.answers.map((answer) => {
                    const selected = (answers[currentQuestion.id] || '').split(',').filter(Boolean)
                    const isOn = selected.includes(answer.id)
                    return (
                      <button
                        key={answer.id}
                        type="button"
                        onClick={() => handleChipToggle(answer.id)}
                        className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all hover:border-[#44883E] ${
                          isOn
                            ? 'border-[#44883E] bg-[#44883E]/10 text-[#2C5234]'
                            : 'border-gray-200 text-gray-700'
                        }`}
                      >
                        {answer.label}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleChipContinue}
                  disabled={!answers[currentQuestion.id]}
                  className="mt-4 w-full rounded-md bg-[#2C5234] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  Continue
                </button>
              </>
            ) : (
              currentQuestion.answers.map((answer) => (
                <button
                  key={answer.id}
                  type="button"
                  onClick={() => handleSingleAnswer(answer.id)}
                  className={`flex w-full items-center gap-4 rounded-lg border-2 p-4 text-left transition-all hover:border-[#44883E] hover:shadow-sm ${
                    answers[currentQuestion.id] === answer.id
                      ? 'border-[#44883E] bg-[#44883E]/5'
                      : 'border-gray-200'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{answer.label}</div>
                    {answer.description && (
                      <div className="mt-0.5 text-xs text-gray-500">{answer.description}</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={handleBack}
            className="mt-6 text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back
          </button>
        </div>
      )}

      {/* RESULTS */}
      {phase === 'results' && result && (
        <div className="space-y-6">
          {/* Diagnosis */}
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${TIER_STYLE[result.riskTier].chip}`}
              >
                {TIER_STYLE[result.riskTier].label}
              </span>
              <span className="text-xs text-gray-500">Score: {result.riskScore}</span>
            </div>
            <h3 className="mt-4 font-heading text-2xl uppercase text-[#2C5234]">
              {result.diagnosisTitle}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">{result.diagnosisSummary}</p>
          </div>

          {/* Recommendations */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Your Recommended Care Plan
            </h4>
            <div className="space-y-4">
              {result.recommendations.map((rec, i) => (
                <div
                  key={rec.handle}
                  className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2C5234] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900">{rec.name}</p>
                      <p className="mt-1 text-sm text-gray-600">{rec.reason}</p>
                    </div>
                  </div>
                  <a
                    href={`/products/${rec.handle}/`}
                    onClick={() => trackQuizResultProductClicked(rec.handle, i)}
                    className="shrink-0 rounded-md border border-[#44883E] px-3 py-1.5 text-xs font-semibold text-[#44883E] transition-colors hover:bg-[#44883E] hover:text-white"
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Seasonal Guidance */}
          <div className="rounded-lg bg-[#2C5234]/5 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-[#44883E]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold text-[#2C5234]">Your Care Routine</p>
                <p className="mt-1 text-sm text-gray-600">{result.seasonalGuidance}</p>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="/blog/treating-vent-gleet-and-pasty-butt-in-chickens/"
              className="inline-flex flex-1 items-center justify-center rounded-md bg-[#2C5234] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
            >
              Read the Health Guide
            </a>
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex flex-1 items-center justify-center rounded-md border border-[#2C5234] px-6 py-3 text-sm font-semibold text-[#2C5234] transition-colors hover:bg-[#2C5234] hover:text-white"
            >
              Retake Quiz
            </button>
          </div>

          {/* Email Capture */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            {leadSubmitted ? (
              <div className="text-center">
                <svg
                  className="mx-auto h-10 w-10 text-[#44883E]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="mt-3 font-heading text-lg uppercase text-[#2C5234]">
                  Care Plan Sent!
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Check your email for your year-round flock care calendar.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  if (isBot(fd)) return

                  setLeadSubmitted(true)

                  const email = fd.get('email') as string
                  const firstName = fd.get('first_name') as string

                  trackEmailSubmitted('flock_health_check', false, !!firstName)

                  submitLead({
                    leadType: 'product_quiz',
                    email,
                    firstName: firstName || null,
                    message: buildQuizSummary(answers, result),
                  })
                }}
              >
                <h4 className="font-heading text-lg uppercase text-[#2C5234]">
                  Email My Care Plan + Calendar
                </h4>
                <p className="mt-1 text-sm text-gray-600">
                  Get this plan plus our year-round backyard flock care calendar (PDF) sent to your
                  inbox.
                </p>

                <input
                  name="website"
                  style={{ display: 'none' }}
                  tabIndex={-1}
                  autoComplete="off"
                />

                <div className="mt-4 space-y-3">
                  <div>
                    <label
                      htmlFor="quiz-email"
                      className="mb-1 block text-sm font-semibold text-gray-700"
                    >
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="quiz-email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="quiz-name"
                      className="mb-1 block text-sm font-semibold text-gray-700"
                    >
                      First Name
                    </label>
                    <input
                      id="quiz-name"
                      name="first_name"
                      type="text"
                      placeholder="Optional"
                      className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-md bg-[#44883E] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    Send My Flock Care Plan
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="text-xs text-gray-400">
            This check provides general flock health guidance, not veterinary diagnosis. For severe
            symptoms or persistent issues, consult a poultry vet.
          </p>
        </div>
      )}
    </div>
  )
}
