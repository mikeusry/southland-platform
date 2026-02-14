export { createClient } from './client'
export type { StorefrontClient } from './client'

// Product / collection queries
export { getCollectionProducts, getGallonProducts } from './queries/products'

// Cart operations
export {
  createCart,
  addToCart,
  updateCartLines,
  removeFromCart,
  getCart,
} from './queries/cart'

// Types
export type {
  Money,
  Product,
  ProductImage,
  ProductVariant,
  Collection,
  Cart,
  CartLine,
  CartLineAttribute,
  CartLineMerchandise,
  CartLineInput,
  CartLineUpdateInput,
  CartDiscountAllocation,
} from './types'
