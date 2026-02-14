/**
 * ProductSelector - Product card for the case builder.
 * Shows product image, title, price, and +/- quantity controls.
 */

import type { Product, ProductVariant } from '@southland/shopify-storefront'

interface Props {
  product: Product
  quantity: number
  maxAdd: number
  onAdd: (variantId: string) => void
  onRemove: (variantId: string) => void
}

function getDefaultVariant(product: Product): ProductVariant | null {
  return product.variants.find((v) => v.availableForSale) ?? product.variants[0] ?? null
}

function formatPrice(amount: string): string {
  return `$${parseFloat(amount).toFixed(2)}`
}

export default function ProductSelector({
  product,
  quantity,
  maxAdd,
  onAdd,
  onRemove,
}: Props) {
  const variant = getDefaultVariant(product)
  if (!variant) return null

  const image = product.images[0] ?? variant.image
  const canAdd = maxAdd > 0 && variant.availableForSale
  const canRemove = quantity > 0

  return (
    <div
      className={`relative overflow-hidden rounded-lg border-2 transition-colors ${
        quantity > 0
          ? 'border-shopify-link bg-green-50/50'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Quantity badge */}
      {quantity > 0 && (
        <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-shopify-link text-xs font-bold text-white">
          {quantity}
        </div>
      )}

      {/* Product image */}
      <div className="aspect-square overflow-hidden bg-gray-100">
        {image ? (
          <img
            src={image.url}
            alt={image.altText ?? product.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            No image
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="p-3">
        <h3 className="text-sm font-medium leading-tight text-shopify-title">
          {product.title}
        </h3>
        <p className="mt-1 text-sm font-medium text-shopify-text">
          {formatPrice(variant.price.amount)}
        </p>

        {!variant.availableForSale && (
          <p className="mt-1 text-xs font-medium text-shopify-alert">
            Out of stock
          </p>
        )}

        {/* Quantity controls */}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRemove(variant.id)}
            disabled={!canRemove}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-shopify-text transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Remove ${product.title}`}
          >
            -
          </button>
          <span className="w-6 text-center text-sm font-medium text-shopify-text">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => onAdd(variant.id)}
            disabled={!canAdd}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-shopify-link bg-shopify-link text-white transition-colors hover:bg-shopify-accent-hover disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Add ${product.title}`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
