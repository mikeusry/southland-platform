/**
 * Who a live URL is for.
 * Blog tags are the same rules the persona pages already use.
 * Title and description override a tag when the page is obviously for someone else.
 * A product or collection is assigned only when that page is for one person.
 */
import { getCollection } from 'astro:content'
import { inferPersonaFromBlog } from './persona-inference'
import { PAGE_GROUPS } from './site-audit-pages'
import { PERSONAS } from './persona-profiles'

const COPY_RULES: ReadonlyArray<[RegExp, string]> = [
  [/\bgame ?birds?\b|\bquail\b|\bpheasant\b/i, 'greg'],
  [/\bturkeys?\b/i, 'tom'],
  [/\bbreeders?\b|\bgrandparent\b/i, 'bob'],
  [/\bbackyard\b|\bcoop\b|\bchicken mites?\b|\bdesecticide\b|\bhen helper\b/i, 'betty'],
  [/\bpoultry\b|\bgrowers?\b|\bbiosecurity\b|\bventilation\b|\bmetapneumovirus\b|\bbroilers?\b|\bpoultry houses?\b|\bintegrator\b|\bdarkling\b|\bwater lines?\b|\bbetween-flock\b/i, 'bill'],
  [/\bgolf\b|\bfairways?\b/i, 'gary'],
  [/\bhydroseed|\bcommercial lawn\b|\bturf pros?\b/i, 'taylor'],
  [/\bseptic\b|\bdrain flies?\b|\bholding tanks?\b|\bodor control\b/i, 'sam'],
  [/\bhomeowners?\b|\bdog urine\b|\bbrown spots?\b|\bdriveways?\b|\blawn care\b|\blawn quiz\b|\blawn health\b/i, 'hannah'],
  [/\bmarket gardens?\b|\bgardens?\b|\bproduce\b|\bvegetables?\b/i, 'maggie'],
  [/\bsoil\b/i, 'taylor'],
]

const COLLECTION_PERSONA: Record<string, string> = {
  'backyard-birds': 'betty',
  'poultry-broilers': 'bill',
  'poultry-breeders': 'bob',
  'game-birds': 'greg',
  turkey: 'tom',
  'golf-courses': 'gary',
  homeowners: 'hannah',
  landscapers: 'taylor',
  hydroseeders: 'taylor',
  turf: 'taylor',
  waste: 'sam',
  produce: 'maggie',
  crops: 'maggie',
}

const PRODUCT_PERSONA: Record<string, string> = {
  'hen-helper': 'betty',
  'backyard-poultry-bundle-chicken-supplements': 'betty',
  'apple-cider-vinegar-for-chickens': 'betty',
  'dog-spot-for-lawns': 'hannah',
  'torched-all-natural-weed-killer': 'hannah',
  'natural-lawn-care-subscription': 'hannah',
  'indoor-plant-food-1': 'hannah',
  'perfect-pot': 'hannah',
  'zeropoint-industrial': 'bill',
  'poultry-probiotic': 'bill',
  'poultry-litter-amendment': 'bill',
  'pour-the-port-septic-tank-treatment': 'sam',
  'holding-tank-treatment': 'sam',
  'pure-b-s-bio-surfactant': 'sam',
}

const PAGE_PERSONA: Record<string, string> = {
  '/tools/flock-dosing-calculator/': 'betty',
  '/tools/flock-health-check/': 'betty',
  '/tools/lawn-quiz/': 'hannah',
  '/lawn/program/': 'hannah',
  '/lawn/bundles/': 'hannah',
  '/lawn/instructions/': 'hannah',
  '/how-to-use/torched/': 'hannah',
  '/blogs/poultry-biosecurity/': 'bill',
  '/agriculture/crops/': 'maggie',
  '/agriculture/produce/': 'maggie',
}

const CATCH_ALL = new Set(['bill', 'taylor', 'sam'])

export function routeKey(route: string): string {
  let path = route.startsWith('/') ? route : `/${route}`
  if (path.length > 1 && !path.endsWith('/')) path = `${path}/`
  return path
}

function fromCopy(text: string): string | null {
  for (const [pattern, slug] of COPY_RULES) {
    if (pattern.test(text)) return slug
  }
  return null
}

export async function personaSlugByRoute(): Promise<Map<string, string>> {
  const found = new Map<string, string>()

  function set(route: string, slug: string): void {
    if (!slug || slug === 'general') return
    found.set(routeKey(route), slug)
  }

  const posts = await getCollection('blog', ({ data }) => data.draft !== true)
  for (const post of posts) {
    const slug = post.id.replace(/\.mdx?$/, '')
    const tagged = inferPersonaFromBlog(post.data.tags ?? [], post.data.segment ?? '')
    const copied = fromCopy(`${post.data.title} ${post.data.description}`)
    const specific = tagged && !CATCH_ALL.has(tagged.persona) ? tagged.persona : null
    const persona = specific ?? copied ?? tagged?.persona
    if (!persona) continue
    set(`/blog/${slug}/`, persona)
    if (post.data.shopifyHandle && post.data.shopifyHandle !== slug) {
      set(`/blog/${post.data.shopifyHandle}/`, persona)
    }
  }

  const products = await getCollection('products')
  for (const product of products) {
    const handle = product.data.shopifyHandle
    const persona = PRODUCT_PERSONA[handle]
    if (persona) set(`/products/${handle}/`, persona)
  }

  const collections = await getCollection('shopCollections')
  for (const collection of collections) {
    const persona = COLLECTION_PERSONA[collection.data.handle]
    if (persona) set(`/collections/${collection.data.handle}/`, persona)
  }

  for (const group of PAGE_GROUPS) {
    for (const page of group.pages) {
      if (page.persona && page.persona !== 'general') set(page.route, page.persona)
    }
  }

  const landerCount = new Map<string, number>()
  for (const person of PERSONAS) {
    if (!person.landerUrl) continue
    const key = routeKey(person.landerUrl)
    landerCount.set(key, (landerCount.get(key) ?? 0) + 1)
  }
  for (const person of PERSONAS) {
    if (!person.landerUrl) continue
    if ((landerCount.get(routeKey(person.landerUrl)) ?? 0) !== 1) continue
    set(person.landerUrl, person.slug)
  }

  const topics = await getCollection('topics')
  for (const topic of topics) {
    const slug = topic.id.replace(/\.mdx?$/, '')
    const tagged = inferPersonaFromBlog([topic.data.name], topic.data.segment ?? '')
    const copied = fromCopy(`${topic.data.name} ${topic.data.description}`)
    const specific = tagged && !CATCH_ALL.has(tagged.persona) ? tagged.persona : null
    const persona = specific ?? copied ?? tagged?.persona
    if (persona) set(`/podcast/topics/${slug}/`, persona)
  }

  const episodes = await getCollection('episodes', ({ data }) => data.draft !== true)
  for (const episode of episodes) {
    const slug = episode.id.replace(/\.mdx?$/, '')
    const topicText = (episode.data.topics ?? []).join(' ').replaceAll('-', ' ')
    const persona = fromCopy(`${episode.data.title} ${episode.data.description} ${topicText}`)
    if (persona) set(`/podcast/${slug}/`, persona)
  }

  for (const [route, slug] of Object.entries(PAGE_PERSONA)) set(route, slug)

  return found
}
