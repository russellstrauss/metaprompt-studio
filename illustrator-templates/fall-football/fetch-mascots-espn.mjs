/**
 * fetch-mascots-espn.mjs
 * Downloads full-color 4096x4096 transparent PNG mascot/secondary logo images from the
 * ESPN API for each school and writes school_mascot paths into fall-football-content.json.
 *
 * Source: ESPN team API → secondary_logo_on_white_color (preferred) or
 *         primary_logo_on_white_color (fallback). These are full-color RGBA PNGs with
 *         transparent backgrounds, 4096x4096 resolution — distinct from the 500px
 *         school_logo already in the template.
 *
 * For schools that have a character mascot (e.g. Sparty, Bucky, Smokey), the secondary
 * logo is often the character illustration. For other schools it is the alternate
 * brand mark (secondary wordmark, helmet, etc.) — still different from school_logo.
 *
 * ESPN team API:
 *   https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/{espn_id}
 *
 * Usage:
 *   node fetch-mascots-espn.mjs [--limit N] [--dry-run] [--concurrency N]
 *   --limit N         only process first N variants (for testing)
 *   --dry-run         log what would happen without downloading or writing JSON
 *   --concurrency N   parallel API+download workers (default 8)
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALL_FOOTBALL_DIR = __dirname;
const IMAGES_DIR = join(FALL_FOOTBALL_DIR, 'images');
const MASCOTS_DIR = join(IMAGES_DIR, 'mascots');
const CONTENT_JSON = join(FALL_FOOTBALL_DIR, 'fall-football-content.json');
const DEFAULT_CSV = join(FALL_FOOTBALL_DIR, 'logos.csv');

const ESPN_TEAMS_API = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams';

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Name normalization for CSV → JSON matching
// ---------------------------------------------------------------------------

function normalizeSchoolName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Filename convention: School_Name_mascot.png  (matches existing logo pattern)
// ---------------------------------------------------------------------------

function mascotFilename(school) {
  const base = String(school)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-_.]/g, '');
  return (base || 'mascot') + '_mascot.png';
}

// ---------------------------------------------------------------------------
// PNG validation (magic bytes)
// ---------------------------------------------------------------------------

const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isValidPng(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer ?? buf);
  if (u8.length < 8) return false;
  return PNG_HEADER.every((b, i) => u8[i] === b);
}

// ---------------------------------------------------------------------------
// ESPN API: get secondary (or primary) logo URL for a team id
// ---------------------------------------------------------------------------

async function getEspnLogoUrl(espnId) {
  const res = await fetch(`${ESPN_TEAMS_API}/${espnId}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`ESPN API HTTP ${res.status} for id=${espnId}`);
  const data = await res.json();
  const logos = data.team?.logos ?? [];

  // Prefer secondary logo (often the mascot character), fall back to primary
  const priority = [
    'secondary_logo_on_white_color',
    'primary_logo_on_white_color',
  ];
  for (const rel of priority) {
    const entry = logos.find((l) => Array.isArray(l.rel) && l.rel.includes(rel));
    if (entry?.href) return { url: entry.href, type: rel };
  }

  // Final fallback: default logo from API
  const def = logos.find((l) => Array.isArray(l.rel) && l.rel.includes('default'));
  if (def?.href) return { url: def.href, type: 'default' };

  throw new Error(`No usable logo found in ESPN API response for id=${espnId}`);
}

// ---------------------------------------------------------------------------
// Download a PNG URL → Buffer
// ---------------------------------------------------------------------------

async function downloadPng(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const buf = await res.arrayBuffer();
  if (!isValidPng(buf)) return { ok: false, reason: 'Not a valid PNG' };
  return { ok: true, buf };
}

// ---------------------------------------------------------------------------
// Concurrency pool
// ---------------------------------------------------------------------------

async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      try {
        results[idx] = await tasks[idx]();
      } catch (e) {
        results[idx] = { error: e };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit'));
  const limitVal = limitArg
    ? limitArg.split('=')[1] || args[args.indexOf(limitArg) + 1]
    : null;
  const limit = limitVal ? parseInt(limitVal, 10) : null;
  const dryRun = args.includes('--dry-run');
  const concurrencyArg = args.find((a) => a.startsWith('--concurrency'));
  const concurrencyVal = concurrencyArg
    ? concurrencyArg.split('=')[1] || args[args.indexOf(concurrencyArg) + 1]
    : null;
  const concurrency = concurrencyVal ? parseInt(concurrencyVal, 10) : 8;

  if (!existsSync(CONTENT_JSON)) {
    console.error('Content JSON not found:', CONTENT_JSON);
    process.exit(1);
  }
  if (!existsSync(DEFAULT_CSV)) {
    console.error('logos.csv not found:', DEFAULT_CSV);
    process.exit(1);
  }

  // Build lookup: normalizedSchoolName → ESPN id
  const { rows: csvRows } = parseCSV(DEFAULT_CSV);
  const nameToId = new Map();
  for (const row of csvRows) {
    const school = (row.school || '').trim();
    const id = (row.id || '').trim();
    if (school && id) nameToId.set(normalizeSchoolName(school), id);
  }
  console.log(`Loaded ${nameToId.size} ESPN IDs from logos.csv`);

  const content = JSON.parse(readFileSync(CONTENT_JSON, 'utf-8'));
  const variants = content.variants || [];
  const toProcess = limit ? variants.slice(0, limit) : variants;
  console.log(`Processing ${toProcess.length} variant(s) with concurrency=${concurrency}${dryRun ? ' (dry-run)' : ''}…\n`);

  if (!dryRun) mkdirSync(MASCOTS_DIR, { recursive: true });

  let downloaded = 0;
  let alreadyExisted = 0;
  let skipped = 0;
  let updated = 0;
  let progressTick = 0;

  const tasks = toProcess.map((variant) => async () => {
    const schoolTitle = (variant.text?.school_title ?? '').trim();
    const fallbackName = (variant.outputFileName ?? '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const schoolName = schoolTitle || fallbackName;
    const norm = normalizeSchoolName(schoolName);

    const espnId = nameToId.get(norm);
    if (!espnId) {
      console.warn(`  No ESPN id for: ${schoolName}`);
      skipped++;
      return;
    }

    const filename = mascotFilename(schoolName);
    const fullPath = join(MASCOTS_DIR, filename);
    const relativePath = `images/mascots/${filename}`;

    // Skip if valid PNG already on disk
    if (!dryRun && existsSync(fullPath)) {
      try {
        const head = readFileSync(fullPath).slice(0, 8);
        if (isValidPng(head)) {
          variant.images = variant.images ?? {};
          variant.images.school_mascot = relativePath;
          alreadyExisted++;
          updated++;
          return;
        }
      } catch {
        // Re-download below
      }
    }

    // Fetch ESPN API to get logo URL
    let logoInfo;
    try {
      logoInfo = await getEspnLogoUrl(espnId);
    } catch (err) {
      console.warn(`  Skip ${schoolName}: ${err.message}`);
      skipped++;
      return;
    }

    if (dryRun) {
      console.log(`  [dry-run] ${schoolName} (${logoInfo.type}) → ${relativePath}`);
      updated++;
      return;
    }

    const result = await downloadPng(logoInfo.url);
    if (!result.ok) {
      console.warn(`  Skip ${schoolName}: ${result.reason}`);
      skipped++;
      return;
    }

    writeFileSync(fullPath, Buffer.from(result.buf));
    variant.images = variant.images ?? {};
    variant.images.school_mascot = relativePath;
    downloaded++;
    updated++;
    progressTick++;
    if (progressTick % 50 === 0) console.log(`  Downloaded ${downloaded} mascot images…`);
  });

  await runWithConcurrency(tasks, concurrency);

  if (!dryRun && updated > 0) {
    writeFileSync(CONTENT_JSON, JSON.stringify(content, null, '\t'), 'utf-8');
    console.log(`\nWrote ${CONTENT_JSON}`);
  }

  console.log(`\nDone.`);
  console.log(`  Downloaded:     ${downloaded} new mascot images`);
  console.log(`  Already cached: ${alreadyExisted} (skipped re-download)`);
  console.log(`  Skipped:        ${skipped} (no id match or download error)`);
  console.log(`  JSON updated:   ${updated} variant(s)`);
  if (!dryRun) console.log(`  Saved to:       ${MASCOTS_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
