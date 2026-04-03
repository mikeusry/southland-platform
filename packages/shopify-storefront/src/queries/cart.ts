import type { StorefrontClient } from '../client'
import type {
  Cart,
  CartLine,
  CartLineAttribute,
  CartLineInput,
  CartLineMerchandise,
  CartLineUpdateInput,
  Money,
  ProductImage,
} from '../types'

// ─── Fragments ───────────────────────────────────────────────────────────────

const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      totalAmount { amount currencyCode }
      subtotalAmount { amount currencyCode }
    }
    lines(first: 100) {
      edges {
        node {
          id
          quantity
          attributes { key value }
          merchandise {
            ... on ProductVariant {
              id
              title
              price { amount currencyCode }
              product {
                title
                handle
                images(first: 1) {
                  edges { node { url altText width height } }
                }
              }
            }
          }
          cost {
            totalAmount { amount currencyCode }
          }
        }
      }
    }
    discountCodes { code applicable }
    discountAllocations {
      discountedAmount { amount currencyCode }
    }
  }
`

// ─── Mutations ───────────────────────────────────────────────────────────────

const CREATE_CART_MUTATION = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
  ${CART_FRAGMENT}
`

const ADD_TO_CART_MUTATION = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
  ${CART_FRAGMENT}
`

const UPDATE_CART_LINES_MUTATION = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
  ${CART_FRAGMENT}
`

const REMOVE_FROM_CART_MUTATION = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
  ${CART_FRAGMENT}
`

const GET_CART_QUERY = `
  query GetCart($cartId: ID!) {
    cart(id: $cartId) { ...CartFields }
  }
  ${CART_FRAGMENT}
`

// ─── Response parsing ────────────────────────────────────────────────────────

function parseImage(node: Record<string, unknown>): ProductImage {
  return {
    url: node.url as string,
    altText: (node.altText as string) ?? null,
    width: node.width as number,
    height: node.height as number,
  }
}

function parseCartLine(node: Record<string, unknown>): CartLine {
  const merch = node.merchandise as Record<string, unknown>
  const product = merch.product as Record<string, unknown>
  const images = product.images as { edges: { node: Record<string, unknown> }[] }

  return {
    id: node.id as string,
    quantity: node.quantity as number,
    attributes: node.attributes as CartLineAttribute[],
    merchandise: {
      id: merch.id as string,
      title: merch.title as string,
      price: merch.price as Money,
      product: {
        title: product.title as string,
        handle: product.handle as string,
        images: images.edges.map((e) => parseImage(e.node)),
      },
    } as CartLineMerchandise,
    cost: node.cost as { totalAmount: Money },
  }
}

function parseCart(raw: Record<string, unknown>): Cart {
  const lines = raw.lines as { edges: { node: Record<string, unknown> }[] }

  return {
    id: raw.id as string,
    checkoutUrl: raw.checkoutUrl as string,
    totalQuantity: raw.totalQuantity as number,
    cost: raw.cost as Cart['cost'],
    lines: lines.edges.map((e) => parseCartLine(e.node)),
    discountCodes: raw.discountCodes as Cart['discountCodes'],
    discountAllocations: raw.discountAllocations as Cart['discountAllocations'],
  }
}

// ─── Error handling ──────────────────────────────────────────────────────────

interface UserError {
  field: string[]
  message: string
}

function checkUserErrors(operation: string, userErrors: UserError[] | undefined): void {
  if (userErrors?.length) {
    const msg = userErrors.map((e) => e.message).join(', ')
    console.error(`[shopify-storefront] ${operation} user errors:`, msg)
    throw new Error(`${operation} failed: ${msg}`)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new cart, optionally with initial line items.
 */
export async function createCart(
  client: StorefrontClient,
  lines?: CartLineInput[],
  attributes?: CartLineAttribute[]
): Promise<Cart> {
  const input: Record<string, unknown> = {}
  if (lines) input.lines = lines
  if (attributes) input.attributes = attributes

  const { data, errors } = await client.request(CREATE_CART_MUTATION, {
    variables: { input },
  })

  if (errors) {
    console.error('[shopify-storefront] createCart errors:', errors)
    throw new Error('Failed to create cart')
  }

  checkUserErrors('createCart', data.cartCreate.userErrors)
  return parseCart(data.cartCreate.cart)
}

/**
 * Add line items to an existing cart.
 */
export async function addToCart(
  client: StorefrontClient,
  cartId: string,
  lines: CartLineInput[]
): Promise<Cart> {
  const { data, errors } = await client.request(ADD_TO_CART_MUTATION, {
    variables: { cartId, lines },
  })

  if (errors) {
    console.error('[shopify-storefront] addToCart errors:', errors)
    throw new Error('Failed to add to cart')
  }

  checkUserErrors('addToCart', data.cartLinesAdd.userErrors)
  return parseCart(data.cartLinesAdd.cart)
}

/**
 * Update existing line items (quantity, attributes).
 */
export async function updateCartLines(
  client: StorefrontClient,
  cartId: string,
  lines: CartLineUpdateInput[]
): Promise<Cart> {
  const { data, errors } = await client.request(UPDATE_CART_LINES_MUTATION, {
    variables: { cartId, lines },
  })

  if (errors) {
    console.error('[shopify-storefront] updateCartLines errors:', errors)
    throw new Error('Failed to update cart lines')
  }

  checkUserErrors('updateCartLines', data.cartLinesUpdate.userErrors)
  return parseCart(data.cartLinesUpdate.cart)
}

/**
 * Remove line items from cart by line ID.
 */
export async function removeFromCart(
  client: StorefrontClient,
  cartId: string,
  lineIds: string[]
): Promise<Cart> {
  const { data, errors } = await client.request(REMOVE_FROM_CART_MUTATION, {
    variables: { cartId, lineIds },
  })

  if (errors) {
    console.error('[shopify-storefront] removeFromCart errors:', errors)
    throw new Error('Failed to remove from cart')
  }

  checkUserErrors('removeFromCart', data.cartLinesRemove.userErrors)
  return parseCart(data.cartLinesRemove.cart)
}

/**
 * Fetch an existing cart by ID.
 * Returns null if the cart no longer exists (expired, completed checkout, etc.)
 */
export async function getCart(client: StorefrontClient, cartId: string): Promise<Cart | null> {
  const { data, errors } = await client.request(GET_CART_QUERY, {
    variables: { cartId },
  })

  if (errors) {
    console.error('[shopify-storefront] getCart errors:', errors)
    return null
  }

  return data?.cart ? parseCart(data.cart) : null
}
