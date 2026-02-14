import type { StorefrontClient } from '../client'
import type { Collection, Product, ProductImage, ProductVariant } from '../types'

// ─── GraphQL ─────────────────────────────────────────────────────────────────

const COLLECTION_PRODUCTS_QUERY = `
  query CollectionProducts($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      title
      handle
      products(first: $first) {
        edges {
          node {
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
                  id
                  title
                  price { amount currencyCode }
                  availableForSale
                  image { url altText width height }
                }
              }
            }
          }
        }
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
  return {
    id: node.id as string,
    title: node.title as string,
    price: node.price as ProductVariant['price'],
    availableForSale: node.availableForSale as boolean,
    image: node.image ? parseImage(node.image as Record<string, unknown>) : null,
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
 * Fetch all gallon products from the "gallon-products" collection.
 *
 * This is the primary query for the Mix & Match Case Builder.
 * The collection handle must be "gallon-products" — ops may rename
 * the collection title freely but must never change the handle.
 */
export async function getGallonProducts(
  client: StorefrontClient,
): Promise<Product[]> {
  const collection = await getCollectionProducts(client, 'gallon-products')
  return collection?.products ?? []
}
