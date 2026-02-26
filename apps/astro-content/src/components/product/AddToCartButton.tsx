/**
 * AddToCartButton — React island for PDP variant selection + add-to-cart.
 *
 * Renders variant selector (if multiple variants), quantity picker,
 * and add-to-cart button. Manages its own loading/success states.
 */

import { useState, useCallback } from 'react'
import type { ProductVariant, Money } from '@southland/shopify-storefront'
import { addToCart } from '../../lib/cart'

interface Props {
  variants: ProductVariant[]
}

function formatPrice(money: Money): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currencyCode || 'USD',
  }).format(Number(money.amount))
}

export default function AddToCartButton({ variants }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    variants.find((v) => v.availableForSale)?.id ?? variants[0]?.id ?? '',
  )
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedVariant = variants.find((v) => v.id === selectedVariantId)
  const isAvailable = selectedVariant?.availableForSale ?? false

  // Group variant options by name for selector UI
  const optionNames = Array.from(
    new Set(variants.flatMap((v) => v.selectedOptions.map((o) => o.name))),
  )
  const hasMultipleVariants = variants.length > 1

  const handleAddToCart = useCallback(async () => {
    if (!selectedVariant || !isAvailable) return
    setAdding(true)
    setError(null)

    try {
      await addToCart([
        {
          merchandiseId: selectedVariant.id,
          quantity,
          attributes: [{ key: 'Source', value: 'Product Page' }],
        },
      ])
      setAdded(true)
      setTimeout(() => setAdded(false), 3000)
    } catch (err) {
      console.error('Add to cart failed:', err)
      setError('Failed to add to cart. Please try again.')
    } finally {
      setAdding(false)
    }
  }, [selectedVariant, isAvailable, quantity])

  if (!selectedVariant) return null

  return (
    <div className="space-y-4">
      {/* Variant selector */}
      {hasMultipleVariants && (
        <div className="space-y-3">
          {optionNames.length === 1 ? (
            // Single option dimension — render as buttons
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {optionNames[0]}
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {variants.map((variant) => {
                  const optionValue = variant.selectedOptions.find(
                    (o) => o.name === optionNames[0],
                  )?.value
                  const isSelected = variant.id === selectedVariantId
                  const isDisabled = !variant.availableForSale

                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariantId(variant.id)
                        setAdded(false)
                      }}
                      disabled={isDisabled}
                      className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                        isSelected
                          ? 'border-brand-green-dark bg-brand-green-dark text-white'
                          : isDisabled
                            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 line-through'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-brand-green-light'
                      }`}
                    >
                      {optionValue ?? variant.title}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            // Multiple option dimensions — render as dropdown
            <div>
              <label
                htmlFor="variant-select"
                className="block text-sm font-medium text-gray-700"
              >
                Option
              </label>
              <select
                id="variant-select"
                value={selectedVariantId}
                onChange={(e) => {
                  setSelectedVariantId(e.target.value)
                  setAdded(false)
                }}
                className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-brand-green-light focus:ring-brand-green-light"
              >
                {variants.map((variant) => (
                  <option
                    key={variant.id}
                    value={variant.id}
                    disabled={!variant.availableForSale}
                  >
                    {variant.title}
                    {!variant.availableForSale ? ' — Sold Out' : ''}
                    {' — '}
                    {formatPrice(variant.price)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Price display */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">
          {formatPrice(selectedVariant.price)}
        </span>
        {selectedVariant.compareAtPrice &&
          Number(selectedVariant.compareAtPrice.amount) >
            Number(selectedVariant.price.amount) && (
            <span className="text-base text-gray-500 line-through">
              {formatPrice(selectedVariant.compareAtPrice)}
            </span>
          )}
      </div>

      {/* Quantity + Add to cart row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-md border border-gray-300">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-gray-600 transition-colors hover:bg-gray-50"
            aria-label="Decrease quantity"
          >
            -
          </button>
          <span className="min-w-[3rem] py-2 text-center text-sm font-medium">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="px-3 py-2 text-gray-600 transition-colors hover:bg-gray-50"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={adding || !isAvailable}
          className={`flex-1 rounded-md px-6 py-3 text-sm font-semibold text-white transition-colors ${
            added
              ? 'bg-green-600'
              : !isAvailable
                ? 'cursor-not-allowed bg-gray-400'
                : 'bg-brand-green-dark hover:bg-green-800'
          } disabled:opacity-60`}
        >
          {adding
            ? 'Adding...'
            : added
              ? 'Added to cart!'
              : !isAvailable
                ? 'Sold Out'
                : 'Add to Cart'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
