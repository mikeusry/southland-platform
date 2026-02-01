#!/usr/bin/env node
/**
 * Migrate Shopify Blog Posts to Astro MDX
 *
 * Fetches all blog posts from Shopify and creates MDX files
 * in src/content/blog/ for each post.
 *
 * Usage:
 *   node scripts/migrate-shopify-blogs.js
 *   node scripts/migrate-shopify-blogs.js --dry-run   # Preview without writing
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import TurndownService from 'turndown';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '../src/content/blog');

// Load env from mothership/.env
function loadEnv(path) {
  try {
    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          let value = trimmed.slice(eqIndex + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      }
    }
  } catch (e) {
    console.log(`   Note: Could not load ${path}`);
  }
}

loadEnv('/Users/mikeusry/CODING/mothership/.env');

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL || 'southland-organics.myshopify.com';
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2024-04';

if (!SHOPIFY_TOKEN) {
  console.error('❌ SHOPIFY_ACCESS_TOKEN not found in mothership/.env');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

// Initialize Turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Custom rule for Shopify images
turndownService.addRule('shopifyImages', {
  filter: 'img',
  replacement: (content, node) => {
    const src = node.getAttribute('src') || '';
    const alt = node.getAttribute('alt') || '';
    // Clean up Shopify CDN URLs
    const cleanSrc = src.replace(/\?.*$/, '');
    return `![${alt}](${cleanSrc})`;
  }
});

/**
 * Fetch from Shopify Admin API
 */
async function shopifyFetch(endpoint) {
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch all blogs (categories)
 */
async function fetchBlogs() {
  const data = await shopifyFetch('blogs.json');
  return data.blogs || [];
}

/**
 * Fetch all articles from a blog with pagination
 */
async function fetchArticles(blogId, blogHandle) {
  const articles = [];
  let pageInfo = null;

  do {
    let endpoint = `blogs/${blogId}/articles.json?limit=250`;
    if (pageInfo) {
      endpoint += `&page_info=${pageInfo}`;
    }

    const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/${endpoint}`, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    // Add blog handle to each article
    const articlesWithBlog = (data.articles || []).map(article => ({
      ...article,
      blogHandle,
    }));

    articles.push(...articlesWithBlog);

    // Check for pagination
    const linkHeader = response.headers.get('link');
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/page_info=([^&>]+)/);
      pageInfo = match ? match[1] : null;
    } else {
      pageInfo = null;
    }
  } while (pageInfo);

  return articles;
}

/**
 * Create slug from title
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Map blog handle to segment
 */
function getSegment(blogHandle) {
  const segmentMap = {
    'poultry': 'poultry',
    'poultry-blog': 'poultry',
    'commercial-poultry': 'poultry',
    'turf': 'turf',
    'turf-blog': 'turf',
    'lawn': 'turf',
    'lawn-care': 'turf',
    'agriculture': 'agriculture',
    'ag': 'agriculture',
    'general': 'general',
    'news': 'general',
  };

  return segmentMap[blogHandle] || 'general';
}

/**
 * Extract tags from article
 */
function extractTags(article) {
  if (!article.tags) return [];
  return article.tags.split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * Convert article to MDX frontmatter + content
 */
function articleToMDX(article) {
  const publishDate = article.published_at
    ? new Date(article.published_at).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const tags = extractTags(article);
  const segment = getSegment(article.blogHandle);

  // Convert HTML to Markdown
  const bodyMarkdown = article.body_html
    ? turndownService.turndown(article.body_html)
    : '';

  // Extract featured image
  const featuredImage = article.image?.src || '';

  // Build frontmatter
  const frontmatter = {
    title: article.title,
    publishDate,
    description: article.summary_html
      ? turndownService.turndown(article.summary_html).slice(0, 300)
      : bodyMarkdown.slice(0, 300).replace(/\n/g, ' '),
    author: article.author || 'Southland Organics',
    segment,
    tags,
    featuredImage,
    shopifyId: article.id,
    shopifyHandle: article.handle,
    draft: false,
  };

  // Clean up description
  frontmatter.description = frontmatter.description.replace(/"/g, '\\"');

  const yaml = `---
title: "${article.title.replace(/"/g, '\\"')}"
publishDate: ${publishDate}
description: "${frontmatter.description}"
author: "${frontmatter.author}"
segment: "${segment}"
tags: ${JSON.stringify(tags)}
featuredImage: "${featuredImage}"
shopifyId: ${article.id}
shopifyHandle: "${article.handle}"
draft: false
---`;

  return `${yaml}

${bodyMarkdown}
`;
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Migrating Shopify blogs to Astro MDX...\n');

  if (DRY_RUN) {
    console.log('📋 DRY RUN MODE - No files will be written\n');
  }

  // Create content directory
  if (!DRY_RUN && !existsSync(CONTENT_DIR)) {
    mkdirSync(CONTENT_DIR, { recursive: true });
    console.log(`📁 Created ${CONTENT_DIR}\n`);
  }

  // Fetch all blogs
  console.log('📚 Fetching blogs from Shopify...');
  const blogs = await fetchBlogs();
  console.log(`   Found ${blogs.length} blogs:\n`);

  for (const blog of blogs) {
    console.log(`   - ${blog.title} (${blog.handle})`);
  }
  console.log('');

  let totalArticles = 0;
  let migratedArticles = 0;
  const errors = [];

  // Fetch articles from each blog
  for (const blog of blogs) {
    console.log(`\n📖 Fetching articles from "${blog.title}"...`);
    const articles = await fetchArticles(blog.id, blog.handle);
    console.log(`   Found ${articles.length} articles`);
    totalArticles += articles.length;

    for (const article of articles) {
      const slug = article.handle || slugify(article.title);
      const filename = `${slug}.mdx`;
      const filepath = join(CONTENT_DIR, filename);

      try {
        const mdxContent = articleToMDX(article);

        if (DRY_RUN) {
          console.log(`   📝 Would create: ${filename}`);
        } else {
          writeFileSync(filepath, mdxContent);
          console.log(`   ✅ Created: ${filename}`);
        }
        migratedArticles++;
      } catch (error) {
        console.log(`   ❌ Error: ${filename} - ${error.message}`);
        errors.push({ article: article.title, error: error.message });
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`   Total blogs: ${blogs.length}`);
  console.log(`   Total articles: ${totalArticles}`);
  console.log(`   Migrated: ${migratedArticles}`);
  console.log(`   Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const err of errors) {
      console.log(`   - ${err.article}: ${err.error}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n📋 This was a DRY RUN. Run without --dry-run to actually migrate.');
  } else {
    console.log('\n✅ Migration complete!');
    console.log(`   Files written to: ${CONTENT_DIR}`);
  }
}

migrate().catch(console.error);
