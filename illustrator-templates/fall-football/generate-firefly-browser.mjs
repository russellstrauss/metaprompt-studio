/**
 * generate-firefly-browser.mjs
 * Browser automation for Adobe Firefly (firefly.adobe.com).
 * Generates bg_image (per school) and/or year_overlay_image by driving
 * the Firefly web UI with Playwright, then saves images and updates
 * fall-football-content.json.
 *
 * First-time setup:
 *   npm install                        (installs Playwright)
 *   npx playwright install chromium    (downloads the browser)
 *
 * Usage:
 *   node generate-firefly-browser.mjs [--bg] [--year-overlay] [options]
 *
 * Flags:
 *   --bg                       Generate bg_image for each school variant (per-school)
 *   --year-overlay             Generate ONE shared year_overlay_image for all variants
 *   --year-overlay-per-school  Generate a school-specific year_overlay_image per variant
 *
 * Options:
 *   --limit N                  Only process first N variants (for testing)
 *   --dry-run                  Print prompts only; do not open browser
 *   --overwrite                Re-generate images that already exist on disk
 *   --year YYYY                Year for overlay prompt (default: current year)
 *   --profile PATH             Browser profile directory (default: ./.firefly-profile)
 *   --headless                 Run headless (only use after confirming login works headed)
 *   --pause-between N          Extra milliseconds to pause between schools (default: 2000)
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALL_FOOTBALL_DIR = __dirname;
const IMAGES_DIR        = join(FALL_FOOTBALL_DIR, 'images');
const BACKGROUNDS_DIR   = join(IMAGES_DIR, 'backgrounds');
const YEAR_OVERLAYS_DIR = join(IMAGES_DIR, 'year-overlays');
const CONTENT_JSON      = join(FALL_FOOTBALL_DIR, 'fall-football-content.json');

// Firefly web URLs
const FIREFLY_HOME    = 'https://firefly.adobe.com';
const FIREFLY_T2I_URL = 'https://firefly.adobe.com/inspire/images';

// Minimum byte size to consider a network response a "generated" image.
// Community gallery thumbnails are typically smaller; generated images are larger.
const MIN_IMAGE_BYTES = 200_000;

// ─── Prompt builders ──────────────────────────────────────────────────────────

// Reference palette used for nearest-color matching.
// Covers the full range of college team colors.
const COLOR_PALETTE = [
  [0,   0,   0,   'black'],
  [255, 255, 255, 'white'],
  [180, 180, 180, 'silver'],
  [100, 100, 100, 'gray'],
  [210, 30,  30,  'red'],
  [140, 10,  10,  'dark red'],
  [120, 20,  50,  'maroon'],
  [220, 110, 20,  'orange'],
  [215, 175, 15,  'gold'],
  [230, 215, 20,  'yellow'],
  [20,  130, 30,  'green'],
  [0,   80,  40,  'dark green'],
  [0,   130, 130, 'teal'],
  [30,  60,  200, 'blue'],
  [10,  25,  100, 'navy blue'],
  [0,   50,  160, 'royal blue'],
  [100, 20,  160, 'purple'],
  [60,  0,   100, 'dark purple'],
  [180, 50,  180, 'violet'],
  [200, 170, 120, 'tan'],
  [130, 70,  20,  'brown'],
];

/**
 * Convert a hex color to the nearest human-readable color name.
 * Always returns a plain English name — never a hex string.
 */
function hexToColorName(hex) {
  const h = (hex || '').replace('#', '').toLowerCase().padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);

  let best = COLOR_PALETTE[0][3];
  let bestDist = Infinity;
  for (const [cr, cg, cb, name] of COLOR_PALETTE) {
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

/**
 * Build the background prompt for a school.
 *
 * Deliberately avoids mascot/team names and "no people" language —
 * both can trigger Firefly content-safety blocks. Uses only color
 * names (never hex codes) and generic football imagery.
 */
function buildBgPrompt(variant) {
  const primary   = hexToColorName(variant.colors?.primary_color   || '#333333');
  const secondary = hexToColorName(variant.colors?.secondary_color || '#888888');

  return [
    'college football game day atmosphere',
    `${primary} and ${secondary} color scheme`,
    'empty football stadium at sunset',
    'dramatic cinematic lighting',
    'bokeh depth of field',
    'photorealistic wide shot',
  ].join(', ');
}

/**
 * Build the shared year-overlay prompt.
 * Simple abstract texture — avoids any imagery that might be flagged.
 */
function buildYearOverlayPrompt(year) {
  return [
    `${year} college football season`,
    'abstract autumn texture background',
    'dark dramatic lighting',
    'grunge overlay graphic',
    'deep shadows and warm highlights',
  ].join(', ');
}

/**
 * Per-school year-overlay prompt with team colors.
 */
function buildYearOverlayPerSchoolPrompt(variant, year) {
  const primary   = hexToColorName(variant.colors?.primary_color   || '#333333');
  const secondary = hexToColorName(variant.colors?.secondary_color || '#888888');

  return [
    `${year} college football season`,
    `${primary} and ${secondary} abstract texture`,
    'dark dramatic overlay background',
    'grunge sports graphic',
    'deep shadows and warm highlights',
  ].join(', ');
}

// ─── Network image capture ────────────────────────────────────────────────────

/**
 * Attaches a response listener to the page that buffers large images arriving
 * while a capture session is active.
 *
 * Call startCapture(page) JUST BEFORE clicking Generate — it snapshots the
 * image URLs already on the page so that lazy-loading community-gallery images
 * cannot be confused with newly-generated ones.
 */
function createImageCapture(page) {
  let active   = false;
  let seenUrls = new Set(); // URLs already present before generation started
  const queue  = [];

  page.on('response', async (response) => {
    if (!active) return;
    if (response.status() !== 200 && response.status() !== 206) return;
    const ct = response.headers()['content-type'] || '';
    if (!ct.startsWith('image/')) return;

    const url = response.url();
    if (seenUrls.has(url)) return; // already loaded before generation

    // Skip small images (icons, spinners, thumbnails)
    const cl = parseInt(response.headers()['content-length'] || '0', 10);
    if (cl > 0 && cl < MIN_IMAGE_BYTES) return;

    try {
      const buf = await response.body();
      if (buf.length >= MIN_IMAGE_BYTES) {
        queue.push({ url, buf, contentType: ct });
      }
    } catch {
      // response body may be unavailable; ignore
    }
  });

  return {
    /** Call this right before clicking Generate. */
    async startCapture() {
      // Snapshot every image src already loaded so we can exclude them
      try {
        const existing = await page.evaluate(() =>
          Array.from(document.querySelectorAll('img'))
            .map(img => img.src)
            .filter(s => s.startsWith('http'))
        );
        seenUrls = new Set(existing);
      } catch {
        seenUrls = new Set();
      }
      queue.length = 0;
      active = true;
    },
    stopCapture() {
      active = false;
    },
    /** Wait up to `timeout` ms for at least `minCount` images. */
    async waitForImages(minCount = 1, timeout = 120_000) {
      const deadline = Date.now() + timeout;
      while (queue.length < minCount && Date.now() < deadline) {
        await sleep(500);
      }
      active = false;
      return [...queue];
    },
  };
}

// ─── Playwright helpers ───────────────────────────────────────────────────────

/**
 * Fill the Firefly prompt textarea.
 *
 * Firefly uses nested Web Components with open Shadow DOM:
 *   <firefly-prompt>
 *     #shadow-root
 *       <firefly-textfield class="input-textfield">
 *         #shadow-root
 *           <textarea placeholder="Describe the image you want to generate">
 *
 * Playwright CSS selectors automatically pierce open shadow roots, so
 * 'firefly-prompt textarea' resolves to the real <textarea>.
 */
async function setPrompt(page, promptText) {
  const textarea = page.locator('firefly-prompt textarea');
  try {
    await textarea.waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    throw new Error(
      'Could not find the Firefly prompt textarea after 20 s.\n' +
      'Make sure you are on https://firefly.adobe.com/inspire/images and logged in.'
    );
  }
  await textarea.click();
  await page.keyboard.press('Control+a');
  await textarea.fill(promptText);

  // Verify the text was accepted (shadow DOM fill can sometimes be swallowed)
  const value = await textarea.inputValue().catch(() => null);
  if (value !== null && value.trim() === '') {
    // Fallback: type character by character
    await textarea.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(promptText, { delay: 10 });
  }
}

/**
 * Click the Generate button.
 * The button is an <sp-button> web component; getByRole() resolves through shadow DOM.
 */
async function clickGenerate(page) {
  const btn = page.getByRole('button', { name: 'Generate' });
  try {
    await btn.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    throw new Error('Could not find the Generate button. Is there text in the prompt field?');
  }
  await btn.click();
}

/**
 * Wait for the Generate button to leave the disabled/loading state,
 * indicating that generation has finished.
 */
async function waitForGenerationComplete(page, timeout = 120_000) {
  // The button is disabled while generating; wait for it to become enabled again
  const btn = page.getByRole('button', { name: 'Generate' });
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const disabled = await btn.isDisabled().catch(() => true);
    if (!disabled) return;
    await sleep(1000);
  }
  // Don't throw — generation may still have produced images even if timeout hit
}

/**
 * Best-effort: try to click an aspect-ratio button in the Firefly toolbar.
 * Uses getByRole so it works regardless of shadow DOM depth.
 * Returns true if a matching button was found and clicked.
 */
async function trySetAspectRatio(page, ratioLabel) {
  // Firefly toolbar has buttons like "Landscape", "Square", "Portrait", "Widescreen"
  const btn = page.getByRole('button', { name: new RegExp(ratioLabel, 'i') });
  try {
    await btn.waitFor({ state: 'visible', timeout: 4_000 });
    await btn.click();
    await sleep(400);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether the user is currently logged in to Firefly.
 * Looks for the presence of a "Sign in" button — if it exists, not logged in.
 */
async function isLoggedIn(page) {
  await page.goto(FIREFLY_HOME, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await sleep(3000);
  try {
    await page.getByRole('button', { name: 'Sign in' }).waitFor({ state: 'visible', timeout: 3000 });
    return false; // sign-in button found → not logged in
  } catch {
    return true;  // sign-in button not found → logged in
  }
}

/**
 * Open a browser page and wait (up to 5 minutes) for the user to log in.
 */
async function waitForLogin(page) {
  console.log('\n─────────────────────────────────────────────────────');
  console.log('ACTION REQUIRED: Please log in to Adobe Firefly');
  console.log('  The browser window is open at firefly.adobe.com');
  console.log('  Sign in with your Adobe account (free account works)');
  console.log('  The script will continue automatically after login.');
  console.log('─────────────────────────────────────────────────────\n');

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    try {
      await page.getByRole('button', { name: 'Sign in' }).waitFor({ state: 'visible', timeout: 2000 });
      // Still showing Sign in — keep waiting
    } catch {
      console.log('Login detected. Continuing…\n');
      return;
    }
    await sleep(3000);
  }
  throw new Error('Login timeout: user did not log in within 5 minutes.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(`--${name}`);
  const opt  = (name) => {
    const a = args.find((a) => a.startsWith(`--${name}=`));
    if (a) return a.split('=').slice(1).join('=');
    const i = args.indexOf(`--${name}`);
    if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
    return null;
  };

  return {
    doBg:                   flag('bg'),
    doYearOverlay:          flag('year-overlay'),
    doYearOverlayPerSchool: flag('year-overlay-per-school'),
    limit:        opt('limit') ? parseInt(opt('limit'), 10) : null,
    dryRun:       flag('dry-run'),
    overwrite:    flag('overwrite'),
    headless:     flag('headless'),
    year:         opt('year') || String(new Date().getFullYear()),
    profileDir:   resolve(opt('profile') || join(FALL_FOOTBALL_DIR, '.firefly-profile')),
    pauseBetween: parseInt(opt('pause-between') || '2000', 10),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const { doBg, doYearOverlay, doYearOverlayPerSchool, dryRun, overwrite, year, pauseBetween } = opts;

  if (!doBg && !doYearOverlay && !doYearOverlayPerSchool) {
    console.error('Specify at least one of: --bg  --year-overlay  --year-overlay-per-school\n');
    console.error('Examples:');
    console.error('  node generate-firefly-browser.mjs --bg --limit 5 --dry-run');
    console.error('  node generate-firefly-browser.mjs --year-overlay --year 2025');
    console.error('  node generate-firefly-browser.mjs --bg --year-overlay --limit 10');
    process.exit(1);
  }

  if (!existsSync(CONTENT_JSON)) {
    console.error('Content file not found:', CONTENT_JSON);
    process.exit(1);
  }

  const content  = JSON.parse(readFileSync(CONTENT_JSON, 'utf-8'));
  const variants = content.variants || [];
  const toProcess = opts.limit ? variants.slice(0, opts.limit) : variants;

  // ── Dry run: just print prompts ────────────────────────────────────────────
  if (dryRun) {
    if (doYearOverlay) {
      const prompt = buildYearOverlayPrompt(year);
      console.log(`[year-overlay — shared]\n  ${prompt}\n`);
    }
    for (const variant of toProcess) {
      const slug  = variant.outputFileName || '?';
      const label = variant.text?.school_title ?? slug;
      if (doBg) {
        console.log(`[bg] ${label}\n  ${buildBgPrompt(variant)}`);
      }
      if (doYearOverlayPerSchool) {
        console.log(`[year-overlay] ${label}\n  ${buildYearOverlayPerSchoolPrompt(variant, year)}`);
      }
      console.log('');
    }
    return;
  }

  // ── Launch browser with persistent profile ─────────────────────────────────
  mkdirSync(opts.profileDir, { recursive: true });
  console.log(`Browser profile: ${opts.profileDir}`);
  console.log('Launching browser…\n');

  const context = await chromium.launchPersistentContext(opts.profileDir, {
    headless: opts.headless,
    viewport: { width: 1400, height: 900 },
    args: ['--no-sandbox'],
    acceptDownloads: true,
  });

  const page = context.pages()[0] || await context.newPage();
  // Attach image capture listener once; it stays active for the session lifetime
  const imageCapture = createImageCapture(page);

  /**
   * Run one full generation cycle: set prompt → snapshot existing images →
   * generate → collect the first new image returned by the network.
   * Returns the image Buffer, or throws on timeout.
   */
  async function generate(prompt) {
    await setPrompt(page, prompt);
    // Snapshot existing images AFTER the prompt is set but BEFORE clicking Generate,
    // so any community-gallery images that loaded during typing are already excluded.
    await imageCapture.startCapture();
    await clickGenerate(page);
    console.log('  Generating…');
    const images = await imageCapture.waitForImages(1, 120_000);
    if (images.length === 0) throw new Error('No image received within 120 s (generation may have failed or was blocked).');
    await waitForGenerationComplete(page, 5_000); // brief wait for UI to settle
    return images[0].buf;
  }

  try {
    // ── Login check ─────────────────────────────────────────────────────────
    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      await waitForLogin(page);
    } else {
      console.log('Already logged in to Adobe Firefly.\n');
    }

    // Navigate to the text-to-image generator and let it fully render
    await page.goto(FIREFLY_T2I_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sleep(4000);

    // ── Shared year overlay (single image, applied to all variants) ──────────
    if (doYearOverlay) {
      mkdirSync(YEAR_OVERLAYS_DIR, { recursive: true });

      const filename     = `year_overlay_${year}.jpg`;
      const fullPath     = join(YEAR_OVERLAYS_DIR, filename);
      const relativePath = `images/year-overlays/${filename}`;
      const prompt       = buildYearOverlayPrompt(year);

      console.log(`Generating shared year overlay (${year})…`);
      console.log(`  Prompt: ${prompt}`);

      if (existsSync(fullPath) && !overwrite) {
        console.log(`  Skipped (already exists). Use --overwrite to regenerate.\n`);
      } else {
        await trySetAspectRatio(page, 'Square');
        const buf = await generate(prompt);
        writeFileSync(fullPath, buf);
        console.log(`  Saved → ${relativePath}\n`);
        await sleep(pauseBetween);
      }

      for (const variant of variants) {
        if (!variant.images) variant.images = {};
        variant.images.year_overlay_image = relativePath;
      }
      writeFileSync(CONTENT_JSON, JSON.stringify(content, null, '\t'), 'utf-8');
      console.log(`Updated all ${variants.length} variants with year_overlay_image.\n`);
    }

    // ── Per-school bg_image and/or per-school year overlay ───────────────────
    if (doBg || doYearOverlayPerSchool) {
      if (doBg)                   mkdirSync(BACKGROUNDS_DIR,   { recursive: true });
      if (doYearOverlayPerSchool) mkdirSync(YEAR_OVERLAYS_DIR, { recursive: true });

      let bgGenerated = 0, bgSkipped = 0, bgFailed = 0;
      let ovGenerated = 0, ovSkipped = 0, ovFailed = 0;
      let jsonUpdated = 0;

      for (let i = 0; i < toProcess.length; i++) {
        const variant = toProcess[i];
        const slug    = variant.outputFileName || `variant-${i}`;
        const label   = `[${i + 1}/${toProcess.length}] ${variant.text?.school_title ?? slug}`;

        // ── bg_image ──────────────────────────────────────────────────────────
        if (doBg) {
          const filename     = `${slug}_bg.jpg`;
          const fullPath     = join(BACKGROUNDS_DIR, filename);
          const relativePath = `images/backgrounds/${filename}`;
          const prompt       = buildBgPrompt(variant);

          if (existsSync(fullPath) && !overwrite) {
            if (!variant.images) variant.images = {};
            variant.images.bg_image = relativePath;
            bgSkipped++;
          } else {
            console.log(`${label} — bg_image`);
            console.log(`  Prompt: ${prompt}`);
            try {
              await trySetAspectRatio(page, 'Landscape');
              const buf = await generate(prompt);
              writeFileSync(fullPath, buf);
              if (!variant.images) variant.images = {};
              variant.images.bg_image = relativePath;
              bgGenerated++;
              jsonUpdated++;
              console.log(`  Saved → ${relativePath}`);
              await sleep(pauseBetween);
            } catch (err) {
              console.warn(`  FAILED bg_image for ${slug}: ${err.message}`);
              bgFailed++;
            }
          }
        }

        // ── year_overlay_image (per school) ───────────────────────────────────
        if (doYearOverlayPerSchool) {
          const filename     = `${slug}_year_overlay.jpg`;
          const fullPath     = join(YEAR_OVERLAYS_DIR, filename);
          const relativePath = `images/year-overlays/${filename}`;
          const prompt       = buildYearOverlayPerSchoolPrompt(variant, year);

          if (existsSync(fullPath) && !overwrite) {
            if (!variant.images) variant.images = {};
            variant.images.year_overlay_image = relativePath;
            ovSkipped++;
          } else {
            console.log(`${label} — year_overlay`);
            console.log(`  Prompt: ${prompt}`);
            try {
              await trySetAspectRatio(page, 'Square');
              const buf = await generate(prompt);
              writeFileSync(fullPath, buf);
              if (!variant.images) variant.images = {};
              variant.images.year_overlay_image = relativePath;
              ovGenerated++;
              jsonUpdated++;
              console.log(`  Saved → ${relativePath}`);
              await sleep(pauseBetween);
            } catch (err) {
              console.warn(`  FAILED year_overlay for ${slug}: ${err.message}`);
              ovFailed++;
            }
          }
        }

        // Save progress every 10 schools
        if (jsonUpdated > 0 && jsonUpdated % 10 === 0) {
          writeFileSync(CONTENT_JSON, JSON.stringify(content, null, '\t'), 'utf-8');
          console.log(`  (Progress saved — ${jsonUpdated} updates so far)`);
        }
      }

      if (jsonUpdated > 0) {
        writeFileSync(CONTENT_JSON, JSON.stringify(content, null, '\t'), 'utf-8');
      }

      console.log('\nSummary:');
      if (doBg) {
        console.log(`  bg_image:     generated=${bgGenerated}, skipped=${bgSkipped}, failed=${bgFailed}`);
      }
      if (doYearOverlayPerSchool) {
        console.log(`  year_overlay: generated=${ovGenerated}, skipped=${ovSkipped}, failed=${ovFailed}`);
      }
      if (jsonUpdated > 0) {
        console.log(`  JSON updated with ${jsonUpdated} new image path(s).`);
      }
    }
  } finally {
    await context.close();
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
