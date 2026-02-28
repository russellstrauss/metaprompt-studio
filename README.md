# Metaprompt Studio

A Vue.js app for creating **metaprompts**—structured attributes that combine into high-quality image generation prompts. Similar to structured planning (e.g. Cursor’s plan mode), you define art style, description, color palette, composition, context, typography, and more; the app turns them into a single, well-ordered prompt.

## Stack

- **Vue 3** (Composition API, `<script setup>`)
- **Vite** for dev and production builds
- **Node** / **npm**

## Commands

```bash
npm install   # install dependencies
npm run dev   # start dev server
npm run build # production build (output in dist/)
npm run preview # preview production build
```

## How it works

1. **Structured attributes**  
   You fill in (or pick from presets):
   - Subject & description  
   - Art style & medium  
   - Composition & framing  
   - Lighting & mood  
   - Color palette  
   - Context / setting  
   - Typography (if relevant)  
   - Quality modifiers (e.g. “highly detailed”, “8k”)  
   - Optional negative prompt  

2. **Prompt generation**  
   The app builds one prompt by concatenating these in a fixed order (subject → style → composition → lighting → color → context → typography → quality), so the result is consistent and easy to tune.

3. **Copy**  
   Use “Copy prompt” to paste into DALL·E, Midjourney, Stable Diffusion, or any image generator that accepts text prompts.

## Embedding and API key (host project)

This app **builds to `dist/`** and is meant to be included in another project (e.g. a portfolio) and served from a relative path. Only the host project is deployed. **Optimize (Gemini)** without a client-side key: when the browser has no API key, the app calls a proxy on the same origin. The **host** project must provide that API.

- **Option A – Cloudflare Pages:** Copy the reference Function from this repo into the **host** project: add `functions/api/optimize-prompt.js` to the host repo (see `functions/README.md`). In the **host** project Cloudflare env, set **`GEMINI_API_KEY`** (encrypted is fine). The app will call `/api/optimize-prompt` on the host origin.
- **Option B – Other host:** Implement `POST` that accepts `{ summary, developerTemplate, model }` and returns `{ prompt }` or `{ error }`. Set **`window.__RUNTIME_CONFIG__.OPTIMIZE_PROXY_URL`** to that URL before the app loads.

The host can also inject **`window.__RUNTIME_CONFIG__.GEMINI_API_KEY`** so the app calls Gemini directly.

 If the host project is on Cloudflare Pages, it should add the Function (see `functions/README.md`) and set **GEMINI_API_KEY** in that project's env. Steps for the host’s :

1. In Cloudflare: open your **Pages** project → **Settings** → **Environment variables**.
2. Add a variable named **`GEMINI_API_KEY`** and set it to your Gemini API key. Encrypted is fine (and recommended).
3. Set its value to your Gemini API key and apply it to **Production** (and Preview if you use it).
4. Trigger a new build (e.g. push a commit or “Retry deployment”). Deploy from source so the static build and `functions/` are both deployed; the Function reads `GEMINI_API_KEY` at runtime.

When no API key is set in the browser (e.g. production), the app calls `/api/optimize-prompt` on the same origin; the Function uses the encrypted env var to call Gemini.

## Project layout

- `src/App.vue` – main UI and form
- `src/composables/useMetaprompt.js` – metaprompt state and prompt-building logic
- `src/style.css` – global styles and theme variables
- `functions/` – reference Cloudflare Pages Function for the host project (see `functions/README.md`)
