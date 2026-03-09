/**
 * generate-firefly-images.mjs
 * Generates AI background images for each school frame (bg_image) and/or a year
 * overlay background (year_overlay_image) using Adobe Firefly text-to-image API v3.
 * Adds the generated image paths to fall-football-content.json.
 *
 * Usage:
 *   node generate-firefly-images.mjs [--bg] [--year-overlay] [--year-overlay-per-school] [options]
 *
 * Flags:
 *   --bg                       Generate bg_image for each school variant (per-school)
 *   --year-overlay             Generate ONE shared year_overlay_image, applied to all variants
 *   --year-overlay-per-school  Generate a school-specific year_overlay_image per variant
 *
 * Options:
 *   --limit N                  Only process first N variants (for testing)
 *   --dry-run                  Print prompts; skip API calls and file writes
 *   --overwrite                Re-generate images that already exist on disk
 *   --year YYYY                Year for year overlay prompt (default: current year)
 *   --bg-size WxH              Size for bg_image (default: 1792x1024)
 *   --overlay-size WxH         Size for year_overlay_image (default: 1024x1024)
 *   --client-id=ID             Adobe client ID (overrides FIREFLY_CLIENT_ID env)
 *   --client-secret=SECRET     Adobe client secret (overrides FIREFLY_CLIENT_SECRET env)
 *
 * Required environment variables (or pass as flags above):
 *   FIREFLY_CLIENT_ID          Adobe Developer Console OAuth client ID
 *   FIREFLY_CLIENT_SECRET      Adobe Developer Console OAuth client secret
 *
 * Optional environment variables:
 *   FIREFLY_DELAY_MS           Milliseconds between API requests (default: 1500)
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALL_FOOTBALL_DIR = __dirname;
const IMAGES_DIR = join(FALL_FOOTBALL_DIR, 'images');
const BACKGROUNDS_DIR = join(IMAGES_DIR, 'backgrounds');
const YEAR_OVERLAYS_DIR = join(IMAGES_DIR, 'year-overlays');
const CONTENT_JSON = join(FALL_FOOTBALL_DIR, 'fall-football-content.json');

const FIREFLY_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const FIREFLY_API_URL = 'https://firefly-api.adobe.io/v3/images/generate';
const FIREFLY_SCOPES = 'openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis';

const DEFAULT_DELAY_MS = 1500;
const MAX_RETRIES = 3;

// ─── Prompt helpers ──────────────────────────────────────────────────────────

/**
 * Map a hex color to a human-readable name for richer, more accurate prompts.
 */
function hexToColorName(hex) {
  const h = (hex || '').replace('#', '').toLowerCase().padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const max = Math.max(r, g, b);

  if (max < 40)                                  return 'black';
  if (r > 200 && g > 200 && b > 200)             return 'white';
  if (r > 180 && g > 180 && b > 180)             return 'silver';
  if (r > 160 && g < 60  && b < 60)              return 'red';
  if (r > 120 && g < 40  && b < 60)              return 'maroon';
  if (r > 180 && g > 100 && b < 60)              return 'orange';
  if (r > 180 && g > 150 && b < 70)              return 'gold';
  if (r > 200 && g > 190 && b < 80)              return 'yellow';
  if (r < 80  && g > 140 && b < 80)              return 'green';
  if (r < 60  && g > 100 && b > 140)             return 'teal';
  if (r < 60  && g < 80  && b > 160)             return 'blue';
  if (r < 50  && g < 60  && b > 100)             return 'navy';
  if (r > 100 && g < 60  && b > 130)             return 'purple';
  if (r > 100 && g > 100 && b > 100)             return 'gray';
  return hex;
}

/**
 * Build the Firefly text-to-image prompt for a school's background (bg_image).
 * Uses team colors and mascot name for a school-specific feel.
 */
function buildBgPrompt(variant) {
  const mascotRaw = (variant.text?.school_subtitle ?? '').trim();
  const mascot = mascotRaw.replace(/^Go\s+/i, '').replace(/!!!$/, '').trim();
  const primary   = hexToColorName(variant.colors?.primary_color   || '#222222');
  const secondary = hexToColorName(variant.colors?.secondary_color || '#888888');

  return [
    'college football game day',
    mascot ? `${mascot} school spirit atmosphere` : 'team spirit atmosphere',
    `${primary} and ${secondary} color palette`,
    'stadium crowd bokeh background',
    'dramatic cinematic sports lighting',
    'photorealistic wide shot',
    'no text, no logos, no numbers, no people',
  ].join(', ');
}

/**
 * Build the Firefly prompt for the single shared year overlay background image.
 */
function buildYearOverlayPrompt(year) {
  return [
    `college football ${year} season abstract background`,
    'dark moody texture',
    'autumn leaves, gridiron field elements',
    'dramatic lighting, depth of field',
    'no text, no numbers, no logos',
  ].join(', ');
}

/**
 * Build the Firefly prompt for a per-school year overlay image.
 * Uses team colors so each school's overlay feels on-brand.
 */
function buildYearOverlayPerSchoolPrompt(variant, year) {
  const primary   = hexToColorName(variant.colors?.primary_color   || '#222222');
  const secondary = hexToColorName(variant.colors?.secondary_color || '#888888');

  return [
    `${year} college football season abstract overlay`,
    `${primary} and ${secondary} dark textured background`,
    'grunge sports graphic element',
    'atmospheric moody lighting',
    'no text, no numbers, no logos',
  ].join(', ');
}

// ─── Firefly API ─────────────────────────────────────────────────────────────

/**
 * Exchange client credentials for an Adobe IMS access token.
 */
async function getAccessToken(clientId, clientSecret) {
  const res = await fetch(FIREFLY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: FIREFLY_SCOPES,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in OAuth response');
  return data.access_token;
}

/**
 * Call Firefly v3 text-to-image and return the presigned image URL.
 */
async function callFirefly(prompt, size, accessToken, clientId) {
  const [width, height] = size.split('x').map(Number);
  const body = {
    numSamples: 1,
    size: { width, height },
    prompt,
    negativePrompt: 'text, watermark, logo, number, blurry, distorted, deformed',
    contentClass: 'photo',
  };

  const res = await fetch(FIREFLY_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-api-key': clientId,
      'Content-Type': 'application/json',
      'x-accept-mimetype': 'image/jpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firefly API HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = await res.json();
  const output = data.outputs?.[0];
  if (!output) {
    throw new Error(`No outputs in Firefly response: ${JSON.stringify(data).slice(0, 300)}`);
  }
  const url = output.image?.presignedUrl ?? output.image?.url ?? output.url;
  if (!url) {
    throw new Error(`No image URL in Firefly output: ${JSON.stringify(output).slice(0, 300)}`);
  }
  return url;
}

/**
 * Generate an image with Firefly, retrying up to MAX_RETRIES times on failure.
 * Backs off 4× longer on 429 rate-limit errors.
 */
async function generateWithRetry(prompt, size, accessToken, clientId, delayMs) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callFirefly(prompt, size, accessToken, clientId);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        const isRateLimit = /429|rate.?limit/i.test(err.message);
        const wait = isRateLimit ? delayMs * 4 : delayMs;
        console.warn(`  Retry ${attempt}/${MAX_RETRIES - 1} after ${wait}ms: ${err.message}`);
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

async function downloadImage(url, filePath) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Image download HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  writeFileSync(filePath, Buffer.from(buf));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Argument parsing ────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(`--${name}`);
  const opt = (name) => {
    const a = args.find((a) => a.startsWith(`--${name}=`));
    if (a) return a.split('=').slice(1).join('=');
    const i = args.indexOf(`--${name}`);
    if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
    return null;
  };

  return {
    doBg:                  flag('bg'),
    doYearOverlay:         flag('year-overlay'),
    doYearOverlayPerSchool: flag('year-overlay-per-school'),
    clientId:              opt('client-id')     || process.env.FIREFLY_CLIENT_ID,
    clientSecret:          opt('client-secret') || process.env.FIREFLY_CLIENT_SECRET,
    limit:     opt('limit')   ? parseInt(opt('limit'), 10) : null,
    dryRun:    flag('dry-run'),
    overwrite: flag('overwrite'),
    year:      opt('year')         || String(new Date().getFullYear()),
    bgSize:    opt('bg-size')      || '1792x1024',
    overlaySize: opt('overlay-size') || '1024x1024',
    delayMs:   parseInt(process.env.FIREFLY_DELAY_MS || String(DEFAULT_DELAY_MS), 10),
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const { doBg, doYearOverlay, doYearOverlayPerSchool, dryRun, overwrite, year, bgSize, overlaySize, delayMs } = opts;

  if (!doBg && !doYearOverlay && !doYearOverlayPerSchool) {
    console.error('Specify at least one of: --bg  --year-overlay  --year-overlay-per-school\n');
    console.error('Examples:');
    console.error('  node generate-firefly-images.mjs --bg --limit 5 --dry-run');
    console.error('  node generate-firefly-images.mjs --year-overlay --year 2025');
    console.error('  node generate-firefly-images.mjs --bg --year-overlay --limit 20');
    console.error('  node generate-firefly-images.mjs --bg --year-overlay-per-school');
    process.exit(1);
  }

  if (!dryRun) {
    if (!opts.clientId) {
      console.error('Set FIREFLY_CLIENT_ID env var or pass --client-id=...');
      process.exit(1);
    }
    if (!opts.clientSecret) {
      console.error('Set FIREFLY_CLIENT_SECRET env var or pass --client-secret=...');
      process.exit(1);
    }
  }

  if (!existsSync(CONTENT_JSON)) {
    console.error('Content file not found:', CONTENT_JSON);
    process.exit(1);
  }

  const content = JSON.parse(readFileSync(CONTENT_JSON, 'utf-8'));
  const variants = content.variants || [];
  const toProcess = opts.limit ? variants.slice(0, opts.limit) : variants;

  let accessToken = null;
  if (!dryRun) {
    console.log('Getting Adobe Firefly access token…');
    accessToken = await getAccessToken(opts.clientId, opts.clientSecret);
    console.log('Access token obtained.\n');
  }

  // ─── Shared year overlay image (one image → all variants) ───────────────────
  if (doYearOverlay) {
    mkdirSync(YEAR_OVERLAYS_DIR, { recursive: true });

    const filename     = `year_overlay_${year}.jpg`;
    const fullPath     = join(YEAR_OVERLAYS_DIR, filename);
    const relativePath = `images/year-overlays/${filename}`;
    const prompt       = buildYearOverlayPrompt(year);

    console.log(`Year overlay prompt:\n  ${prompt}\n`);

    if (dryRun) {
      console.log(`[dry-run] Would save → ${relativePath}`);
    } else if (existsSync(fullPath) && !overwrite) {
      console.log(`Year overlay already exists (use --overwrite to regenerate): ${relativePath}`);
    } else {
      try {
        console.log('Generating shared year overlay image…');
        const imageUrl = await generateWithRetry(prompt, overlaySize, accessToken, opts.clientId, delayMs);
        await downloadImage(imageUrl, fullPath);
        console.log('Saved:', relativePath);
        await sleep(delayMs);
      } catch (err) {
        console.error('Year overlay generation failed:', err.message);
      }
    }

    if (!dryRun) {
      for (const variant of variants) {
        if (!variant.images) variant.images = {};
        variant.images.year_overlay_image = relativePath;
      }
      writeFileSync(CONTENT_JSON, JSON.stringify(content, null, '\t'), 'utf-8');
      console.log(`Updated all ${variants.length} variants with year_overlay_image → ${relativePath}\n`);
    }
  }

  // ─── Per-school bg_image and/or per-school year overlay ─────────────────────
  if (doBg || doYearOverlayPerSchool) {
    if (doBg)                  mkdirSync(BACKGROUNDS_DIR,   { recursive: true });
    if (doYearOverlayPerSchool) mkdirSync(YEAR_OVERLAYS_DIR, { recursive: true });

    let bgGenerated = 0, bgSkipped = 0, bgFailed = 0;
    let overlayGenerated = 0, overlaySkipped = 0, overlayFailed = 0;
    let jsonUpdated = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const variant = toProcess[i];
      const slug    = variant.outputFileName || `variant-${i}`;
      const label   = `[${i + 1}/${toProcess.length}] ${variant.text?.school_title ?? slug}`;

      // ── bg_image ─────────────────────────────────────────────────────────────
      if (doBg) {
        const filename     = `${slug}_bg.jpg`;
        const fullPath     = join(BACKGROUNDS_DIR, filename);
        const relativePath = `images/backgrounds/${filename}`;
        const prompt       = buildBgPrompt(variant);

        if (dryRun) {
          console.log(`${label}\n  [bg] ${prompt}`);
        } else if (existsSync(fullPath) && !overwrite) {
          if (!variant.images) variant.images = {};
          variant.images.bg_image = relativePath;
          bgSkipped++;
        } else {
          try {
            if (bgGenerated % 10 === 0) console.log(`Generating bg_image ${label}…`);
            const imageUrl = await generateWithRetry(prompt, bgSize, accessToken, opts.clientId, delayMs);
            await downloadImage(imageUrl, fullPath);
            if (!variant.images) variant.images = {};
            variant.images.bg_image = relativePath;
            bgGenerated++;
            jsonUpdated++;
            await sleep(delayMs);
          } catch (err) {
            console.warn(`  Failed bg_image for ${slug}: ${err.message}`);
            bgFailed++;
          }
        }
      }

      // ── year_overlay_image (per-school) ──────────────────────────────────────
      if (doYearOverlayPerSchool) {
        const filename     = `${slug}_year_overlay.jpg`;
        const fullPath     = join(YEAR_OVERLAYS_DIR, filename);
        const relativePath = `images/year-overlays/${filename}`;
        const prompt       = buildYearOverlayPerSchoolPrompt(variant, year);

        if (dryRun) {
          console.log(`${label}\n  [year-overlay] ${prompt}`);
        } else if (existsSync(fullPath) && !overwrite) {
          if (!variant.images) variant.images = {};
          variant.images.year_overlay_image = relativePath;
          overlaySkipped++;
        } else {
          try {
            const imageUrl = await generateWithRetry(prompt, overlaySize, accessToken, opts.clientId, delayMs);
            await downloadImage(imageUrl, fullPath);
            if (!variant.images) variant.images = {};
            variant.images.year_overlay_image = relativePath;
            overlayGenerated++;
            jsonUpdated++;
            await sleep(delayMs);
          } catch (err) {
            console.warn(`  Failed year_overlay for ${slug}: ${err.message}`);
            overlayFailed++;
          }
        }
      }
    }

    if (!dryRun && jsonUpdated > 0) {
      writeFileSync(CONTENT_JSON, JSON.stringify(content, null, '\t'), 'utf-8');
    }

    console.log('\nSummary:');
    if (doBg) {
      console.log(`  bg_image:         generated=${bgGenerated}, skipped=${bgSkipped}, failed=${bgFailed}`);
    }
    if (doYearOverlayPerSchool) {
      console.log(`  year_overlay:     generated=${overlayGenerated}, skipped=${overlaySkipped}, failed=${overlayFailed}`);
    }
    if (!dryRun && jsonUpdated > 0) {
      console.log(`  JSON updated with ${jsonUpdated} new image path(s).`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
