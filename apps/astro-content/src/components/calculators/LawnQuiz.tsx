import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type QuizResult,
  QUIZ_QUESTIONS,
  buildQuizSummary,
  getRecommendations,
} from '../../lib/lawnQuizData'
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

export default function LawnQuiz() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const startTime = useRef(Date.now())
  const stepTime = useRef(Date.now())

  // Filter to only questions whose conditions pass
  const activeQuestions = useMemo(
    () => QUIZ_QUESTIONS.filter((q) => !q.condition || q.condition(answers)),
    [answers]
  )

  const currentQuestion = phase === 'questions' ? activeQuestions[currentStep] : null
  const totalSteps = activeQuestions.length

  const progressPercent =
    phase === 'intro' ? 0 : phase === 'results' ? 100 : Math.round((currentStep / totalSteps) * 100)

  // Start quiz
  const handleStart = useCallback(() => {
    setPhase('questions')
    setCurrentStep(0)
    startTime.current = Date.now()
    stepTime.current = Date.now()
    trackToolStarted('lawn_health_quiz')
  }, [])

  // Answer a question
  const handleAnswer = useCallback(
    (answerId: string) => {
      if (!currentQuestion) return

      const timeOnQuestion = Math.round((Date.now() - stepTime.current) / 1000)
      trackQuizQuestionAnswered(currentQuestion.id, answerId, timeOnQuestion)

      const newAnswers = { ...answers, [currentQuestion.id]: answerId }
      setAnswers(newAnswers)

      // Recalculate active questions with new answers
      const nextActive = QUIZ_QUESTIONS.filter((q) => !q.condition || q.condition(newAnswers))
      const nextStep = currentStep + 1

      if (nextStep >= nextActive.length) {
        // Quiz complete — calculate results
        const quizResult = getRecommendations(newAnswers)
        setResult(quizResult)
        setPhase('results')

        const elapsed = Math.round((Date.now() - startTime.current) / 1000)
        trackToolCompleted('lawn_health_quiz', quizResult.diagnosisTitle, elapsed)
        trackResultViewed(
          'lawn_health_quiz',
          'recommendations',
          quizResult.recommendations.map((r) => r.handle)
        )
      } else {
        setCurrentStep(nextStep)
        stepTime.current = Date.now()
      }
    },
    [currentQuestion, answers, currentStep]
  )

  // Go back
  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      stepTime.current = Date.now()
    } else {
      setPhase('intro')
    }
  }, [currentStep])

  // Restart
  const handleRestart = useCallback(() => {
    setPhase('intro')
    setCurrentStep(0)
    setAnswers({})
    setResult(null)
    setLeadSubmitted(false)
  }, [])

  return (
    <div className="mx-auto max-w-2xl">
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
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <h3 className="mt-5 font-heading text-2xl uppercase text-[#2C5234]">
            Find Your Lawn Plan in 60 Seconds
          </h3>
          <p className="mx-auto mt-3 max-w-md text-gray-600">
            Answer 5-7 quick questions about your lawn and we'll recommend the right products with
            application rates and timing.
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="mt-6 rounded-md bg-[#2C5234] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
          >
            Start My Assessment
          </button>
          <p className="mt-3 text-xs text-gray-400">No email required. See results instantly.</p>
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
            {currentQuestion.type === 'severity' ? (
              <div className="grid grid-cols-3 gap-3">
                {currentQuestion.answers.map((answer) => (
                  <button
                    key={answer.id}
                    type="button"
                    onClick={() => handleAnswer(answer.id)}
                    className={`rounded-lg border-2 p-4 text-center transition-all hover:border-[#44883E] hover:shadow-sm ${
                      answers[currentQuestion.id] === answer.id
                        ? 'border-[#44883E] bg-[#44883E]/5'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900">{answer.label}</div>
                    {answer.description && (
                      <div className="mt-1 text-xs text-gray-500">{answer.description}</div>
                    )}
                  </button>
                ))}
              </div>
            ) : currentQuestion.type === 'chip-select' ? (
              <div className="flex flex-wrap gap-2">
                {currentQuestion.answers.map((answer) => (
                  <button
                    key={answer.id}
                    type="button"
                    onClick={() => handleAnswer(answer.id)}
                    className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all hover:border-[#44883E] ${
                      answers[currentQuestion.id] === answer.id
                        ? 'border-[#44883E] bg-[#44883E]/5 text-[#2C5234]'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    {answer.label}
                  </button>
                ))}
              </div>
            ) : (
              currentQuestion.answers.map((answer) => (
                <button
                  key={answer.id}
                  type="button"
                  onClick={() => handleAnswer(answer.id)}
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

          {/* Back button */}
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
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#44883E]/10">
                <svg
                  className="h-5 w-5 text-[#44883E]"
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
              </div>
              <div>
                <h3 className="font-heading text-xl uppercase text-[#2C5234]">
                  {result.diagnosisTitle}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{result.diagnosisSummary}</p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Your Recommended Products
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

          {/* Application Timing */}
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
                <p className="text-sm font-semibold text-[#2C5234]">Application Timing</p>
                <p className="mt-1 text-sm text-gray-600">{result.applicationTiming}</p>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={result.calculatorLink}
              className="inline-flex flex-1 items-center justify-center rounded-md bg-[#2C5234] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
            >
              Calculate How Much I Need
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
                  Lawn Plan Sent!
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Check your email for your personalized plan.
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

                  trackEmailSubmitted('lawn_health_quiz', false, !!firstName)

                  submitLead({
                    leadType: 'product_quiz',
                    email,
                    firstName: firstName || null,
                    message: buildQuizSummary(answers, result),
                  })
                }}
              >
                <h4 className="font-heading text-lg uppercase text-[#2C5234]">
                  Email My Lawn Plan
                </h4>
                <p className="mt-1 text-sm text-gray-600">
                  Get a seasonal plan + application timeline sent to your inbox.
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
                    Send My Lawn Plan
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="text-xs text-gray-400">
            This assessment provides general recommendations based on common lawn conditions. For
            severe or unusual issues, contact our team for personalized guidance.
          </p>
        </div>
      )}
    </div>
  )
}
