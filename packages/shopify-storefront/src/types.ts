/**
 * Storefront API response types for Southland Platform.
 *
 * These types represent the shapes returned by our GraphQL queries/mutations.
 * They are intentionally minimal — only the fields we actually query.
 */

// ─── Money ───────────────────────────────────────────────────────────────────

export interface Money {
  amount: string
  currencyCode: string
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface ProductImage {
  url: string
  altText: string | null
  width: number
  height: number
}

export interface VariantOption {
  name: string
  value: string
}

export interface ProductVariant {
  id: string
  title: string
  price: Money
  compareAtPrice: Money | null
  availableForSale: boolean
  image: ProductImage | null
  selectedOptions: VariantOption[]
}

export interface Product {
  id: string
  title: string
  handle: string
  description: string
  tags: string[]
  priceRange: {
    minVariantPrice: Money
  }
  images: ProductImage[]
  variants: ProductVariant[]
}

/**
 * Extended product type for Product Detail Pages.
 * Includes HTML description, all images, SEO metadata, and compareAtPrice.
 */
export interface ProductDetail extends Product {
  descriptionHtml: string
  vendor: string
  productType: string
  seo: {
    title: string | null
    description: string | null
  }
}

export interface Collection {
  title: string
  handle: string
  description: string
  products: Product[]
}

export interface CollectionSummary {
  id: string
  title: string
  handle: string
  description: string
  image: ProductImage | null
}

// ─── Cart ────────────────────────────────────────────────────────────────────

export interface CartLineAttribute {
  key: string
  value: string
}

export interface CartLineMerchandise {
  id: string
  title: string
  price: Money
  product: {
    title: string
    handle: string
    images: ProductImage[]
  }
}

export interface CartLine {
  id: string
  quantity: number
  attributes: CartLineAttribute[]
  merchandise: CartLineMerchandise
  cost: {
    totalAmount: Money
  }
}

export interface CartDiscountAllocation {
  discountedAmount: Money
}

export interface Cart {
  id: string
  checkoutUrl: string
  totalQuantity: number
  cost: {
    totalAmount: Money
    subtotalAmount: Money
  }
  lines: CartLine[]
  discountCodes: { code: string; applicable: boolean }[]
  discountAllocations: CartDiscountAllocation[]
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface CartLineInput {
  merchandiseId: string
  quantity: number
  attributes?: CartLineAttribute[]
}

export interface CartLineUpdateInput {
  id: string
  merchandiseId?: string
  quantity?: number
  attributes?: CartLineAttribute[]
}
