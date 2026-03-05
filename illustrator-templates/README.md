# Illustrator design templates

This folder contains **Adobe Illustrator templates** and **ExtendScript (.jsx)** scripts to programmatically swap images, text, colors, and other elements. Use one template to generate many variants—e.g. fall football designs for different schools.

## Workflow

1. **Create a template in Illustrator**
   - Design the layout once (e.g. fall football poster).
   - Use **named layers** and, where helpful, **named art** for every element you want to change:
     - Placed images (hero photo, logo): put each on its own layer and name the layer (e.g. `hero-image`, `school-logo`).
     - Text (school name, tagline, date): use point or area text on named layers (e.g. `school-name`, `tagline`).
     - Color elements: use a single shape or group per “slot” on a named layer (e.g. `accent-bar`) so the script can recolor the fill.
   - Save as `.ai` (e.g. `fall-football-template.ai`).

2. **Define one content JSON**
   - One JSON file holds **all variants** for that template. Structure: `{ "variants": [ { "outputFileName": "...", "images": {...}, "text": {...}, "colors": {...} }, ... ] }`. Each object in `variants` lines up with one exported JPEG. Layer names in every variant must match the template.
   - You can author the JSON by hand or use the **Design template variants** section in the app to build a single variant and merge it into a `variants` array.

3. **Run the ExtendScript in Illustrator**
   - Open the **template** in Adobe Illustrator.
   - Run **File → Scripts → Other Script…** and choose `apply-template-variants.jsx`.
   - Select your **content JSON** (the one with the `variants` array).
   - The script exports **one JPEG per variant** (e.g. `Fall Football - East Valley Eagles.jpg`) to the same folder as the content JSON. The template stays unchanged.

## Folder structure

```
illustrator-templates/
├── README.md                    # This file
├── apply-template-variants.jsx  # Script: one content JSON + one template → many JPEG exports
├── fall-football/
│   ├── README.md                # Fall football: layer names and usage
│   ├── fall-football-content.json  # One JSON, all schools (variants array)
│   ├── content-schema.json      # Optional JSON Schema for content file
│   └── variant-schema.json      # Optional schema for one variant object
```

## Fall football example

- **Template:** One .ai file (e.g. `fall-football-template.ai`) with named layers: `school_title`, `school_subtitle`, `school_logo`, `school_mascot`, `bg_image`, `year_overlay_image`, `primary_color`, `secondary_color`.
- **Content:** One JSON file, `fall-football/fall-football-content.json`, with a **variants** array. Each element has `outputFileName`, `images`, `text`, and `colors` (primary_color, secondary_color) for one school. The script exports one JPEG per variant (output file name from `outputFileName` with .jpg extension).

See `fall-football/README.md` and `fall-football/fall-football-content.json` for the exact structure and sample data.

## Script usage (apply-template-variants.jsx)

1. Open your **template** in Illustrator.
2. Run **File → Scripts → Other Script…** and select `apply-template-variants.jsx`.
3. In the file dialog, choose the **content JSON** (the file that contains the `variants` array).
4. The script loops over each variant: applies images, text, and colors; exports one JPEG per variant to the JSON folder; reopens the template for the next. When done, the template is open again and all JPEGs have been written.

## Content JSON format (one file, many outputs)

```json
{
  "variants": [
    {
      "outputFileName": "Fall Football - East Valley Eagles",
      "images": {
        "school_logo": "eagles-logo.png",
        "school_mascot": "eagles-mascot.png",
        "bg_image": "hero-stadium.jpg",
        "year_overlay_image": "year-2025.png"
      },
      "text": {
        "school_title": "East Valley Eagles",
        "school_subtitle": "2025 Fall Season"
      }
    }
  ]
}
```

- **variants**: Required array. One object per output file. Each object: **outputFileName**, **images**, **text** (optional **colors**).
- **outputFileName**: Base name for that output JPEG (script adds .jpg if missing). JPEGs are written to the same folder as the content JSON.
- **images** / **text**: Keys = template layer names. Interchangeable data: school_title, school_subtitle, school_logo, school_mascot, bg_image, year_overlay_image. Paths absolute or relative to the JSON file’s folder.

The script also accepts a single-variant JSON (no `variants` key): it treats the root as one variant for backward compatibility.

## Requirements

- **Adobe Illustrator** (CC or later recommended).
- Template .ai file with **named layers** for every swappable element.
- Variant JSON files that follow the structure above (and optionally the fall-football schema).

## Integration with Metaprompt Studio

The app includes a **Design template variants** section where you can:

- Enter school (or variant) name, colors, text, and image paths.
- **Export content JSON (variants array)** to get a JSON file with `{ "variants": [ ... ] }` ready for the script. Add more variants to the array by hand or by exporting again and merging.
- **Export single variant only** to get one variant object (for pasting into an existing content file).

Use the exported content JSON with `apply-template-variants.jsx` so one template plus one JSON produces many JPEG exports.
