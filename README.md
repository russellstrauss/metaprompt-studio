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

## Project layout

- `src/App.vue` – main UI and form
- `src/composables/useMetaprompt.js` – metaprompt state and prompt-building logic
- `src/style.css` – global styles and theme variables
