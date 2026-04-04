import { useMemo, useState } from 'react'
import type { CalculatorInputs } from '../../lib/erosionControlTypes'
import {
  GOAL_OPTIONS,
  METHOD_OPTIONS,
  REGION_OPTIONS,
  SEASON_OPTIONS,
  SLOPE_OPTIONS,
  SOIL_OPTIONS,
  SUN_OPTIONS,
} from '../../lib/erosionControlRules'
import { calculateResult, formatWeight } from '../../lib/erosionControlUtils'

const DEFAULTS: CalculatorInputs = {
  area: 1000,
  slope: 'moderate',
  sun: 'full-sun',
  soil: 'red-clay',
  compost: true,
  goal: 'quick-long-term',
  season: 'fall',
  region: 'georgia-southeast',
  method: 'broadcast',
}

export default function ErosionControlCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULTS)

  const result = useMemo(() => calculateResult(inputs), [inputs])

  function update<K extends keyof CalculatorInputs>(key: K, value: CalculatorInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
      {/* Form Panel */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-6 font-heading text-xl uppercase text-[#2C5234]">
            Your Site Conditions
          </h3>

          {/* Area */}
          <div className="mb-5">
            <label htmlFor="ec-area" className="mb-1.5 block text-sm font-semibold text-gray-700">
              Area (sq ft)
            </label>
            <input
              id="ec-area"
              type="number"
              min={1}
              max={10000000}
              value={inputs.area}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v > 0) update('area', v)
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
            />
          </div>

          {/* Slope */}
          <SelectField
            id="ec-slope"
            label="Slope"
            options={SLOPE_OPTIONS}
            value={inputs.slope}
            onChange={(v) => update('slope', v as CalculatorInputs['slope'])}
          />

          {/* Sun */}
          <SelectField
            id="ec-sun"
            label="Sun Exposure"
            options={SUN_OPTIONS}
            value={inputs.sun}
            onChange={(v) => update('sun', v as CalculatorInputs['sun'])}
          />

          {/* Soil */}
          <SelectField
            id="ec-soil"
            label="Soil Type"
            options={SOIL_OPTIONS}
            value={inputs.soil}
            onChange={(v) => update('soil', v as CalculatorInputs['soil'])}
          />

          {/* Compost */}
          <div className="mb-5">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Compost Added?
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => update('compost', true)}
                className={`rounded-md border px-5 py-2 text-sm font-medium transition-colors ${
                  inputs.compost
                    ? 'border-[#2C5234] bg-[#2C5234] text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-[#44883E]'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => update('compost', false)}
                className={`rounded-md border px-5 py-2 text-sm font-medium transition-colors ${
                  !inputs.compost
                    ? 'border-[#2C5234] bg-[#2C5234] text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-[#44883E]'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Goal */}
          <SelectField
            id="ec-goal"
            label="Goal"
            options={GOAL_OPTIONS}
            value={inputs.goal}
            onChange={(v) => update('goal', v as CalculatorInputs['goal'])}
          />

          {/* Season */}
          <SelectField
            id="ec-season"
            label="Season"
            options={SEASON_OPTIONS}
            value={inputs.season}
            onChange={(v) => update('season', v as CalculatorInputs['season'])}
          />

          {/* Region */}
          <SelectField
            id="ec-region"
            label="Region"
            options={REGION_OPTIONS}
            value={inputs.region}
            onChange={(v) => update('region', v as CalculatorInputs['region'])}
          />

          {/* Method */}
          <SelectField
            id="ec-method"
            label="Application Method"
            options={METHOD_OPTIONS}
            value={inputs.method}
            onChange={(v) => update('method', v as CalculatorInputs['method'])}
          />
        </div>
      </div>

      {/* Results Panel */}
      <div className="lg:col-span-3">
        <div className="sticky top-6 space-y-6">
          {/* Custom Review Banner */}
          {result.confidence === 'custom-review' && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Custom Review Recommended
                  </p>
                  <p className="mt-1 text-sm text-amber-700">
                    Your site conditions fall outside our standard calculator scenarios. We recommend
                    talking to a specialist for a tailored recommendation.
                  </p>
                  <a
                    href="/contact/"
                    className="mt-2 inline-block text-sm font-semibold text-amber-800 underline decoration-amber-400 underline-offset-2 hover:text-amber-900"
                  >
                    Talk to a Specialist
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Main Results Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-heading text-xl uppercase text-[#2C5234]">
                  {result.mixName}
                </h3>
                <p className="mt-1 text-sm text-gray-600">{result.summary}</p>
              </div>
              {result.isHydroseedOverlay && (
                <span className="shrink-0 rounded-full bg-[#44883E]/10 px-3 py-1 text-xs font-semibold text-[#44883E]">
                  Hydroseed System
                </span>
              )}
            </div>

            {/* Species Breakdown */}
            <div className="mb-6">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Species Breakdown
              </h4>
              <div className="space-y-3">
                {result.speciesBreakdown.map((s) => (
                  <div key={s.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900">{s.name}</span>
                      <span className="text-gray-600">
                        {s.percentMin}–{s.percentMax}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#44883E]"
                        style={{ width: `${(s.percentMin + s.percentMax) / 2}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seed Total — Hero Number */}
            <div className="mb-6 rounded-lg bg-gray-50 p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Total Seed Needed
                  </p>
                  <p className="mt-1 text-3xl font-bold text-[#2C5234]">
                    {result.roundedTotalLbs} lb
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {formatWeight(result.ratePer1000)} per 1,000 sq ft
                  </p>
                  <p className="text-xs text-gray-500">
                    {inputs.area.toLocaleString()} sq ft total area
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Recommended calculator rate for this erosion-control scenario
              </p>
            </div>

            {/* Mulch Recommendation */}
            <div className="mb-4">
              <h4 className="mb-1 text-sm font-semibold text-gray-700">Mulch</h4>
              <p className="text-sm text-gray-600">{result.mulchRecommendation}</p>
            </div>

            {/* Blanket */}
            {result.blanketRequired && (
              <div className="mb-4 rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  Erosion Control Blanket Required
                </p>
                {result.blanketReason && (
                  <p className="mt-1 text-sm text-red-700">{result.blanketReason}</p>
                )}
              </div>
            )}
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-3">
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4"
                >
                  <p className="text-sm text-amber-800">{w}</p>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {result.notes.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Installation Notes
              </h4>
              <ul className="space-y-2">
                {result.notes.map((n, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#44883E]"
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
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Product Recommendations */}
          {result.productRecommendations.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Recommended Products
              </h4>
              <div className="space-y-3">
                {result.productRecommendations.map((p) => (
                  <div
                    key={p.slug}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                        {p.required && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-600">{p.reason}</p>
                    </div>
                    <a
                      href={`/products/${p.slug}/`}
                      className="shrink-0 rounded-md border border-[#44883E] px-3 py-1.5 text-xs font-semibold text-[#44883E] transition-colors hover:bg-[#44883E] hover:text-white"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="/contact/"
              className="inline-flex items-center justify-center rounded-md bg-[#2C5234] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
            >
              Request Custom Recommendation
            </a>
            <a
              href="tel:+18006083755"
              className="inline-flex items-center justify-center rounded-md border border-[#2C5234] px-6 py-3 text-sm font-semibold text-[#2C5234] transition-colors hover:bg-[#2C5234] hover:text-white"
            >
              Call 800-608-3755
            </a>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-gray-400">
            This tool provides planning guidance for common erosion-control scenarios.
            Unusual slopes, drainage paths, or regulatory requirements may need site-specific
            review.
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reusable Select Field
// ---------------------------------------------------------------------------

function SelectField({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string
  label: string
  options: { value: string; label: string; description?: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
