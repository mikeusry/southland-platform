/**
 * CaseBuilder - Main React island for the Mix & Match Gallon Case builder.
 *
 * Fetches gallon products from Shopify Storefront API, lets customers
 * pick any 4 gallon products, and adds them to the cart as a bundle.
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient, getGallonProducts } from '@southland/shopify-storefront'
import type { Product } from '@southland/shopify-storefront'
import { addToCart, buildCaseLines, generateBundleId } from '../../lib/cart'
import { getPersonaId } from '../../lib/persona'
import CaseProgress from './CaseProgress'
import ProductSelector from './ProductSelector'
import SavingsDisplay from './SavingsDisplay'

const CASE_SIZE = 4
const DISCOUNT_PERCENT = 10 // Must match the Shopify Automatic Discount

// Persona-aware product sort: prioritize products by persona
const PERSONA_SORT_PRIORITY: Record<string, string[]> = {
  backyard: ['hen-helper', 'big-ole-bird', 'chicken-e-lixir'],
  commercial: ['big-ole-bird', 'litter-life', 'catalyst'],
  lawn: ['genesis', 'humic-acid', 'fulvic-acid'],
}

function sortByPersona(products: Product[], persona: string | null): Product[] {
  const priority = persona ? PERSONA_SORT_PRIORITY[persona] ?? [] : []
  if (priority.length === 0) return products

  return [...products].sort((a, b) => {
    const aIdx = priority.indexOf(a.handle)
    const bIdx = priority.indexOf(b.handle)
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
    if (aIdx !== -1) return -1
    if (bIdx !== -1) return 1
    return 0
  })
}

function getVariantPrice(product: Product): number {
  const variant = product.variants.find((v) => v.availableForSale) ?? product.variants[0]
  return variant ? parseFloat(variant.price.amount) : 0
}

type Selections = Map<string, { product: Product; quantity: number }>

export default function CaseBuilder() {
  const [products, setProducts] = useState<Product[]>([])
  const [selections, setSelections] = useState<Selections>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingToCart, setAddingToCart] = useState(false)
  const [added, setAdded] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)

  // Fetch gallon products on mount
  useEffect(() => {
    async function fetchProducts() {
      try {
        const client = createClient()
        const gallonProducts = await getGallonProducts(client)
        const persona = getPersonaId()
        setProducts(sortByPersona(gallonProducts, persona))
      } catch (err) {
        console.error('Failed to fetch gallon products:', err)
        setError('Unable to load products. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  // Calculate totals
  const totalSelected = Array.from(selections.values()).reduce(
    (sum, s) => sum + s.quantity,
    0,
  )
  const remainingSlots = CASE_SIZE - totalSelected
  const subtotal = Array.from(selections.values()).reduce(
    (sum, s) => sum + getVariantPrice(s.product) * s.quantity,
    0,
  )

  const handleAdd = useCallback(
    (variantId: string, product: Product) => {
      if (totalSelected >= CASE_SIZE) return
      setSelections((prev) => {
        const next = new Map(prev)
        const existing = next.get(variantId)
        if (existing) {
          next.set(variantId, { ...existing, quantity: existing.quantity + 1 })
        } else {
          next.set(variantId, { product, quantity: 1 })
        }
        return next
      })
      setAdded(false)
    },
    [totalSelected],
  )

  const handleRemove = useCallback((variantId: string) => {
    setSelections((prev) => {
      const next = new Map(prev)
      const existing = next.get(variantId)
      if (!existing) return prev
      if (existing.quantity <= 1) {
        next.delete(variantId)
      } else {
        next.set(variantId, { ...existing, quantity: existing.quantity - 1 })
      }
      return next
    })
    setAdded(false)
  }, [])

  const handleAddToCart = useCallback(async () => {
    if (totalSelected !== CASE_SIZE) return
    setAddingToCart(true)

    try {
      const bundleId = generateBundleId()
      const variantQuantities = new Map<string, number>()
      for (const [variantId, sel] of selections) {
        variantQuantities.set(variantId, sel.quantity)
      }
      const lines = buildCaseLines(variantQuantities, bundleId)
      const cart = await addToCart(lines)
      setCheckoutUrl(cart.checkoutUrl)
      setAdded(true)
    } catch (err) {
      console.error('Failed to add case to cart:', err)
      setError('Failed to add to cart. Please try again.')
    } finally {
      setAddingToCart(false)
    }
  }, [selections, totalSelected])

  const handleReset = useCallback(() => {
    setSelections(new Map())
    setAdded(false)
    setCheckoutUrl(null)
  }, [])

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-shopify-link" />
          <p className="mt-3 text-sm text-brand-gray-dark">
            Loading gallon products...
          </p>
        </div>
      </div>
    )
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  if (error && products.length === 0) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 text-sm font-medium text-shopify-link underline"
        >
          Reload page
        </button>
      </div>
    )
  }

  // ─── Empty state ───────────────────────────────────────────────────────────

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-sm text-brand-gray-dark">
          No gallon products are currently available.
        </p>
      </div>
    )
  }

  // ─── Added confirmation ────────────────────────────────────────────────────

  if (added && checkoutUrl) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border-2 border-shopify-link bg-green-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-shopify-link text-white">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-4 font-heading text-xl text-shopify-title">
          Case added to cart!
        </h2>
        <p className="mt-2 text-sm text-brand-gray-dark">
          Your {CASE_SIZE}-gallon case has been added with the case discount.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={checkoutUrl}
            className="inline-block rounded-md bg-shopify-link px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-shopify-accent-hover"
          >
            Go to checkout
          </a>
          <button
            type="button"
            onClick={handleReset}
            className="inline-block rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-shopify-text transition-colors hover:bg-gray-50"
          >
            Build another case
          </button>
        </div>
      </div>
    )
  }

  // ─── Main builder ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Progress + savings row */}
      <div className="sticky top-0 z-20 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <CaseProgress filled={totalSelected} total={CASE_SIZE} />
        <div className="mt-4">
          <SavingsDisplay
            subtotal={subtotal}
            discountPercent={DISCOUNT_PERCENT}
            filled={totalSelected}
            total={CASE_SIZE}
          />
        </div>
        {totalSelected === CASE_SIZE && (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={addingToCart}
            className="mt-4 w-full rounded-md bg-shopify-link px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-shopify-accent-hover disabled:opacity-50"
          >
            {addingToCart ? 'Adding to cart...' : 'Add case to cart'}
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => {
          const variant = product.variants.find((v) => v.availableForSale) ?? product.variants[0]
          if (!variant) return null
          const sel = selections.get(variant.id)
          return (
            <ProductSelector
              key={product.id}
              product={product}
              quantity={sel?.quantity ?? 0}
              maxAdd={remainingSlots}
              onAdd={(variantId) => handleAdd(variantId, product)}
              onRemove={handleRemove}
            />
          )
        })}
      </div>
    </div>
  )
}
