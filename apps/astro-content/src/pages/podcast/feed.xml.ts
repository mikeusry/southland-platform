/**
 * RSS Feed - /podcast/feed.xml
 * Generates RSS 2.0 feed with iTunes and Podcast Index extensions
 */

import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { getLogoUrl } from '../../lib/cloudinary'

const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://southlandorganics.com'

// Podcast cover image from Cloudinary (using logo until proper cover is available)
const podcastCoverUrl = getLogoUrl('square', { width: 1400 })

// Format duration from "45:32" to "00:45:32"
function formatDuration(duration: string): string {
  const parts = duration.split(':')
  if (parts.length === 2) {
    return `00:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
  }
  return duration
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const GET: APIRoute = async () => {
  const episodes = await getCollection('episodes', ({ data }) => {
    return data.draft !== true
  })

  // Sort by publish date (newest first)
  const sortedEpisodes = [...episodes].sort(
    (a, b) => new Date(b.data.publishDate).getTime() - new Date(a.data.publishDate).getTime()
  )

  const lastBuildDate =
    sortedEpisodes.length > 0
      ? sortedEpisodes[0].data.publishDate.toUTCString()
      : new Date().toUTCString()

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:podcast="https://podcastindex.org/namespace/1.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Ag &amp; Culture Podcast</title>
    <link>${siteUrl}/podcast/</link>
    <description>You can't have culture without agriculture. Join us for conversations about sustainable farming, animal health, and the communities built around agriculture.</description>
    <language>en-us</language>
    <copyright>© ${new Date().getFullYear()} Southland Organics</copyright>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <pubDate>${lastBuildDate}</pubDate>
    <generator>Astro</generator>

    <atom:link href="${siteUrl}/podcast/feed.xml" rel="self" type="application/rss+xml"/>

    <itunes:author>Southland Organics</itunes:author>
    <itunes:owner>
      <itunes:name>Southland Organics</itunes:name>
      <itunes:email>podcast@southlandorganics.com</itunes:email>
    </itunes:owner>
    <itunes:image href="${podcastCoverUrl}"/>
    <itunes:category text="Science">
      <itunes:category text="Nature"/>
    </itunes:category>
    <itunes:category text="Business">
      <itunes:category text="Entrepreneurship"/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>

    <podcast:locked>no</podcast:locked>
    <podcast:guid>${siteUrl}/podcast/</podcast:guid>

    ${sortedEpisodes
      .map((episode) => {
        const slug = episode.id.replace(/\.mdx?$/, '')
        const episodeUrl = `${siteUrl}/podcast/${slug}/`
        const pubDate = episode.data.publishDate.toUTCString()

        return `
    <item>
      <title>${escapeXml(episode.data.title)}</title>
      <link>${episodeUrl}</link>
      <guid isPermaLink="true">${episodeUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${episode.data.description}]]></description>
      ${episode.data.longDescription ? `<content:encoded><![CDATA[${episode.data.longDescription}]]></content:encoded>` : ''}

      ${episode.data.audioUrl ? `<enclosure url="${episode.data.audioUrl}" type="audio/mpeg" length="0"/>` : ''}

      <itunes:title>${escapeXml(episode.data.title)}</itunes:title>
      <itunes:episode>${episode.data.episodeNumber}</itunes:episode>
      ${episode.data.season ? `<itunes:season>${episode.data.season}</itunes:season>` : ''}
      <itunes:duration>${formatDuration(episode.data.duration)}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      ${episode.data.thumbnail ? `<itunes:image href="${siteUrl}${episode.data.thumbnail}"/>` : ''}
      <itunes:summary><![CDATA[${episode.data.description}]]></itunes:summary>

      ${
        episode.data.transcript && episode.data.transcript.length > 0
          ? `
      <podcast:transcript url="${episodeUrl}transcript.vtt" type="text/vtt"/>`
          : ''
      }

      ${
        episode.data.chapters && episode.data.chapters.length > 0
          ? `
      <podcast:chapters url="${episodeUrl}chapters.json" type="application/json+chapters"/>`
          : ''
      }
    </item>`
      })
      .join('')}
  </channel>
</rss>`

  return new Response(rss.trim(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
