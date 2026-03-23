# Cloudinary Audit Data

Generated: 2026-03-23

These files are the output of the Cloudinary account audit. Regenerate with `../cloudinary-audit.sh`.

## Files

| File | What | Count |
|------|------|-------|
| `cld_full_inventory.tsv` | Every resource in the account (public_id, folder, bytes, format, date, url) | 3,013 |
| `cld_all_referenced_pids.txt` | Public_ids found in any codebase | 618 |
| `cld_blog_images_referenced.txt` | Blog Images used in blog MDX | 379 |
| `cld_blog_images_orphaned.txt` | Blog Images NOT referenced anywhere | 67 |
| `cld_product_images_referenced.txt` | Product Images used in code/MDX | 34 |
| `cld_product_images_orphaned.txt` | Product Images NOT referenced | 293 |
| `cld_chicks_referenced.txt` | Chicks images used (in rickets-in-chickens.mdx) | 2 |
| `cld_chicks_orphaned.txt` | Chicks images NOT referenced | 104 |
| `cld_lawn_bundles_orphaned.txt` | Lawn Bundles — all orphaned | 18 |
| `cld_logos_orphaned.txt` | Old Logos folder — all orphaned | 25 |

## Usage

Review orphan lists before deleting. Spot-check a few URLs to confirm truly unused:

```bash
# Preview an orphan as a URL
echo "https://res.cloudinary.com/southland-organics/image/upload/$(head -1 cld_blog_images_orphaned.txt)"
```
