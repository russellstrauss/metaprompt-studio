<script setup>
import { useMetaprompt } from './composables/useMetaprompt'
import { computed, ref } from 'vue'

const {
	meta,
	baseSummary,
	finalOutput,
	optimizedPrompt,
	optimizedPromptOptions,
	characterLimit,
	optimizePrompt,
	isOptimizing,
	optimizeError,
	lastOptimizedAt,
	presetStyles,
	presetColorPalettes,
	presetCompositions,
	presetAspectRatios,
	presetLighting,
	presetMoods,
	qualityTags,
	presetSubjectTypes,
	presetCameraSettings,
	presetTimeOfDay,
	presetWeather,
	presetMaterials,
	presetAbstractionLevels,
	presetRenderMediums,
	presetBrandTones,
	presetAudiences,
	presetNegativeModifiers,
	toggleArtStyle,
	toggleSubjectType,
	toggleColorPalette,
	toggleComposition,
	toggleAspectRatio,
	toggleCameraSetting,
	toggleLighting,
	toggleMood,
	toggleQualityTag,
	toggleTimeOfDay,
	toggleWeather,
	toggleMaterial,
	toggleRenderMedium,
	toggleBrandTone,
	toggleAudience,
	toggleNegativeModifier,
	setAbstractionLevel,
	clearSelections,
	reset,
} = useMetaprompt()

const copied = ref(false)

const negativeFull = computed(() => {
	const tags = meta.value.negativeModifiers || []
	const custom = meta.value.negativePrompt || ''
	return [...tags, custom].filter(Boolean).join(', ')
})

function copyToClipboard() {
	navigator.clipboard.writeText(finalOutput.value).then(() => {
		copied.value = true
		setTimeout(() => (copied.value = false), 2000)
	})
}

function addCustomNegative() {
	const value = (meta.value.negativePrompt || '').trim()
	if (!value) return
	const existing = meta.value.negativeModifiers || []
	if (!existing.includes(value)) {
		meta.value.negativeModifiers = [...existing, value]
	}
	meta.value.negativePrompt = ''
}

function addCustomArtStyle() {
	const value = (meta.value.artStyleCustom || '').trim()
	if (!value) return
	const existing = meta.value.artStyles || []
	if (!existing.includes(value)) {
		meta.value.artStyles = [...existing, value]
	}
	meta.value.artStyleCustom = ''
}

function addCustomColorPalette() {
	const value = (meta.value.colorPaletteCustom || '').trim()
	if (!value) return
	const existing = meta.value.colorPalettes || []
	if (!existing.includes(value)) {
		meta.value.colorPalettes = [...existing, value]
	}
	meta.value.colorPaletteCustom = ''
}

function addCustomComposition() {
	const value = (meta.value.compositionCustom || '').trim()
	if (!value) return
	const existing = meta.value.compositions || []
	if (!existing.includes(value)) {
		meta.value.compositions = [...existing, value]
	}
	meta.value.compositionCustom = ''
}

function addCustomLighting() {
	const value = (meta.value.lightingCustom || '').trim()
	if (!value) return
	const existing = meta.value.lightings || []
	if (!existing.includes(value)) {
		meta.value.lightings = [...existing, value]
	}
	meta.value.lightingCustom = ''
}

function addCustomMood() {
	const value = (meta.value.moodCustom || '').trim()
	if (!value) return
	const existing = meta.value.moods || []
	if (!existing.includes(value)) {
		meta.value.moods = [...existing, value]
	}
	meta.value.moodCustom = ''
}

function useCustomAbstraction() {
	const value = (meta.value.abstractionLevelCustom || '').trim()
	if (!value) return
	meta.value.abstractionLevel = value
	meta.value.abstractionLevelCustom = ''
}
</script>

<template>
	<div class="app">
		<header class="header">
			<h1>Metaprompt Studio</h1>
			<p class="tagline">Structuring attributes for high-quality image prompts</p>
			<div class="prompt-at-top">
				<div v-if="meta.negativePrompt" class="negative-at-top">
					<span class="negative-label">Avoid:</span>
					<span class="negative-text">{{ negativeFull }}</span>
				</div>
				<div v-if="baseSummary" class="facet-input-section">
					<span class="facet-label">Structured Prompt Inputs:</span>
					<p class="facet-text">{{ baseSummary }}</p>
				</div>
				<div v-if="(optimizedPromptOptions || []).length" class="final-output-section">
					<span class="facet-label">Final prompts:</span>
					<div v-for="(option, index) in (optimizedPromptOptions || [])" :key="index" class="prompt-option">
						<p class="prompt-option-label">Prompt option {{ index + 1 }}</p>
						<p class="prompt-text">{{ option }}</p>
					</div>
				</div>
				<p v-else-if="finalOutput" class="prompt-text">{{ finalOutput }}</p>
				<p v-else class="prompt-placeholder">Set a template above and fill in attributes below to see your prompt
					here.</p>
				<div class="prompt-actions">
					<button type="button" class="btn secondary" :disabled="isOptimizing" @click="optimizePrompt">
						{{ isOptimizing ? 'Generating...' : 'Generate prompt' }}
					</button>
					<button type="button" class="btn secondary clear-selections-btn" @click="clearSelections">
						Clear All
					</button>
				</div>
				<div v-if="isOptimizing" class="loading-inline" aria-live="polite">
					<div class="progress-ring" aria-hidden="true" />
				</div>
				<p v-if="optimizeError" class="status-error">{{ optimizeError }}</p>
				<p v-else-if="optimizedPrompt && lastOptimizedAt" class="status-note">Optimized just now.</p>
			</div>
		</header>

		<div class="layout">
			<aside class="form-panel">
				<section class="block block-description">
					<h2>Description</h2>
					<textarea v-model="meta.description" rows="2"
						placeholder="Detailed description of the scene or subject..." />
				</section>

				<section class="block">
					<h2>Branding</h2>
					<label>Brand tone</label>
					<div class="chips">
						<button v-for="tone in presetBrandTones" :key="tone" type="button" class="chip"
							:class="{ active: meta.brandTones?.includes(tone) }" @click="toggleBrandTone(tone)">
							{{ tone }}
						</button>
					</div>
					<label class="mt">Audience</label>
					<div class="chips">
						<button v-for="aud in presetAudiences" :key="aud" type="button" class="chip"
							:class="{ active: meta.audiences?.includes(aud) }" @click="toggleAudience(aud)">
							{{ aud }}
						</button>
					</div>
				</section>

				<section class="block block-brand-reqs">
					<h2>Brand requirements</h2>
					<textarea v-model="meta.brandRequirements" rows="2"
						placeholder="Specific brand requirements, guardrails, or must-include elements..." />
				</section>

				<section class="block">
					<h2>Avoid</h2>
					<div class="chips">
						<button
							v-for="n in [...new Set([...(presetNegativeModifiers || []), ...(meta.negativeModifiers || [])])]"
							:key="n" type="button" class="chip" :class="{ active: meta.negativeModifiers?.includes(n) }"
							@click="toggleNegativeModifier(n)">
							{{ n }}
						</button>
					</div>
					<div class="custom-input-row">
						<input v-model="meta.negativePrompt" type="text"
							placeholder="Additional negatives or custom phrasing (for tools that support it)" />
						<button type="button" class="btn-add" @click="addCustomNegative" aria-label="Add custom negative">
							+
						</button>
					</div>
				</section>

				<section class="block block-setting">
					<h2>Setting</h2>
					<textarea v-model="meta.context" rows="2" placeholder="Environment, era, or narrative context..." />
				</section>

				<section class="block">
					<h2>Art Style</h2>
					<div class="chips">
						<button v-for="s in [...new Set([...(presetStyles || []), ...(meta.artStyles || [])])]" :key="s"
							type="button" class="chip" :class="{ active: meta.artStyles?.includes(s) }"
							@click="toggleArtStyle(s)">
							{{ s }}
						</button>
					</div>
					<div class="custom-input-row">
						<input v-model="meta.artStyleCustom" type="text" placeholder="Or type custom style" />
						<button type="button" class="btn-add" @click="addCustomArtStyle" aria-label="Add custom art style">
							+
						</button>
					</div>
				</section>

				<section class="block">
					<h2>Medium &amp; rendering</h2>
					<div class="chips">
						<button v-for="m in presetRenderMediums" :key="m" type="button" class="chip"
							:class="{ active: meta.renderMediums?.includes(m) }" @click="toggleRenderMedium(m)">
							{{ m }}
						</button>
					</div>
				</section>

				<section class="block">
					<h2>Abstraction &amp; realism</h2>
					<div class="chips">
						<button v-for="level in presetAbstractionLevels" :key="level" type="button" class="chip"
							:class="{ active: meta.abstractionLevel === level }" @click="setAbstractionLevel(level)">
							{{ level }}
						</button>
					</div>
					<div class="custom-input-row">
						<input v-model="meta.abstractionLevelCustom" type="text"
							placeholder="Or custom description (e.g. data-heavy schematic)" />
						<button type="button" class="btn-add" @click="useCustomAbstraction"
							aria-label="Use custom abstraction">
							+
						</button>
					</div>
				</section>

				<section class="block">
					<h2>Color Palette</h2>
					<div class="chips">
						<button v-for="p in [...new Set([...(presetColorPalettes || []), ...(meta.colorPalettes || [])])]"
							:key="p" type="button" class="chip" :class="{ active: meta.colorPalettes?.includes(p) }"
							@click="toggleColorPalette(p)">
							{{ p }}
						</button>
					</div>
					<div class="custom-input-row">
						<input v-model="meta.colorPaletteCustom" type="text" placeholder="Or type custom palette" />
						<button type="button" class="btn-add" @click="addCustomColorPalette"
							aria-label="Add custom color palette">
							+
						</button>
					</div>
				</section>

				<section class="block">
					<h2>Composition</h2>
					<div class="chips">
						<button v-for="c in [...new Set([...(presetCompositions || []), ...(meta.compositions || [])])]"
							:key="c" type="button" class="chip" :class="{ active: meta.compositions?.includes(c) }"
							@click="toggleComposition(c)">
							{{ c }}
						</button>
					</div>
					<div class="custom-input-row">
						<input v-model="meta.compositionCustom" type="text" placeholder="Or custom composition" />
						<button type="button" class="btn-add" @click="addCustomComposition"
							aria-label="Add custom composition">
							+
						</button>
					</div>
				</section>

				<section class="block">
					<h2>Lighting & mood</h2>
					<label>Time &amp; weather</label>
					<div class="chips">
						<button v-for="t in presetTimeOfDay" :key="t" type="button" class="chip"
							:class="{ active: meta.timeOfDay?.includes(t) }" @click="toggleTimeOfDay(t)">
							{{ t }}
						</button>
					</div>
					<div class="chips mt-sm">
						<button v-for="w in presetWeather" :key="w" type="button" class="chip"
							:class="{ active: meta.weather?.includes(w) }" @click="toggleWeather(w)">
							{{ w }}
						</button>
					</div>
					<label class="mt">Lighting</label>
					<div class="chips">
						<button v-for="l in [...new Set([...(presetLighting || []), ...(meta.lightings || [])])]" :key="l"
							type="button" class="chip" :class="{ active: meta.lightings?.includes(l) }"
							@click="toggleLighting(l)">
							{{ l }}
						</button>
					</div>
					<div class="custom-input-row">
						<input v-model="meta.lightingCustom" type="text" placeholder="Or custom" />
						<button type="button" class="btn-add" @click="addCustomLighting" aria-label="Add custom lighting">
							+
						</button>
					</div>
					<label class="mt">Mood</label>
					<div class="chips">
						<button v-for="mood in [...new Set([...(presetMoods || []), ...(meta.moods || [])])]" :key="mood"
							type="button" class="chip" :class="{ active: meta.moods?.includes(mood) }"
							@click="toggleMood(mood)">
							{{ mood }}
						</button>
					</div>
					<div class="custom-input-row">
						<input v-model="meta.moodCustom" type="text" placeholder="Or custom mood" />
						<button type="button" class="btn-add" @click="addCustomMood" aria-label="Add custom mood">
							+
						</button>
					</div>
				</section>

				<section class="block">
					<h2>Texture &amp; materials</h2>
					<div class="chips">
						<button v-for="mat in presetMaterials" :key="mat" type="button" class="chip"
							:class="{ active: meta.materials?.includes(mat) }" @click="toggleMaterial(mat)">
							{{ mat }}
						</button>
					</div>
				</section>

				<section class="block">
					<h2>Quality modifiers</h2>
					<div class="chips">
						<button v-for="q in qualityTags" :key="q" type="button" class="chip quality"
							:class="{ active: meta.qualityModifiers?.includes(q) }" @click="toggleQualityTag(q)">
							{{ q }}
						</button>
					</div>
				</section>

				<section class="block">
					<h2>Character limit</h2>
					<input v-model.number="characterLimit" type="number" min="0" placeholder="400"
						class="input-no-spinner" />
				</section>

				<section class="block">
					<h2>Aspect ratio</h2>
					<div class="chips">
						<button v-for="ratio in presetAspectRatios" :key="ratio" type="button" class="chip"
							:class="{ active: meta.aspectRatios?.includes(ratio) }" @click="toggleAspectRatio(ratio)">
							{{ ratio }}
						</button>
					</div>
				</section>
			</aside>
		</div>
	</div>
</template>

<style scoped>
.app {
	--column-gutter: 1rem;
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

.facet-input-section,
.final-output-section {
	margin-bottom: 0.75rem;
}

.facet-label {
	display: block;
	font-size: 0.8rem;
	font-weight: 600;
	color: var(--muted);
	margin-bottom: 0.25rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.facet-text {
	margin: 0 0 0.75rem;
	font-size: 1rem;
	line-height: 1.5;
	color: var(--muted);
	white-space: pre-wrap;
	word-break: break-word;
}

.prompt-text {
	margin: 0 0 0.75rem;
	font-size: 1.2rem;
	line-height: 1.6;
	color: var(--text);
	white-space: pre-wrap;
	word-break: break-word;
}

.prompt-option {
	margin-bottom: 0.75rem;
}

.prompt-option-label {
	margin: 0 0 0.25rem;
	font-size: 0.85rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--muted);
}

.prompt-placeholder {
	margin: 0 0 0.75rem;
	font-size: 1.2rem;
	color: var(--muted);
	font-style: italic;
}

.prompt-actions {
	display: flex;
	align-items: center;
	margin-bottom: 0.5rem;
}

.prompt-actions .btn:first-child {
	margin-right: var(--column-gutter);
}

.clear-selections-btn {
	margin-left: auto;
}

.negative-at-top {
	display: block;
	margin-bottom: 0.75rem;
	padding-bottom: 0.75rem;
	border-bottom: 1px solid var(--border);
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
	gap: var(--column-gutter);
	grid-auto-flow: row dense;
}

@media (min-width: 701px) {
	.block-description,
	.block-brand-reqs,
	.block-setting {
		grid-column: 2;
	}
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

.custom-input-row {
	display: inline-flex;
	align-items: center;
	gap: 0.4rem;
	margin-top: 0.75rem;
}

.custom-input-row input {
	width: auto;
	min-width: 0;
	flex: 1 1 auto;
	display: inline-block;
}

.btn-add {
	padding: 0.45rem 0.7rem;
	border-radius: 999px;
	border: 1px solid var(--border);
	background: var(--input);
	color: var(--text);
	cursor: pointer;
	font-size: 0.85rem;
	line-height: 1;
}

.btn-add:hover {
	border-color: var(--accent);
	background: var(--border);
}

.input-select {
	appearance: none;
}

.input-no-spinner::-webkit-outer-spin-button,
.input-no-spinner::-webkit-inner-spin-button {
	-webkit-appearance: none;
	margin: 0;
}

.input-no-spinner {
	-moz-appearance: textfield;
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

.loading-inline {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	margin-bottom: 0.5rem;
	font-size: 0.85rem;
	color: var(--muted);
}

.progress-ring {
	width: 18px;
	height: 18px;
	border-radius: 999px;
	border: 2px solid var(--border);
	border-top-color: var(--accent);
	animation: progress-ring-spin 0.6s linear infinite;
}

@keyframes progress-ring-spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
