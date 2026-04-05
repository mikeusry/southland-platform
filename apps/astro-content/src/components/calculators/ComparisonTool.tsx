import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomerType, GoalType, PriorityType, ScenarioInputs } from '../../lib/comparisonData'
import {
  CUSTOMER_TYPES,
  GOALS,
  PRIORITIES,
  buildComparisonSummary,
  getComparison,
} from '../../lib/comparisonData'
import {
  isBot,
  submitLead,
  trackComparisonCtaClicked,
  trackComparisonEvidenceExpanded,
  trackComparisonScenarioSet,
  trackEmailSubmitted,
  trackResultViewed,
  trackToolCompleted,
  trackToolStarted,
} from '../../lib/leadCapture'

export default function ComparisonTool() {
  const [customerType, setCustomerType] = useState<CustomerType | ''>('')
  const [goal, setGoal] = useState<GoalType | ''>('')
  const [priority, setPriority] = useState<PriorityType | ''>('')
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const startTime = useRef(Date.now())

  const hasInputs = customerType && goal && priority
  const inputs: ScenarioInputs | null = hasInputs
    ? {
        customerType: customerType as CustomerType,
        goal: goal as GoalType,
        priority: priority as PriorityType,
      }
    : null

  const result = useMemo(() => (inputs ? getComparison(inputs) : null), [inputs])

  useEffect(() => {
    trackToolStarted('product_comparison')
  }, [])

  useEffect(() => {
    if (result && inputs) {
      trackComparisonScenarioSet({
        customerType: inputs.customerType,
        area: '',
        goal: inputs.goal,
        priority: inputs.priority,
      })
      trackToolCompleted(
        'product_comparison',
        result.headline,
        Math.round((Date.now() - startTime.current) / 1000)
      )
      trackResultViewed('product_comparison', 'comparison', [result.biologicalProduct.handle])
    }
  }, [result, inputs])

  return (
    <div className="space-y-8">
      {/* Scenario Builder */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-6 font-heading text-xl uppercase text-[#2C5234]">Build Your Scenario</h3>

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label
              htmlFor="ct-customer"
              className="mb-1.5 block text-sm font-semibold text-gray-700"
            >
              Operation Type
            </label>
            <select
              id="ct-customer"
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as CustomerType)}
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
            >
              <option value="">Select...</option>
              {CUSTOMER_TYPES.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ct-goal" className="mb-1.5 block text-sm font-semibold text-gray-700">
              Primary Goal
            </label>
            <select
              id="ct-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value as GoalType)}
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
            >
              <option value="">Select...</option>
              {GOALS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ct-priority"
              className="mb-1.5 block text-sm font-semibold text-gray-700"
            >
              Your Priority
            </label>
            <select
              id="ct-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityType)}
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
            >
              <option value="">Select...</option>
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {!result && (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-gray-500">
              Select your operation, goal, and priority
            </p>
            <p className="mt-1 text-xs text-gray-400">
              We'll show a tailored comparison with outcome-based criteria
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && inputs && (
        <>
          {/* Headline */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl uppercase text-[#2C5234]">{result.headline}</h3>
            <p className="mt-2 text-sm text-gray-600">{result.summary}</p>
          </div>

          {/* Comparison Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-3 border-b border-gray-200 bg-gray-50">
              <div className="p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Criteria
                </span>
              </div>
              <div className="border-l border-gray-200 bg-[#2C5234]/5 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#2C5234]">
                  Biological
                </span>
              </div>
              <div className="border-l border-gray-200 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Conventional
                </span>
              </div>
            </div>

            {/* Rows */}
            {result.rows.map((row, i) => (
              <div key={i}>
                <div className="grid grid-cols-3 border-b border-gray-100">
                  <div className="p-4">
                    <span className="text-sm font-semibold text-gray-900">{row.criteria}</span>
                  </div>
                  <div
                    className={`border-l border-gray-100 p-4 ${
                      row.advantage === 'biological' ? 'bg-[#44883E]/5' : ''
                    }`}
                  >
                    <span className="text-sm text-gray-700">{row.biological}</span>
                    {row.advantage === 'biological' && (
                      <span className="ml-1 inline-block text-[#44883E]">
                        <svg
                          className="inline h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div
                    className={`border-l border-gray-100 p-4 ${
                      row.advantage === 'conventional' ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="text-sm text-gray-700">{row.conventional}</span>
                    {row.advantage === 'conventional' && (
                      <span className="ml-1 inline-block text-blue-500">
                        <svg
                          className="inline h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>

                {/* Evidence Drawer */}
                {row.evidence && (
                  <details
                    className="border-b border-gray-100 bg-gray-50"
                    onToggle={(e) => {
                      if ((e.target as HTMLDetailsElement).open) {
                        trackComparisonEvidenceExpanded(row.criteria)
                      }
                    }}
                  >
                    <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-[#44883E] hover:text-green-700">
                      View evidence
                    </summary>
                    <p className="px-4 pb-3 text-xs text-gray-600">{row.evidence}</p>
                  </details>
                )}
              </div>
            ))}
          </div>

          {/* Bottom Line */}
          <div className="rounded-lg bg-[#2C5234]/5 p-5">
            <h4 className="text-sm font-semibold text-[#2C5234]">Bottom Line</h4>
            <p className="mt-1 text-sm text-gray-700">{result.bottomLine}</p>
          </div>

          {/* Recommended Product */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Recommended Biological Approach
            </h4>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-[#2C5234]">
                  {result.biologicalProduct.name}
                </p>
                <p className="mt-1 text-sm text-gray-600">{result.biologicalProduct.reason}</p>
              </div>
              <a
                href={`/products/${result.biologicalProduct.handle}/`}
                onClick={() => trackComparisonCtaClicked('cart')}
                className="shrink-0 rounded-md bg-[#2C5234] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-800"
              >
                View Product
              </a>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="/application-rate-calculator/"
              onClick={() => trackComparisonCtaClicked('calculator')}
              className="inline-flex flex-1 items-center justify-center rounded-md bg-[#2C5234] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
            >
              Calculate How Much I Need
            </a>
            <a
              href="/contact/"
              onClick={() => trackComparisonCtaClicked('rep')}
              className="inline-flex flex-1 items-center justify-center rounded-md border border-[#2C5234] px-6 py-3 text-sm font-semibold text-[#2C5234] transition-colors hover:bg-[#2C5234] hover:text-white"
            >
              Talk Through My Scenario
            </a>
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
                  Comparison Saved!
                </p>
                <p className="mt-1 text-sm text-gray-600">Check your email.</p>
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

                  trackEmailSubmitted('product_comparison', false, !!firstName)

                  submitLead({
                    leadType: 'lead_magnet',
                    email,
                    firstName: firstName || null,
                    message: buildComparisonSummary(inputs, result),
                  })
                }}
              >
                <h4 className="font-heading text-lg uppercase text-[#2C5234]">
                  Email This Comparison
                </h4>
                <p className="mt-1 text-sm text-gray-600">
                  Get this comparison with evidence notes sent to your inbox.
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
                      htmlFor="ct-email"
                      className="mb-1 block text-sm font-semibold text-gray-700"
                    >
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="ct-email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ct-name"
                      className="mb-1 block text-sm font-semibold text-gray-700"
                    >
                      First Name
                    </label>
                    <input
                      id="ct-name"
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
                    Send My Comparison
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  )
}
