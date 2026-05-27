import { useMemo, useRef, useState } from 'react'
import {
  PRODUCTS,
  AGE_LABELS,
  calculateDosing,
  type AgeClass,
  type DosingResult,
} from '../../lib/flockDosingData'
import {
  isBot,
  submitLead,
  trackCalculatorProductSelected,
  trackEmailSubmitted,
  trackResultViewed,
  trackToolCompleted,
  trackToolStarted,
} from '../../lib/leadCapture'

/**
 * Flock Dosing Calculator (Thursday Pulse #6).
 *
 * Backyard persona: "how much Hen Helper / Catalyst do my N birds need, and how
 * long does a bottle last?" Returns a deterministic plan from real MDX dosing
 * rates (src/lib/flockDosingData.ts) — non-commodity content by construction.
 *
 * Mirrors the ApplicationRateCalculator pattern: select product → enter flock →
 * instant result → optional email capture for a printable plan (no email
 * required to see results).
 */
export default function FlockDosingCalculator() {
  const [productHandle, setProductHandle] = useState(PRODUCTS[0].handle)
  const [birds, setBirds] = useState<number>(6)
  const [ageClass, setAgeClass] = useState<AgeClass>('layers')
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const startedRef = useRef(false)
  const startTime = useRef(Date.now())

  const product = useMemo(
    () => PRODUCTS.find((p) => p.handle === productHandle) ?? PRODUCTS[0],
    [productHandle]
  )

  const result: DosingResult | null = useMemo(() => {
    if (!birds || birds < 1) return null
    return calculateDosing(product, birds, ageClass)
  }, [product, birds, ageClass])

  // Fire tool-started once, on first meaningful interaction.
  function markStarted() {
    if (startedRef.current) return
    startedRef.current = true
    trackToolStarted('flock_dosing_calculator')
  }

  // Fire result-viewed/completed when a valid result first renders.
  const resultSeen = useRef(false)
  if (result && !resultSeen.current) {
    resultSeen.current = true
    trackResultViewed('flock_dosing_calculator', `${product.handle}:${birds}:${ageClass}`)
    trackToolCompleted(
      'flock_dosing_calculator',
      product.name,
      Math.round((Date.now() - startTime.current) / 1000)
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Inputs */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="font-heading text-xl uppercase text-[#2C5234]">Your Flock</h3>

        <label className="mt-4 block text-sm font-semibold text-gray-700">
          Product
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 p-3"
            value={productHandle}
            onChange={(e) => {
              markStarted()
              setProductHandle(e.target.value)
              trackCalculatorProductSelected(e.target.value)
            }}
          >
            {PRODUCTS.map((p) => (
              <option key={p.handle} value={p.handle}>
                {p.name} — {p.role}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-gray-700">
            Number of birds
            <input
              type="number"
              min={1}
              max={500}
              className="mt-1 w-full rounded-lg border border-gray-300 p-3"
              value={birds || ''}
              onChange={(e) => {
                markStarted()
                setBirds(Math.max(0, Math.min(500, Number(e.target.value))))
              }}
            />
          </label>

          <label className="block text-sm font-semibold text-gray-700">
            Age class
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 p-3"
              value={ageClass}
              onChange={(e) => {
                markStarted()
                setAgeClass(e.target.value as AgeClass)
              }}
            >
              {(Object.keys(AGE_LABELS) as AgeClass[]).map((k) => (
                <option key={k} value={k}>
                  {AGE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-6 rounded-2xl border border-[#2C5234]/20 bg-[#F4F7F0] p-6">
          <h3 className="font-heading text-xl uppercase text-[#2C5234]">
            Your {result.product.name} Plan
          </h3>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat
              label="Daily drinking water"
              value={`${result.dailyWaterGal} gal`}
              hint={`${result.birds} birds`}
            />
            <Stat
              label="Dose per refill"
              value={`${result.tbspPerRefill} tbsp`}
              hint={`every 2-3 days`}
            />
            <Stat
              label="One bottle lasts"
              value={result.bottleLastsLabel}
              hint={`${result.product.bottleOz} oz bottle`}
            />
          </div>

          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            {result.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#2C5234]">•</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-gray-500">
            Estimates for planning, based on typical backyard water intake — not a veterinary
            prescription. Always provide fresh water and consult a poultry vet for sick birds.
          </p>

          <a
            href={`/products/${result.product.handle}`}
            className="mt-4 inline-flex rounded-full bg-[#2C5234] px-5 py-2 text-sm font-semibold text-white"
          >
            Shop {result.product.name}
          </a>

          {/* Email capture — optional, results already shown above */}
          {leadSubmitted ? (
            <p className="mt-6 rounded-lg bg-white p-4 text-sm text-[#2C5234]">
              Sent! Check your email for your printable dosing plan + year-round flock calendar.
            </p>
          ) : (
            <form
              className="mt-6 rounded-lg bg-white p-4"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                if (isBot(fd)) return
                const email = fd.get('email') as string
                const firstName = (fd.get('firstName') as string) || null
                if (!email) return
                trackEmailSubmitted('flock_dosing_calculator', false, !!firstName)
                submitLead({
                  leadType: 'roi_calculator',
                  email,
                  firstName,
                  message: `Flock dosing plan — ${result.product.name}, ${result.birds} ${result.ageClass} birds: ${result.tbspPerRefill} tbsp/refill, bottle lasts ${result.bottleLastsLabel}.`,
                })
                setLeadSubmitted(true)
              }}
            >
              <h4 className="font-heading text-lg uppercase text-[#2C5234]">
                Email My Dosing Plan + Calendar
              </h4>
              <p className="mt-1 text-sm text-gray-600">
                Get this plan plus our year-round backyard flock care calendar (PDF).
              </p>
              {/* Honeypot — bots fill this, humans never see it (isBot checks it) */}
              <input
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="absolute left-[-9999px] h-0 w-0"
                aria-hidden="true"
              />
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  name="firstName"
                  placeholder="First name (optional)"
                  className="rounded-lg border border-gray-300 p-3"
                />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@email.com"
                  className="rounded-lg border border-gray-300 p-3"
                />
              </div>
              <button
                type="submit"
                className="mt-3 w-full rounded-full bg-[#2C5234] px-5 py-3 text-sm font-semibold text-white"
              >
                Send My Plan
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center shadow-sm">
      <div className="font-heading text-2xl text-[#2C5234]">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
    </div>
  )
}
