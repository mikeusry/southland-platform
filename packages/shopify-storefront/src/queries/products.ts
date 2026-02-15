import type { StorefrontClient } from '../client'
import type { Collection, Product, ProductImage, ProductVariant } from '../types'

// ─── GraphQL fragments ──────────────────────────────────────────────────────

const PRODUCT_VARIANT_FIELDS = `
  id
  title
  price { amount currencyCode }
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
  first = 50,
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
    products: products.edges.map((e) => parseProduct(e.node)),
  }
}

/**
 * Fetch all products from the store, paginating through results.
 */
export async function getAllProducts(
  client: StorefrontClient,
): Promise<Product[]> {
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
export async function getGallonProducts(
  client: StorefrontClient,
): Promise<Product[]> {
  const allProducts = await getAllProducts(client)
  return allProducts.filter((product) =>
    product.variants.some((variant) =>
      variant.selectedOptions.some(
        (opt) => opt.name === 'Size' && opt.value === '1 Gallon',
      ),
    ),
  )
}
