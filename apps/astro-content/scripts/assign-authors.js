#!/usr/bin/env node
/**
 * Batch assign authors and reviewers to blog posts
 * Maps author names to team member slugs and assigns reviewers based on segment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.join(__dirname, '../src/content/blog');

// Map author names to team member slugs
const authorMap = {
  'Allen Reynolds': 'allen-reynolds',
  'Erin Flowers': 'erin-flowers',
  'Mike Usry': 'mike-usry',
  'Isabella Dobbins': 'isabella-dobbins',
  'Haley Stone': 'mike-usry', // Former employee with 1 post, map to Mike
};

// Assign reviewers based on segment expertise
const segmentReviewers = {
  'poultry': 'allen-reynolds', // Allen is poultry expert
  'agriculture': 'mike-usry',  // Mike is soil/humate expert
  'turf': 'mike-usry',         // Mike covers turf
  'general': 'mike-usry',      // Mike as CEO reviews general content
};

// Process all blog MDX files
const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.mdx'));

let updated = 0;
let skipped = 0;

for (const file of files) {
  const filePath = path.join(blogDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Extract current author (name format)
  const authorMatch = content.match(/^author:\s*"([^"]+)"/m);
  const authorName = authorMatch?.[1];

  // Extract segment
  const segmentMatch = content.match(/^segment:\s*"([^"]+)"/m);
  const segment = segmentMatch?.[1] || 'general';

  // Map author name to slug
  if (authorName && authorMap[authorName]) {
    const newAuthor = authorMap[authorName];
    content = content.replace(
      /^author:\s*"[^"]+"/m,
      `author: ${newAuthor}`
    );
    modified = true;
  }

  // Add reviewer if not present
  if (!content.match(/^reviewer:/m)) {
    const reviewer = segmentReviewers[segment] || 'mike-usry';
    // Don't add reviewer if it's the same as author
    const currentAuthor = content.match(/^author:\s*(\S+)/m)?.[1];
    if (currentAuthor !== reviewer) {
      // Insert reviewer after author line
      content = content.replace(
        /^(author:\s*\S+)/m,
        `$1\nreviewer: ${reviewer}`
      );
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    updated++;
  } else {
    skipped++;
  }
}

console.log(`\n✅ Author/Reviewer Assignment Complete`);
console.log(`   Updated: ${updated} files`);
console.log(`   Skipped: ${skipped} files (already assigned or no changes needed)`);
