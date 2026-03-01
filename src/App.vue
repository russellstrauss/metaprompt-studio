<script setup>
import { useMetaprompt } from './composables/useMetaprompt'
import { ref } from 'vue'

const {
	meta,
	baseSummary,
	finalOutput,
	optimizedPrompt,
	optimizedPromptOptions,
	finalPromptOptions,
	characterLimit,
	optimizePrompt,
	isOptimizing,
	optimizeError,
	lastOptimizedAt,
	descriptionSuggestions,
	isSuggestingDescription,
	descriptionSuggestionError,
	suggestDescription,
	applyDescriptionSuggestion,
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
	setAbstractionLevel,
	clearSelections,
	reset,
	logoHolePlacements,
	setLogoHolePlacement,
} = useMetaprompt()

const copied = ref(false)

function copyToClipboard() {
	navigator.clipboard.writeText(finalOutput.value).then(() => {
		copied.value = true
		setTimeout(() => (copied.value = false), 2000)
	})
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

</script>

<template>
	<div class="app">
		<header class="header">
			<h1>Metaprompt Studio</h1>
			<p class="tagline">Structuring attributes for high-quality image prompts</p>
			<div class="prompt-at-top">
				<div v-if="baseSummary" class="facet-input-section">
					<span class="facet-label">Structured Prompt Inputs:</span>
					<p class="facet-text">{{ baseSummary }}</p>
				</div>
				<div v-if="(finalPromptOptions || []).length" class="final-output-section">
					<div v-for="(option, index) in (finalPromptOptions || [])" :key="index" class="prompt-option">
						<p class="prompt-option-label">Prompt option {{ index + 1 }}</p>
						<p class="prompt-text">{{ option }}</p>
					</div>
				</div>
				<p v-else-if="optimizedPrompt" class="prompt-text">{{ finalOutput }}</p>
				<p v-else class="prompt-placeholder">Choose input attributes and add any custom descriptions or requirements.</p>
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
				<div class="descriptive-section">
					<p class="attribute-section-label">Descriptive</p>
					<section class="block block-description">
						<h2>Description</h2>
						<textarea v-model="meta.description" rows="2"
							placeholder="Detailed description of the scene or subject..." />
						<div class="description-suggestions">
							<label class="suggestion-label">Suggestions</label>
							<p v-if="descriptionSuggestionError" class="status-error suggestion-error">
								{{ descriptionSuggestionError }}
							</p>
							<div v-if="descriptionSuggestions.length" class="suggestion-row">
								<span class="suggestion-text">{{ descriptionSuggestions.join(', ') }}</span>
							</div>
						</div>
					</section>
					<section class="block block-setting">
						<h2>Setting</h2>
						<textarea v-model="meta.context" rows="2" placeholder="Environment, era, or narrative context..." />
					</section>
				</div>

				<hr class="attribute-section-divider" />

				<div class="marketing-section">
					<p class="attribute-section-label">Marketing</p>
					<section class="block">
						<h2>Audience</h2>
						<div class="chips">
							<button v-for="aud in presetAudiences" :key="aud" type="button" class="chip"
								:class="{ active: meta.audiences?.includes(aud) }" @click="toggleAudience(aud)">
								{{ aud }}
							</button>
						</div>
					</section>
					<section class="block block-brand-reqs">
						<h2>Brand requirements</h2>
						<textarea v-model="meta.brandRequirements" rows="6"
							placeholder="Specific brand requirements, guardrails, or must-include elements..." />
					</section>
					<section class="block">
						<h2>Brand tone</h2>
						<div class="chips">
							<button v-for="tone in presetBrandTones" :key="tone" type="button" class="chip"
								:class="{ active: meta.brandTones?.includes(tone) }" @click="toggleBrandTone(tone)">
								{{ tone }}
							</button>
						</div>
					</section>
					<section class="block block-logo-hole">
						<h2>Logo placement</h2>
						<div class="logo-grid" role="group" aria-label="Logo placement" aria-multiselectable="true">
							<button
								v-for="placement in logoHolePlacements"
								:key="placement"
								type="button"
								class="logo-grid-cell"
								:class="{ active: (meta.logoHolePlacement || []).includes(placement) }"
								:title="placement"
								:aria-pressed="(meta.logoHolePlacement || []).includes(placement)"
								@click="setLogoHolePlacement(placement)"
							>
								<span v-if="(meta.logoHolePlacement || []).includes(placement)" class="logo-grid-dot" aria-hidden="true" />
							</button>
						</div>
					</section>
				</div>

				<hr class="attribute-section-divider" />

				<p class="attribute-section-label">Appearance</p>

				<section class="block">
					<h2>Art Style</h2>
					<div class="chips">
						<button v-for="s in [...new Set([...(presetStyles || []), ...(meta.artStyles || [])])]" :key="s"
							type="button" class="chip" :class="{ active: meta.artStyles?.includes(s) }"
							@click="toggleArtStyle(s)">
							{{ s }}
						</button>
					</div>
					<hr class="custom-input-divider" />
					<div class="custom-input-row">
						<input v-model="meta.artStyleCustom" type="text" placeholder="Or type custom style"
							@keydown.enter="addCustomArtStyle" />
						<button type="button" class="btn-add" @click="addCustomArtStyle" aria-label="Add custom art style">
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
					<hr class="custom-input-divider" />
					<div class="custom-input-row">
						<input v-model="meta.colorPaletteCustom" type="text" placeholder="Or type custom palette"
							@keydown.enter="addCustomColorPalette" />
						<button type="button" class="btn-add" @click="addCustomColorPalette"
							aria-label="Add custom color palette">
							+
						</button>
					</div>
				</section>

				<section class="block">
					<h2>Mood</h2>
					<div class="chips">
						<button v-for="mood in [...new Set([...(presetMoods || []), ...(meta.moods || [])])]" :key="mood"
							type="button" class="chip" :class="{ active: meta.moods?.includes(mood) }"
							@click="toggleMood(mood)">
							{{ mood }}
						</button>
					</div>
					<hr class="custom-input-divider" />
					<div class="custom-input-row">
						<input v-model="meta.moodCustom" type="text" placeholder="Or custom mood"
							@keydown.enter="addCustomMood" />
						<button type="button" class="btn-add" @click="addCustomMood" aria-label="Add custom mood">
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
					<hr class="custom-input-divider" />
					<div class="custom-input-row">
						<input v-model="meta.compositionCustom" type="text" placeholder="Or custom composition"
							@keydown.enter="addCustomComposition" />
						<button type="button" class="btn-add" @click="addCustomComposition"
							aria-label="Add custom composition">
							+
						</button>
					</div>
				</section>

				<section class="block">
					<h2>Lighting</h2>
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
					<hr class="custom-input-divider" />
					<div class="custom-input-row">
						<input v-model="meta.lightingCustom" type="text" placeholder="Or custom"
							@keydown.enter="addCustomLighting" />
						<button type="button" class="btn-add" @click="addCustomLighting" aria-label="Add custom lighting">
							+
						</button>
					</div>
				</section>

				<section class="block">
					<h3 class="subheading">Abstraction &amp; realism</h3>
					<div class="chips">
						<button v-for="level in presetAbstractionLevels" :key="level" type="button" class="chip"
							:class="{ active: meta.abstractionLevel === level }" @click="setAbstractionLevel(level)">
							{{ level }}
						</button>
					</div>
					<h3 class="subheading">Medium &amp; rendering</h3>
					<div class="chips">
						<button v-for="m in presetRenderMediums" :key="m" type="button" class="chip"
							:class="{ active: meta.renderMediums?.includes(m) }" @click="toggleRenderMedium(m)">
							{{ m }}
						</button>
					</div>
					<h3 class="subheading">Texture &amp; materials</h3>
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

				<hr class="attribute-section-divider" />

				<div class="structure-section">
					<p class="attribute-section-label">Structure</p>
					<section class="block">
						<h2>Aspect ratio</h2>
						<div class="chips">
							<button v-for="ratio in presetAspectRatios" :key="ratio" type="button" class="chip"
								:class="{ active: meta.aspectRatios?.includes(ratio) }" @click="toggleAspectRatio(ratio)">
								{{ ratio }}
							</button>
						</div>
					</section>
					<section class="block">
						<h2>Prompt Character Limit</h2>
						<input v-model.number="characterLimit" type="number" min="0" placeholder="400"
							class="input-no-spinner" />
					</section>
				</div>
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

.descriptive-section {
	grid-column: 1 / -1;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--column-gutter);
}

.descriptive-section .attribute-section-label {
	grid-column: 1 / -1;
}

@media (min-width: 701px) {
	.descriptive-section .block-description {
		grid-column: 1;
	}
	.descriptive-section .block-setting {
		grid-column: 2;
	}
}

.attribute-section-label {
	grid-column: 1 / -1;
	margin: 1.5rem 0 0.35rem;
	font-size: 0.75rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.12em;
	color: var(--muted);
}

.attribute-section-label:first-child {
	margin-top: 0;
}

.attribute-section-divider + .attribute-section-label {
	margin-top: 0.5rem;
}

.attribute-section-divider {
	grid-column: 1 / -1;
	margin: 0.5rem 0;
	border: 0;
	border-top: 1px solid var(--border);
}

.marketing-section {
	grid-column: 1 / -1;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--column-gutter);
	grid-auto-flow: row dense;
}

.marketing-section .attribute-section-label {
	grid-column: 1 / -1;
	grid-row: 1;
}

@media (min-width: 701px) {
	.marketing-section .block:first-of-type {
		grid-column: 1;
		grid-row: 2;
	}
	.marketing-section .block-brand-reqs {
		grid-column: 1;
		grid-row: 3;
	}
	.marketing-section .block:nth-of-type(3) {
		grid-column: 2;
		grid-row: 2;
	}
	.marketing-section .block-logo-hole {
		grid-column: 2;
		grid-row: 3;
	}
}

.structure-section {
	grid-column: 1 / -1;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--column-gutter);
	grid-auto-flow: row dense;
}

.structure-section .attribute-section-label {
	grid-column: 1 / -1;
}

@media (max-width: 700px) {
	.form-panel {
		grid-template-columns: 1fr;
	}
	.marketing-section,
	.structure-section {
		grid-template-columns: 1fr;
	}
}

.block {
	display: flex;
	flex-direction: column;
	background: var(--card);
	border: 1px solid var(--border);
	border-radius: 12px;
	padding: 1.25rem;
}

.block-template {
	grid-column: 1 / -1;
}

.logo-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	grid-template-rows: repeat(3, 1fr);
	gap: 4px;
	max-width: 140px;
	aspect-ratio: 1;
	margin-top: 0.5rem;
}

.logo-grid-cell {
	aspect-ratio: 1;
	min-width: 0;
	min-height: 0;
	border: 1px solid var(--border);
	border-radius: 6px;
	background: var(--input);
	color: var(--text);
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: border-color 0.15s, background 0.15s;
}

.logo-grid-cell:hover {
	border-color: var(--accent);
}

.logo-grid-cell.active {
	background: var(--accent-alpha);
	border-color: var(--accent);
}

.logo-grid-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--accent);
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

.description-suggestions {
	margin-top: 0.75rem;
	padding-top: 0.75rem;
	border-top: 1px solid var(--border);
}

.suggestion-label {
	display: block;
	font-size: 0.8rem;
	font-weight: 500;
	color: var(--muted);
	margin-bottom: 0.35rem;
}

.suggestion-error {
	margin-top: 0.35rem;
}

.suggestion-row {
	margin-top: 0.5rem;
}

.suggestion-text {
	font-size: 0.9rem;
	color: var(--text);
	line-height: 1.4;
}

.btn-sm {
	margin-top: 0;
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

.block h3.subheading {
	margin: 1rem 0 0.5rem;
	font-size: 0.8rem;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--muted);
	opacity: 0.9;
}

.block h3.subheading:first-of-type {
	margin-top: 0;
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

.custom-input-divider {
	margin-top: auto;
	margin-bottom: 0;
	padding-top: 0.75rem;
	border: 0;
	border-top: 1px solid var(--border);
}

.custom-input-row {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 0.35rem;
	margin-top: 0.4rem;
}

.custom-input-row input {
	max-width: 180px;
	padding: 0.35rem 0.5rem;
	font-size: 0.8rem;
}

.btn-add {
	padding: 0.3rem 0.55rem;
	border-radius: 999px;
	border: 1px solid var(--border);
	background: var(--input);
	color: var(--text);
	cursor: pointer;
	font-size: 0.8rem;
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
