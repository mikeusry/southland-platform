/**
 * Cart State Management
 *
 * Client-side cart utilities for Storefront API integration.
 * Follows the same localStorage + cookie + CustomEvent pattern as persona.ts.
 *
 * Cart ID persists across page navigations. The actual cart lives on Shopify's
 * servers — we only store the ID locally.
 */

import {
  createClient,
  createCart as sfCreateCart,
  addToCart as sfAddToCart,
  getCart as sfGetCart,
  removeFromCart as sfRemoveFromCart,
  updateCartLines as sfUpdateCartLines,
} from '@southland/shopify-storefront'
import type {
  Cart,
  CartLineInput,
  CartLineUpdateInput,
  StorefrontClient,
} from '@southland/shopify-storefront'

// Re-export for convenience
export type { Cart, CartLineInput }

// ─── Storage ─────────────────────────────────────────────────────────────────

const CART_ID_KEY = 'southland_cart_id'
const CART_COOKIE_NAME = 'sl_cart'
const CART_COOKIE_DAYS = 14 // Shopify carts expire after ~10 days

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  const domain = window.location.hostname.replace(/^www\./, '')
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; domain=.${domain}; SameSite=Lax`
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop()!.split(';').shift()!)
  }
  return null
}

export function getCartId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CART_ID_KEY) ?? getCookie(CART_COOKIE_NAME)
}

export function setCartId(cartId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CART_ID_KEY, cartId)
  setCookie(CART_COOKIE_NAME, cartId, CART_COOKIE_DAYS)
}

export function clearCartId(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CART_ID_KEY)
  setCookie(CART_COOKIE_NAME, '', -1)
}

// ─── Events ──────────────────────────────────────────────────────────────────

function dispatchCartEvent(cart: Cart | null): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('cart-changed', { detail: cart }))
}

// ─── Client singleton per page lifecycle ─────────────────────────────────────

let _client: StorefrontClient | null = null

function getClient(): StorefrontClient {
  if (!_client) {
    _client = createClient()
  }
  return _client
}

// ─── Cart operations ─────────────────────────────────────────────────────────

/**
 * Get the current cart. Returns null if no cart exists or it has expired.
 */
export async function getCart(): Promise<Cart | null> {
  const cartId = getCartId()
  if (!cartId) return null

  const cart = await sfGetCart(getClient(), cartId)
  if (!cart) {
    // Cart expired or completed — clear the stored ID
    clearCartId()
    return null
  }

  return cart
}

/**
 * Add lines to cart. Creates a new cart if none exists.
 */
export async function addToCart(lines: CartLineInput[]): Promise<Cart> {
  const client = getClient()
  const cartId = getCartId()

  let cart: Cart

  if (cartId) {
    // Try adding to existing cart
    try {
      cart = await sfAddToCart(client, cartId, lines)
    } catch {
      // Cart may have expired — create a new one
      cart = await sfCreateCart(client, lines)
    }
  } else {
    cart = await sfCreateCart(client, lines)
  }

  setCartId(cart.id)
  dispatchCartEvent(cart)
  return cart
}

/**
 * Update existing cart lines (quantity changes, etc.)
 */
export async function updateCartLines(
  lines: CartLineUpdateInput[],
): Promise<Cart | null> {
  const cartId = getCartId()
  if (!cartId) return null

  const cart = await sfUpdateCartLines(getClient(), cartId, lines)
  dispatchCartEvent(cart)
  return cart
}

/**
 * Remove lines from cart by line ID.
 */
export async function removeFromCart(lineIds: string[]): Promise<Cart | null> {
  const cartId = getCartId()
  if (!cartId) return null

  const cart = await sfRemoveFromCart(getClient(), cartId, lineIds)
  dispatchCartEvent(cart)
  return cart
}

// ─── Bundle helpers ──────────────────────────────────────────────────────────

const CASE_SIZE = 4

/**
 * Build cart line inputs for a gallon case bundle.
 *
 * Takes a map of variantId → quantity (must total 4) and returns
 * CartLineInput[] with bundle attributes. Shopify will merge lines
 * with identical merchandiseId + attributes.
 */
export function buildCaseLines(
  selections: Map<string, number>,
  bundleId: string,
): CartLineInput[] {
  return Array.from(selections.entries()).map(([variantId, quantity]) => ({
    merchandiseId: variantId,
    quantity,
    attributes: [
      { key: '_bundle_id', value: bundleId },
      { key: '_bundle_type', value: 'gallon-case' },
      { key: 'Case Bundle', value: 'Gallon Case' },
    ],
  }))
}

/**
 * Generate a unique bundle ID for a new case.
 */
export function generateBundleId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `gallon-case-${ts}-${rand}`
}

/**
 * Count gallon items in a cart (items with _bundle_type = "gallon-case").
 */
export function countGallonItems(cart: Cart): number {
  return cart.lines
    .filter((line) =>
      line.attributes.some(
        (a) => a.key === '_bundle_type' && a.value === 'gallon-case',
      ),
    )
    .reduce((sum, line) => sum + line.quantity, 0)
}

/**
 * Get case completion nudge info.
 * Returns null if no nudge is needed (0 gallon items, or exactly on a case boundary).
 */
export function getCaseNudge(
  gallonCount: number,
): { needed: number; caseNumber: number } | null {
  if (gallonCount === 0) return null
  const remainder = gallonCount % CASE_SIZE
  if (remainder === 0) return null
  return {
    needed: CASE_SIZE - remainder,
    caseNumber: Math.floor(gallonCount / CASE_SIZE) + 1,
  }
}
