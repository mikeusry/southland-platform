export { createClient } from './client'
export type { StorefrontClient } from './client'

// Product / collection queries
export {
  getCollectionProducts,
  getAllCollections,
  getAllProducts,
  getGallonProducts,
  getProductByHandle,
  searchProducts,
} from './queries/products'

// Cart operations
export {
  createCart,
  addToCart,
  updateCartLines,
  removeFromCart,
  applyDiscountCode,
  getCart,
} from './queries/cart'

// Types
export type {
  Money,
  Product,
  ProductDetail,
  ProductImage,
  ProductVariant,
  SellingPlanAllocation,
  VariantOption,
  Collection,
  CollectionSummary,
  Cart,
  CartLine,
  CartLineAttribute,
  CartLineMerchandise,
  CartLineInput,
  CartLineUpdateInput,
  CartDiscountAllocation,
} from './types'
