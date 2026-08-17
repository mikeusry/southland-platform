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

/** ISO 8601 duration for Schema.org VideoObject (PT8M53S). */
export function secondsToIsoDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `PT${h}H${m}M${sec}S`
  if (m > 0) return `PT${m}M${sec}S`
  return `PT${sec}S`
}

/**
 * Schema.org VideoObject for a Mux-hosted blog video.
 * Google requires name, thumbnailUrl, uploadDate. transcript is valid on
 * VideoObject (https://schema.org/transcript) even though it is not a
 * PodcastEpisode property.
 */
export function buildVideoObject(opts: {
  name: string
  description: string
  playbackId: string
  pageUrl: string
  uploadDate: string
  durationSeconds?: number
  transcript?: string
  publisher?: ReturnType<typeof buildOrganizationSchema>
  id?: string
}) {
  const thumb = `https://image.mux.com/${opts.playbackId}/thumbnail.jpg`
  return {
    '@type': 'VideoObject' as const,
    '@id': opts.id || `${opts.pageUrl}#video`,
    name: opts.name,
    description: opts.description,
    thumbnailUrl: [
      `${thumb}?width=1280&height=720&fit_mode=smartcrop&time=10`,
      `${thumb}?width=640&height=360&fit_mode=smartcrop&time=10`,
    ],
    uploadDate: opts.uploadDate,
    contentUrl: `https://stream.mux.com/${opts.playbackId}.m3u8`,
    embedUrl: `https://player.mux.com/${opts.playbackId}`,
    inLanguage: 'en',
    ...(opts.durationSeconds != null && {
      duration: secondsToIsoDuration(opts.durationSeconds),
    }),
    ...(opts.transcript && { transcript: opts.transcript }),
    ...(opts.publisher && { publisher: opts.publisher }),
  }
}
