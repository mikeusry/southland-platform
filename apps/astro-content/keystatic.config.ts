import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    team: collection({
      label: 'Team Members',
      slugField: 'name',
      path: 'src/content/team/*',
      format: { contentField: 'content' },
      columns: ['role', 'isAuthor', 'isReviewer', 'order'],
      previewUrl: '/team/{slug}',
      entryLayout: 'content',
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        role: fields.text({ label: 'Role/Title', validation: { isRequired: true } }),
        bio: fields.text({ label: 'Short Bio', multiline: true, validation: { isRequired: true } }),
        photo: fields.text({
          label: 'Photo (Cloudinary Public ID)',
          description: 'e.g., team/MIKE_Usry',
        }),
        email: fields.text({ label: 'Email' }),
        phone: fields.text({ label: 'Phone' }),
        links: fields.object({
          linkedin: fields.url({ label: 'LinkedIn URL' }),
          twitter: fields.url({ label: 'Twitter/X URL' }),
          website: fields.url({ label: 'Personal Website' }),
        }, { label: 'Social Links' }),
        // E-E-A-T fields for author credibility
        credentials: fields.array(fields.text({ label: 'Credential' }), {
          label: 'Credentials',
          description: 'Certifications, degrees, awards (e.g., "20+ years in organic agriculture")',
          itemLabel: props => props.value || 'Credential',
        }),
        expertiseAreas: fields.multiselect({
          label: 'Expertise Areas',
          description: 'Topics this person is qualified to write about',
          options: [
            { label: 'Poultry', value: 'poultry' },
            { label: 'Turf & Lawn', value: 'turf' },
            { label: 'Agriculture', value: 'agriculture' },
            { label: 'Soil Health', value: 'soil-health' },
            { label: 'Organic Farming', value: 'organic-farming' },
            { label: 'Waste Management', value: 'waste-management' },
          ],
        }),
        yearsExperience: fields.number({
          label: 'Years of Experience',
          description: 'Years working in agriculture/industry',
        }),
        isAuthor: fields.checkbox({
          label: 'Can Author Posts',
          defaultValue: false,
          description: 'This person can be selected as a blog author',
        }),
        isReviewer: fields.checkbox({
          label: 'Can Review Posts',
          defaultValue: false,
          description: 'This person can be selected as a content reviewer',
        }),
        // Display settings
        order: fields.number({
          label: 'Display Order',
          defaultValue: 99,
          description: 'Lower numbers appear first',
        }),
        featured: fields.checkbox({
          label: 'Featured',
          defaultValue: false,
          description: 'Show on homepage/contact page',
        }),
        active: fields.checkbox({
          label: 'Active',
          defaultValue: true,
          description: 'Currently with the company',
        }),
        content: fields.mdx({
          label: 'Extended Bio',
          description: 'Full bio content for individual page',
        }),
      },
    }),
    episodes: collection({
      label: 'Podcast Episodes',
      slugField: 'title',
      path: 'src/content/episodes/*',
      format: { contentField: 'content' },
      columns: ['episodeNumber', 'publishDate', 'duration'],
      previewUrl: '/podcast/{slug}',
      entryLayout: 'content',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        episodeNumber: fields.number({ label: 'Episode Number', validation: { isRequired: true } }),
        season: fields.number({ label: 'Season', defaultValue: 1 }),
        publishDate: fields.date({ label: 'Publish Date', validation: { isRequired: true } }),
        description: fields.text({ label: 'Description', multiline: true, validation: { isRequired: true } }),
        longDescription: fields.text({ label: 'Long Description', multiline: true }),
        gumletId: fields.text({ label: 'Gumlet Video ID' }),
        audioUrl: fields.url({ label: 'Audio URL' }),
        youtubeUrl: fields.url({ label: 'YouTube URL' }),
        applePodcastUrl: fields.url({ label: 'Apple Podcast URL' }),
        spotifyUrl: fields.url({ label: 'Spotify URL' }),
        thumbnail: fields.text({ label: 'Thumbnail (Cloudinary ID)' }),
        duration: fields.text({ label: 'Duration (45:32 format)', validation: { isRequired: true } }),
        durationSeconds: fields.number({ label: 'Duration in Seconds', validation: { isRequired: true } }),
        topics: fields.array(fields.text({ label: 'Topic' }), {
          label: 'Topics',
          itemLabel: props => props.value || 'Topic',
        }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
        content: fields.mdx({ label: 'Show Notes' }),
      },
    }),
    guests: collection({
      label: 'Podcast Guests',
      slugField: 'name',
      path: 'src/content/guests/*',
      format: { contentField: 'content' },
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        role: fields.text({ label: 'Role/Title' }),
        company: fields.text({ label: 'Company' }),
        bio: fields.text({ label: 'Bio', multiline: true, validation: { isRequired: true } }),
        photo: fields.text({ label: 'Photo (Cloudinary Public ID)' }),
        links: fields.object({
          website: fields.url({ label: 'Website' }),
          linkedin: fields.url({ label: 'LinkedIn' }),
          twitter: fields.url({ label: 'Twitter/X' }),
          instagram: fields.url({ label: 'Instagram' }),
        }, { label: 'Links' }),
        featured: fields.checkbox({ label: 'Featured', defaultValue: false }),
        content: fields.mdx({ label: 'Full Bio' }),
      },
    }),
    blog: collection({
      label: 'Blog Posts',
      slugField: 'title',
      path: 'src/content/blog/*',
      format: { contentField: 'content' },
      columns: ['publishDate', 'segment', 'author'],
      previewUrl: '/blog/{slug}',
      entryLayout: 'content',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        publishDate: fields.date({ label: 'Publish Date', validation: { isRequired: true } }),
        updatedDate: fields.date({ label: 'Last Updated', description: 'Set when content is significantly updated' }),
        description: fields.text({ label: 'Description', multiline: true, validation: { isRequired: true } }),
        // E-E-A-T: Author and Reviewer (team member slugs)
        author: fields.relationship({
          label: 'Author',
          description: 'Team member who wrote this article',
          collection: 'team',
        }),
        reviewer: fields.relationship({
          label: 'Reviewer',
          description: 'Team member who reviewed/fact-checked this article (for E-E-A-T)',
          collection: 'team',
        }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          itemLabel: props => props.value || 'Tag',
        }),
        segment: fields.select({
          label: 'Segment',
          options: [
            { label: 'General', value: 'general' },
            { label: 'Poultry', value: 'poultry' },
            { label: 'Turf', value: 'turf' },
            { label: 'Agriculture', value: 'agriculture' },
          ],
          defaultValue: 'general',
        }),
        featuredImage: fields.text({ label: 'Featured Image URL' }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
        // Shopify migration fields (read-only reference)
        shopifyId: fields.text({ label: 'Shopify ID', description: 'Original Shopify article ID' }),
        shopifyHandle: fields.text({ label: 'Shopify Handle', description: 'Original Shopify URL handle' }),
        content: fields.mdx({ label: 'Content' }),
      },
    }),
    topics: collection({
      label: 'Topics',
      slugField: 'name',
      path: 'src/content/topics/*',
      format: { contentField: 'content' },
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        description: fields.text({ label: 'Description', multiline: true, validation: { isRequired: true } }),
        icon: fields.text({ label: 'Icon' }),
        segment: fields.select({
          label: 'Segment',
          options: [
            { label: 'General', value: 'general' },
            { label: 'Poultry', value: 'poultry' },
            { label: 'Turf', value: 'turf' },
            { label: 'Agriculture', value: 'agriculture' },
          ],
          defaultValue: 'general',
        }),
        content: fields.mdx({ label: 'Full Description' }),
      },
    }),
  },
});
