# Cloudinary Account Cleanup Plan

**Account:** `southland-organics` (Free plan)
**Audit date:** 2026-03-23
**Last updated:** 2026-03-23

## Execution Log

| Phase | Status | Date | Resources | Storage |
|-------|--------|------|-----------|---------|
| **1a DELETE** | ✅ DONE | 2026-03-23 | -106 | -446 MB |
| **1b MERGE** | ✅ DONE | 2026-03-23 | 0 (renames) | 0 |
| **2 ARCHIVE** | ✅ DONE | 2026-03-23 | 433 moved to `archive/` | 1.8 GB (moved, not freed) |
| **3 ORPHANS** | ✅ DONE | 2026-03-23 | 507 moved to `archive/REVIEW-orphans/` | 834 MB (moved, not freed) |

**Current state:** 2,907 resources, 18 top-level folders (down from 32), 5.93 GB storage
**Credits:** 18.1 / 25.0 (72.3%) — storage freed once you delete from `archive/`

### Phase 1a Completed
Deleted: `samples/`, `Prince/`, `Summer 2021 Interns/`, `Archives/`, `Email Assetts/`

### Phase 1b Completed
- `Southland Sanitize/` (30 images) → `d2-sanitizers/` ✅
- `Poultry/` (3 images) → `Southland Website/poultry/` ✅
- `Waste/` (1 image) → `Southland Website/` ✅
- `heiser/` ↔ `Heiser/` — Cloudinary is case-insensitive; already same folder. Updated Heiser project code from `heiser/heiser/` → `Heiser/heiser/` for consistency.
- `CPRC/` ↔ `cprc/` — same; already unified. Updated CPRC project code from `CPRC/` → `cprc/` in URLs.

**Note:** Cloudinary's Admin API rename endpoint does NOT work with basic auth. Must use the Upload API signed rename (`POST /v1_1/:cloud/image/rename` with SHA1 signature). Video rename uses `/video/rename`. Script updated.

### Phase 2 Completed

Moved to `archive/`:
- `Greenhouse/` (113 images + 8 videos) → `archive/Greenhouse/`
- `Garden/` (111 images + 5 videos) → `archive/Garden/`
- `Products at Office/` (24 images) → `archive/Products at Office/`
- `Office/` (22 images) → `archive/Office/`
- `Drain + Tree/` (70 images + 3 videos) → `archive/Drain + Tree/`
- `2022/` (81 images) → `archive/2022/`

Updated 1 blog MDX ref: `understanding-humate-a-beginners-guide.mdx` (Products at Office → archive/Products at Office)

### Phase 3 Completed — Orphans Moved to Review

All orphaned images moved to `archive/REVIEW-orphans/` for manual review:

| Source | Orphans Moved | Size | What Remains in Source |
|--------|--------------|------|----------------------|
| Blog Images | 67 → `archive/REVIEW-orphans/Blog Images/` | 116 MB | 379 referenced images (used in blog MDX) |
| Product Images | 293 → `archive/REVIEW-orphans/Product Images/` | 501 MB | 35 referenced images (used in blog MDX + scripts) |
| Chicks | 104 → `archive/REVIEW-orphans/Chicks/` | 200 MB | 2 referenced images (rickets-in-chickens.mdx) |
| Lawn Bundles | 18 → `archive/REVIEW-orphans/Lawn Bundles/` | 10 MB | 0 (folder deleted) |
| Logos | 25 → `archive/REVIEW-orphans/Logos/` | 7 MB | 2 raw font files (stuck, sig issue) |

**To review:** Browse `archive/REVIEW-orphans/` in Cloudinary console. Download anything you want to keep, then delete the entire `REVIEW-orphans` folder.

### Remaining Cleanup (not urgent)

- `Logos/Fonts/` — 2 raw font files (.ttf, .woff2) couldn't be renamed (signature mismatch). Delete manually if not needed.
- `CPRC/` folder shows in list (case-insensitive alias of `cprc/`) — cosmetic only
- Empty source folders were deleted except those with subfolders Cloudinary won't garbage-collect

---

**Original audit stats (pre-cleanup):**
**Resources:** 3,013 images, 38 videos, 3 raw = 3,054 total
**Storage:** 6.4 GB

---

## Account Overview

One Cloudinary cloud (`southland-organics`) shared by **15 projects**:

| Project | Folder(s) | Images | Size | Status |
|---------|-----------|--------|------|--------|
| **Southland Organics** | `Southland Website/` + scattered | 159 + ~900 scattered | 99 MB + ~1.6 GB | Production |
| **D2 Sanitizers** | `d2-sanitizers/` | 241 | 50 MB | Active, well-organized |
| **Soul Miner's Eden** | `Soul Miner's/` | 356 | 1.1 GB | Active |
| **SpraySquad** | `Spray Squad/` | 327 | 401 MB | Active |
| **point.dog** | `point.dog/` | 84 | 103 MB | Active |
| **Heiser** | `Heiser/` + `heiser/` | 77 | 76 MB | Active (duplicate folders) |
| **Pour the PORT** | `pour-the-port/` | 30 | 7 MB | Active |
| **Banyan Tree** | `banyan_tree/` | 144 | 42 MB | Client |
| **CPRC** | `cprc/` + `CPRC/` | 63 | 11 MB | Client (duplicate folders) |
| **Hamilton Agency** | `Hamilton Agency/` | 6 | 2 MB | Client |
| **JockShock** | `JockShock/` | 5 | 1 MB | Active |
| **Stars National Walker** | `StarsNationalWalker/` | 10 | 22 MB | Active |
| **Ayn Parker Usry** | `AynParkerUsry/` | 6 | 36 MB | Personal |
| **southland-inventory** | (uses shared images) | — | — | Active |
| **union-county-splost** | (configured, unused) | — | — | Dormant |

### Problems

1. **32 top-level folders** with no hierarchy or naming convention
2. **Southland content scattered across 12 folders** instead of one
3. **~1.4 GB personal/farm photos** (Greenhouse, Garden, Prince, Interns, Office)
4. **Duplicate folders** from case mismatches (heiser/Heiser, cprc/CPRC)
5. **Free plan at 72%** — will hit limits with CRO expansion

---

## Phase 1a: DELETE (Safe — Zero Code References)

**Impact: 106 resources, 446 MB freed**

| Folder | Images | Size | Notes |
|--------|--------|------|-------|
| `samples/` | 7 | 25 MB | Cloudinary default sample images |
| `Prince/` | 36 | 126 MB | Personal photos (dog/track) |
| `Summer 2021 Interns/` | 54 | 285 MB | Personal photos |
| `Archives/` | 1 | 8 MB | Single unknown image |
| `Email Assetts/` | 8 | 3 MB | Zero refs, typo folder name |

**Verification:** Each folder searched across all 12 codebases. Zero references found.

```bash
# Execute
./scripts/cloudinary-cleanup.sh 1a
```

---

## Phase 1b: MERGE (Safe — Consolidate Duplicates)

**Impact: 76 resources reorganized, no storage change**

| From | To | Images | Notes |
|------|----|--------|-------|
| `CPRC/` | `cprc/` | 1 | Case-duplicate |
| `Southland Sanitize/` | `d2-sanitizers/` | 30 | Old brand name, zero refs |
| `Poultry/` | `Southland Website/poultry/` | 3 | Consolidation |
| `Waste/` | `Southland Website/` | 1 | Consolidation |
| `heiser/` | `Heiser/` | 41 | Case-duplicate |

**Warning:** Renames change public_ids. Old URLs will 404 immediately. All verified zero live code references.

```bash
# Execute
./scripts/cloudinary-cleanup.sh 1b
```

---

## Phase 2: ARCHIVE (Move to `archive/` prefix)

**Impact: 433 resources, 1.8 GB moved (not deleted)**

| Folder | Images | Size | Live Refs | Notes |
|--------|--------|------|-----------|-------|
| `Greenhouse/` | 120 | 818 MB | 0 | Personal farm photos |
| `Garden/` | 114 | 372 MB | 0 | Personal farm photos |
| `Drain + Tree/` | 73 | 198 MB | 0 | Only in mothership docs |
| `Products at Office/` | 24 | 177 MB | **1** | `understanding-humate-a-beginners-guide.mdx` |
| `2022/` | 80 | 132 MB | 0 | Dated photos |
| `Office/` | 22 | 84 MB | **1** | Blog ref (needs verification) |

**Before executing:** Update the 2 blog MDX files that reference `Products at Office` and `Office` images:
- `apps/astro-content/src/content/blog/understanding-humate-a-beginners-guide.mdx:70`
  - Current: `Products%20at%20Office/humate%20application`
  - Update to: `archive/Products%20at%20Office/humate%20application`

```bash
# Execute (after updating MDX refs)
./scripts/cloudinary-cleanup.sh 2
```

---

## Phase 3: AUDIT Results — Orphan Analysis

### Blog Images (446 total, 641 MB)

| Status | Count | Size |
|--------|-------|------|
| **Referenced** (in blog MDX) | 379 | 525 MB |
| **Orphaned** (zero refs anywhere) | 67 | 116 MB |

Orphan list: `/tmp/cld_blog_images_orphaned.txt`

These 379 images are hardcoded as full Cloudinary URLs in blog `.mdx` files (e.g. `https://res.cloudinary.com/southland-organics/image/upload/v.../Blog%20Images/...`). They **cannot be moved without updating every blog post** that references them.

**Recommendation:**
- DELETE the 67 orphans (116 MB freed)
- Leave the 379 referenced images in place for now
- Future: batch-update all 385 MDX URLs to use `Southland Website/blog/` path, then move

Sample orphans:
```
Blog Images/Apex_Predator_fqqame
Blog Images/Buy Compost Tea
Blog Images/Chicken_eggs_qhwi3v
Blog Images/Conventional_lawn_care_program_vs._organic_lawn_care_program_c32yij
...
```

---

### Product Images (327 total, 526 MB)

| Status | Count | Size |
|--------|-------|------|
| **Referenced** (blog MDX + scripts) | 34 | 24 MB |
| **Orphaned** | 293 | 501 MB |

Orphan breakdown:

| Subfolder | Orphans | Verdict |
|-----------|---------|---------|
| `2024 Updated Product Images/` | 83 | **HOLD** — current product shots, may be source files for Shopify |
| `Archived/` | 64 | Safe to DELETE — explicitly archived |
| `2023/All unedited/` | 59 | Safe to DELETE — raw photo shoot originals |
| Misc root-level images | 87 | Safe to DELETE — old labels, discontinued products |

Referenced list: `/tmp/cld_product_images_referenced.txt`
Orphan list: `/tmp/cld_product_images_orphaned.txt`

**Recommendation:**
- DELETE `Archived/` (64 images) and `2023/All unedited/` (59 images) = 123 images
- DELETE misc root-level orphans (87 images) after spot-checking
- HOLD `2024 Updated Product Images/` case images until confirmed these aren't Shopify source files
- Move 34 referenced images to `Southland Website/products/` (requires MDX URL updates)

---

### Chicks (106 total, 202 MB)

| Status | Count | Size |
|--------|-------|------|
| **Referenced** | 2 | 3 MB |
| **Orphaned** | 104 | 200 MB |

Only 2 images referenced, both in `rickets-in-chickens.mdx`:
- `Chicks/Chicks_with_Roost_and_sl-61_ibozp3`
- `Chicks/Chicks_with_Roost_and_sl-91_rrye2j`

**Recommendation:** Move 2 referenced images to `Southland Website/poultry/backyard/`, update MDX, DELETE remaining 104.

---

### Lawn Bundles (18 total, 10 MB)

| Status | Count | Size |
|--------|-------|------|
| **Referenced** | 0 | 0 |
| **Orphaned** | 18 | 10 MB |

Zero code references. The text "Lawn Bundles" appears in one blog post but as prose, not an image reference.

**Recommendation:** DELETE all 18.

---

### Logos (25 total, 7 MB)

| Status | Count | Size |
|--------|-------|------|
| **Referenced** | 0 | 0 |
| **Orphaned** | 25 | 7 MB |

This is the OLD logos folder. Production logos are at `Southland Website/Southland Branding/logos/`. Contents:
- `Logos/Old Infinity/` (6) — retired branding
- `Logos/CMF/` (3) — Schitt CMF analysis images
- `Logos/Fonts/` (2) — raw font files
- 14 misc old logo variants, SO-badge images

Badge images (`SO-all-natural`, `SO-biology-added`, etc.) have zero code references.

**Recommendation:** Download any you want to keep locally, then DELETE all 25.

---

## Summary: Total Reclaimable Storage

| Action | Resources | Storage |
|--------|-----------|---------|
| Phase 1a DELETE | 106 | 446 MB |
| Phase 2 ARCHIVE (move, not delete) | 433 | 1.8 GB |
| Phase 3 DELETE orphans (Blog Images) | 67 | 116 MB |
| Phase 3 DELETE orphans (Product Images safe subset) | 210 | ~400 MB |
| Phase 3 DELETE orphans (Chicks) | 104 | 200 MB |
| Phase 3 DELETE (Lawn Bundles) | 18 | 10 MB |
| Phase 3 DELETE (Logos) | 25 | 7 MB |
| **Total deletable** | **~530** | **~1.2 GB** |
| **Total archivable** | **433** | **1.8 GB** |

**After full cleanup:** ~2,480 resources, ~3.4 GB storage (down from 3,054 / 6.4 GB)

---

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/cloudinary-cleanup.sh` | Execute Phase 1a, 1b, 2 | `./scripts/cloudinary-cleanup.sh {1a\|1b\|2}` |
| `scripts/cloudinary-audit.sh` | Regenerate orphan lists | `./scripts/cloudinary-audit.sh` |

## Orphan List Files (in `/tmp/`)

| File | Contents |
|------|----------|
| `cld_full_inventory.tsv` | Full account inventory (public_id, folder, bytes, format, date, url) |
| `cld_all_referenced_pids.txt` | All public_ids referenced in any codebase (618) |
| `cld_blog_images_referenced.txt` | Blog Images that are used (379) |
| `cld_blog_images_orphaned.txt` | Blog Images orphans (67) |
| `cld_product_images_referenced.txt` | Product Images that are used (34) |
| `cld_product_images_orphaned.txt` | Product Images orphans (293) |
| `cld_chicks_referenced.txt` | Chicks images that are used (2) |
| `cld_chicks_orphaned.txt` | Chicks orphans (104) |
| `cld_lawn_bundles_orphaned.txt` | Lawn Bundles orphans (18) |
| `cld_logos_orphaned.txt` | Logos orphans (25) |

**Note:** `/tmp/` files are ephemeral. Re-run `scripts/cloudinary-audit.sh` to regenerate.

---

## Future: Target Folder Structure

After all phases complete, the account should look like:

```
southland/                        ← rename from "Southland Website"
├── branding/                     ← logos, icons, patterns
├── products/                     ← consolidated from Blog Images + Product Images refs
├── blog/                         ← consolidated from Blog Images refs
├── podcast/
│   ├── episodes/
│   ├── guests/
│   └── covers/
├── poultry/
│   ├── backyard/
│   ├── breeders-layers/
│   ├── turkey/
│   └── game-birds/
├── turf/
├── team/
├── heroes/
├── reviews/
└── email/

d2-sanitizers/                    ← already good
soul-miners-eden/                 ← normalize apostrophe
spray-squad/                      ← already good
point-dog/                        ← normalize period
heiser/                           ← merged
pour-the-port/                    ← already good

clients/
├── banyan-tree/
├── cprc/
├── hamilton-agency/
├── stars-national-walker/
└── jockshock/

personal/
└── ayn-parker-usry/

archive/                          ← Phase 2 destinations
├── greenhouse/
├── garden/
├── products-at-office/
├── office/
├── drain-tree/
└── 2022/
```

## Free vs Plus Decision

| Scenario | Credits/mo | Storage | Cost |
|----------|-----------|---------|------|
| Free (current) | 25 | ~10 GB | $0 |
| Free after cleanup | 25 | ~10 GB | $0 |
| **Plus** | 225 | 100 GB | $89/mo |

After cleanup you'll be at ~53% credits instead of 72%. That buys runway through Q2 2026. But CRO homepage work, 5 new persona landers, turf segment images, and video thumbnails will push past Free limits by summer. Plan for Plus upgrade around June 2026.
