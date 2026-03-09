/**
 * fetch-mascots-sportradar.mjs
 * Fetches team/mascot imagery from Sportradar Images v3 API and adds school_mascot
 * paths to fall-football-content.json. Follows 302 redirects when downloading images.
 *
 * Requires: SPORTRADAR_IMAGES_API_KEY in environment (or --api-key=...).
 * Optional: sportradar-team-ids.csv with columns school,sportradar_team_id to map
 * school names to Sportradar team UUIDs (from NCAAFB API). Without it, matching is
 * by normalized school name against manifest team names.
 *
 * Usage:
 *   node fetch-mascots-sportradar.mjs [--api-key=KEY] [--limit N] [--dry-run] [--manifest-only]
 *   --limit N        only process first N variants (for testing)
 *   --dry-run        fetch manifest and log matches, do not download or write JSON
 *   --manifest-only fetch and print manifest structure (for debugging / verifying API key)
 *
 * Sportradar Images v3: manifest at
 *   https://api.sportradar.us/{sport}-images-{t|p}3/{provider}/{league}/logos/{year}/manifest.json?api_key=...
 * Image URLs in the manifest require following 302 redirects.
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALL_FOOTBALL_DIR = __dirname;
const IMAGES_DIR = join(FALL_FOOTBALL_DIR, 'images');
const MASCOTS_DIR = join(IMAGES_DIR, 'mascots');
const CONTENT_JSON = join(FALL_FOOTBALL_DIR, 'fall-football-content.json');
const MAPPING_CSV = join(FALL_FOOTBALL_DIR, 'sportradar-team-ids.csv');

// Sportradar Images v3 config (NCAA Football)
const SPORT = 'ncaafb';
const ACCESS_LEVEL = process.env.SPORTRADAR_ACCESS_LEVEL || 'p'; // p = production, t = trial
const PROVIDER = process.env.SPORTRADAR_IMAGES_PROVIDER || 'usat'; // usat, ap, getty, reuters
const LEAGUE = 'ncaafb';
const YEAR = process.env.SPORTRADAR_IMAGES_YEAR || new Date().getFullYear();
const BASE_URL = `https://api.sportradar.us/${SPORT}-images-${ACCESS_LEVEL}3/${PROVIDER}/${LEAGUE}/logos/${YEAR}`;

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

function normalizeName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .trim();
}

function mascotFilenameFromSchool(school, ext = '.png') {
  const base = String(school)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-_.]/g, '');
  return (base || 'mascot') + '_mascot' + ext;
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

async function downloadToFile(url, filePath, ext) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const buf = await res.arrayBuffer();
  if (!isLikelyImage(buf, ext)) throw new Error('Downloaded content is not a valid image');
  writeFileSync(filePath, Buffer.from(buf));
}

function extensionFromUrl(url) {
  const u = String(url);
  if (/\.png(\?|$)/i.test(u)) return '.png';
  if (/\.jpe?g(\?|$)/i.test(u)) return '.jpg';
  if (/\.webp(\?|$)/i.test(u)) return '.webp';
  return '.png';
}

/**
 * Fetch logo manifest from Sportradar Images v3.
 * Returns { assets: [{ team_id, team_name?, type?, image_urls: [...] }], ... } or similar.
 */
async function fetchManifest(apiKey) {
  const url = `${BASE_URL}/manifest.json?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sportradar manifest HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Pick best image URL from an asset (prefer mascot-type, then primary, then first).
 * Manifest structure may vary; common fields: type (e.g. "primary", "mascot"), links or image URLs.
 */
function pickImageUrl(asset) {
  const links = asset.links || asset.image_urls || asset.images || [];
  const arr = Array.isArray(links) ? links : Object.entries(links).map(([k, v]) => ({ type: k, url: v }));
  const typeOrder = ['mascot', 'primary', 'secondary', 'global', 'letter'];
  for (const t of typeOrder) {
    const entry = arr.find((e) => (e.type || e.name || '').toLowerCase().includes(t));
    const url = entry?.url ?? entry?.href ?? (typeof entry === 'string' ? entry : null);
    if (url) return url;
  }
  const first = arr[0];
  return first?.url ?? first?.href ?? (typeof first === 'string' ? first : null);
}

/**
 * Build maps from manifest: by normalized name and by team ID.
 * Returns { byName: Map(normalizedName -> { imageUrl }), byId: Map(team_id -> { imageUrl }) }.
 */
function buildTeamMaps(manifest) {
  const byName = new Map();
  const byId = new Map();
  const assets = manifest.assets ?? manifest.logos ?? manifest.teams ?? [];
  const list = Array.isArray(assets) ? assets : Object.entries(assets).flatMap(([id, a]) => ({ ...a, team_id: a.team_id ?? a.teamId ?? a.id ?? id }));

  for (const asset of list) {
    const teamId = asset.team_id ?? asset.teamId ?? asset.id;
    const teamName = asset.team_name ?? asset.name ?? asset.teamName ?? '';
    const imageUrl = pickImageUrl(asset);
    if (!imageUrl) continue;

    const entry = { team_id: teamId, teamName, asset, imageUrl };
    const norm = normalizeName(teamName);
    if (norm) byName.set(norm, entry);
    if (teamId) byId.set(String(teamId), entry);
  }
  return { byName, byId };
}

async function main() {
  const args = process.argv.slice(2);
  const apiKeyArg = args.find((a) => a.startsWith('--api-key='));
  const apiKey = apiKeyArg ? apiKeyArg.split('=')[1] : process.env.SPORTRADAR_IMAGES_API_KEY;
  const limitArg = args.find((a) => a.startsWith('--limit'));
  const limitVal = limitArg ? limitArg.split('=')[1] || args[args.indexOf(limitArg) + 1] : null;
  const limit = limitVal ? parseInt(limitVal, 10) : null;
  const dryRun = args.includes('--dry-run');
  const manifestOnly = args.includes('--manifest-only');

  if (!apiKey) {
    console.error('Set SPORTRADAR_IMAGES_API_KEY or pass --api-key=YOUR_KEY');
    process.exit(1);
  }
  if (!existsSync(CONTENT_JSON)) {
    console.error('Content file not found:', CONTENT_JSON);
    process.exit(1);
  }

  // Optional: school -> sportradar_team_id (so we can match by ID when manifest uses UUIDs)
  let schoolToId = null;
  if (existsSync(MAPPING_CSV)) {
    const { rows } = parseCSV(MAPPING_CSV);
    schoolToId = {};
    for (const r of rows) {
      const id = (r.sportradar_team_id || r.team_id || r.id || '').trim();
      const school = (r.school || '').trim();
      if (id && school) schoolToId[normalizeName(school)] = id;
    }
  }

  const content = JSON.parse(readFileSync(CONTENT_JSON, 'utf-8'));
  const variants = content.variants || [];
  const toProcess = limit ? variants.slice(0, limit) : variants;

  console.log('Fetching Sportradar Images v3 logo manifest…');
  let manifest;
  try {
    manifest = await fetchManifest(apiKey);
  } catch (err) {
    console.error('Manifest fetch failed:', err.message);
    process.exit(1);
  }

  if (manifestOnly) {
    console.log(JSON.stringify(manifest, null, 2).slice(0, 4000) + (JSON.stringify(manifest).length > 4000 ? '\n...' : ''));
    return;
  }

  const { byName, byId } = buildTeamMaps(manifest);
  console.log('Manifest entries (by name):', byName.size, '(by id):', byId.size);

  mkdirSync(MASCOTS_DIR, { recursive: true });
  let downloaded = 0;
  let updated = 0;

  for (const variant of toProcess) {
    const title = (variant.text?.school_title ?? variant.outputFileName ?? '').toString();
    const schoolName = title.replace(/\s+/g, ' ').trim();
    const norm = normalizeName(schoolName);
    // Prefer match by Sportradar team ID if we have a mapping CSV, else by name
    const match =
      (schoolToId && byId.get(schoolToId[norm])) ||
      byName.get(norm) ||
      byName.get(normalizeName(variant.outputFileName || ''));

    if (!match) continue;

    const { imageUrl } = match;
    const ext = extensionFromUrl(imageUrl);
    const filename = mascotFilenameFromSchool(schoolName, ext);
    const fullPath = join(MASCOTS_DIR, filename);
    const relativePath = 'images/mascots/' + filename;

    if (dryRun) {
      console.log('Would set school_mascot:', schoolName, '->', relativePath);
      updated++;
      continue;
    }

    let needDownload = !existsSync(fullPath);
    if (needDownload) {
      try {
        await downloadToFile(imageUrl, fullPath, ext);
        downloaded++;
        if (downloaded % 25 === 0) console.log('Downloaded', downloaded, 'mascot images…');
      } catch (err) {
        console.warn('Skip mascot download', schoolName, err.message);
        continue;
      }
    }

    if (!variant.images) variant.images = {};
    variant.images.school_mascot = relativePath;
    updated++;
  }

  if (!dryRun && updated > 0) {
    writeFileSync(CONTENT_JSON, JSON.stringify(content, null, '\t'), 'utf-8');
    console.log('Updated', CONTENT_JSON, 'with', updated, 'school_mascot paths.');
  }

  console.log('Done. Downloaded', downloaded, 'new mascot images; variants updated:', updated);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
