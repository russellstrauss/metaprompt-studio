# Fall football template example

One Illustrator template is used to generate many school-specific designs by swapping school_title, school_subtitle, school_logo, school_mascot, bg_image, year_overlay_image, primary_color, and secondary_color via the `apply-template-variants.jsx` script.

## Template layer names

Create an `.ai` template with these layer names (or subset). The script matches JSON keys to layer names.

| Layer name            | Type  | Purpose                          |
|-----------------------|-------|----------------------------------|
| `school_title`        | text  | School or team name              |
| `school_subtitle`     | text  | Tagline or season line           |
| `school_logo`         | image | School or team logo              |
| `school_mascot`       | image | Mascot graphic                   |
| `bg_image`            | image | Background / hero photo          |
| `year_overlay_image`  | image | Year or season overlay graphic   |
| `primary_color`       | color | Primary brand color (hex fill)   |
| `secondary_color`     | color | Secondary brand color (hex fill) |

- **Images** (`school_logo`, `school_mascot`, `bg_image`, `year_overlay_image`): Each layer should contain a single **placed image** (File â†’ Place). The script replaces that image with the file path in the JSON.
- **Text** (`school_title`, `school_subtitle`): Each layer should contain one **text frame**. The script sets its contents from the JSON. For **school_title**, use **area text** (drag with the Type tool to draw a frame); the script will shrink the font so the full name fits in that frame. Optionally, add a rectangle path on the same layer to define the title area; the script will fit the text into that box.
- **Colors** (`primary_color`, `secondary_color`): Each layer should contain path(s) with a fill. The script sets the fill to the hex color in the JSON (e.g. `#C41E3A`).

## Naming your template file

Save the template as e.g. `fall-football-template.ai`. Open this file in Illustrator before running the script and selecting a variant JSON.

## Building content from logos.csv

To populate **`fall-football-content.json`** from **`logos.csv`** (school name, two colors, logo URL):

1. From this folder, run:
   ```bash
   node build-from-logos-csv.mjs
   ```
   Or with a limit for testing: `node build-from-logos-csv.mjs --limit 20`

2. The script downloads each logo **once** into **`images/`** with filenames like `University_of_Kansas_logo.png`, then writes `fall-football-content.json` with one variant per school (school_title, primary_color, secondary_color, school_logo path). Existing image files are skipped.

3. Use the generated `fall-football-content.json` with `apply-template-variants.jsx` as below.

## Pulling mascot imagery from Sportradar Images v3

To fill the **`school_mascot`** layer from [Sportradar Images v3](https://developer.sportradar.com/images-and-editorials/reference/images-overview):

1. Get an API key for Sportradar Images (trial or production) from the [Sportradar Marketplace](https://marketplace.sportradar.com/).
2. Set it in the environment or pass it on the command line:
   ```bash
   set SPORTRADAR_IMAGES_API_KEY=your_key_here
   node fetch-mascots-sportradar.mjs
   ```
   Or: `node fetch-mascots-sportradar.mjs --api-key=your_key_here`
3. The script fetches the logo manifest for NCAA football, matches teams to your content by school name, downloads images into `images/` (e.g. `Alabama_mascot.png`), and adds `school_mascot` paths to `fall-football-content.json`. It follows 302 redirects as required by the API.
4. Optional: use `sportradar-team-ids.csv` with columns `school,sportradar_team_id` to map school names to Sportradar team UUIDs if name matching is insufficient.
5. Options:
   - `--limit N` — process only the first N variants (for testing).
   - `--dry-run` — show what would be matched and downloaded without writing files.
   - `--manifest-only` — fetch and print the manifest JSON (to verify the API key and inspect response structure).

Environment variables (optional): `SPORTRADAR_ACCESS_LEVEL` (default `p`), `SPORTRADAR_IMAGES_PROVIDER` (default `usat`), `SPORTRADAR_IMAGES_YEAR` (default current year).

## One content JSON, one template

Use **one** content file for this template: **`fall-football-content.json`** in this folder. It contains a **variants** array with one object per school. The script reads this file and exports one JPEG per variant (same folder as the JSON).

| Variant | Output file | Accent |
|--------|-------------|--------|
| East Valley Eagles | Fall Football - East Valley Eagles.jpg | #C41E3A |
| North Lake Wolves | Fall Football - North Lake Wolves.jpg | #003366 |
| Riverside Rangers | Fall Football - Riverside Rangers.jpg | #228B22 |
| Westside Thunder | Fall Football - Westside Thunder.jpg | #4B0082 |
| Central Hawks | Fall Football - Central Hawks.jpg | #CC0000 |
| Lincoln Tigers | Fall Football - Lincoln Tigers.jpg | #FF6600 |

Paths in the JSON are placeholders; replace with real paths (or relative paths from the JSON file folder).

## Quick test

1. Create `fall-football-template.ai` with named layers (e.g. `school_title`, `school_subtitle`, `school_logo`, `bg_image`, etc.).
2. Open the template in Illustrator.
3. Run File, Scripts, Other Script, then select `apply-template-variants.jsx` and choose **`fall-football-content.json`**.
4. The script exports six JPEGs (one per school) to the same folder as the content JSON and leaves the template open.
