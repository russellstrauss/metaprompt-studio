# Metaprompt Studio

A Vue.js app for creating **metaprompts**â€”structured attributes that combine into high-quality image generation prompts. Similar to structured planning (e.g. Cursorâ€™s plan mode), you define art style, description, color palette, composition, context, typography, and more; the app turns them into a single, well-ordered prompt.

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
   - Quality modifiers (e.g. â€œhighly detailedâ€, â€œ8kâ€)  
   - Optional negative prompt  

2. **Prompt generation**  
   The app builds one prompt by concatenating these in a fixed order (subject â†’ style â†’ composition â†’ lighting â†’ color â†’ context â†’ typography â†’ quality), so the result is consistent and easy to tune.

3. **Copy**  
   Use â€œCopy promptâ€ to paste into DALLÂ·E, Midjourney, Stable Diffusion, or any image generator that accepts text prompts.

## Embedding and API key (host project)

This app **builds to `dist/`** and is meant to be included in another project (e.g. a portfolio) and served from a relative path. **The API key is never included in the build**, so dist/ is safe to copy or commit.

**Production:** the app fetches the key at runtime. Add one Function in the host repo (see `functions/README.md`). Do not use the env var when building.

- **Local dev:** copy `.env.example` to `.env` and set `VITE_GEMINI_API_KEY` (used only when running `npm run dev`).
- **Production:** copy `functions/api/metaprompt-config.js` into the host repo; set `GEMINI_API_KEY` in Cloudflare Pages env; deploy from source. The app fetches the key from GET /api/metaprompt-config at runtime.




## Project layout

- `src/App.vue` â€“ main UI and form
- `src/composables/useMetaprompt.js` â€“ metaprompt state and prompt-building logic
- `src/style.css` â€“ global styles and theme variables
- `functions/` â€“ reference Cloudflare Pages Function for the host project (see `functions/README.md`)
