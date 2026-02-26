/**
 * CartPage — React island for the full cart experience.
 *
 * Fetches cart from Shopify on mount, displays line items with
 * quantity controls, remove buttons, and checkout redirect.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Cart, CartLine } from '@southland/shopify-storefront'
import {
  getCart,
  updateCartLines,
  removeFromCart,
} from '../../lib/cart'

const NEXUS_API = 'https://nexus.southlandorganics.com/api/public/shipping-estimate'

// ─── Shipping Estimate Types ────────────────────────────────────────────────

type Recommendation = 'proceed' | 'dealer_suggest' | 'dealer_redirect' | 'ltl_suggest'

interface NearbyDealer {
  name: string
  city: string
  state: string
  distance_miles: number
  phone: string | null
}

interface ShippingEstimate {
  estimate: {
    lowestRate: number
    carrier: string
    packages: number
    totalWeightLb: number
  } | null
  analysis: {
    shippingPctOfCart: number
    recommendation: Recommendation
    reason: string
  }
  nearbyDealers: NearbyDealer[]
}

function formatPrice(amount: string, currencyCode = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(Number(amount))
}

function CartLineItem({
  line,
  onUpdateQuantity,
  onRemove,
  updating,
}: {
  line: CartLine
  onUpdateQuantity: (lineId: string, quantity: number) => void
  onRemove: (lineId: string) => void
  updating: boolean
}) {
  const { merchandise } = line
  const image = merchandise.product.images[0] ?? null

  return (
    <div className="flex gap-4 border-b border-gray-200 py-6 last:border-b-0">
      {/* Product image */}
      <a
        href={`/products/${merchandise.product.handle}/`}
        className="flex-shrink-0"
      >
        {image ? (
          <img
            src={image.url}
            alt={image.altText || merchandise.product.title}
            width={96}
            height={96}
            loading="lazy"
            className="h-24 w-24 rounded-md border border-gray-200 object-contain"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-md bg-gray-100">
            <svg
              className="h-8 w-8 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </a>

      {/* Line details */}
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between">
          <div>
            <a
              href={`/products/${merchandise.product.handle}/`}
              className="text-sm font-semibold text-gray-900 hover:text-brand-green-dark"
            >
              {merchandise.product.title}
            </a>
            {merchandise.title !== 'Default Title' && (
              <p className="mt-0.5 text-sm text-gray-500">
                {merchandise.title}
              </p>
            )}
          </div>
          <span className="ml-4 text-sm font-semibold text-gray-900">
            {formatPrice(
              line.cost.totalAmount.amount,
              line.cost.totalAmount.currencyCode,
            )}
          </span>
        </div>

        {/* Bundle attribute */}
        {line.attributes.some((a) => a.key === 'Case Bundle') && (
          <span className="mt-1 inline-block rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            Gallon Case Bundle
          </span>
        )}

        {/* Quantity + remove */}
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center rounded-md border border-gray-300">
            <button
              type="button"
              onClick={() =>
                onUpdateQuantity(line.id, Math.max(1, line.quantity - 1))
              }
              disabled={updating || line.quantity <= 1}
              className="px-2.5 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              -
            </button>
            <span className="min-w-[2.5rem] py-1.5 text-center text-sm font-medium">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(line.id, line.quantity + 1)}
              disabled={updating}
              className="px-2.5 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={() => onRemove(line.id)}
            disabled={updating}
            className="text-sm text-gray-500 underline transition-colors hover:text-red-600 disabled:opacity-40"
          >
            Remove
          </button>

          {/* Per-unit price when qty > 1 */}
          {line.quantity > 1 && (
            <span className="text-xs text-gray-400">
              {formatPrice(
                merchandise.price.amount,
                merchandise.price.currencyCode,
              )}{' '}
              each
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  // Shipping estimate state
  const [zip, setZip] = useState('')
  const [shippingEstimate, setShippingEstimate] = useState<ShippingEstimate | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const lastEstimateZip = useRef<string>('')

  const fetchShippingEstimate = useCallback(
    async (zipCode: string, currentCart: Cart) => {
      if (!/^\d{5}$/.test(zipCode)) return
      if (zipCode === lastEstimateZip.current) return
      lastEstimateZip.current = zipCode
      setEstimateLoading(true)
      setEstimateError(null)

      try {
        const items = currentCart.lines.map((line) => ({
          sku: line.merchandise.product.handle,
          quantity: line.quantity,
          grams: 0,
        }))
        const cartSubtotal = Number(currentCart.cost.subtotalAmount.amount)

        const res = await fetch(NEXUS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, destinationZip: zipCode, cartSubtotal }),
        })

        if (!res.ok) {
          throw new Error(`Estimate failed (${res.status})`)
        }

        const data: ShippingEstimate = await res.json()
        setShippingEstimate(data)
      } catch (err) {
        console.error('Shipping estimate failed:', err)
        setEstimateError('Could not estimate shipping')
        setShippingEstimate(null)
      } finally {
        setEstimateLoading(false)
      }
    },
    [],
  )

  // Re-fetch estimate when cart changes (if ZIP is entered)
  useEffect(() => {
    if (cart && /^\d{5}$/.test(zip)) {
      lastEstimateZip.current = '' // force re-fetch
      fetchShippingEstimate(zip, cart)
    }
  }, [cart?.totalQuantity]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch cart on mount
  useEffect(() => {
    getCart()
      .then(setCart)
      .catch((err) => console.error('Failed to fetch cart:', err))
      .finally(() => setLoading(false))
  }, [])

  // Listen for external cart-changed events (e.g. from AddToCartButton on PDP)
  useEffect(() => {
    function handleCartChanged(e: Event) {
      const detail = (e as CustomEvent).detail as Cart | null
      if (detail) setCart(detail)
    }
    window.addEventListener('cart-changed', handleCartChanged)
    return () => window.removeEventListener('cart-changed', handleCartChanged)
  }, [])

  const handleUpdateQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      setUpdating(true)
      try {
        const updated = await updateCartLines([{ id: lineId, quantity }])
        if (updated) setCart(updated)
      } catch (err) {
        console.error('Failed to update quantity:', err)
      } finally {
        setUpdating(false)
      }
    },
    [],
  )

  const handleRemove = useCallback(async (lineId: string) => {
    setUpdating(true)
    try {
      const updated = await removeFromCart([lineId])
      setCart(updated)
    } catch (err) {
      console.error('Failed to remove item:', err)
    } finally {
      setUpdating(false)
    }
  }, [])

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-green-dark" />
          <p className="mt-3 text-sm text-gray-500">Loading your cart...</p>
        </div>
      </div>
    )
  }

  // ─── Empty cart ─────────────────────────────────────────────────────────────

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <svg
          className="mx-auto h-16 w-16 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
          />
        </svg>
        <h2 className="mt-4 font-heading text-xl text-gray-900">
          Your cart is empty
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Browse our products and add something you love.
        </p>
        <a
          href="/products/"
          className="mt-6 inline-block rounded-md bg-brand-green-dark px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
        >
          Browse Products
        </a>
      </div>
    )
  }

  // ─── Cart with items ────────────────────────────────────────────────────────

  const hasDiscount =
    cart.discountAllocations.length > 0 &&
    Number(cart.discountAllocations[0].discountedAmount.amount) > 0

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Line items */}
      <div className="lg:col-span-2">
        <div className="divide-y-0">
          {cart.lines.map((line) => (
            <CartLineItem
              key={line.id}
              line={line}
              onUpdateQuantity={handleUpdateQuantity}
              onRemove={handleRemove}
              updating={updating}
            />
          ))}
        </div>
      </div>

      {/* Order summary */}
      <div className="lg:col-span-1">
        <div className="sticky top-6 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h2 className="font-heading text-lg text-gray-900">Order Summary</h2>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">
                Subtotal ({cart.totalQuantity}{' '}
                {cart.totalQuantity === 1 ? 'item' : 'items'})
              </dt>
              <dd className="font-medium text-gray-900">
                {formatPrice(
                  cart.cost.subtotalAmount.amount,
                  cart.cost.subtotalAmount.currencyCode,
                )}
              </dd>
            </div>

            {/* Discounts */}
            {hasDiscount && (
              <div className="flex justify-between text-green-700">
                <dt>
                  Discount
                  {cart.discountCodes.length > 0 && (
                    <span className="ml-1 text-xs">
                      ({cart.discountCodes[0].code})
                    </span>
                  )}
                </dt>
                <dd className="font-medium">
                  -
                  {formatPrice(
                    cart.discountAllocations[0].discountedAmount.amount,
                    cart.discountAllocations[0].discountedAmount.currencyCode,
                  )}
                </dd>
              </div>
            )}

            {/* Shipping estimate — only show for heavy carts (4+ items ≈ 100+ lbs) */}
            {cart.totalQuantity >= 4 ? (
              <div className="space-y-2">
                <div className="flex justify-between text-gray-500">
                  <dt>Shipping</dt>
                  <dd className="text-right">
                    {estimateLoading ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-brand-green-dark" />
                        Estimating...
                      </span>
                    ) : shippingEstimate?.estimate ? (
                      <span className="font-medium text-gray-900">
                        ~{formatPrice(String(shippingEstimate.estimate.lowestRate))}
                      </span>
                    ) : estimateError ? (
                      <span className="text-xs text-red-500">Unavailable</span>
                    ) : (
                      <span className="text-xs">Enter ZIP below</span>
                    )}
                  </dd>
                </div>

                {/* ZIP input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (cart) fetchShippingEstimate(zip, cart)
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="ZIP code"
                    value={zip}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 5)
                      setZip(v)
                      if (v.length === 5 && cart) fetchShippingEstimate(v, cart)
                    }}
                    className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-green-light focus:outline-none focus:ring-1 focus:ring-brand-green-light"
                  />
                  <button
                    type="submit"
                    disabled={zip.length !== 5 || estimateLoading}
                    className="whitespace-nowrap rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-40"
                  >
                    Estimate
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex justify-between text-gray-500">
                <dt>Shipping</dt>
                <dd>Calculated at checkout</dd>
              </div>
            )}

            {/* Recommendation banner */}
            {shippingEstimate && shippingEstimate.analysis.recommendation !== 'proceed' && (
              <div
                className={`rounded-md p-3 text-sm ${
                  shippingEstimate.analysis.recommendation === 'dealer_redirect'
                    ? 'bg-amber-50 text-amber-800'
                    : shippingEstimate.analysis.recommendation === 'ltl_suggest'
                      ? 'bg-blue-50 text-blue-800'
                      : 'bg-green-50 text-green-800'
                }`}
              >
                <p className="font-medium">
                  {shippingEstimate.analysis.recommendation === 'ltl_suggest'
                    ? 'Large order — freight shipping recommended'
                    : shippingEstimate.analysis.recommendation === 'dealer_redirect'
                      ? 'Save on shipping — pick up locally!'
                      : 'Local pickup available nearby'}
                </p>
                <p className="mt-1 text-xs opacity-80">{shippingEstimate.analysis.reason}</p>

                {/* Nearby dealers */}
                {shippingEstimate.nearbyDealers.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {shippingEstimate.nearbyDealers.map((dealer) => (
                      <li key={dealer.name} className="text-xs">
                        <span className="font-medium">{dealer.name}</span>
                        {' — '}
                        {dealer.city}, {dealer.state}
                        {' '}({dealer.distance_miles} mi)
                        {dealer.phone && (
                          <a
                            href={`tel:${dealer.phone}`}
                            className="ml-1 underline"
                          >
                            {dealer.phone}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <a
                  href="/store-locator/"
                  className="mt-2 inline-block text-xs font-medium underline"
                >
                  Find all dealers
                </a>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between">
                <dt className="text-base font-semibold text-gray-900">Total</dt>
                <dd className="text-base font-semibold text-gray-900">
                  {formatPrice(
                    cart.cost.totalAmount.amount,
                    cart.cost.totalAmount.currencyCode,
                  )}
                </dd>
              </div>
            </div>
          </dl>

          {/* Checkout button */}
          <a
            href={cart.checkoutUrl}
            className="mt-6 block w-full rounded-md bg-brand-green-dark px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-green-800"
          >
            Proceed to Checkout
          </a>

          {/* Continue shopping */}
          <a
            href="/products/"
            className="mt-3 block text-center text-sm text-brand-green-light hover:underline"
          >
            Continue Shopping
          </a>
        </div>
      </div>
    </div>
  )
}
