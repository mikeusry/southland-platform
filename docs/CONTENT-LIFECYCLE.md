# Content Lifecycle

How content moves from idea to indexed, across both systems.

## The Sequence

```
1. PLAN          site-audit-pages.ts    Add route with pipeline: 'no-copy'
      ↓
2. WRITE         src/content/blog/      Create MDX file with frontmatter
      ↓
3. AUDIT         /admin/site-audit      Run local quality checks (structure, SEO, E-E-A-T)
      ↓                                 Persona + voice scans work on content body
      ↓                                 Content gap scan WILL NOT WORK yet (not crawled)
      ↓
4. SHIP          Update pipeline        Set pipeline: 'shipped' in site-audit-pages.ts
      ↓           Deploy                Push to main → Cloudflare Pages deploys
      ↓
5. CRAWL         Mothership             Run: python scripts/crawl-and-embed-site.py --site southland
      ↓                                 ~5-10 min. Crawls live site, generates embeddings.
      ↓
6. SCAN          /admin/site-audit      Content gap scan now works (page is in vector index)
      ↓                                 Persona scoring compares against crawled content
      ↓
7. ITERATE       Fix gaps               Update content based on scan results, redeploy, re-crawl
```

## What Works at Each Stage

| Scan Type | Local (pre-deploy) | Live (post-deploy, pre-crawl) | Crawled (post-crawl) |
|-----------|-------------------|------------------------------|---------------------|
| Quality (word count, headings, readability) | Yes | Yes | Yes |
| SEO (title, OG tags, schema) | Yes | Yes | Yes |
| E-E-A-T (author, dates) | Yes | Yes | Yes |
| Persona scoring (which persona?) | Yes | Yes | Yes |
| Brand voice (transcript similarity) | Yes | Yes | Yes |
| **Content gap (overlap/orphan)** | **No** | **No** | **Yes** |

Content gap analysis requires the page to be in Mothership's `website_content` table, which only happens after a crawl.

## The Crawl Command

```bash
cd ~/CODING/mothership
python scripts/crawl-and-embed-site.py --site southland
```

**Requires:** `APIFY_TOKEN`, `OPENAI_API_KEY`, `SOUTHLAND_SUPABASE_URL`, `SOUTHLAND_SUPABASE_SERVICE_KEY` in mothership `.env`.

**Duration:** ~5-10 minutes for full site crawl.

**When to run:**
- After deploying new content to pages.dev
- After significant content edits on existing pages
- Before running content gap scans on recently published content

## Deploy Checklist

After merging content changes to main:

1. Verify Cloudflare Pages deploy completes (check pages.dev)
2. Run Mothership crawl: `cd ~/CODING/mothership && python scripts/crawl-and-embed-site.py --site southland`
3. Re-run content gap scans in `/admin/site-audit` for new pages
4. Update `pipeline` field in `site-audit-pages.ts` if not already 'shipped'

## Why Content Gap Scans Show Empty for New Posts

The content gap scan (`analyzeContentGap`) works by:
1. Embedding the new article text
2. Searching Mothership's `website_content` table for similar existing pages
3. Classifying: ORPHAN (nothing similar), WEAK (some overlap), CONFUSED (near-duplicate), OK (fills a gap)

If the article hasn't been crawled into `website_content` yet, step 2 finds nothing — not because there's no similar content, but because the index is stale. The scan result "Content gap: run scan" with no results means **re-crawl first, then re-scan**.

## Future: Automation

The crawl is currently manual. Future options:

1. **GitHub Action:** On push to main, trigger crawl in mothership repo via repository dispatch
2. **Cloudflare Pages deploy hook:** Webhook → n8n workflow → run crawl script
3. **Scheduled cron:** Weekly Sunday 2am crawl (config exists in `apify/southland-content-crawler.json` but not wired)

Until automated, the deploy checklist above is the process.
