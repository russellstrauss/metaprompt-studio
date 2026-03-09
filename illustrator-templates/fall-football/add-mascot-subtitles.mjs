/**
 * add-mascot-subtitles.mjs
 * One-time migration: reads mascot names from logos.csv and updates
 * school_subtitle in fall-football-content.json with "Go [mascot]!!!"
 *
 * Usage: node add-mascot-subtitles.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, 'logos.csv');
const JSON_PATH = join(__dirname, 'fall-football-content.json');

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

function slugFromSchool(school) {
  return String(school)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// Build a slug → mascot map from logos.csv
const csvText = readFileSync(CSV_PATH, 'utf-8');
const csvLines = csvText.split(/\r?\n/).filter((l) => l.length);
const headers = parseCSVLine(csvLines[0]);
const schoolIdx = headers.indexOf('school');
const mascotIdx = headers.indexOf('mascot');

const mascotMap = new Map();
for (const line of csvLines.slice(1)) {
  const values = parseCSVLine(line);
  const school = (values[schoolIdx] || '').trim();
  const mascot = (values[mascotIdx] || '').trim();
  if (school && mascot) {
    mascotMap.set(slugFromSchool(school), mascot);
  }
}

console.log(`Loaded ${mascotMap.size} mascot entries from logos.csv`);

// Update content JSON
const content = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
let updated = 0;
let noMascot = 0;

for (const variant of content.variants) {
  const mascot = mascotMap.get(variant.outputFileName);
  if (mascot) {
    variant.text.school_subtitle = `Go ${mascot}!!!`;
    updated++;
  } else {
    noMascot++;
  }
}

writeFileSync(JSON_PATH, JSON.stringify(content, null, '\t'), 'utf-8');

console.log(`Updated ${updated} variants with subtitles.`);
console.log(`${noMascot} variants had no mascot match (slug mismatch or missing mascot).`);
console.log('Done.');
