/**
 * E-commerce Event Tracking
 *
 * Pushes standard GA4 e-commerce events to dataLayer (consumed by GTM),
 * mirrors to point.dog pixel for CDP attribution, and fires Meta Pixel
 * standard events (ViewContent, AddToCart, InitiateCheckout) for ROAS.
 *
 * Event reference: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 */

// ─── Types ──────────────────────────────────────────────────────────────────

interface GA4Item {
  item_id: string
  item_name: string
  item_brand?: string
  item_category?: string
  item_variant?: string
  price?: number
  quantity?: number
  currency?: string
}

interface ProductData {
  id: string
  handle: string
  title: string
  vendor?: string
  productType?: string
  variants: Array<{
    id: string
    title: string
    price: { amount: string; currencyCode?: string }
    availableForSale?: boolean
  }>
  priceRange?: {
    minVariantPrice: { amount: string; currencyCode?: string }
  }
}

interface CartLineData {
  id: string
  quantity: number
  cost: {
    totalAmount: { amount: string; currencyCode?: string }
  }
  merchandise: {
    id: string
    title: string
    price: { amount: string; currencyCode?: string }
    product: {
      handle: string
      title: string
      vendor?: string // Not available on CartLineMerchandise from Storefront API
      productType?: string // Not available on CartLineMerchandise from Storefront API
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pushToDataLayer(event: string, data: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  // Clear previous ecommerce data to prevent contamination
  window.dataLayer.push({ ecommerce: null })
  window.dataLayer.push({ event, ecommerce: data })
}

function pushToMeta(event: string, data: Record<string, unknown>): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  window.fbq('track', event, data)
}

function pushToPixel(event: string, data: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.pdPixel) return
  // Include persona if set (from DecisionEngine → localStorage)
  let persona: string | undefined
  try {
    const raw = localStorage.getItem('southland_persona')
    if (raw) {
      const p = JSON.parse(raw)
      if (p?.id) persona = p.id
    }
  } catch (_err) {
    /* localStorage may be unavailable */
  }
  window.pdPixel.track(event, {
    content_type: 'ecommerce',
    ...(persona ? { persona } : {}),
    ...data,
  })
}

function buildItem(
  product: ProductData,
  variant?: ProductData['variants'][number],
  quantity = 1
): GA4Item {
  const v = variant || product.variants[0]
  return {
    item_id: product.handle,
    item_name: product.title,
    item_brand: product.vendor || 'Southland Organics',
    item_category: product.productType || undefined,
    item_variant: v?.title !== 'Default Title' ? v?.title : undefined,
    price: v ? parseFloat(v.price.amount) : undefined,
    quantity,
    currency: v?.price.currencyCode || 'USD',
  }
}

function cartLineToItem(line: CartLineData): GA4Item {
  return {
    item_id: line.merchandise.product.handle,
    item_name: line.merchandise.product.title,
    item_brand: line.merchandise.product.vendor || 'Southland Organics',
    item_category: line.merchandise.product.productType || undefined,
    item_variant: line.merchandise.title !== 'Default Title' ? line.merchandise.title : undefined,
    price: parseFloat(line.merchandise.price.amount),
    quantity: line.quantity,
    currency: line.merchandise.price.currencyCode || 'USD',
  }
}

// ─── Events ─────────────────────────────────────────────────────────────────

/**
 * view_item — fired when a user views a product detail page
 */
export function trackViewItem(product: ProductData, variantIndex = 0): void {
  const variant = product.variants[variantIndex]
  const item = buildItem(product, variant)
  const value = parseFloat(variant?.price.amount || '0')
  const currency = variant?.price.currencyCode || 'USD'

  pushToDataLayer('view_item', { currency, value, items: [item] })
  pushToPixel('view_item', { currency, value, items: [item] })
  pushToMeta('ViewContent', {
    content_ids: [product.handle],
    content_name: product.title,
    content_type: 'product',
    value,
    currency,
  })
}

/**
 * view_item_list — fired when a user views a collection / product list
 */
export function trackViewItemList(listId: string, listName: string, products: ProductData[]): void {
  const items = products.map((product, index) => ({
    ...buildItem(product),
    index,
    item_list_id: listId,
    item_list_name: listName,
  }))

  pushToDataLayer('view_item_list', { item_list_id: listId, item_list_name: listName, items })
  pushToPixel('view_item_list', {
    item_list_id: listId,
    item_list_name: listName,
    item_count: items.length,
  })
}

/**
 * add_to_cart — fired when a user adds an item to cart
 */
export function trackAddToCart(
  product: ProductData,
  variant: ProductData['variants'][number],
  quantity: number
): void {
  const item = buildItem(product, variant, quantity)
  const value = parseFloat(variant.price.amount) * quantity
  const currency = variant.price.currencyCode || 'USD'

  pushToDataLayer('add_to_cart', { currency, value, items: [item] })
  pushToPixel('add_to_cart', { currency, value, items: [item] })
  pushToMeta('AddToCart', {
    content_ids: [product.handle],
    content_name: product.title,
    content_type: 'product',
    value,
    currency,
  })
}

/**
 * remove_from_cart — fired when a user removes an item from cart
 */
export function trackRemoveFromCart(line: CartLineData): void {
  const item = cartLineToItem(line)
  const value = parseFloat(line.cost.totalAmount.amount)
  const currency = line.cost.totalAmount.currencyCode || 'USD'

  pushToDataLayer('remove_from_cart', { currency, value, items: [item] })
  pushToPixel('remove_from_cart', { currency, value, items: [item] })
}

/**
 * view_cart — fired when a user views the cart page
 */
export function trackViewCart(lines: CartLineData[], totalAmount: string, currency = 'USD'): void {
  const items = lines.map(cartLineToItem)
  const value = parseFloat(totalAmount)

  pushToDataLayer('view_cart', { currency, value, items })
  pushToPixel('view_cart', { currency, value, item_count: items.length })
}

/**
 * begin_checkout — fired when a user clicks "Proceed to Checkout"
 */
export function trackBeginCheckout(
  lines: CartLineData[],
  totalAmount: string,
  currency = 'USD'
): void {
  const items = lines.map(cartLineToItem)
  const value = parseFloat(totalAmount)

  pushToDataLayer('begin_checkout', { currency, value, items })
  pushToPixel('begin_checkout', { currency, value, item_count: items.length })
  pushToMeta('InitiateCheckout', {
    content_ids: items.map((i) => i.item_id),
    num_items: items.length,
    value,
    currency,
  })
}
