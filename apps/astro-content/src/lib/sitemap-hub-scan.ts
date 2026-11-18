/**
 * Hub and spoke from the clusters already wired.
 * A spoke is a page the hub links down to, or a page that links up to that hub.
 * Humate Hub membership (the tag and the learning-path list) beats a cross-link.
 * One page, one hub.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PAGE_GROUPS } from './site-audit-pages'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

type Why = 'member' | 'down'

type HubDef = {
  route: string
  file: string
  member?: boolean
}

const HUBS: HubDef[] = [
  { route: '/blogs/humate-hub/', file: 'pages/blogs/humate-hub.astro', member: true },
  { route: '/blog/how-to-get-rid-of-chicken-mites/', file: 'content/blog/how-to-get-rid-of-chicken-mites.mdx' },
  { route: '/blog/treating-vent-gleet-and-pasty-butt-in-chickens/', file: 'content/blog/treating-vent-gleet-and-pasty-butt-in-chickens.mdx' },
  { route: '/blog/keeping-pets-safe-guide-to-weed-killer-and-pet-safety/', file: 'content/blog/keeping-pets-safe-guide-to-weed-killer-and-pet-safety.mdx' },
  { route: '/blog/the-effect-of-soil-ph-on-plants/', file: 'content/blog/the-effect-of-soil-ph-on-plants.mdx' },
  { route: '/blog/how-to-get-rid-of-drain-flies/', file: 'content/blog/how-to-get-rid-of-drain-flies.mdx' },
  { route: '/blog/17989164-vault-toilets-a-step-up-from-the-pit/', file: 'content/blog/17989164-vault-toilets-a-step-up-from-the-pit.mdx' },
  { route: '/blogs/poultry-biosecurity/', file: 'pages/blogs/poultry-biosecurity.astro' },
]

export type HubAssignment = {
  role: 'hub' | 'spoke'
  parent: string | null
}

function routeKey(route: string): string {
  let path = route.startsWith('/') ? route : `/${route}`
  if (path.length > 1 && !path.endsWith('/')) path = `${path}/`
  return path
}

function blogRoute(slug: string): string {
  return `/blog/${slug}/`
}

function slugOf(route: string): string {
  return route.split('/').filter(Boolean).at(-1) ?? ''
}

function quotedSlugs(text: string, known: Set<string>): string[] {
  const found = new Set<string>()
  for (const match of text.matchAll(/'([a-z0-9]+(?:-[a-z0-9]+){1,})'/g)) {
    const slug = match[1]
    if (slug && known.has(slug)) found.add(slug)
  }
  return [...found]
}

function downSlugs(text: string): string[] {
  return [...text.matchAll(/\/blog\/([a-z0-9-]+)\//g)].map((match) => match[1] ?? '').filter(Boolean)
}

function blogFiles(): string[] {
  return readdirSync(join(ROOT, 'content/blog')).filter((name) => name.endsWith('.mdx'))
}

export function hubByRoute(): Map<string, HubAssignment> {
  const files = blogFiles()
  const known = new Set(files.map((name) => name.replace(/\.mdx$/, '')))
  const claims = new Map<string, { hub: string; why: Why; rank: number }>()

  function claim(route: string, hub: string, why: Why, rank: number): void {
    const key = routeKey(route)
    if (key === routeKey(hub)) return
    const prior = claims.get(key)
    if (!prior) {
      claims.set(key, { hub: routeKey(hub), why, rank })
      return
    }
    const whyRank = { member: 0, down: 1 }
    if (whyRank[why] < whyRank[prior.why] || (why === prior.why && rank < prior.rank)) {
      claims.set(key, { hub: routeKey(hub), why, rank })
    }
  }

  HUBS.forEach((hub, rank) => {
    const text = readFileSync(join(ROOT, hub.file), 'utf8')
    const own = slugOf(hub.route)
    const why: Why = hub.member ? 'member' : 'down'
    for (const slug of quotedSlugs(text, known)) claim(blogRoute(slug), hub.route, why, rank)
    for (const slug of downSlugs(text)) {
      if (slug === own) continue
      claim(blogRoute(slug), hub.route, 'down', rank)
    }
  })

  for (const name of files) {
    const text = readFileSync(join(ROOT, 'content/blog', name), 'utf8')
    if (/tags:\s*\[[^\]]*Humate Hub/i.test(text)) {
      claim(blogRoute(name.replace(/\.mdx$/, '')), '/blogs/humate-hub/', 'member', 0)
    }
  }

  const found = new Map<string, HubAssignment>()
  for (const hub of HUBS) {
    found.set(routeKey(hub.route), { role: 'hub', parent: null })
  }
  for (const [route, hit] of claims) {
    if (found.get(route)?.role === 'hub') continue
    found.set(route, { role: 'spoke', parent: hit.hub })
  }

  const poultry = '/poultry/'
  if (!found.has(poultry)) found.set(poultry, { role: 'hub', parent: null })
  for (const group of PAGE_GROUPS) {
    if (group.id !== 'persona') continue
    for (const page of group.pages) {
      if (!page.route.startsWith('/poultry/') || page.route === poultry) continue
      if (found.has(routeKey(page.route))) continue
      found.set(routeKey(page.route), { role: 'spoke', parent: poultry })
    }
  }

  const podcast = '/podcast/'
  if (!found.has(podcast)) found.set(podcast, { role: 'hub', parent: null })
  for (const route of ['/podcast/topics/', '/podcast/guests/']) {
    if (!found.has(route)) found.set(route, { role: 'spoke', parent: podcast })
  }

  return found
}
