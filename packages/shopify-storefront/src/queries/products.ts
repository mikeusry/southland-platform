import type { StorefrontClient } from '../client'
import type {
  Collection,
  CollectionSummary,
  Product,
  ProductDetail,
  ProductImage,
  ProductVariant,
} from '../types'

// ─── GraphQL fragments ──────────────────────────────────────────────────────

const PRODUCT_VARIANT_FIELDS = `
  id
  title
  price { amount currencyCode }
  compareAtPrice { amount currencyCode }
  availableForSale
  image { url altText width height }
  selectedOptions { name value }
`

const PRODUCT_FIELDS = `
  id
  title
  handle
  description
  tags
  priceRange {
    minVariantPrice { amount currencyCode }
  }
  images(first: 1) {
    edges {
      node { url altText width height }
    }
  }
  variants(first: 20) {
    edges {
      node {
        ${PRODUCT_VARIANT_FIELDS}
      }
    }
  }
`

// ─── GraphQL queries ────────────────────────────────────────────────────────

const COLLECTION_PRODUCTS_QUERY = `
  query CollectionProducts($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      title
      handle
      description
      products(first: $first) {
        edges {
          node {
            ${PRODUCT_FIELDS}
          }
        }
      }
    }
  }
`

const ALL_COLLECTIONS_QUERY = `
  query AllCollections($first: Int!) {
    collections(first: $first) {
      edges {
        node {
          id
          title
          handle
          description
          image {
            url
            altText
            width
            height
          }
        }
      }
    }
  }
`

const ALL_PRODUCTS_QUERY = `
  query AllProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          ${PRODUCT_FIELDS}
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

// ─── PDP detail fields (all images, HTML description, SEO) ─────────────────

const PRODUCT_DETAIL_FIELDS = `
  id
  title
  handle
  description
  descriptionHtml
  vendor
  productType
  tags
  seo {
    title
    description
  }
  priceRange {
    minVariantPrice { amount currencyCode }
  }
  images(first: 20) {
    edges {
      node { url altText width height }
    }
  }
  variants(first: 20) {
    edges {
      node {
        ${PRODUCT_VARIANT_FIELDS}
      }
    }
  }
`

const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      ${PRODUCT_DETAIL_FIELDS}
    }
  }
`

const SEARCH_PRODUCTS_QUERY = `
  query SearchProducts($query: String!, $first: Int!, $after: String) {
    search(query: $query, first: $first, after: $after, types: [PRODUCT]) {
      edges {
        node {
          ... on Product {
            ${PRODUCT_FIELDS}
          }
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
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

function parseVariant(node: Record<string, unknown>): ProductVariant {
  const selectedOptions = (node.selectedOptions as { name: string; value: string }[]) ?? []
  return {
    id: node.id as string,
    title: node.title as string,
    price: node.price as ProductVariant['price'],
    compareAtPrice: (node.compareAtPrice as ProductVariant['compareAtPrice']) ?? null,
    availableForSale: node.availableForSale as boolean,
    image: node.image ? parseImage(node.image as Record<string, unknown>) : null,
    selectedOptions,
  }
}

function parseProduct(node: Record<string, unknown>): Product {
  const images = node.images as { edges: { node: Record<string, unknown> }[] }
  const variants = node.variants as {
    edges: { node: Record<string, unknown> }[]
  }

  return {
    id: node.id as string,
    title: node.title as string,
    handle: node.handle as string,
    description: node.description as string,
    tags: node.tags as string[],
    priceRange: node.priceRange as Product['priceRange'],
    images: images.edges.map((e) => parseImage(e.node)),
    variants: variants.edges.map((e) => parseVariant(e.node)),
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch all products from a Shopify collection by handle.
 */
export async function getCollectionProducts(
  client: StorefrontClient,
  handle: string,
  first = 50
): Promise<Collection | null> {
  const { data, errors } = await client.request(COLLECTION_PRODUCTS_QUERY, {
    variables: { handle, first },
  })

  if (errors) {
    console.error('[shopify-storefront] getCollectionProducts errors:', errors)
    return null
  }

  const collection = data?.collection
  if (!collection) return null

  const products = collection.products as {
    edges: { node: Record<string, unknown> }[]
  }

  return {
    title: collection.title as string,
    handle: collection.handle as string,
    description: (collection.description as string) ?? '',
    products: products.edges.map((e) => parseProduct(e.node)),
  }
}

/**
 * Fetch all collections from the store (summaries only, no products).
 */
export async function getAllCollections(
  client: StorefrontClient,
  first = 50
): Promise<CollectionSummary[]> {
  const { data, errors } = await client.request(ALL_COLLECTIONS_QUERY, {
    variables: { first },
  })

  if (errors) {
    console.error('[shopify-storefront] getAllCollections errors:', errors)
    return []
  }

  const collections = data?.collections as {
    edges: { node: Record<string, unknown> }[]
  }
  if (!collections) return []

  return collections.edges.map((e) => {
    const node = e.node
    const image = node.image ? parseImage(node.image as Record<string, unknown>) : null
    return {
      id: node.id as string,
      title: node.title as string,
      handle: node.handle as string,
      description: (node.description as string) ?? '',
      image,
    }
  })
}

/**
 * Fetch all products from the store, paginating through results.
 */
export async function getAllProducts(client: StorefrontClient): Promise<Product[]> {
  const allProducts: Product[] = []
  let after: string | null = null

  // Paginate through all products (250 per page max, we use 50)
  do {
    const { data, errors } = await client.request(ALL_PRODUCTS_QUERY, {
      variables: { first: 50, after },
    })

    if (errors) {
      console.error('[shopify-storefront] getAllProducts errors:', errors)
      break
    }

    const products = data?.products as {
      edges: { node: Record<string, unknown> }[]
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
    if (!products) break

    allProducts.push(...products.edges.map((e) => parseProduct(e.node)))

    if (products.pageInfo.hasNextPage) {
      after = products.pageInfo.endCursor
    } else {
      after = null
    }
  } while (after)

  return allProducts
}

/**
 * Fetch products that have a "1 Gallon" variant.
 *
 * Gallon products are VARIANTS (Size option = "1 Gallon") of multi-variant
 * products, not standalone products. This queries all products and filters
 * to only those with a "1 Gallon" variant option.
 *
 * Each returned Product has its full variant list — the CaseBuilder
 * component is responsible for selecting the "1 Gallon" variant for display
 * and add-to-cart.
 */
export async function getGallonProducts(client: StorefrontClient): Promise<Product[]> {
  const allProducts = await getAllProducts(client)
  return allProducts.filter((product) =>
    product.variants.some((variant) =>
      variant.selectedOptions.some((opt) => opt.name === 'Size' && opt.value === '1 Gallon')
    )
  )
}

/**
 * Fetch a single product by handle (URL slug) with full detail for PDP.
 * Returns all images, HTML description, SEO metadata, vendor, and productType.
 */
export async function getProductByHandle(
  client: StorefrontClient,
  handle: string
): Promise<ProductDetail | null> {
  const { data, errors } = await client.request(PRODUCT_BY_HANDLE_QUERY, {
    variables: { handle },
  })

  if (errors) {
    console.error('[shopify-storefront] getProductByHandle errors:', errors)
    return null
  }

  const product = data?.product
  if (!product) return null

  const node = product as Record<string, unknown>
  const images = node.images as { edges: { node: Record<string, unknown> }[] }
  const variants = node.variants as {
    edges: { node: Record<string, unknown> }[]
  }

  return {
    id: node.id as string,
    title: node.title as string,
    handle: node.handle as string,
    description: node.description as string,
    descriptionHtml: node.descriptionHtml as string,
    vendor: (node.vendor as string) ?? '',
    productType: (node.productType as string) ?? '',
    tags: node.tags as string[],
    seo: (node.seo as ProductDetail['seo']) ?? { title: null, description: null },
    priceRange: node.priceRange as Product['priceRange'],
    images: images.edges.map((e) => parseImage(e.node)),
    variants: variants.edges.map((e) => parseVariant(e.node)),
  }
}

/**
 * Search products by query string using Shopify's search API.
 * Returns matching products with pagination support.
 */
export async function searchProducts(
  client: StorefrontClient,
  query: string,
  first = 20,
  after?: string
): Promise<{
  products: Product[]
  totalCount: number
  hasNextPage: boolean
  endCursor: string | null
}> {
  const { data, errors } = await client.request(SEARCH_PRODUCTS_QUERY, {
    variables: { query, first, after: after ?? null },
  })

  if (errors) {
    console.error('[shopify-storefront] searchProducts errors:', errors)
    return { products: [], totalCount: 0, hasNextPage: false, endCursor: null }
  }

  const search = data?.search as {
    edges: { node: Record<string, unknown> }[]
    totalCount: number
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  }
  if (!search) {
    return { products: [], totalCount: 0, hasNextPage: false, endCursor: null }
  }

  return {
    products: search.edges.map((e) => parseProduct(e.node)),
    totalCount: search.totalCount,
    hasNextPage: search.pageInfo.hasNextPage,
    endCursor: search.pageInfo.endCursor,
  }
}
