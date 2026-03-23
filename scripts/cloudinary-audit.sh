#!/bin/bash
# =============================================================================
# CLOUDINARY AUDIT SCRIPT — Blog Images & Product Images
#
# Produces a whitelist of referenced images and a list of orphans.
# Run AFTER Phase 1 cleanup. This powers Phase 3 decisions.
#
# Output files:
#   /tmp/cld_blog_images_referenced.txt   — public_ids used in blog MDX
#   /tmp/cld_blog_images_orphaned.txt     — public_ids NOT referenced anywhere
#   /tmp/cld_product_images_referenced.txt
#   /tmp/cld_product_images_orphaned.txt
#   /tmp/cld_audit_report.txt             — human-readable summary
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_DIR="${SCRIPT_DIR}/.."
source "${PLATFORM_DIR}/apps/astro-content/.env"

CLOUD="southland-organics"
BASE_URL="https://${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}@api.cloudinary.com/v1_1/${CLOUD}"
CONTENT_DIR="${PLATFORM_DIR}/apps/astro-content/src/content"

echo "=== CLOUDINARY AUDIT: Blog Images & Product Images ==="
echo ""

# Step 1: Dump all public_ids from target folders
echo "Step 1: Fetching current inventory from Cloudinary..."

for folder in "Blog Images" "Product Images" "Chicks" "Lawn Bundles" "Logos"; do
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${folder}'''))")
  outfile="/tmp/cld_folder_$(echo "$folder" | tr ' ' '_' | tr '[:upper:]' '[:lower:]').txt"
  > "$outfile"

  cursor=""
  while true; do
    url="${BASE_URL}/resources/image/upload?prefix=${encoded}&max_results=500"
    [ -n "$cursor" ] && url="${url}&next_cursor=${cursor}"

    resp=$(curl -s "$url")
    echo "$resp" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('resources',[]):
    print(f'{r[\"public_id\"]}\t{r.get(\"bytes\",0)}\t{r.get(\"format\",\"\")}')
" >> "$outfile"

    cursor=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('next_cursor',''))" 2>/dev/null)
    [ -z "$cursor" ] && break
  done

  count=$(wc -l < "$outfile" | tr -d ' ')
  echo "  ${folder}: ${count} resources"
done

# Step 2: Extract all Cloudinary references from codebases
echo ""
echo "Step 2: Scanning codebases for Cloudinary references..."

SEARCH_DIRS=(
  "${PLATFORM_DIR}"
  "/Users/mikeusry/CODING/mothership"
  "/Users/mikeusry/CODING/D2"
  "/Users/mikeusry/CODING/Soul-Miners-Eden"
  "/Users/mikeusry/CODING/SpraySquad"
  "/Users/mikeusry/CODING/Heiser"
  "/Users/mikeusry/CODING/pourtheport"
  "/Users/mikeusry/CODING/southland-inventory"
)

> /tmp/cld_all_code_refs.txt

# Extract full Cloudinary URLs from all codebases
for dir in "${SEARCH_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  rg -o 'res\.cloudinary\.com/southland-organics/[^"'"'"'\s)}\]>]+' "$dir" \
    --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' --glob '!*.lock' --glob '!*.map' \
    --no-filename 2>/dev/null >> /tmp/cld_all_code_refs.txt
done

# Also extract bare public_id strings (in cloudinary helper calls, MDX frontmatter, etc.)
for dir in "${SEARCH_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  rg -o '(?:Blog Images|Product Images|Chicks|Lawn Bundles|Logos)/[A-Za-z0-9_\-/. ]+' "$dir" \
    --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' --glob '!*.lock' \
    --no-filename 2>/dev/null >> /tmp/cld_all_code_refs.txt
done

# Normalize: extract public_ids from full URLs
python3 << 'PYEOF'
import urllib.parse

pids = set()
with open("/tmp/cld_all_code_refs.txt") as f:
    for line in f:
        url = line.strip()
        if not url:
            continue

        # Full Cloudinary URL: extract public_id after version segment
        if "res.cloudinary.com" in url:
            parts = url.split("/")
            for i, p in enumerate(parts):
                if p.startswith("v") and len(p) > 1 and p[1:].replace(".", "").isdigit():
                    pid_parts = parts[i+1:]
                    if pid_parts:
                        pid = "/".join(pid_parts)
                        if "." in pid.split("/")[-1]:
                            pid = pid.rsplit(".", 1)[0]
                        pid = urllib.parse.unquote(pid)
                        pids.add(pid)
                    break
        else:
            # Bare public_id reference
            pid = url.strip().rstrip(".,;:\"')")
            pid = urllib.parse.unquote(pid)
            if pid:
                pids.add(pid)

with open("/tmp/cld_all_referenced_pids.txt", "w") as f:
    for pid in sorted(pids):
        f.write(pid + "\n")

print(f"  Found {len(pids)} unique public_id references across all codebases")
PYEOF

# Step 3: Cross-reference
echo ""
echo "Step 3: Cross-referencing inventory vs code references..."

python3 << 'PYEOF'
import os

def load_pids(path):
    pids = {}
    with open(path) as f:
        for line in f:
            parts = line.strip().split("\t")
            if parts[0]:
                pids[parts[0]] = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    return pids

with open("/tmp/cld_all_referenced_pids.txt") as f:
    referenced = set(line.strip() for line in f)

def fmt(b):
    if b > 1_000_000: return f"{b/1_000_000:.1f} MB"
    return f"{b/1_000:.0f} KB"

report = []

for folder_name, folder_file in [
    ("Blog Images", "/tmp/cld_folder_blog_images.txt"),
    ("Product Images", "/tmp/cld_folder_product_images.txt"),
    ("Chicks", "/tmp/cld_folder_chicks.txt"),
    ("Lawn Bundles", "/tmp/cld_folder_lawn_bundles.txt"),
    ("Logos", "/tmp/cld_folder_logos.txt"),
]:
    inventory = load_pids(folder_file)
    ref = {p: b for p, b in inventory.items() if p in referenced}
    orphan = {p: b for p, b in inventory.items() if p not in referenced}

    safe_name = folder_name.lower().replace(" ", "_")
    with open(f"/tmp/cld_{safe_name}_referenced.txt", "w") as f:
        for p in sorted(ref): f.write(p + "\n")
    with open(f"/tmp/cld_{safe_name}_orphaned.txt", "w") as f:
        for p in sorted(orphan): f.write(p + "\n")

    section = f"""
{'=' * 60}
  {folder_name}
{'=' * 60}
  Total:       {len(inventory):>5} images  ({fmt(sum(inventory.values()))})
  Referenced:  {len(ref):>5} images  ({fmt(sum(ref.values()))})
  Orphaned:    {len(orphan):>5} images  ({fmt(sum(orphan.values()))})

  Referenced list: /tmp/cld_{safe_name}_referenced.txt
  Orphaned list:   /tmp/cld_{safe_name}_orphaned.txt
"""
    report.append(section)
    print(section)

# Write full report
with open("/tmp/cld_audit_report.txt", "w") as f:
    f.write("CLOUDINARY AUDIT REPORT\n")
    f.write(f"Generated: {os.popen('date').read().strip()}\n")
    f.write("\n".join(report))
    f.write(f"""
{'=' * 60}
  PHASE 3 ACTIONS
{'=' * 60}

For each folder:
  1. Review the orphaned list
  2. Spot-check a few URLs to confirm they're truly unused
  3. Delete confirmed orphans
  4. Move remaining referenced images to Southland Website/ subfolders
  5. Update any hardcoded URLs in blog MDX content

Commands to delete orphans (after review):
  cat /tmp/cld_blog_images_orphaned.txt | head -100
  # Then use cloudinary-cleanup.sh or manual API calls
""")

print("\nFull report: /tmp/cld_audit_report.txt")
PYEOF

echo ""
echo "=== AUDIT COMPLETE ==="
