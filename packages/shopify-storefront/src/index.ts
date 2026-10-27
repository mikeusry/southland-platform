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

// Shop policies (privacy, terms, shipping, refund)
export {
  getShopPolicy,
  getShopPolicyUnauthenticated,
  policySlugToField,
  POLICY_SLUG_TO_FIELD,
} from './queries/policies'

// Cart operations
export {
  createCart,
  addToCart,
  updateCartLines,
  updateCartAttributes,
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
  ShopPolicy,
  ShopPolicyField,
} from './types'
