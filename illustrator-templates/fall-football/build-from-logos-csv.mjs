/**
 * build-from-logos-csv.mjs
 * Reads logos.csv (school, color, alt_color, logo URL), downloads logos into images/
 * with filenames like University_of_Kansas_logo.png, and writes fall-football-content.json
 * for use with apply-template-variants.jsx.
 *
 * Usage: node build-from-logos-csv.mjs [logos.csv] [--limit N]
 * Default CSV path: ./logos.csv (same folder as this script).
 * --limit N: only process first N rows (e.g. --limit 20 for quick testing).
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALL_FOOTBALL_DIR = __dirname;
const IMAGES_DIR = join(FALL_FOOTBALL_DIR, 'images');
const DEFAULT_CSV = join(FALL_FOOTBALL_DIR, 'logos.csv');
const CONTENT_JSON = join(FALL_FOOTBALL_DIR, 'fall-football-content.json');

// Parse a single CSV row handling quoted fields (simple parser)
function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      cur += c;
    } else if (c === ',') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCSV(csvPath) {
  const text = readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
  return { headers, rows };
}

function slugFromSchool(school) {
  return String(school)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function logoFilenameFromSchool(school, ext = '.png') {
  const base = String(school)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-_.]/g, '');
  return (base || 'logo') + '_logo' + ext;
}

function extensionFromUrl(url) {
  const match = String(url).match(/\.(png|jpe?g|gif|webp)(?:\?|$)/i);
  return match ? '.' + match[1].toLowerCase() : '.png';
}

const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff]);

function isLikelyImage(buf, ext) {
  const len = buf && (buf.byteLength ?? buf.length);
  if (!len || len < 8) return false;
  const u8 = new Uint8Array(buf);
  if (ext === '.png') return PNG_HEADER.every((b, i) => u8[i] === b);
  if (ext === '.jpg' || ext === '.jpeg') return JPEG_HEADER.every((b, i) => u8[i] === b);
  return true;
}

function isExistingFileValidImage(fullPath, ext) {
  try {
    const buf = readFileSync(fullPath).slice(0, 12);
    return isLikelyImage(buf, ext);
  } catch {
    return false;
  }
}

async function downloadToFile(url, filePath, ext) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const buf = await res.arrayBuffer();
  const u8 = new Uint8Array(buf);
  if (!isLikelyImage(buf, ext)) throw new Error('Downloaded content is not a valid image (e.g. HTML error page)');
  writeFileSync(filePath, Buffer.from(buf));
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit'));
  const limitVal = limitArg ? (limitArg.split('=')[1] || process.argv[process.argv.indexOf(limitArg) + 1]) : null;
  const limit = limitVal ? parseInt(limitVal, 10) : null;
  const skip = new Set(['--limit', limitVal != null ? String(limitVal) : null].filter(Boolean));
  const positionals = process.argv.slice(2).filter((a) => !a.startsWith('--') && !skip.has(a));
  const csvPath = positionals[0] || DEFAULT_CSV;
  if (!existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  const { rows } = parseCSV(csvPath);
  if (!rows.length) {
    console.error('No rows in CSV');
    process.exit(1);
  }

  mkdirSync(IMAGES_DIR, { recursive: true });

  const variants = [];
  const seen = new Set();
  let downloaded = 0;
  let skipped = 0;
  const rowsToProcess = limit ? rows.slice(0, limit) : rows;

  let skippedNoColors = 0;
  let skippedBlackPrimary = 0;

  for (const row of rowsToProcess) {
    const school = (row.school || '').trim();
    const primaryColorRaw = (row.color || '').trim();
    const secondaryColorRaw = (row.alt_color || '').trim();
    const primaryColor = primaryColorRaw || '#000000';
    const secondaryColor = secondaryColorRaw || primaryColor;
    const logoUrl = (row.logo || '').trim();

    if (!school) continue;

    if (!primaryColorRaw && !secondaryColorRaw) {
      skippedNoColors++;
      continue;
    }

    const primaryHex = (primaryColor.startsWith('#') ? primaryColor : '#' + primaryColor).toLowerCase().replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, '#$1$1$2$2$3$3');
    const secondaryHex = (secondaryColor.startsWith('#') ? secondaryColor : '#' + secondaryColor).toLowerCase().replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, '#$1$1$2$2$3$3');
    if (primaryHex === '#000000' && secondaryHex === '#000000') {
      skippedBlackPrimary++;
      continue;
    }

    const slug = slugFromSchool(school);
    if (seen.has(slug)) continue;
    seen.add(slug);

    let logoPath = '';
    if (logoUrl && /^https?:\/\//i.test(logoUrl)) {
      const ext = extensionFromUrl(logoUrl);
      const filename = logoFilenameFromSchool(school, ext);
      const fullPath = join(IMAGES_DIR, filename);
      const relativePath = 'images/' + filename;

      let needDownload = !existsSync(fullPath);
      if (!needDownload && !isExistingFileValidImage(fullPath, ext)) {
        try {
          unlinkSync(fullPath);
          needDownload = true;
        } catch {}
      }
      if (needDownload) {
        try {
          await downloadToFile(logoUrl, fullPath, ext);
          downloaded++;
          if (downloaded % 50 === 0) console.log('Downloaded', downloaded, 'logos…');
        } catch (err) {
          console.warn('Skip download', school, err.message);
          skipped++;
          continue;
        }
      }
      logoPath = relativePath;
    } else {
      skipped++;
      continue;
    }

    variants.push({
      outputFileName: slug,
      images: {
        school_logo: logoPath,
      },
      text: {
        school_title: school.toUpperCase(),
        school_subtitle: '',
      },
      colors: {
        primary_color: primaryColor.startsWith('#') ? primaryColor : '#' + primaryColor.replace(/^#/, ''),
        secondary_color: secondaryColor.startsWith('#') ? secondaryColor : '#' + secondaryColor.replace(/^#/, ''),
      },
    });
  }

  const content = {
    description: 'Generated from logos.csv. Run apply-template-variants.jsx with this file.',
    templateLayerNames: {
      images: ['school_logo', 'school_mascot', 'bg_image', 'year_overlay_image'],
      text: ['school_title', 'school_subtitle'],
      colors: ['primary_color', 'secondary_color'],
    },
    variants,
  };

  writeFileSync(CONTENT_JSON, JSON.stringify(content, null, '\t'), 'utf-8');

  console.log('Done.');
  console.log('Downloaded', downloaded, 'new logos.');
  console.log('Skipped', skipped, 'rows (no URL or duplicate).');
  console.log('Skipped', skippedNoColors, 'rows (no primary_color and no secondary_color).');
  console.log('Skipped', skippedBlackPrimary, 'rows (both primary and secondary are black).');
  console.log('Variants written:', variants.length);
  console.log('Content file:', CONTENT_JSON);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
