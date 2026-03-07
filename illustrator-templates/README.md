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

### Stored paths (run by simply executing the script)

1. Open `apply-template-variants.jsx` in a text editor.
2. At the top, set **STORED_TEMPLATE_PATH** and **STORED_JSON_PATH** (paths relative to the script’s folder or full paths), for example:
   ```js
   var STORED_TEMPLATE_PATH = 'fall-football-template.ai';
   var STORED_JSON_PATH = 'fall-football/fall-football-content.json';
   ```
3. In Illustrator, run **File → Scripts → Other Script…** and select `apply-template-variants.jsx` (or run the script from the command line by passing it to Illustrator). No dialogs; the script opens the template, applies the JSON, exports JPEGs to the JSON folder, and leaves the template open.

### Interactive (no stored paths)

1. Leave both stored paths empty in the script.
2. Open your **template** in Illustrator.
3. Run **File → Scripts → Other Script…** and select `apply-template-variants.jsx`.
4. In the file dialog, choose the **content JSON**. The script exports one JPEG per variant and reopens the template when done.

### Optional: single command from terminal (wrapper)

To run without opening Illustrator first and pass paths on the command line:

```powershell
cd illustrator-templates
.\run-apply-template.ps1 ".\fall-football-template.ai" ".\fall-football\fall-football-content.json"
```

The wrapper writes an args file, launches Illustrator with the script, runs the export, then Illustrator quits. Set `$env:ILLUSTRATOR_EXE` if Illustrator is not in the default install path.

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
