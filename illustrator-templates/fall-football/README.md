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
- **Text** (`school_title`, `school_subtitle`): Each layer should contain one **text frame**. The script sets its contents from the JSON.
- **Colors** (`primary_color`, `secondary_color`): Each layer should contain path(s) with a fill. The script sets the fill to the hex color in the JSON (e.g. `#C41E3A`).

## Naming your template file

Save the template as e.g. `fall-football-template.ai`. Open this file in Illustrator before running the script and selecting a variant JSON.

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
