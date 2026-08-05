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

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:p-8">
      {/* Question 1 — turf zone */}
      <fieldset>
        <legend className="font-heading text-lg uppercase text-[#2C5234]">
          1. Which turf zone are you in?
        </legend>
        <p className="mt-1 text-sm text-gray-600">
          Your zone sets which months you apply. Not sure? Find your state below.
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
                className={`rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? 'border-[#2C5234] bg-[#2C5234] text-white'
                    : 'border-gray-300 bg-white hover:border-[#2C5234] hover:bg-green-50'
                }`}
              >
                <span className="font-heading text-base uppercase">{z.label}</span>
                <span
                  className={`mt-1 block text-xs ${active ? 'text-green-100' : 'text-gray-600'}`}
                >
                  {z.detail}
                </span>
                <span
                  className={`mt-2 block text-xs ${active ? 'text-green-200' : 'text-gray-500'}`}
                >
                  Applies {z.season}
                </span>
                <span
                  className={`mt-2 block text-[11px] leading-snug ${
                    active ? 'text-green-200' : 'text-gray-400'
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
      <fieldset className={`mt-8 ${zone ? '' : 'opacity-50'}`} disabled={!zone}>
        <legend className="font-heading text-lg uppercase text-[#2C5234]">
          2. How big is your lawn?
        </legend>
        <p className="mt-1 text-sm text-gray-600">
          An approximate square footage is fine — it sets the container size.
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
                className={`rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed ${
                  active
                    ? 'border-[#2C5234] bg-[#2C5234] text-white'
                    : 'border-gray-300 bg-white hover:border-[#2C5234] hover:bg-green-50'
                }`}
              >
                <span className="font-heading text-base uppercase">{s.label}</span>
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
        <div className="mt-8 border-t border-gray-200 pt-8">
          <div className="rounded-lg bg-[#2C5234] p-6 text-white">
            <p className="text-xs uppercase tracking-wide text-green-200">Your bundle</p>
            <h3 className="mt-1 font-heading text-2xl uppercase md:text-3xl">
              Lawn Bundle #{result.number}
            </h3>
            <p className="mt-2 text-green-100">
              {TURF_ZONES.find((z) => z.id === result.zone)?.label} turf zone,{' '}
              {LAWN_SIZES.find((s) => s.id === result.size)?.label.toLowerCase()} lawn — everything
              your lawn needs for the whole season.
            </p>
            <p className="mt-4 font-heading text-3xl">${result.price}</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href={bundleCartUrl(result)}
                onClick={() => trackAddToCartClicked(TOOL, result.sku, 1, result.price)}
                className="rounded-md bg-white px-6 py-3 text-center text-sm font-semibold text-[#2C5234] transition-colors hover:bg-green-50"
              >
                Add Bundle #{result.number} to Cart
              </a>
              <a
                href={bundleProductUrl(result)}
                className="rounded-md border border-white/40 px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                See what's included
              </a>
            </div>
          </div>

          {/* Schedule */}
          <div className="mt-6">
            <h4 className="font-heading text-base uppercase text-[#2C5234]">
              Your application schedule
            </h4>
            <p className="mt-1 text-sm text-gray-600">
              One product, once per month. Use the entire bottle in each application.
            </p>
            <ol className="mt-4 space-y-2">
              {result.schedule.map((s) => (
                <li
                  key={s.month}
                  className="flex gap-4 rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <span className="w-24 shrink-0 font-heading text-sm uppercase text-[#2C5234]">
                    {s.month}
                  </span>
                  <span className="text-sm text-gray-700">{s.action}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Dilution for this bundle's container format */}
          <div className="mt-6 rounded-md border border-gray-200 p-4">
            <h4 className="font-heading text-sm uppercase text-[#2C5234]">
              {DILUTION[result.format].heading}
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {DILUTION[result.format].steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>

          {/* Optional email capture — after the answer, never before it */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
            {leadSubmitted ? (
              <p className="text-center text-sm text-gray-700">
                <span className="font-heading text-base uppercase text-[#2C5234]">Plan sent.</span>{' '}
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
                <h4 className="font-heading text-base uppercase text-[#2C5234]">
                  Email me this schedule
                </h4>
                <p className="mt-1 text-sm text-gray-600">
                  We'll send your month-by-month plan so you have it when you need it.
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
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    aria-label="Email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-1"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-[#2C5234] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#24432b]"
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
            className="mt-4 text-sm text-gray-500 underline hover:text-[#2C5234]"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  )
}
