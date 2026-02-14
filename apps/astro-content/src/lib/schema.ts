/**
 * Shared Schema.org utilities for E-E-A-T structured data
 *
 * Used by blog posts, podcast episodes, and podcast hub to generate
 * consistent Person schemas from team member collection entries.
 */

import { buildSouthlandUrl } from './cloudinary'

const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://southlandorganics.com'

/**
 * Build a Schema.org Person object from a team member collection entry.
 * Generates rich E-E-A-T signals: credentials, expertise, profile links.
 *
 * @param member - Astro content collection entry from 'team' collection
 * @returns Schema.org Person object for JSON-LD
 */
export function buildPersonSchema(member: {
  id: string
  data: {
    name: string
    role: string
    bio?: string
    photo?: string
    links?: { linkedin?: string; twitter?: string; website?: string }
    credentials?: string[]
    expertiseAreas?: string[]
    yearsExperience?: number
  }
}) {
  const slug = member.id.replace(/\.mdx?$/, '')
  const sameAs = [
    member.data.links?.linkedin,
    member.data.links?.twitter,
    member.data.links?.website,
  ].filter(Boolean) as string[]

  return {
    '@type': 'Person' as const,
    name: member.data.name,
    url: `${siteUrl}/team/${slug}/`,
    jobTitle: member.data.role,
    worksFor: {
      '@type': 'Organization' as const,
      name: 'Southland Organics',
      url: siteUrl,
    },
    ...(sameAs.length > 0 && { sameAs }),
    ...(member.data.photo && {
      image: buildSouthlandUrl(member.data.photo, {
        width: 400,
        height: 400,
        crop: 'fill',
        gravity: 'face',
        format: 'auto',
        quality: 'auto',
      }),
    }),
    ...(member.data.credentials &&
      member.data.credentials.length > 0 && {
        description: member.data.credentials.join('. '),
      }),
    ...(member.data.expertiseAreas &&
      member.data.expertiseAreas.length > 0 && {
        knowsAbout: member.data.expertiseAreas,
      }),
  }
}

/**
 * Build a Schema.org Organization object for Southland Organics.
 * Used as publisher/author fallback when no specific person is attributed.
 */
export function buildOrganizationSchema() {
  return {
    '@type': 'Organization' as const,
    name: 'Southland Organics',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject' as const,
      url: `${siteUrl}/logo.png`,
    },
  }
}
