/**
 * fetch-colors-wikipedia.mjs
 * Fetches college team colors from Wikipedia Module:College_color/data and updates
 * logos.csv color and alt_color columns. Uses primary (first) and secondary (second)
 * hex from the module; resolves alias entries.
 *
 * Usage: node fetch-colors-wikipedia.mjs [logos.csv]
 * Default: ./logos.csv (same folder as this script).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALL_FOOTBALL_DIR = __dirname;
const DEFAULT_CSV = join(FALL_FOOTBALL_DIR, 'logos.csv');
const WIKI_RAW_URL = 'https://en.wikipedia.org/wiki/Module:College_color/data?action=raw';

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

function escapeCSVField(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function normalizeKey(name) {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\u2013/g, ' ') // en-dash
    .replace(/\u2014/g, ' ') // em-dash
    .replace(/\s+/g, ' ')
    .trim();
}

const WHITE_HEX = '#FFFFFF';

/** Parse Lua table from Wikipedia raw. Returns Map(normalizedKey -> { primary, secondary }). */
function parseWikipediaLua(rawText) {
  const colorData = new Map(); // key -> { primary, secondary }
  const aliases = new Map();   // key -> canonicalKey

  // ["Some Key"] = {"hex1", "hex2", "hex3", ...}  capture up to 3 hex values; use third as secondary when second is white
  const dataRegex = /\[\"([^\"]+)\"\]\s*=\s*\{\s*\"([0-9A-Fa-f]{6})\",\s*\"([0-9A-Fa-f]{6})\"(?:,\s*\"([0-9A-Fa-f]{6})\")?/g;
  // ["Alias Key"] = "Canonical Key"
  const aliasRegex = /\[\"([^\"]+)\"\]\s*=\s*\"([^\"]+)\"/g;

  let m;
  while ((m = dataRegex.exec(rawText)) !== null) {
    const key = m[1].trim();
    const primary = '#' + m[2].toUpperCase();
    let secondary = '#' + m[3].toUpperCase();
    const third = m[4] ? '#' + m[4].toUpperCase() : null;
    if (secondary === WHITE_HEX && third && third !== WHITE_HEX) {
      secondary = third;
    }
    colorData.set(normalizeKey(key), { primary, secondary });
  }

  while ((m = aliasRegex.exec(rawText)) !== null) {
    const fromKey = m[1].trim();
    const toKey = m[2].trim();
    aliases.set(normalizeKey(fromKey), normalizeKey(toKey));
  }

  // Resolve aliases: point alias to same colors as canonical
  for (const [aliasNorm, canonicalNorm] of aliases) {
    const canon = colorData.get(canonicalNorm);
    if (canon) colorData.set(aliasNorm, canon);
  }

  return colorData;
}

function buildLookupKeys(school, mascot) {
  const s = (school || '').trim();
  const m = (mascot || '').trim();
  if (!s && !m) return [];
  const full = m ? `${s} ${m}` : s;
  const keys = [full];

  // Without parenthetical: "Albany State (GA)" -> "Albany State"
  const withoutParen = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (withoutParen !== s && m) keys.push(`${withoutParen} ${m}`);

  // "Amherst College" / "Avila College" -> "Amherst" / "Avila" for "Amherst Mammoths", "Avila Eagles"
  if (/\s+College\s*$/.test(s) && m) {
    keys.push(`${s.replace(/\s+College\s*$/, '')} ${m}`);
  }

  // "Alma College" -> "Alma Scots" (school name has "College" in middle)
  if (s.includes(' College ') && m) {
    keys.push(`${s.replace(/\s+College\s+/, ' ')} ${m}`);
  }

  // Alderson-Broaddus -> Alderson Broaddus
  if (s.includes('-') && m) keys.push(`${s.replace(/-/g, ' ')} ${m}`);

  // Alfred State College -> Alfred State (for schools that might be "Alfred Saxons" vs "Alfred State College Pioneers")
  if (s.includes('State College') && m) keys.push(`${s} ${m}`);

  // "Allegheny Golden Gators" -> try "Allegheny Gators" (Wikipedia often drops "Golden"/"Lady"/"Fighting" prefix)
  if (m && /^(Golden |Lady |Fighting )/i.test(m)) {
    keys.push(`${s} ${m.replace(/^(Golden |Lady |Fighting )/i, '')}`);
  }

  // "Arkansas-Monticello Weevils" -> "Arkansas-Monticello Boll Weevils"
  if (m === 'Weevils') keys.push(`${s} Boll Weevils`);

  return [...new Set(keys)];
}

async function main() {
  const csvPath = process.argv[2] || DEFAULT_CSV;
  if (!existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  console.log('Fetching Wikipedia Module:College_color/data...');
  const res = await fetch(WIKI_RAW_URL, { redirect: 'follow' });
  if (!res.ok) {
    console.error('Fetch failed:', res.status, res.statusText);
    process.exit(1);
  }
  const rawText = await res.text();
  const colorMap = parseWikipediaLua(rawText);
  console.log('Parsed', colorMap.size, 'team color entries.');

  const { headers, rows } = parseCSV(csvPath);
  const colorIdx = headers.indexOf('color');
  const altColorIdx = headers.indexOf('alt_color');
  if (colorIdx === -1 || altColorIdx === -1) {
    console.error('CSV must have color and alt_color columns.');
    process.exit(1);
  }

  let updated = 0;
  let notFound = 0;

  for (const row of rows) {
    const school = row.school || '';
    const mascot = row.mascot || '';
    const keys = buildLookupKeys(school, mascot);
    let found = null;
    for (const k of keys) {
      const norm = normalizeKey(k);
      if (colorMap.has(norm)) {
        found = colorMap.get(norm);
        break;
      }
    }
    if (found) {
      row.color = found.primary;
      row.alt_color = found.secondary;
      updated++;
    } else if (school) {
      notFound++;
    }
  }

  // Write CSV back
  const outLines = [headers.map(escapeCSVField).join(',')];
  for (const row of rows) {
    const values = headers.map((h) => escapeCSVField(row[h]));
    outLines.push(values.join(','));
  }
  writeFileSync(csvPath, outLines.join('\n') + '\n', 'utf-8');

  console.log('Updated', updated, 'rows with colors from Wikipedia.');
  console.log('No match for', notFound, 'rows.');
  console.log('Wrote', csvPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
