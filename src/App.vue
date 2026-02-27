<script setup>
import { useMetaprompt } from './composables/useMetaprompt'
import { ref } from 'vue'

const {
  meta,
  baseSummary,
  finalOutput,
  optimizePrompt,
  optimizedPrompt,
  isOptimizing,
  optimizeError,
  lastOptimizedAt,
  developerInstructionTemplate,
  llmApiKey,
  GEMINI_MODEL,
  llmInputPreview,
  PROMPT_PLACEHOLDER,
  resetDeveloperTemplateToDefault,
  resetDeveloperSettings,
  presetStyles,
  presetColorPalettes,
  presetCompositions,
  presetLighting,
  presetMoods,
  qualityTags,
  toggleArtStyle,
  toggleColorPalette,
  toggleComposition,
  toggleLighting,
  toggleMood,
  toggleQualityTag,
  reset,
} = useMetaprompt()

const copied = ref(false)

function copyToClipboard() {
  navigator.clipboard.writeText(finalOutput.value).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  })
}
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>Metaprompt Studio</h1>
      <p class="tagline">Structuring attributes for high-quality image prompts</p>
      <div class="prompt-at-top">
        <p v-if="finalOutput" class="prompt-text">{{ finalOutput }}</p>
        <p v-else class="prompt-placeholder">Set a template above and fill in attributes below to see your prompt here.</p>
        <div class="prompt-actions">
          <button
            type="button"
            class="btn secondary"
            :disabled="isOptimizing"
            @click="optimizePrompt"
          >
            {{ isOptimizing ? 'Generating...' : 'Generate prompt' }}
          </button>
          <button
            type="button"
            class="btn primary"
            :disabled="!finalOutput || isOptimizing"
            @click="copyToClipboard"
          >
            {{ copied ? 'Copied!' : 'Copy prompt' }}
          </button>
        </div>
        <p v-if="optimizeError" class="status-error">{{ optimizeError }}</p>
        <p v-else-if="optimizedPrompt && lastOptimizedAt" class="status-note">Optimized just now using Developer settings.</p>
        <div v-if="meta.negativePrompt" class="negative-at-top">
          <span class="negative-label">Negative prompt:</span>
          <span class="negative-text">{{ meta.negativePrompt }}</span>
        </div>
      </div>
    </header>

    <div class="layout">
      <aside class="form-panel">
        <details class="block block-template developer-settings">
          <summary>Developer settings (advanced)</summary>
          <p class="block-hint">This configuration is hidden from end users and saved locally in your browser.</p>
          <p class="warning-text">Direct frontend API calls expose your key in the browser environment. Use only for local/dev workflows.</p>

          <label>Gemini API key</label>
          <input
            v-model="llmApiKey"
            type="password"
            autocomplete="off"
            placeholder="AIza... (or set VITE_GEMINI_API_KEY in .env)"
          />
          <p class="placeholder-hint">Free key at <a href="https://aistudio.google.com" target="_blank" rel="noopener">aistudio.google.com</a> — no credit card needed.</p>

          <label class="mt">Model</label>
          <input :value="GEMINI_MODEL" type="text" readonly />

          <label class="mt">Developer instruction template</label>
          <textarea
            v-model="developerInstructionTemplate"
            class="template-textarea"
            rows="10"
            :placeholder="'e.g. Your instructions... ' + PROMPT_PLACEHOLDER + ' ...rest of template'"
          />
          <p class="placeholder-hint"><code>{{ PROMPT_PLACEHOLDER }}</code> → replaced with the generated base summary before the LLM call</p>

          <label class="mt">Current base summary (deterministic fallback)</label>
          <textarea :value="baseSummary" class="template-textarea" rows="4" readonly />

          <label class="mt">LLM input preview</label>
          <textarea :value="llmInputPreview" class="template-textarea" rows="6" readonly />

          <div class="developer-actions">
            <button type="button" class="btn secondary btn-sm" @click="resetDeveloperTemplateToDefault">Reset template</button>
            <button type="button" class="btn secondary btn-sm" @click="resetDeveloperSettings">Reset all dev settings</button>
          </div>
        </details>

        <section class="block">
          <h2>Subject & description</h2>
          <label>Subject</label>
          <input
            v-model="meta.subject"
            type="text"
            placeholder="e.g. a lone astronaut, a futuristic city"
          />
          <label>Description</label>
          <textarea
            v-model="meta.description"
            rows="2"
            placeholder="Detailed description of the scene or subject..."
          />
        </section>

        <section class="block">
          <h2>Art Style</h2>
          <div class="chips">
            <button
              v-for="s in presetStyles"
              :key="s"
              type="button"
              class="chip"
              :class="{ active: meta.artStyles?.includes(s) }"
              @click="toggleArtStyle(s)"
            >
              {{ s }}
            </button>
          </div>
          <input
            v-model="meta.artStyleCustom"
            type="text"
            placeholder="Or type custom style"
            class="mt-sm"
          />
          <label class="mt">Medium</label>
          <input
            v-model="meta.medium"
            type="text"
            placeholder="e.g. matte painting, 3D render, charcoal"
          />
        </section>

        <section class="block">
          <h2>Color Palette</h2>
          <div class="chips">
            <button
              v-for="p in presetColorPalettes"
              :key="p"
              type="button"
              class="chip"
              :class="{ active: meta.colorPalettes?.includes(p) }"
              @click="toggleColorPalette(p)"
            >
              {{ p }}
            </button>
          </div>
          <input
            v-model="meta.colorPaletteCustom"
            type="text"
            placeholder="Or type custom palette"
            class="mt-sm"
          />
        </section>

        <section class="block">
          <h2>Composition</h2>
          <div class="chips">
            <button
              v-for="c in presetCompositions"
              :key="c"
              type="button"
              class="chip"
              :class="{ active: meta.compositions?.includes(c) }"
              @click="toggleComposition(c)"
            >
              {{ c }}
            </button>
          </div>
          <input
            v-model="meta.compositionCustom"
            type="text"
            placeholder="Or custom composition"
            class="mt-sm"
          />
          <label class="mt">Framing</label>
          <input
            v-model="meta.framing"
            type="text"
            placeholder="e.g. full body, extreme close-up"
          />
        </section>

        <section class="block">
          <h2>Lighting & mood</h2>
          <label>Lighting</label>
          <div class="chips">
            <button
              v-for="l in presetLighting"
              :key="l"
              type="button"
              class="chip"
              :class="{ active: meta.lightings?.includes(l) }"
              @click="toggleLighting(l)"
            >
              {{ l }}
            </button>
          </div>
          <input
            v-model="meta.lightingCustom"
            type="text"
            placeholder="Or custom"
            class="mt-sm"
          />
          <label class="mt">Mood</label>
          <div class="chips">
            <button
              v-for="m in presetMoods"
              :key="m"
              type="button"
              class="chip"
              :class="{ active: meta.moods?.includes(m) }"
              @click="toggleMood(m)"
            >
              {{ m }}
            </button>
          </div>
          <input
            v-model="meta.moodCustom"
            type="text"
            placeholder="Or custom mood"
            class="mt-sm"
          />
        </section>

        <section class="block">
          <h2>Context / setting</h2>
          <textarea
            v-model="meta.context"
            rows="2"
            placeholder="Environment, era, or narrative context..."
          />
        </section>

        <section class="block">
          <h2>Typography</h2>
          <input
            v-model="meta.typography"
            type="text"
            placeholder="e.g. bold sans-serif, hand-lettered, no text"
          />
        </section>

        <section class="block">
          <h2>Quality modifiers</h2>
          <div class="chips">
            <button
              v-for="q in qualityTags"
              :key="q"
              type="button"
              class="chip quality"
              :class="{ active: meta.qualityModifiers?.includes(q) }"
              @click="toggleQualityTag(q)"
            >
              {{ q }}
            </button>
          </div>
        </section>

        <section class="block">
          <h2>Negative prompt</h2>
          <input
            v-model="meta.negativePrompt"
            type="text"
            placeholder="What to avoid (for tools that support it)"
          />
        </section>

        <div class="actions">
          <button type="button" class="btn secondary" @click="reset">Reset all</button>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  padding: 0 1rem 2rem;
}

.header {
  text-align: center;
  padding: 2rem 0 0;
}

.header h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.tagline {
  margin: 0.35rem 0 0;
  font-size: 0.95rem;
  color: var(--muted);
}

.prompt-at-top {
  max-width: 1280px;
  margin: 1.75rem auto 0;
  padding: 1.25rem 0 1.5rem;
  text-align: left;
  border-top: 1px solid var(--border);
}

.prompt-text {
  margin: 0 0 0.75rem;
  font-size: 1.2rem;
  line-height: 1.6;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
}

.prompt-placeholder {
  margin: 0 0 0.75rem;
  font-size: 1.2rem;
  color: var(--muted);
  font-style: italic;
}

.prompt-actions {
  margin-bottom: 0.5rem;
}

.negative-at-top {
  display: block;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
  font-size: 0.9rem;
}

.negative-label {
  font-weight: 600;
  color: var(--muted);
  margin-right: 0.35rem;
}

.negative-text {
  color: var(--text);
}

.layout {
  max-width: 1280px;
  margin: 0 auto;
  padding-top: 0.5rem;
}

.form-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 700px) {
  .form-panel {
    grid-template-columns: 1fr;
  }
}

.block {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem;
}

.block-template {
  grid-column: 1 / -1;
}

.block-hint {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.4;
}

.template-textarea {
  min-height: 140px;
  font-size: 0.9rem;
  line-height: 1.5;
}

.placeholder-hint {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: var(--muted);
}

.placeholder-hint code {
  background: var(--input);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.btn-sm {
  margin-top: 0.75rem;
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
}

.status-error {
  margin: 0.35rem 0 0;
  color: #d14343;
  font-size: 0.85rem;
}

.status-note {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.block h2 {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.block label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 0.35rem;
}

.block label.mt {
  margin-top: 0.75rem;
}

.mt-sm {
  margin-top: 0.5rem;
}

.block input,
.block textarea,
.block select {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  font-size: 0.9rem;
  background: var(--input);
  color: var(--text);
}

.input-select {
  appearance: none;
}

.developer-settings summary {
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 0.75rem;
}

.developer-settings[open] summary {
  margin-bottom: 1rem;
}

.developer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.warning-text {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.block input:focus,
.block textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-alpha);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.35rem 0.65rem;
  font-size: 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--input);
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.chip:hover {
  border-color: var(--accent);
}

.chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
}

.chip.quality.active {
  background: var(--quality);
  border-color: var(--quality);
  color: var(--quality-fg);
}

.actions {
  padding: 0.5rem 0;
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s, transform 0.1s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--accent);
  color: var(--accent-fg);
}

.btn.primary:not(:disabled):hover {
  opacity: 0.9;
}

.btn.secondary {
  background: var(--input);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn.secondary:hover {
  background: var(--border);
}

</style>
