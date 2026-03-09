"""
Compare logo and mascot images for each school.
Where a mascot image is visually identical (or near-identical) to the logo,
delete the mascot image since it's a duplicate.
"""

import os
import sys
from pathlib import Path
import imagehash
from PIL import Image

LOGOS_DIR = Path(__file__).parent / "images" / "logos"
MASCOTS_DIR = Path(__file__).parent / "images" / "mascots"

# Perceptual hash distance threshold (0 = identical, higher = more different)
# A value of 0 means pixel-perfect same visual content at hash resolution.
# We use a small threshold to account for minor re-encoding differences.
HASH_THRESHOLD = 5

def get_phash(path):
    try:
        with Image.open(path) as img:
            return imagehash.phash(img)
    except Exception as e:
        print(f"  ERROR reading {path.name}: {e}")
        return None

def main(dry_run=True):
    # Build a lookup of logos keyed by normalized school name
    logo_map = {}
    for logo_file in LOGOS_DIR.glob("*_logo.png"):
        # Strip '_logo.png' suffix and normalize to uppercase
        school_key = logo_file.stem.replace("_logo", "").upper()
        logo_map[school_key] = logo_file

    print(f"Found {len(logo_map)} logos")

    mascot_files = sorted(MASCOTS_DIR.glob("*_mascot.png"))
    print(f"Found {len(mascot_files)} mascots")
    print()

    duplicates = []
    no_match = []

    for mascot_file in mascot_files:
        school_key = mascot_file.stem.replace("_mascot", "").upper()

        if school_key not in logo_map:
            no_match.append(mascot_file.name)
            continue

        logo_file = logo_map[school_key]

        mascot_hash = get_phash(mascot_file)
        logo_hash = get_phash(logo_file)

        if mascot_hash is None or logo_hash is None:
            continue

        distance = mascot_hash - logo_hash

        if distance <= HASH_THRESHOLD:
            duplicates.append((mascot_file, logo_file, distance))
            status = f"DUPLICATE (distance={distance})"
        else:
            status = f"different  (distance={distance})"

        print(f"  {mascot_file.name:50s} vs {logo_file.name:50s} -> {status}")

    print()
    print(f"--- Summary ---")
    print(f"Mascots with no matching logo:  {len(no_match)}")
    print(f"Duplicate mascots found:        {len(duplicates)}")

    if no_match:
        print("\nMascots with no matching logo:")
        for name in no_match:
            print(f"  {name}")

    if duplicates:
        print(f"\nDuplicates to {'DELETE' if not dry_run else 'delete (dry run)'}:")
        for mascot_file, logo_file, dist in duplicates:
            print(f"  {mascot_file.name} (distance={dist})")
            if not dry_run:
                mascot_file.unlink()
                print(f"    -> DELETED")

    if dry_run and duplicates:
        print(f"\nDry run complete. Run with --delete to actually remove {len(duplicates)} duplicate(s).")

if __name__ == "__main__":
    dry_run = "--delete" not in sys.argv
    if not dry_run:
        print("*** DELETE MODE - will permanently remove duplicate mascot images ***\n")
    else:
        print("*** DRY RUN - no files will be deleted (pass --delete to remove) ***\n")
    main(dry_run=dry_run)
