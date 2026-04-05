import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppRateResult, Segment, Unit } from '../../lib/appRateTypes'
import { PRODUCTS, SEGMENTS, getProductsBySegment } from '../../lib/appRateRules'
import { calculateResult, formatAmount, formatCoverage } from '../../lib/appRateUtils'
// Lazy import cart to avoid blocking hydration if storefront package has issues
const lazyAddToCart = async (
  lines: {
    merchandiseId: string
    quantity: number
    attributes?: { key: string; value: string }[]
  }[]
) => {
  const { addToCart } = await import('../../lib/cart')
  return addToCart(lines)
}
import {
  isBot,
  submitLead,
  trackAddToCartClicked,
  trackCalculatorPresetUsed,
  trackCalculatorProductSelected,
  trackCalculatorThresholdCrossed,
  trackCalculatorUnitSwitched,
  trackEmailSubmitted,
  trackResultViewed,
  trackToolCompleted,
  trackToolStarted,
} from '../../lib/leadCapture'

// =============================================================================
// CONSTANTS
// =============================================================================

const UNIT_LABELS: Record<Unit, string> = {
  sqft: 'sq ft',
  acres: 'Acres',
  houses: 'Houses',
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ApplicationRateCalculator() {
  const [segment, setSegment] = useState<Segment>('lawn')
  const [productHandle, setProductHandle] = useState('')
  const [useCaseId, setUseCaseId] = useState('')
  const [area, setArea] = useState<number>(0)
  const [unit, setUnit] = useState<Unit>('sqft')
  const [onHand, setOnHand] = useState<number>(0)
  const [showOnHand, setShowOnHand] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)
  const startTime = useRef(Date.now())
  const thresholdFired = useRef(false)

  const product = useMemo(() => PRODUCTS.find((p) => p.handle === productHandle), [productHandle])

  const result: AppRateResult | null = useMemo(() => {
    if (!product || !useCaseId || !area) return null
    return calculateResult(productHandle, useCaseId, area, unit, showOnHand ? onHand : 0)
  }, [product, productHandle, useCaseId, area, unit, onHand, showOnHand])

  useEffect(() => {
    trackToolStarted('application_rate_calculator')
  }, [])

  useEffect(() => {
    if (result && product) {
      trackToolCompleted(
        'application_rate_calculator',
        `${product.name}: ${formatAmount(result.application.totalNeeded, result.application.totalNeededUnit)} for ${formatCoverage(area, unit)}`,
        Math.round((Date.now() - startTime.current) / 1000)
      )
      trackResultViewed('application_rate_calculator', 'calculation', [product.handle])
    }
  }, [result, product, area, unit])

  useEffect(() => {
    if (result?.isCommercial && !thresholdFired.current) {
      thresholdFired.current = true
      trackCalculatorThresholdCrossed(
        result.purchase?.containers.reduce((s, c) => s + c.quantity, 0) ?? 0,
        result.purchase?.estimatedCost ?? 0
      )
    }
  }, [result])

  function handleSegmentChange(seg: Segment) {
    setSegment(seg)
    const products = getProductsBySegment(seg)
    if (products.length > 0) {
      handleProductChange(products[0].handle)
    } else {
      setProductHandle('')
      setUseCaseId('')
    }
  }

  function handleProductChange(handle: string) {
    setProductHandle(handle)
    trackCalculatorProductSelected(handle)
    const p = PRODUCTS.find((pr) => pr.handle === handle)
    if (p) {
      setUseCaseId(p.useCases[0]?.id ?? '')
      setUnit(p.defaultUnit)
      setArea(0)
      setOnHand(0)
      setShowOnHand(false)
      setActivePreset(null)
      setLeadSubmitted(false)
      setAddedToCart(false)
      thresholdFired.current = false
    }
  }

  function handlePreset(presetId: string) {
    if (!product) return
    const preset = product.presets.find((p) => p.id === presetId)
    if (!preset) return
    setArea(preset.area)
    setUnit(preset.unit)
    if (preset.useCase) setUseCaseId(preset.useCase)
    setOnHand(0)
    setShowOnHand(false)
    setActivePreset(presetId)
    trackCalculatorPresetUsed(preset.label)
  }

  function handleInputChange() {
    if (activePreset) setActivePreset(null)
  }

  function handleUnitSwitch(newUnit: Unit) {
    trackCalculatorUnitSwitched(unit, newUnit)
    setUnit(newUnit)
    handleInputChange()
  }

  async function handleAddToCart() {
    if (!result?.cartLines.length) return
    setAddingToCart(true)
    try {
      const lines = result.cartLines.map((l) => ({
        merchandiseId: l.variantGid,
        quantity: l.quantity,
        attributes: [{ key: 'Source', value: 'Application Calculator' }],
      }))
      await lazyAddToCart(lines)
      trackAddToCartClicked(
        'application_rate_calculator',
        productHandle,
        result.cartLines.reduce((s, l) => s + l.quantity, 0),
        result.purchase?.estimatedCost
      )
      setAddedToCart(true)
      setTimeout(() => setAddedToCart(false), 3000)
    } catch {
      // Silent
    } finally {
      setAddingToCart(false)
    }
  }

  const segmentProducts = getProductsBySegment(segment)

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
      {/* ─── INPUT PANEL ─── */}
      <div className="lg:col-span-2">
        <div className="space-y-6">
          {/* Segment Cards */}
          <div className="grid grid-cols-3 gap-3">
            {SEGMENTS.map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => handleSegmentChange(seg.id)}
                className={`rounded-lg border p-3 text-center transition-colors ${
                  segment === seg.id
                    ? 'border-[#2C5234] bg-[#2C5234] text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-[#44883E]'
                }`}
              >
                <p className="text-sm font-semibold">{seg.label}</p>
                <p
                  className={`mt-0.5 text-xs ${segment === seg.id ? 'text-green-100' : 'text-gray-400'}`}
                >
                  {getProductsBySegment(seg.id).length} products
                </p>
              </button>
            ))}
          </div>

          {/* Form Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-6 font-heading text-xl uppercase text-[#2C5234]">
              Calculate Your Rate
            </h3>

            {/* Product */}
            <div className="mb-5">
              <label
                htmlFor="arc-product"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                Product
              </label>
              <select
                id="arc-product"
                value={productHandle}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
              >
                {!productHandle && <option value="">Select a product...</option>}
                {segmentProducts.map((p) => (
                  <option key={p.handle} value={p.handle}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Use Case */}
            {product && product.useCases.length > 1 && (
              <div className="mb-5">
                <label
                  htmlFor="arc-usecase"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  Use Case
                </label>
                <select
                  id="arc-usecase"
                  value={useCaseId}
                  onChange={(e) => {
                    setUseCaseId(e.target.value)
                    handleInputChange()
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
                >
                  {product.useCases.map((uc) => (
                    <option key={uc.id} value={uc.id}>
                      {uc.label}
                    </option>
                  ))}
                </select>
                {product.useCases.find((uc) => uc.id === useCaseId)?.description && (
                  <p className="mt-1 text-xs text-gray-500">
                    {product.useCases.find((uc) => uc.id === useCaseId)?.description}
                  </p>
                )}
              </div>
            )}

            {/* Presets */}
            {product && product.presets.length > 0 && (
              <div className="mb-5">
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Quick Start
                </span>
                <div className="flex flex-wrap gap-2">
                  {product.presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePreset(preset.id)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        activePreset === preset.id
                          ? 'border-[#2C5234] bg-[#2C5234] text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-[#44883E] hover:bg-[#44883E]/5'
                      }`}
                      title={preset.description}
                    >
                      {preset.label}
                    </button>
                  ))}
                  {activePreset && (
                    <button
                      type="button"
                      onClick={() => {
                        setActivePreset(null)
                        setArea(0)
                      }}
                      className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      Custom
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Area Input */}
            {product && (
              <div className="mb-5">
                <label
                  htmlFor="arc-area"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  {product.defaultUnit === 'houses'
                    ? 'Number of Houses'
                    : product.handle === 'pour-the-port-septic-tank-treatment'
                      ? 'Number of Months'
                      : product.handle === 'torched-all-natural-weed-killer'
                        ? 'Gallons of Spray Mix'
                        : 'Area'}
                </label>
                <div className="flex gap-2">
                  <input
                    id="arc-area"
                    type="number"
                    min={0}
                    step={unit === 'acres' ? 0.25 : 1}
                    value={area || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setArea(isNaN(v) ? 0 : v)
                      handleInputChange()
                    }}
                    placeholder={
                      product.handle === 'pour-the-port-septic-tank-treatment'
                        ? 'e.g., 12'
                        : product.handle === 'torched-all-natural-weed-killer'
                          ? 'e.g., 3'
                          : `Enter ${UNIT_LABELS[unit].toLowerCase()}...`
                    }
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
                  />
                  {product.defaultUnit !== 'houses' &&
                    product.handle !== 'pour-the-port-septic-tank-treatment' &&
                    product.handle !== 'torched-all-natural-weed-killer' && (
                      <div className="flex rounded-md border border-gray-300">
                        {(['sqft', 'acres'] as const).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => handleUnitSwitch(u)}
                            className={`px-3 py-2 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                              unit === u
                                ? 'bg-[#2C5234] text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {UNIT_LABELS[u]}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
                {product.defaultUnit === 'sqft' &&
                  unit === 'sqft' &&
                  product.handle !== 'pour-the-port-septic-tank-treatment' &&
                  product.handle !== 'torched-all-natural-weed-killer' && (
                    <p className="mt-1 text-xs text-gray-400">
                      A 1/4 acre lawn is about 10,890 sq ft
                    </p>
                  )}
              </div>
            )}

            {/* On Hand */}
            {product && (
              <div className="mb-5">
                {!showOnHand ? (
                  <button
                    type="button"
                    onClick={() => setShowOnHand(true)}
                    className="text-xs font-medium text-[#44883E] hover:text-green-700"
                  >
                    I already have some on hand
                  </button>
                ) : (
                  <div>
                    <label
                      htmlFor="arc-onhand"
                      className="mb-1.5 block text-sm font-semibold text-gray-700"
                    >
                      Amount on Hand
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="arc-onhand"
                        type="number"
                        min={0}
                        value={onHand || ''}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                          setOnHand(isNaN(v) ? 0 : Math.max(0, v))
                          handleInputChange()
                        }}
                        placeholder="0"
                        className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
                      />
                      <span className="text-sm text-gray-500">
                        {product.rates[0]?.rateUnit ?? 'units'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOnHand(false)
                          setOnHand(0)
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Application Method */}
            {product && (
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-500">Application Method</p>
                <p className="mt-0.5 text-sm text-gray-700">{product.applicationMethod}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── RESULTS PANEL ─── */}
      <div className="lg:col-span-3">
        <div className="sticky top-6 space-y-6">
          {!product && (
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
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <p className="mt-3 text-sm font-medium text-gray-500">
                  Select a product to get started
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Choose your product, use case, and area to see exact quantities
                </p>
              </div>
            </div>
          )}

          {product && !result && (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12">
              <p className="text-sm font-medium text-gray-500">Enter your area to see results</p>
            </div>
          )}

          {/* Sufficient on hand */}
          {product && result?.sufficientOnHand && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-6 w-6 shrink-0 text-[#44883E]"
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
                <div>
                  <p className="font-heading text-lg uppercase text-[#2C5234]">
                    You Have Enough on Hand
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Your current supply covers this application. No purchase needed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Results */}
          {product && result && !result.sufficientOnHand && (
            <>
              {/* Results Card */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-1 flex items-start justify-between">
                  <h3 className="font-heading text-xl uppercase text-[#2C5234]">{product.name}</h3>
                  <span className="shrink-0 rounded-full bg-[#44883E]/10 px-3 py-1 text-xs font-semibold text-[#44883E]">
                    {result.application.scope === 'single_application' && 'One Application'}
                    {result.application.scope === 'first_2_applications' && 'First 2 Applications'}
                    {result.application.scope === 'full_flock' && 'Full Flock'}
                    {result.application.scope === 'annual_maintenance' && 'Annual Supply'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {product.useCases.find((uc) => uc.id === useCaseId)?.label}
                </p>

                {/* Hero */}
                <div className="mt-5 rounded-lg bg-gray-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    You Need
                  </p>
                  {result.purchase && (
                    <p className="mt-1 text-3xl font-bold text-[#2C5234]">
                      {result.purchase.containers
                        .map((c) => `${c.quantity} × ${c.label}`)
                        .join(' + ')}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-600">
                    {result.application.scopeExplanation}
                  </p>
                  {result.purchase && (
                    <div className="mt-3 flex items-baseline justify-between">
                      <p className="text-lg font-bold text-[#2C5234]">
                        ~${result.purchase.estimatedCost.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        estimated · pricing may vary at checkout
                      </p>
                    </div>
                  )}
                </div>

                {/* Rate */}
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Recommended rate:</span>{' '}
                    {result.application.rateLabel}
                    {result.application.rateSource === 'condition_adjusted' && (
                      <span className="ml-1 text-amber-600">(adjusted for conditions)</span>
                    )}
                  </p>
                  {result.application.rateRange && (
                    <p className="text-xs text-gray-500">{result.application.rateRange.label}</p>
                  )}
                </div>

                {/* Overage */}
                {result.purchase?.excessNote && (
                  <p className="mt-3 text-xs text-gray-500">{result.purchase.excessNote}</p>
                )}

                {/* Frequency */}
                {result.frequency && (
                  <div className="mt-4 flex items-start gap-3">
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
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Application Frequency</p>
                      <p className="text-sm text-gray-600">{result.frequency}</p>
                    </div>
                  </div>
                )}

                {/* Assumptions */}
                {result.application.assumptions.length > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">Assumptions</p>
                    <ul className="mt-1 space-y-0.5">
                      {result.application.assumptions.map((a, i) => (
                        <li key={i} className="text-xs text-amber-700">
                          • {a.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.confidenceNote && (
                  <p className="mt-3 text-xs text-amber-600">{result.confidenceNote}</p>
                )}

                {/* Calculation Steps */}
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-[#44883E] hover:text-green-700">
                    How we calculated this
                  </summary>
                  <div className="mt-2 space-y-1">
                    {result.application.calculationSteps.map((step, i) => (
                      <p key={i} className="text-sm text-gray-600">
                        {step}
                      </p>
                    ))}
                  </div>
                </details>

                {/* Alternative */}
                {result.purchase?.alternativeOption && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700">
                      Compare pack options
                    </summary>
                    <div className="mt-2 rounded-lg bg-gray-50 p-3">
                      <p className="text-sm text-gray-600">
                        Also available as:{' '}
                        {result.purchase.alternativeOption
                          .map((c) => `${c.quantity} × ${c.label}`)
                          .join(' + ')}{' '}
                        — $
                        {result.purchase.alternativeOption
                          .reduce((s, c) => s + c.subtotal, 0)
                          .toFixed(2)}
                      </p>
                    </div>
                  </details>
                )}
              </div>

              {/* CTA */}
              {result.buyingPath === 'consultation_required' && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">Specialist Recommended</p>
                    <p className="mt-1 text-sm text-amber-700">{result.buyingPathReason}</p>
                  </div>
                  <a
                    href={`/contact/?product=${encodeURIComponent(product.name)}&ref=calculator`}
                    className="inline-flex w-full items-center justify-center rounded-md bg-[#2C5234] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
                  >
                    Talk to a Specialist
                  </a>
                  <a
                    href="tel:+18006083755"
                    className="inline-flex w-full items-center justify-center rounded-md border border-[#2C5234] px-6 py-3 text-sm font-semibold text-[#2C5234] transition-colors hover:bg-[#2C5234] hover:text-white"
                  >
                    Call 800-608-3755
                  </a>
                </div>
              )}

              {result.buyingPath === 'rep_recommended' && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">Volume Pricing Available</p>
                    <p className="mt-1 text-sm text-amber-700">{result.buyingPathReason}</p>
                  </div>
                  <a
                    href={`/contact/?product=${encodeURIComponent(product.name)}&ref=calculator`}
                    className="inline-flex w-full items-center justify-center rounded-md bg-[#2C5234] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
                  >
                    Request Volume Pricing
                  </a>
                  {result.cartLines.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={addingToCart}
                      className="inline-flex w-full items-center justify-center rounded-md border border-[#2C5234] px-6 py-3 text-sm font-semibold text-[#2C5234] transition-colors hover:bg-[#2C5234] hover:text-white disabled:opacity-50"
                    >
                      {addedToCart
                        ? 'Added to Cart!'
                        : addingToCart
                          ? 'Adding...'
                          : 'Add to Cart Anyway'}
                    </button>
                  ) : (
                    <a
                      href={`/products/${product.handle}/`}
                      className="inline-flex w-full items-center justify-center rounded-md border border-[#2C5234] px-6 py-3 text-sm font-semibold text-[#2C5234] transition-colors hover:bg-[#2C5234] hover:text-white"
                    >
                      View Product
                    </a>
                  )}
                </div>
              )}

              {(result.buyingPath === 'direct' || result.buyingPath === 'direct_with_note') && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {result.cartLines.length > 0 ? (
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={addingToCart}
                        className="inline-flex flex-1 items-center justify-center rounded-md bg-[#2C5234] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:opacity-50"
                      >
                        {addedToCart
                          ? 'Added to Cart!'
                          : addingToCart
                            ? 'Adding...'
                            : 'Add to Cart'}
                      </button>
                    ) : (
                      <a
                        href={`/products/${product.handle}/`}
                        className="inline-flex flex-1 items-center justify-center rounded-md bg-[#2C5234] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
                      >
                        Buy {product.name}
                      </a>
                    )}
                    <a
                      href="/contact/"
                      className="inline-flex flex-1 items-center justify-center rounded-md border border-[#2C5234] px-6 py-3 text-sm font-semibold text-[#2C5234] transition-colors hover:bg-[#2C5234] hover:text-white"
                    >
                      Talk to a Specialist
                    </a>
                  </div>
                  {result.buyingPath === 'direct_with_note' && (
                    <p className="text-center text-xs text-gray-500">
                      {result.buyingPathReason}{' '}
                      <a href="/contact/" className="font-medium text-[#44883E] underline">
                        Talk to a specialist
                      </a>
                    </p>
                  )}
                </div>
              )}

              {/* Disclaimers */}
              {product.disclaimers.length > 0 && (
                <div className="space-y-1">
                  {product.disclaimers.map((d, i) => (
                    <p key={i} className="text-xs text-gray-400">
                      {d}
                    </p>
                  ))}
                </div>
              )}

              {/* Lead Capture */}
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
                      Application Plan Saved!
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
                      const firstName = (fd.get('first_name') as string) || null
                      const phone = (fd.get('phone') as string) || null

                      trackEmailSubmitted('application_rate_calculator', !!phone, !!firstName)

                      const useCaseLabel =
                        product.useCases.find((uc) => uc.id === useCaseId)?.label ?? ''
                      const containerSummary = result.purchase
                        ? result.purchase.containers
                            .map((c) => `${c.quantity} × ${c.label}`)
                            .join(' + ')
                        : 'none needed'

                      submitLead({
                        leadType: 'roi_calculator',
                        email,
                        firstName,
                        phone,
                        message: `Application Rate Calculator: ${product.name} (${useCaseLabel}). Area: ${formatCoverage(area, unit)}. Need: ${containerSummary} (~$${result.purchase?.estimatedCost.toFixed(2) ?? '0'}). Scope: ${result.application.scope}. Path: ${result.buyingPath}.`,
                      })
                    }}
                  >
                    <h4 className="font-heading text-lg uppercase text-[#2C5234]">
                      Save Your Application Plan
                    </h4>
                    <p className="mt-1 text-sm text-gray-600">
                      {result.isCommercial
                        ? 'A specialist will follow up within 1 business day.'
                        : 'Get your calculated rates + seasonal application timeline sent to your inbox.'}
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
                          htmlFor="arc-email"
                          className="mb-1 block text-sm font-semibold text-gray-700"
                        >
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="arc-email"
                          name="email"
                          type="email"
                          required
                          placeholder="you@example.com"
                          className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
                        />
                      </div>

                      {result.isCommercial && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label
                              htmlFor="arc-name"
                              className="mb-1 block text-sm font-semibold text-gray-700"
                            >
                              First Name
                            </label>
                            <input
                              id="arc-name"
                              name="first_name"
                              type="text"
                              placeholder="Optional"
                              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="arc-phone"
                              className="mb-1 block text-sm font-semibold text-gray-700"
                            >
                              Phone
                            </label>
                            <input
                              id="arc-phone"
                              name="phone"
                              type="tel"
                              placeholder="Optional"
                              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full rounded-md bg-[#44883E] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                      >
                        {result.isCommercial ? 'Request Follow-Up' : 'Send My Application Plan'}
                      </button>

                      <p className="text-center text-xs text-gray-400">
                        We may follow up with seasonal application reminders.
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}

          {/* Global disclaimer */}
          <p className="text-xs text-gray-400">
            This calculator provides planning guidance based on standard label rates. Actual
            application rates may vary based on site conditions, product formulation, and local
            regulations. Always refer to the product label for official rates.
          </p>
        </div>
      </div>
    </div>
  )
}
