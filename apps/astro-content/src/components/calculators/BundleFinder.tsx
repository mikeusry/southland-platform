import { useCallback, useRef, useState } from 'react'
import {
  DILUTION,
  LAWN_SIZES,
  TURF_ZONES,
  type LawnBundle,
  type LawnSize,
  type TurfZone,
  bundleCartUrl,
  bundleProductUrl,
  buildBundleSummary,
  findBundle,
} from '../../lib/lawnBundleData'
import {
  isBot,
  submitLead,
  trackAddToCartClicked,
  trackEmailSubmitted,
  trackQuizQuestionAnswered,
  trackResultViewed,
  trackToolCompleted,
  trackToolStarted,
} from '../../lib/leadCapture'

const TOOL = 'lawn_bundle_finder'

/**
 * Two questions — turf zone, then lawn size — resolving to one of nine bundles.
 *
 * Replaces the VideoAsk quiz. The whole recommendation is a 3×3 lookup, so it
 * runs client-side with no API round trip and no third-party embed. The email
 * step is optional and comes AFTER the answer: the old flow gated the result
 * behind a form, which is the likeliest reason 55 of 62 visitors dropped before
 * interacting at all.
 */
export default function BundleFinder() {
  const [zone, setZone] = useState<TurfZone | null>(null)
  const [size, setSize] = useState<LawnSize | null>(null)
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const started = useRef(false)
  const startTime = useRef(Date.now())

  const markStarted = useCallback(() => {
    if (started.current) return
    started.current = true
    startTime.current = Date.now()
    trackToolStarted(TOOL)
  }, [])

  const handleZone = useCallback(
    (z: TurfZone) => {
      markStarted()
      setZone(z)
      trackQuizQuestionAnswered('turf_zone', z)
    },
    [markStarted]
  )

  const handleSize = useCallback(
    (s: LawnSize) => {
      markStarted()
      setSize(s)
      trackQuizQuestionAnswered('lawn_size', s)
      if (zone) {
        const b = findBundle(zone, s)
        trackResultViewed(TOOL, `bundle_${b.number}`, [b.sku])
        trackToolCompleted(
          TOOL,
          `Bundle #${b.number}`,
          Math.round((Date.now() - startTime.current) / 1000)
        )
      }
    },
    [zone]
  )

  const result: LawnBundle | null = zone && size ? findBundle(zone, size) : null

  const reset = useCallback(() => {
    setZone(null)
    setSize(null)
    setLeadSubmitted(false)
    started.current = false
  }, [])

  const answered = (zone ? 1 : 0) + (size ? 1 : 0)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Progress */}
      <div className="h-1.5 w-full bg-gray-100">
        <div
          className="h-full bg-[#44883E] transition-all duration-500"
          style={{ width: `${(answered / 2) * 100}%` }}
        />
      </div>

      <div className="p-6 md:p-8">
        {/* Question 1 — turf zone */}
        <fieldset>
          <legend className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                zone ? 'bg-[#44883E] text-white' : 'bg-green-100 text-green-700'
              }`}
            >
              {zone ? '✓' : '1'}
            </span>
            <span className="font-heading text-lg uppercase text-shopify-title">
              Which turf zone are you in?
            </span>
          </legend>
          <p className="mt-2 pl-11 text-sm text-gray-600">
            Your zone sets which months you apply. Not sure? Find your state in the list.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {TURF_ZONES.map((z) => {
              const active = zone === z.id
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => handleZone(z.id)}
                  aria-pressed={active}
                  className={`group rounded-xl border-2 p-4 text-left transition-all ${
                    active
                      ? 'border-[#44883E] bg-[#2C5234] text-white shadow-md'
                      : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-[#44883E] hover:shadow-md'
                  }`}
                >
                  <span
                    className={`font-heading text-base uppercase ${
                      active ? 'text-white' : 'text-shopify-title'
                    }`}
                  >
                    {z.label}
                  </span>
                  <span
                    className={`mt-1 block text-xs leading-snug ${
                      active ? 'text-green-100' : 'text-gray-600'
                    }`}
                  >
                    {z.detail}
                  </span>
                  <span
                    className={`mt-2 block text-xs font-semibold ${
                      active ? 'text-green-300' : 'text-[#44883E]'
                    }`}
                  >
                    Applies {z.season}
                  </span>
                  <span
                    className={`mt-2 block border-t pt-2 text-[11px] leading-snug ${
                      active ? 'border-white/20 text-green-200/90' : 'border-gray-100 text-gray-400'
                    }`}
                  >
                    {z.states}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {/* Question 2 — lawn size */}
        <fieldset
          className={`mt-8 border-t border-gray-100 pt-8 transition-opacity ${
            zone ? '' : 'opacity-40'
          }`}
          disabled={!zone}
        >
          <legend className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                size ? 'bg-[#44883E] text-white' : 'bg-green-100 text-green-700'
              }`}
            >
              {size ? '✓' : '2'}
            </span>
            <span className="font-heading text-lg uppercase text-shopify-title">
              How big is your lawn?
            </span>
          </legend>
          <p className="mt-2 pl-11 text-sm text-gray-600">
            An approximate square footage is fine — it sets the container size. When in doubt, round
            up.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {LAWN_SIZES.map((s) => {
              const active = size === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSize(s.id)}
                  aria-pressed={active}
                  className={`rounded-xl border-2 p-4 text-left transition-all disabled:cursor-not-allowed ${
                    active
                      ? 'border-[#44883E] bg-[#2C5234] text-white shadow-md'
                      : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-[#44883E] hover:shadow-md'
                  }`}
                >
                  <span
                    className={`font-heading text-base uppercase ${
                      active ? 'text-white' : 'text-shopify-title'
                    }`}
                  >
                    {s.label}
                  </span>
                  <span
                    className={`mt-1 block text-xs ${active ? 'text-green-100' : 'text-gray-600'}`}
                  >
                    {s.detail}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {/* Result */}
        {result && (
          <div className="mt-8 border-t border-gray-100 pt-8">
            <div className="overflow-hidden rounded-xl bg-[#2C5234] text-white shadow-lg">
              <div className="p-6 md:p-8">
                <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-300">
                  Your match
                </span>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    {/* 🛑 `text-white` is explicit on purpose — a global h3 rule sets
                        this to the brand green, which is the exact colour of this
                        panel's background. Inheriting made the heading invisible. */}
                    <h3 className="font-heading text-3xl uppercase leading-tight text-white md:text-4xl">
                      Lawn Bundle #{result.number}
                    </h3>
                    <p className="mt-2 max-w-md text-green-100">
                      {TURF_ZONES.find((z) => z.id === result.zone)?.label} turf zone,{' '}
                      {LAWN_SIZES.find((s) => s.id === result.size)?.label.toLowerCase()} lawn —
                      everything your lawn needs for the whole season.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-4xl leading-none">${result.price}</p>
                    <p className="mt-1 text-xs text-green-200/80">for the season</p>
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={bundleCartUrl(result)}
                    onClick={() => trackAddToCartClicked(TOOL, result.sku, 1, result.price)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-[#2C5234] transition-colors hover:bg-green-50"
                  >
                    Add Bundle #{result.number} to Cart
                    <span aria-hidden="true">→</span>
                  </a>
                  <a
                    href={bundleProductUrl(result)}
                    className="inline-flex items-center justify-center rounded-lg border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/5"
                  >
                    See what's included
                  </a>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="mt-8">
              <h4 className="font-heading text-lg uppercase text-shopify-title">
                Your application schedule
              </h4>
              <p className="mt-1 text-sm text-gray-600">
                One product, once per month. Use the entire bottle in each application.
              </p>
              <ol className="mt-4 space-y-2">
                {result.schedule.map((s, i) => (
                  <li
                    key={s.month}
                    className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                      {i + 1}
                    </span>
                    <span className="w-24 shrink-0 font-heading text-sm uppercase text-[#44883E]">
                      {s.month}
                    </span>
                    <span className="text-sm leading-relaxed text-gray-700">{s.action}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Dilution for this bundle's container format */}
            <div className="mt-6 rounded-lg border-l-4 border-[#44883E] bg-green-50/60 p-5">
              <h4 className="font-heading text-sm uppercase text-shopify-title">
                {DILUTION[result.format].heading}
              </h4>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-gray-700">
                {DILUTION[result.format].steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>

            {/* Optional email capture — after the answer, never before it */}
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-6">
              {leadSubmitted ? (
                <p className="text-center text-sm text-gray-700">
                  <span className="font-heading text-base uppercase text-[#44883E]">
                    Plan sent.
                  </span>{' '}
                  Check your email for your Bundle #{result.number} schedule.
                </p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    if (isBot(fd)) return
                    setLeadSubmitted(true)
                    const email = fd.get('email') as string
                    const firstName = (fd.get('first_name') as string) || null
                    trackEmailSubmitted(TOOL, false, !!firstName)
                    submitLead({
                      leadType: 'product_quiz',
                      email,
                      firstName,
                      message: buildBundleSummary(result),
                    })
                  }}
                >
                  <h4 className="font-heading text-base uppercase text-shopify-title">
                    Want this schedule in your inbox?
                  </h4>
                  <p className="mt-1 text-sm text-gray-600">
                    Optional — you already have your answer above. We'll send the month-by-month
                    plan so you have it when you need it.
                  </p>
                  <input
                    name="website"
                    style={{ display: 'none' }}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <input
                      aria-label="First name"
                      name="first_name"
                      placeholder="First name"
                      autoComplete="given-name"
                      className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
                    />
                    <input
                      aria-label="Email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[#44883E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#44883E]/85"
                    >
                      Send it
                    </button>
                  </div>
                </form>
              )}
            </div>

            <button
              type="button"
              onClick={reset}
              className="mt-5 text-sm text-gray-500 underline transition-colors hover:text-[#44883E]"
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
