import { defineConfig } from "tinacms";

export default defineConfig({
  branch:
    process.env.TINA_BRANCH ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.HEAD ||
    "main",
  clientId: process.env.TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",
  build: {
    outputFolder: "cms",
    publicFolder: "public",
  },
  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "public",
    },
  },
  search: {
    tina: {
      indexerToken: process.env.TINA_SEARCH_TOKEN,
      stopwordLanguages: ["eng"],
    },
    indexBatchSize: 100,
    maxSearchIndexFieldLength: 100,
  },
  schema: {
    collections: [
      {
        name: "blog",
        label: "Blog Posts",
        path: "src/content/blog",
        format: "mdx",
        ui: {
          filename: {
            readonly: true,
            slugify: (values) => {
              return values?.title
                ?.toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "") || "";
            },
          },
        },
        defaultItem: () => ({
          publishDate: new Date().toISOString().split("T")[0],
          draft: true,
          segment: "general",
        }),
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "datetime",
            name: "publishDate",
            label: "Publish Date",
            required: true,
            ui: {
              dateFormat: "YYYY-MM-DD",
            },
          },
          {
            type: "datetime",
            name: "updatedDate",
            label: "Last Updated",
            description: "Set when content is significantly updated",
            ui: {
              dateFormat: "YYYY-MM-DD",
            },
          },
          {
            type: "string",
            name: "description",
            label: "Description",
            required: true,
            ui: {
              component: "textarea",
            },
          },
          {
            type: "string",
            name: "author",
            label: "Author",
            description: "Team member slug who wrote this article",
          },
          {
            type: "string",
            name: "reviewer",
            label: "Reviewer",
            description: "Team member slug who reviewed/fact-checked this article (for E-E-A-T)",
          },
          {
            type: "string",
            name: "tags",
            label: "Tags",
            list: true,
          },
          {
            type: "string",
            name: "segment",
            label: "Segment",
            options: [
              { label: "General", value: "general" },
              { label: "Poultry", value: "poultry" },
              { label: "Turf", value: "turf" },
              { label: "Agriculture", value: "agriculture" },
            ],
          },
          {
            type: "string",
            name: "targetKeyword",
            label: "Target Keyword",
            description: "Primary SEO keyword for this post (used by content quality scoring)",
          },
          {
            type: "string",
            name: "featuredImage",
            label: "Featured Image URL",
          },
          {
            type: "boolean",
            name: "draft",
            label: "Draft",
          },
          {
            type: "number",
            name: "shopifyId",
            label: "Shopify ID",
            description: "Original Shopify article ID",
          },
          {
            type: "string",
            name: "shopifyHandle",
            label: "Shopify Handle",
            description: "Original Shopify URL handle",
          },
          {
            type: "rich-text",
            name: "body",
            label: "Content",
            isBody: true,
          },
        ],
      },
      {
        name: "team",
        label: "Team Members",
        path: "src/content/team",
        format: "mdx",
        ui: {
          filename: {
            readonly: true,
            slugify: (values) => {
              return values?.name
                ?.toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "") || "";
            },
          },
        },
        fields: [
          {
            type: "string",
            name: "name",
            label: "Name",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "role",
            label: "Role/Title",
            required: true,
          },
          {
            type: "string",
            name: "bio",
            label: "Short Bio",
            required: true,
            ui: {
              component: "textarea",
            },
          },
          {
            type: "string",
            name: "photo",
            label: "Photo (Cloudinary Public ID)",
            description: "e.g., team/MIKE_Usry",
          },
          {
            type: "string",
            name: "email",
            label: "Email",
          },
          {
            type: "string",
            name: "phone",
            label: "Phone",
          },
          {
            type: "object",
            name: "links",
            label: "Social Links",
            fields: [
              { type: "string", name: "linkedin", label: "LinkedIn URL" },
              { type: "string", name: "twitter", label: "Twitter/X URL" },
              { type: "string", name: "website", label: "Personal Website" },
              { type: "string", name: "youtube", label: "YouTube URL" },
            ],
          },
          {
            type: "string",
            name: "credentials",
            label: "Credentials",
            description: 'Certifications, degrees, awards (e.g., "20+ years in organic agriculture")',
            list: true,
          },
          {
            type: "string",
            name: "expertiseAreas",
            label: "Expertise Areas",
            description: "Topics this person is qualified to write about",
            list: true,
            options: [
              { label: "Poultry", value: "poultry" },
              { label: "Turf & Lawn", value: "turf" },
              { label: "Agriculture", value: "agriculture" },
              { label: "Soil Health", value: "soil-health" },
              { label: "Organic Farming", value: "organic-farming" },
              { label: "Waste Management", value: "waste-management" },
            ],
          },
          {
            type: "number",
            name: "yearsExperience",
            label: "Years of Experience",
            description: "Years working in agriculture/industry",
          },
          {
            type: "boolean",
            name: "isAuthor",
            label: "Can Author Posts",
            description: "This person can be selected as a blog author",
          },
          {
            type: "boolean",
            name: "isReviewer",
            label: "Can Review Posts",
            description: "This person can be selected as a content reviewer",
          },
          {
            type: "number",
            name: "order",
            label: "Display Order",
            description: "Lower numbers appear first",
          },
          {
            type: "boolean",
            name: "featured",
            label: "Featured",
            description: "Show on homepage/contact page",
          },
          {
            type: "boolean",
            name: "active",
            label: "Active",
            description: "Currently with the company",
          },
          // --- Extended Profile Fields (for rich team pages) ---
          {
            type: "string",
            name: "subtitle",
            label: "Subtitle",
            description: 'e.g., "Founder, Southland Organics · Host, AG & Culture Podcast"',
          },
          {
            type: "string",
            name: "hook",
            label: "Hook",
            description: "One-liner that answers 'Why should I listen to this person?'",
            ui: {
              component: "textarea",
            },
          },
          {
            type: "string",
            name: "portraitBadge",
            label: "Portrait Badge",
            description: 'Pill text overlaid on portrait (e.g., "Host of the AG & Culture Podcast")',
          },
          {
            type: "string",
            name: "credibilityStats",
            label: "Credibility Stats",
            description: "Short credibility bullets for the snapshot band",
            list: true,
          },
          {
            type: "string",
            name: "storySectionTitle",
            label: "Story Section Title",
            description: 'e.g., "From humate deposits to field results"',
          },
          {
            type: "string",
            name: "storyParagraphs",
            label: "Story Paragraphs",
            description: "Long-form story paragraphs (each item = one paragraph)",
            list: true,
            ui: {
              component: "textarea",
            },
          },
          {
            type: "string",
            name: "tieInHeading",
            label: "Tie-In Heading",
            description: 'e.g., "What Mike brings to the mic"',
          },
          {
            type: "string",
            name: "tieInPoints",
            label: "Tie-In Points",
            description: "Bullet points for what this person brings (no trailing periods)",
            list: true,
            ui: {
              component: "textarea",
            },
          },
          {
            type: "object",
            name: "primaryCta",
            label: "Primary CTA",
            description: "Main call-to-action button on extended profile",
            fields: [
              { type: "string", name: "label", label: "Button Label", required: true },
              { type: "string", name: "url", label: "Button URL", required: true },
            ],
          },
          {
            type: "string",
            name: "blogSectionTitle",
            label: "Blog Section Title",
            description: 'Override for blog section heading (e.g., "From Mike\'s notebook")',
          },
          {
            type: "string",
            name: "heroImage",
            label: "Hero Background Image",
            description: "Full Cloudinary public ID for wide contextual hero background (e.g., Soul Miner's/Summer 2022/...)",
          },
          {
            type: "rich-text",
            name: "body",
            label: "Extended Bio",
            description: "Personal note or full bio for individual page",
            isBody: true,
          },
        ],
      },
      {
        name: "episodes",
        label: "Podcast Episodes",
        path: "src/content/episodes",
        format: "mdx",
        ui: {
          filename: {
            readonly: true,
            slugify: (values) => {
              return values?.title
                ?.toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "") || "";
            },
          },
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "number",
            name: "episodeNumber",
            label: "Episode Number",
            required: true,
          },
          {
            type: "number",
            name: "season",
            label: "Season",
          },
          {
            type: "datetime",
            name: "publishDate",
            label: "Publish Date",
            required: true,
          },
          {
            type: "string",
            name: "description",
            label: "Description",
            required: true,
            ui: {
              component: "textarea",
            },
          },
          {
            type: "string",
            name: "longDescription",
            label: "Long Description",
            ui: {
              component: "textarea",
            },
          },
          {
            type: "string",
            name: "muxPlaybackId",
            label: "Mux Playback ID",
          },
          {
            type: "string",
            name: "audioUrl",
            label: "Audio URL",
          },
          {
            type: "string",
            name: "youtubeUrl",
            label: "YouTube URL",
          },
          {
            type: "string",
            name: "applePodcastUrl",
            label: "Apple Podcast URL",
          },
          {
            type: "string",
            name: "spotifyUrl",
            label: "Spotify URL",
          },
          {
            type: "string",
            name: "thumbnail",
            label: "Thumbnail (Mux fallback URL)",
          },
          {
            type: "string",
            name: "coverImage",
            label: "Cover Image (Cloudinary public ID, e.g. podcast/episodes/ep-001-invisible-economy)",
          },
          {
            type: "string",
            name: "duration",
            label: "Duration (45:32 format)",
            required: true,
          },
          {
            type: "number",
            name: "durationSeconds",
            label: "Duration in Seconds",
            required: true,
          },
          {
            type: "string",
            name: "topics",
            label: "Topics",
            list: true,
          },
          {
            type: "boolean",
            name: "draft",
            label: "Draft",
          },
          {
            type: "rich-text",
            name: "body",
            label: "Show Notes",
            isBody: true,
          },
        ],
      },
      {
        name: "guests",
        label: "Podcast Guests",
        path: "src/content/guests",
        format: "mdx",
        ui: {
          filename: {
            readonly: true,
            slugify: (values) => {
              return values?.name
                ?.toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "") || "";
            },
          },
        },
        fields: [
          {
            type: "string",
            name: "name",
            label: "Name",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "role",
            label: "Role/Title",
          },
          {
            type: "string",
            name: "company",
            label: "Company",
          },
          {
            type: "string",
            name: "bio",
            label: "Bio",
            required: true,
            ui: {
              component: "textarea",
            },
          },
          {
            type: "string",
            name: "photo",
            label: "Photo (Cloudinary Public ID)",
          },
          {
            type: "object",
            name: "links",
            label: "Links",
            fields: [
              { type: "string", name: "website", label: "Website" },
              { type: "string", name: "linkedin", label: "LinkedIn" },
              { type: "string", name: "twitter", label: "Twitter/X" },
              { type: "string", name: "instagram", label: "Instagram" },
            ],
          },
          {
            type: "boolean",
            name: "featured",
            label: "Featured",
          },
          {
            type: "rich-text",
            name: "body",
            label: "Full Bio",
            isBody: true,
          },
        ],
      },
      {
        name: "topics",
        label: "Topics",
        path: "src/content/topics",
        format: "mdx",
        ui: {
          filename: {
            readonly: true,
            slugify: (values) => {
              return values?.name
                ?.toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "") || "";
            },
          },
        },
        fields: [
          {
            type: "string",
            name: "name",
            label: "Name",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "description",
            label: "Description",
            required: true,
            ui: {
              component: "textarea",
            },
          },
          {
            type: "string",
            name: "icon",
            label: "Icon",
          },
          {
            type: "string",
            name: "segment",
            label: "Segment",
            options: [
              { label: "General", value: "general" },
              { label: "Poultry", value: "poultry" },
              { label: "Turf", value: "turf" },
              { label: "Agriculture", value: "agriculture" },
            ],
          },
          {
            type: "rich-text",
            name: "body",
            label: "Full Description",
            isBody: true,
          },
        ],
      },
      {
        name: "shopCollections",
        label: "Shop Collections",
        path: "src/content/collections",
        format: "mdx",
        ui: {
          filename: {
            readonly: true,
            slugify: (values) => {
              return values?.handle
                ?.toLowerCase()
                .replace(/[^a-z0-9-]+/g, "-")
                .replace(/(^-|-$)/g, "") || "";
            },
          },
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "handle",
            label: "Shopify Handle",
            description: "Must match the collection handle in Shopify (e.g., backyard-birds)",
            required: true,
          },
          {
            type: "string",
            name: "persona",
            label: "Persona",
            description: "Assign a persona for full themed layout. Leave empty for standard layout.",
            options: [
              { label: "Backyard Betty", value: "backyard" },
              { label: "Broiler Bill", value: "commercial" },
              { label: "Turf Pro Taylor", value: "lawn" },
            ],
          },
          {
            type: "string",
            name: "seoDescription",
            label: "SEO Description",
            description: "Meta description for search engines (150-160 chars)",
            ui: {
              component: "textarea",
            },
          },
          {
            type: "string",
            name: "heroHeadline",
            label: "Hero Headline",
          },
          {
            type: "string",
            name: "heroSubheadline",
            label: "Hero Subheadline",
          },
          {
            type: "string",
            name: "heroImage",
            label: "Hero Image (Cloudinary Public ID)",
            description: "Optional hero background image",
          },
          {
            type: "object",
            name: "faq",
            label: "FAQ",
            list: true,
            fields: [
              {
                type: "string",
                name: "question",
                label: "Question",
                required: true,
              },
              {
                type: "string",
                name: "answer",
                label: "Answer",
                required: true,
                ui: {
                  component: "textarea",
                },
              },
            ],
          },
          {
            type: "rich-text",
            name: "body",
            label: "Below-the-fold Content",
            description: "Rich content displayed below the product grid (education, guides, etc.)",
            isBody: true,
          },
        ],
      },
    ],
  },
});
