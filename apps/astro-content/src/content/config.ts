import { defineCollection, z } from 'astro:content'

// Episode schema - full podcast episode with all metadata
// Note: slug is auto-generated from filename in Astro v5
const episodesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    episodeNumber: z.number(),
    season: z.number().optional().default(1),
    publishDate: z.coerce.date(),
    description: z.string(),
    longDescription: z.string().optional(),

    // Media
    gumletId: z.string().optional(),
    audioUrl: z.string().optional(),
    youtubeUrl: z.string().optional(),
    applePodcastUrl: z.string().optional(),
    spotifyUrl: z.string().optional(),
    thumbnail: z.string().optional(),
    duration: z.string(), // "45:32" format
    durationSeconds: z.number(),

    // Chapters with timestamps
    chapters: z
      .array(
        z.object({
          time: z.number(), // seconds
          title: z.string(),
        })
      )
      .optional()
      .default([]),

    // Guests (inline or reference)
    guests: z
      .array(
        z.object({
          name: z.string(),
          slug: z.string(),
          role: z.string().optional(),
          bio: z.string().optional(),
          photo: z.string().optional(),
          links: z
            .object({
              website: z.string().optional(),
              linkedin: z.string().optional(),
              twitter: z.string().optional(),
            })
            .optional(),
        })
      )
      .optional()
      .default([]),

    // Topics/Tags
    topics: z.array(z.string()).optional().default([]),

    // Related content
    relatedProducts: z
      .array(
        z.object({
          slug: z.string(),
          name: z.string(),
          cta: z.string().optional(),
        })
      )
      .optional()
      .default([]),
    relatedBlogPosts: z
      .array(
        z.object({
          slug: z.string(),
          title: z.string(),
        })
      )
      .optional()
      .default([]),
    relatedEpisodes: z.array(z.string()).optional().default([]),

    // Transcript with timestamps
    transcript: z
      .array(
        z.object({
          time: z.number(), // seconds
          speaker: z.string(),
          text: z.string(),
        })
      )
      .optional()
      .default([]),

    // SEO
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    ogImage: z.string().optional(),

    // Status
    draft: z.boolean().optional().default(false),
  }),
})

// Guest schema - for guest directory
// Note: slug is auto-generated from filename in Astro v5
const guestsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    role: z.string().optional(),
    company: z.string().optional(),
    bio: z.string(),
    photo: z.string().optional(),
    links: z
      .object({
        website: z.string().optional(),
        linkedin: z.string().optional(),
        twitter: z.string().optional(),
        instagram: z.string().optional(),
      })
      .optional(),
    episodes: z.array(z.string()).optional().default([]),
    featured: z.boolean().optional().default(false),
  }),
})

// Topic schema - shared taxonomy across podcast, blog, segments
// Note: slug is auto-generated from filename in Astro v5
const topicsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    relatedTopics: z.array(z.string()).optional().default([]),
    relatedProducts: z.array(z.string()).optional().default([]),
    segment: z.enum(['poultry', 'turf', 'agriculture', 'general']).optional().default('general'),
    // SEO fields
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    ogImage: z.string().optional(),
  }),
})

// Blog posts schema - migrated from Shopify (E-E-A-T optimized)
// Note: slug is auto-generated from filename in Astro v5
const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(), // For "Last updated" display
    description: z.string(),
    // E-E-A-T: Author and Reviewer as team member slugs
    author: z.string().optional(), // Team member slug (e.g., "mike-usry")
    reviewer: z.string().optional(), // Team member who reviewed/fact-checked
    // Content classification
    tags: z.array(z.string()).optional().default([]),
    segment: z.enum(['poultry', 'turf', 'agriculture', 'general']).optional().default('general'),
    featuredImage: z.string().optional(),
    draft: z.boolean().optional().default(false),
    // Shopify migration fields
    shopifyId: z.union([z.number(), z.string()]).optional(),
    shopifyHandle: z.string().optional(),
    // Legacy field mapping
    topics: z.array(z.string()).optional().default([]),
    relatedProducts: z.array(z.string()).optional().default([]),
    relatedEpisodes: z.array(z.string()).optional().default([]),
  }),
})

// Team members schema - for about pages and blog author pages (E-E-A-T optimized)
// Note: slug is auto-generated from filename in Astro v5
const teamCollection = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    role: z.string(),
    bio: z.string(),
    photo: z.string().optional(), // Cloudinary public ID
    email: z.string().optional(),
    phone: z.string().optional(),
    links: z
      .object({
        linkedin: z.string().optional(),
        twitter: z.string().optional(),
        website: z.string().optional(),
      })
      .optional(),
    // E-E-A-T fields for author credibility
    credentials: z.array(z.string()).optional().default([]), // Certifications, degrees, awards
    expertiseAreas: z
      .array(
        z.enum([
          'poultry',
          'turf',
          'agriculture',
          'soil-health',
          'organic-farming',
          'waste-management',
        ])
      )
      .optional()
      .default([]),
    yearsExperience: z.number().optional(), // Years in the industry
    isAuthor: z.boolean().optional().default(false), // Can author blog posts
    isReviewer: z.boolean().optional().default(false), // Can review/fact-check content
    // Display settings
    order: z.number().optional().default(99),
    featured: z.boolean().optional().default(false), // Show on homepage/contact
    active: z.boolean().optional().default(true), // Still with company
  }),
})

// Products schema - links to Shopify products with content enrichment
// Note: slug is auto-generated from filename in Astro v5
const productsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    shopifyHandle: z.string(),
    segment: z.enum(['poultry', 'turf', 'agriculture']),
    shortDescription: z.string(),
    benefits: z.array(z.string()).optional().default([]),
    useCases: z.array(z.string()).optional().default([]),
    topics: z.array(z.string()).optional().default([]),
    featured: z.boolean().optional().default(false),
  }),
})

export const collections = {
  episodes: episodesCollection,
  guests: guestsCollection,
  topics: topicsCollection,
  blog: blogCollection,
  team: teamCollection,
  products: productsCollection,
}
