---
title: Joseph's Podcast Production Checklist — DRAFT
date: 2026-04-24
status: DRAFT — Claude-authored from assumptions. Joseph to review and edit into reality.
owner: Joseph Boehm
reviewer: Mike Usry
---

# Joseph's Podcast Production Checklist — DRAFT

> **This is a starter checklist written by Claude based on best guesses about what Joseph does today. Joseph — please correct every line that's wrong. Your real process beats my theoretical one. Anything you add here gets absorbed into the unified content workflow.**

---

## Pre-recording (T−7 to T−4)

### Topic + brief
- [ ] Episode topic confirmed with Mike
- [ ] Working title drafted
- [ ] Target persona(s) identified (Backyard Betty, Broiler Bill, Turf Pro Taylor, Mold Molly, or general)
- [ ] Primary search keyword identified
- [ ] 2–3 secondary keywords identified
- [ ] Top 3–5 SERP competitors reviewed (what do they cover? what's missing?)
- [ ] "People Also Ask" questions captured (3–5)
- [ ] YouTube autocomplete suggestions captured for the main topic
- [ ] Customer support ticket themes from the last 30 days reviewed for relevant questions
- [ ] Reddit/forum threads on the topic reviewed (optional)
- [ ] Talking points drafted (8–12 bullets, each tied to a keyword or question)
- [ ] Chapter plan drafted (6–10 chapters, each answering a specific question)
- [ ] Related products identified (which SKUs should surface on the episode page?)
- [ ] Related episodes identified (2–3 for cross-linking)
- [ ] Related blog posts identified (2–3 pillar pages to link to/from)
- [ ] CTA per persona decided (where do we send listeners at the end?)

### Guest logistics (if applicable)
- [ ] Guest confirmed and scheduled
- [ ] Guest bio + photo + company + links collected
- [ ] Guest consent / release signed
- [ ] Pre-interview questions sent to guest
- [ ] Guest told where audio/video will end up (Spotify, Apple, YouTube, website)

### Tech prep
- [ ] Recording software tested (mic levels, video framing)
- [ ] Backup audio recording method ready
- [ ] Guest audio levels pre-tested on a call
- [ ] Outline / questions loaded and visible during recording

---

## Recording day (T−7)

- [ ] Final audio check (both sides)
- [ ] Record intro/outro separately if needed
- [ ] Record main episode (target 30–40 minutes raw)
- [ ] Record any bonus clips (30-second "teaser" answers Joseph may want for social)
- [ ] Log standout moments with timestamps for future Shorts
- [ ] Export raw audio immediately, back up to second location
- [ ] Export raw video if applicable

---

## Post-production (T−6 to T−3)

### Audio
- [ ] Rough-cut: trim dead air, filler, major flubs
- [ ] Final cut: tighten pacing
- [ ] Normalize audio levels
- [ ] Add intro/outro bumpers
- [ ] Master at podcast-standard LUFS (-16 LUFS mono / -19 LUFS stereo target)
- [ ] Export final audio MP3
- [ ] Upload to R2 bucket
- [ ] Capture file size (bytes) for RSS enclosure

### Video
- [ ] Color-correct (if applicable)
- [ ] Sync audio to video
- [ ] Add lower thirds for guest name/role
- [ ] Cover art / episode thumbnail created (Cloudinary, 1600×900)
- [ ] Burn-in captions for first 15 seconds (retention hook)
- [ ] Export full video

### Mux upload
- [ ] Upload audio to Mux (audio-only asset)
- [ ] Upload video to Mux (if video-enabled episode)
- [ ] Capture Mux playback IDs (audio + video separately)
- [ ] Verify Mux thumbnail auto-generates

### Transcript
- [ ] Generate transcript via Whisper
- [ ] Human-review for errors, especially product names and technical terms
- [ ] Add chapter-level timestamps
- [ ] Paste into episode record

### Metadata
- [ ] Final episode title (SEO-aligned with primary keyword)
- [ ] Episode description (150–200 words, primary keyword in first 2 lines)
- [ ] Short description / hook (1 sentence, curiosity-driven — goes in email subject line)
- [ ] Chapter titles (keyword-rich, each 2–8 words)
- [ ] Topic tags (from shared taxonomy)
- [ ] Guest info linked
- [ ] FAQ entries drafted from People Also Ask (3–5 Q&A pairs)
- [ ] Cover image selected from Cloudinary
- [ ] Related products linked
- [ ] Related episodes linked
- [ ] Related blog posts linked

---

## YouTube publish (T−2, 48h ahead of site/email)

### Upload
- [ ] Video uploaded to correct channel (main Southland / Poultry Biosecurity / depends on persona)
- [ ] Title optimized (primary keyword near front)
- [ ] Description formatted:
  - [ ] First 2 lines contain the hook + primary keyword
  - [ ] Chapter timestamps listed
  - [ ] UTM-tagged links back to southlandorganics.com/podcast/[slug]/
  - [ ] UTM-tagged links to related products
  - [ ] Guest links (if applicable)
- [ ] Tags added (from brief)
- [ ] Thumbnail uploaded (custom, high-contrast, readable at small size)
- [ ] End screen configured (related videos, subscribe)
- [ ] Cards added (related products, related episodes)
- [ ] Playlist assignment: "Ag & Culture Podcast" + any topical playlists
- [ ] Scheduled for T−2 (48h before site launch)
- [ ] YouTube video URL captured

### YouTube audit check
- [ ] Nexus YouTube audit tool run against new video
- [ ] Audit score ≥ 80 (if below, apply suggested fixes before going public)
- [ ] Primary keyword confirmed set in Nexus for this video

---

## Site + RSS publish (T0)

- [ ] Episode MDX page generated (via Nexus "Generate MDX" action)
- [ ] Pull request reviewed + merged to southland-platform main
- [ ] Deploy confirmed on southlandorganics.com/podcast/[slug]/
- [ ] Page renders: video player, audio player, chapters, transcript, FAQ, related products
- [ ] JSON-LD validates (PodcastEpisode + FAQPage)
- [ ] OG image loads correctly
- [ ] RSS feed regenerated — new episode appears at /podcast/feed.xml
- [ ] Spotify pulls update (usually within 1–24h — verify next day)
- [ ] Apple Podcasts pulls update (usually within 1–24h — verify next day)

---

## Email (T0, same day as site publish)

- [ ] Klaviyo Touch 1 campaign built via Nexus integration
- [ ] Subject line uses the hook field
- [ ] Preview text drafted
- [ ] Segment set: persona-matched recipients from list `WqRKi8`
- [ ] Links UTM-tagged
- [ ] Test send to self + Mike
- [ ] Campaign scheduled or sent

---

## Social launch (T0 + T+1 to T+3)

- [ ] LinkedIn post (Mike personal + Southland company page)
- [ ] Instagram post (feed + story)
- [ ] Facebook post
- [ ] First Short uploaded (YouTube Shorts + Instagram Reels + TikTok)
- [ ] Remaining 1–3 Shorts staggered across days T+1 to T+3
- [ ] Guest tagged on all platforms (if applicable)
- [ ] Guest sent the episode + social graphics to reshare

---

## Follow-up email (T+3 to T+5)

- [ ] Klaviyo Touch 2 campaign built (Nexus auto or manual)
- [ ] Segment: did-not-click from Touch 1
- [ ] Subject: takeaway-focused, not "new episode"
- [ ] Body: 3 key takeaways + one 30-second clip or pull quote
- [ ] Scheduled or sent

---

## Week-one close-out (T+7)

- [ ] Website play count captured
- [ ] Klaviyo open/click/revenue captured
- [ ] YouTube retention curve reviewed (where do people drop off?)
- [ ] YouTube views → site click-through captured (via UTM)
- [ ] Persona distribution of listeners captured
- [ ] Related-product add-to-cart count captured
- [ ] Analytics summary pasted into episode record as "7-day results"
- [ ] Any surprises or learnings noted for future briefs

---

## Every-so-often tasks (not per-episode)

- [ ] Monthly: pull YouTube audit scores across all 3 channels, schedule retroactive fixes
- [ ] Monthly: review which topics are getting cited in AI Overviews
- [ ] Quarterly: review what episodes drove the most cohort LTV lift (vs. baseline)
- [ ] Quarterly: rebalance production cadence by persona (which personas are underserved?)

---

## Joseph — please edit this doc

Every item here is a guess. Edit it:
- **Delete** items that don't apply (tools you don't use, steps that are someone else's job, things we don't actually do)
- **Add** items that are missing (there WILL be missing items — you know your process, I don't)
- **Correct** the order wherever I got the sequence wrong
- **Flag** anything that's currently broken or painful — those are the parts the Nexus admin should fix

Once you've edited this, we'll absorb it into the unified Nexus content workflow so every step becomes a field, a state transition, or an automated action.
