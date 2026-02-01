// tina/config.ts
import { defineConfig } from "tinacms";
var config_default = defineConfig({
  branch: process.env.TINA_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || process.env.HEAD || "main",
  clientId: process.env.TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",
  build: {
    outputFolder: "admin",
    publicFolder: "public"
  },
  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "public"
    }
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
              return values?.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "";
            }
          }
        },
        defaultItem: () => ({
          publishDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          draft: true,
          segment: "general"
        }),
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true
          },
          {
            type: "datetime",
            name: "publishDate",
            label: "Publish Date",
            required: true,
            ui: {
              dateFormat: "YYYY-MM-DD"
            }
          },
          {
            type: "datetime",
            name: "updatedDate",
            label: "Last Updated",
            description: "Set when content is significantly updated",
            ui: {
              dateFormat: "YYYY-MM-DD"
            }
          },
          {
            type: "string",
            name: "description",
            label: "Description",
            required: true,
            ui: {
              component: "textarea"
            }
          },
          {
            type: "string",
            name: "author",
            label: "Author",
            description: "Team member slug who wrote this article"
          },
          {
            type: "string",
            name: "reviewer",
            label: "Reviewer",
            description: "Team member slug who reviewed/fact-checked this article (for E-E-A-T)"
          },
          {
            type: "string",
            name: "tags",
            label: "Tags",
            list: true
          },
          {
            type: "string",
            name: "segment",
            label: "Segment",
            options: [
              { label: "General", value: "general" },
              { label: "Poultry", value: "poultry" },
              { label: "Turf", value: "turf" },
              { label: "Agriculture", value: "agriculture" }
            ]
          },
          {
            type: "string",
            name: "featuredImage",
            label: "Featured Image URL"
          },
          {
            type: "boolean",
            name: "draft",
            label: "Draft"
          },
          {
            type: "number",
            name: "shopifyId",
            label: "Shopify ID",
            description: "Original Shopify article ID"
          },
          {
            type: "string",
            name: "shopifyHandle",
            label: "Shopify Handle",
            description: "Original Shopify URL handle"
          },
          {
            type: "rich-text",
            name: "body",
            label: "Content",
            isBody: true
          }
        ]
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
              return values?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "";
            }
          }
        },
        fields: [
          {
            type: "string",
            name: "name",
            label: "Name",
            isTitle: true,
            required: true
          },
          {
            type: "string",
            name: "role",
            label: "Role/Title",
            required: true
          },
          {
            type: "string",
            name: "bio",
            label: "Short Bio",
            required: true,
            ui: {
              component: "textarea"
            }
          },
          {
            type: "string",
            name: "photo",
            label: "Photo (Cloudinary Public ID)",
            description: "e.g., team/MIKE_Usry"
          },
          {
            type: "string",
            name: "email",
            label: "Email"
          },
          {
            type: "string",
            name: "phone",
            label: "Phone"
          },
          {
            type: "object",
            name: "links",
            label: "Social Links",
            fields: [
              { type: "string", name: "linkedin", label: "LinkedIn URL" },
              { type: "string", name: "twitter", label: "Twitter/X URL" },
              { type: "string", name: "website", label: "Personal Website" }
            ]
          },
          {
            type: "string",
            name: "credentials",
            label: "Credentials",
            description: 'Certifications, degrees, awards (e.g., "20+ years in organic agriculture")',
            list: true
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
              { label: "Waste Management", value: "waste-management" }
            ]
          },
          {
            type: "number",
            name: "yearsExperience",
            label: "Years of Experience",
            description: "Years working in agriculture/industry"
          },
          {
            type: "boolean",
            name: "isAuthor",
            label: "Can Author Posts",
            description: "This person can be selected as a blog author"
          },
          {
            type: "boolean",
            name: "isReviewer",
            label: "Can Review Posts",
            description: "This person can be selected as a content reviewer"
          },
          {
            type: "number",
            name: "order",
            label: "Display Order",
            description: "Lower numbers appear first"
          },
          {
            type: "boolean",
            name: "featured",
            label: "Featured",
            description: "Show on homepage/contact page"
          },
          {
            type: "boolean",
            name: "active",
            label: "Active",
            description: "Currently with the company"
          },
          {
            type: "rich-text",
            name: "body",
            label: "Extended Bio",
            description: "Full bio content for individual page",
            isBody: true
          }
        ]
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
              return values?.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "";
            }
          }
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true
          },
          {
            type: "number",
            name: "episodeNumber",
            label: "Episode Number",
            required: true
          },
          {
            type: "number",
            name: "season",
            label: "Season"
          },
          {
            type: "datetime",
            name: "publishDate",
            label: "Publish Date",
            required: true
          },
          {
            type: "string",
            name: "description",
            label: "Description",
            required: true,
            ui: {
              component: "textarea"
            }
          },
          {
            type: "string",
            name: "longDescription",
            label: "Long Description",
            ui: {
              component: "textarea"
            }
          },
          {
            type: "string",
            name: "gumletId",
            label: "Gumlet Video ID"
          },
          {
            type: "string",
            name: "audioUrl",
            label: "Audio URL"
          },
          {
            type: "string",
            name: "youtubeUrl",
            label: "YouTube URL"
          },
          {
            type: "string",
            name: "applePodcastUrl",
            label: "Apple Podcast URL"
          },
          {
            type: "string",
            name: "spotifyUrl",
            label: "Spotify URL"
          },
          {
            type: "string",
            name: "thumbnail",
            label: "Thumbnail (Cloudinary ID)"
          },
          {
            type: "string",
            name: "duration",
            label: "Duration (45:32 format)",
            required: true
          },
          {
            type: "number",
            name: "durationSeconds",
            label: "Duration in Seconds",
            required: true
          },
          {
            type: "string",
            name: "topics",
            label: "Topics",
            list: true
          },
          {
            type: "boolean",
            name: "draft",
            label: "Draft"
          },
          {
            type: "rich-text",
            name: "body",
            label: "Show Notes",
            isBody: true
          }
        ]
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
              return values?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "";
            }
          }
        },
        fields: [
          {
            type: "string",
            name: "name",
            label: "Name",
            isTitle: true,
            required: true
          },
          {
            type: "string",
            name: "role",
            label: "Role/Title"
          },
          {
            type: "string",
            name: "company",
            label: "Company"
          },
          {
            type: "string",
            name: "bio",
            label: "Bio",
            required: true,
            ui: {
              component: "textarea"
            }
          },
          {
            type: "string",
            name: "photo",
            label: "Photo (Cloudinary Public ID)"
          },
          {
            type: "object",
            name: "links",
            label: "Links",
            fields: [
              { type: "string", name: "website", label: "Website" },
              { type: "string", name: "linkedin", label: "LinkedIn" },
              { type: "string", name: "twitter", label: "Twitter/X" },
              { type: "string", name: "instagram", label: "Instagram" }
            ]
          },
          {
            type: "boolean",
            name: "featured",
            label: "Featured"
          },
          {
            type: "rich-text",
            name: "body",
            label: "Full Bio",
            isBody: true
          }
        ]
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
              return values?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "";
            }
          }
        },
        fields: [
          {
            type: "string",
            name: "name",
            label: "Name",
            isTitle: true,
            required: true
          },
          {
            type: "string",
            name: "description",
            label: "Description",
            required: true,
            ui: {
              component: "textarea"
            }
          },
          {
            type: "string",
            name: "icon",
            label: "Icon"
          },
          {
            type: "string",
            name: "segment",
            label: "Segment",
            options: [
              { label: "General", value: "general" },
              { label: "Poultry", value: "poultry" },
              { label: "Turf", value: "turf" },
              { label: "Agriculture", value: "agriculture" }
            ]
          },
          {
            type: "rich-text",
            name: "body",
            label: "Full Description",
            isBody: true
          }
        ]
      }
    ]
  }
});
export {
  config_default as default
};
