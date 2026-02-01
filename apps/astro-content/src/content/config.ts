import { defineCollection, z } from 'astro:content';

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
    chapters: z.array(z.object({
      time: z.number(), // seconds
      title: z.string(),
    })).optional().default([]),

    // Guests (inline or reference)
    guests: z.array(z.object({
      name: z.string(),
      slug: z.string(),
      role: z.string().optional(),
      bio: z.string().optional(),
      photo: z.string().optional(),
      links: z.object({
        website: z.string().optional(),
        linkedin: z.string().optional(),
        twitter: z.string().optional(),
      }).optional(),
    })).optional().default([]),

    // Topics/Tags
    topics: z.array(z.string()).optional().default([]),

    // Related content
    relatedProducts: z.array(z.object({
      slug: z.string(),
      name: z.string(),
      cta: z.string().optional(),
    })).optional().default([]),
    relatedBlogPosts: z.array(z.object({
      slug: z.string(),
      title: z.string(),
    })).optional().default([]),
    relatedEpisodes: z.array(z.string()).optional().default([]),

    // Transcript with timestamps
    transcript: z.array(z.object({
      time: z.number(), // seconds
      speaker: z.string(),
      text: z.string(),
    })).optional().default([]),

    // SEO
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    ogImage: z.string().optional(),

    // Status
    draft: z.boolean().optional().default(false),
  }),
});

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
    links: z.object({
      website: z.string().optional(),
      linkedin: z.string().optional(),
      twitter: z.string().optional(),
      instagram: z.string().optional(),
    }).optional(),
    episodes: z.array(z.string()).optional().default([]),
    featured: z.boolean().optional().default(false),
  }),
});

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
});

// Blog posts schema - for future blog content
// Note: slug is auto-generated from filename in Astro v5
const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    publishDate: z.coerce.date(),
    description: z.string(),
    author: z.string().optional(),
    topics: z.array(z.string()).optional().default([]),
    segment: z.enum(['poultry', 'turf', 'agriculture', 'general']).optional().default('general'),
    featuredImage: z.string().optional(),
    draft: z.boolean().optional().default(false),
    relatedProducts: z.array(z.string()).optional().default([]),
    relatedEpisodes: z.array(z.string()).optional().default([]),
  }),
});

// Team members schema - for about pages
// Note: slug is auto-generated from filename in Astro v5
const teamCollection = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    role: z.string(),
    bio: z.string(),
    photo: z.string().optional(),
    email: z.string().optional(),
    links: z.object({
      linkedin: z.string().optional(),
      twitter: z.string().optional(),
    }).optional(),
    order: z.number().optional().default(99),
  }),
});

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
});

export const collections = {
  'episodes': episodesCollection,
  'guests': guestsCollection,
  'topics': topicsCollection,
  'blog': blogCollection,
  'team': teamCollection,
  'products': productsCollection,
};
