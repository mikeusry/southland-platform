#!/bin/bash
# =============================================================================
# CLOUDINARY CLEANUP — southland-organics account
# Generated: 2026-03-23
#
# This script executes the phased cleanup plan.
# Run each phase separately. Review output before proceeding to next phase.
#
# Prerequisites:
#   - source apps/astro-content/.env (loads CLOUDINARY_API_KEY + SECRET)
#   - The inventory file at /tmp/cld_full_inventory.tsv (regenerate with audit script)
#
# IMPORTANT: Cloudinary delete is PERMANENT. No recycle bin on Free plan.
# =============================================================================

set -euo pipefail

# Load credentials
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/../apps/astro-content/.env"

CLOUD="southland-organics"
BASE_URL="https://${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}@api.cloudinary.com/v1_1/${CLOUD}"

# Helper: delete all images in a folder (paginated, 100 at a time per API limit)
delete_folder_images() {
  local folder="$1"
  local encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${folder}'''))")
  local total_deleted=0

  echo "  Deleting images in: ${folder}"

  while true; do
    # Get batch of public_ids
    local pids=$(curl -s "${BASE_URL}/resources/image/upload?prefix=${encoded}&max_results=100" | \
      python3 -c "
import sys,json
d=json.load(sys.stdin)
pids = [r['public_id'] for r in d.get('resources',[])]
print('\n'.join(pids))
")

    if [ -z "$pids" ]; then
      break
    fi

    # Delete batch (max 100 per API call)
    local delete_body=$(echo "$pids" | python3 -c "
import sys,json,urllib.parse
pids = [l.strip() for l in sys.stdin if l.strip()]
params = '&'.join([f'public_ids[]={urllib.parse.quote(p)}' for p in pids])
print(params)
")

    local result=$(curl -s -X DELETE "${BASE_URL}/resources/image/upload?${delete_body}")
    local count=$(echo "$result" | python3 -c "
import sys,json
d=json.load(sys.stdin)
deleted = d.get('deleted',{})
print(sum(1 for v in deleted.values() if v == 'deleted'))
" 2>/dev/null || echo "0")

    total_deleted=$((total_deleted + count))
    echo "    Deleted batch: ${count} images"

    # If we got fewer than 100, we're done
    local batch_size=$(echo "$pids" | wc -l | tr -d ' ')
    if [ "$batch_size" -lt 100 ]; then
      break
    fi
  done

  # Also delete videos in the folder
  local vid_pids=$(curl -s "${BASE_URL}/resources/video/upload?prefix=${encoded}&max_results=100" | \
    python3 -c "
import sys,json
d=json.load(sys.stdin)
pids = [r['public_id'] for r in d.get('resources',[])]
print('\n'.join(pids))
" 2>/dev/null)

  if [ -n "$vid_pids" ]; then
    local vid_body=$(echo "$vid_pids" | python3 -c "
import sys,json,urllib.parse
pids = [l.strip() for l in sys.stdin if l.strip()]
params = '&'.join([f'public_ids[]={urllib.parse.quote(p)}' for p in pids])
print(params)
")
    curl -s -X DELETE "${BASE_URL}/resources/video/upload?${vid_body}" > /dev/null 2>&1
    echo "    Also deleted videos"
  fi

  # Try to delete the empty folder
  curl -s -X DELETE "${BASE_URL}/folders/${encoded}" > /dev/null 2>&1

  echo "  ✅ ${folder}: ${total_deleted} images deleted"
}

# Helper: signed rename via Upload API (Admin API rename does NOT work with basic auth)
cloudinary_rename() {
  local from="$1"
  local to="$2"
  local ts=$(date +%s)
  local sig_str="from_public_id=${from}&timestamp=${ts}&to_public_id=${to}${CLOUDINARY_API_SECRET}"
  local sig=$(printf '%s' "$sig_str" | shasum -a 1 | cut -d' ' -f1)

  curl -s -X POST "https://api.cloudinary.com/v1_1/${CLOUD}/image/rename" \
    -F "from_public_id=${from}" \
    -F "to_public_id=${to}" \
    -F "api_key=${CLOUDINARY_API_KEY}" \
    -F "timestamp=${ts}" \
    -F "signature=${sig}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('public_id', d.get('error',{}).get('message','UNKNOWN')))" 2>/dev/null
}

# Helper: rename (move) all images from one folder to another
rename_folder_images() {
  local from_folder="$1"
  local to_folder="$2"
  local encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${from_folder}'''))")
  local moved=0

  echo "  Moving: ${from_folder} → ${to_folder}"

  # Get all public_ids in source folder (paginated)
  local cursor=""
  while true; do
    local url="${BASE_URL}/resources/image/upload?prefix=${encoded}&max_results=100"
    [ -n "$cursor" ] && url="${url}&next_cursor=${cursor}"

    local resp=$(curl -s "$url")
    local pids=$(echo "$resp" | python3 -c "
import sys,json
for r in json.load(sys.stdin).get('resources',[]):
    pid = r['public_id']
    if pid.startswith('''${from_folder}'''):
        print(pid)
")

    [ -z "$pids" ] && break

    while IFS= read -r pid; do
      [ -z "$pid" ] && continue
      local new_pid=$(echo "$pid" | python3 -c "
import sys
pid = sys.stdin.read().strip()
old_prefix = '''${from_folder}'''
new_prefix = '''${to_folder}'''
if pid.startswith(old_prefix):
    print(new_prefix + pid[len(old_prefix):])
else:
    print(new_prefix + '/' + pid.split('/')[-1])
")

      local result=$(cloudinary_rename "$pid" "$new_pid")
      echo "    → $result"
      moved=$((moved + 1))
    done <<< "$pids"

    cursor=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('next_cursor',''))" 2>/dev/null)
    [ -z "$cursor" ] && break
  done

  # Try to delete the empty source folder
  curl -s -X DELETE "${BASE_URL}/folders/${encoded}" > /dev/null 2>&1

  echo "  ✅ Moved ${moved} images from ${from_folder} → ${to_folder}"
}

# =============================================================================
# PHASE 1a: DELETE — ✅ COMPLETED 2026-03-23 (done manually in Cloudinary console)
# =============================================================================
phase_1a() {
  echo "============================================"
  echo "  PHASE 1a: ✅ ALREADY COMPLETED"
  echo "============================================"
  echo ""
  echo "Folders to delete:"
  echo "  - samples/              (7 imgs,  25 MB)  — Cloudinary defaults"
  echo "  - Prince/               (36 imgs, 126 MB) — Personal photos"
  echo "  - Summer 2021 Interns/  (54 imgs, 285 MB) — Personal photos"
  echo "  - Archives/             (1 img,   8 MB)   — Unknown single image"
  echo "  - Email Assetts/        (8 imgs,  3 MB)   — Zero refs, typo name"
  echo ""
  read -p "Proceed with deletion? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    return
  fi

  delete_folder_images "samples"
  delete_folder_images "Prince"
  delete_folder_images "Summer 2021 Interns"
  delete_folder_images "Archives"
  delete_folder_images "Email Assetts"

  echo ""
  echo "Phase 1a complete. Checking new usage..."
  curl -s "${BASE_URL%/v1_1*}/v1_1/${CLOUD}/usage" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  Storage: {d[\"storage\"][\"usage\"]/1e9:.2f} GB')
print(f'  Credits: {d[\"credits\"][\"usage\"]:.1f} / {d[\"credits\"][\"limit\"]:.0f} ({d[\"credits\"][\"used_percent\"]:.1f}%)')
"
}

# =============================================================================
# PHASE 1b: MERGE — ✅ COMPLETED 2026-03-23 (via signed Upload API rename)
# Southland Sanitize→d2-sanitizers, Poultry→SW/poultry, Waste→SW
# heiser/Heiser and CPRC/cprc were already same folder (Cloudinary is case-insensitive)
# Heiser + CPRC project code updated to use consistent casing
# =============================================================================
phase_1b() {
  echo "============================================"
  echo "  PHASE 1b: ✅ ALREADY COMPLETED"
  echo "============================================"
  echo ""
  echo "Merges:"
  echo "  - CPRC (1 img)              → cprc/"
  echo "  - Southland Sanitize (30)   → d2-sanitizers/"
  echo "  - Poultry (3 imgs)          → Southland Website/poultry/"
  echo "  - Waste (1 img)             → Southland Website/"
  echo "  - heiser (41 imgs)          → Heiser/"
  echo ""
  echo "NOTE: Renaming changes public_ids. Old URLs will 404."
  echo "      Audit confirmed zero live code references for these folders."
  echo ""
  read -p "Proceed with merges? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    return
  fi

  rename_folder_images "CPRC" "cprc"
  rename_folder_images "Southland Sanitize" "d2-sanitizers"
  rename_folder_images "Poultry" "Southland Website/poultry"
  rename_folder_images "Waste" "Southland Website"
  rename_folder_images "heiser" "Heiser"

  echo ""
  echo "Phase 1b complete."
}

# =============================================================================
# PHASE 2: ARCHIVE — Move non-production to archive/ prefix
# =============================================================================
phase_2() {
  echo "============================================"
  echo "  PHASE 2: ARCHIVE (433 resources, 1.8 GB)"
  echo "============================================"
  echo ""
  echo "Moving to archive/ prefix:"
  echo "  - Greenhouse (120 imgs, 818 MB)"
  echo "  - Garden (114 imgs, 372 MB)"
  echo "  - Products at Office (24 imgs, 177 MB)  ⚠️ 1 blog ref"
  echo "  - Office (22 imgs, 84 MB)               ⚠️ 1 blog ref"
  echo "  - Drain + Tree (73 imgs, 198 MB)"
  echo "  - 2022 (80 imgs, 132 MB)"
  echo ""
  echo "⚠️  'Products at Office' has 1 blog reference:"
  echo "    understanding-humate-a-beginners-guide.mdx"
  echo "    Update the MDX image URL after moving."
  echo ""
  echo "⚠️  'Office' has 1 blog reference:"
  echo "    Check and update if needed."
  echo ""
  read -p "Proceed with archiving? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    return
  fi

  rename_folder_images "Greenhouse" "archive/Greenhouse"
  rename_folder_images "Garden" "archive/Garden"
  rename_folder_images "Products at Office" "archive/Products at Office"
  rename_folder_images "Office" "archive/Office"
  rename_folder_images "Drain + Tree" "archive/Drain + Tree"
  rename_folder_images "2022" "archive/2022"

  echo ""
  echo "Phase 2 complete."
  echo "TODO: Update blog MDX refs for 'Products at Office' and 'Office' images."
}

# =============================================================================
# MAIN
# =============================================================================
case "${1:-}" in
  1a) phase_1a ;;
  1b) phase_1b ;;
  2)  phase_2 ;;
  *)
    echo "Usage: $0 {1a|1b|2}"
    echo ""
    echo "  1a  — DELETE safe folders (samples, Prince, Summer 2021 Interns, Archives, Email Assetts)"
    echo "  1b  — MERGE duplicate/misnamed folders"
    echo "  2   — ARCHIVE non-production folders"
    ;;
esac
