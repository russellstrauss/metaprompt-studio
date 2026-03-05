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
	presetContexts,
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
	toggleContextPreset,
	setAbstractionLevel,
	clearSelections,
	reset,
	logoHolePlacements,
	setLogoHolePlacement,
} = useMetaprompt()

const copied = ref(false)

// Design template variant config (Illustrator): build JSON for apply-template-variants.jsx
// Interchangeable data: school_title, school_subtitle, school_logo, school_mascot, bg_image, year_overlay_image, primary_color, secondary_color
const variantConfig = ref({
	outputFileName: '',
	images: { school_logo: '', school_mascot: '', bg_image: '', year_overlay_image: '' },
	text: { school_title: '', school_subtitle: '' },
	colors: { primary_color: '', secondary_color: '' },
})
function buildOneVariant() {
	const c = variantConfig.value
	const colors = Object.fromEntries(
		Object.entries(c.colors).filter(([, v]) => (v || '').trim())
	)
	return {
		outputFileName: (c.outputFileName || '').trim() || 'Fall Football - variant',
		images: Object.fromEntries(
			Object.entries(c.images).filter(([, v]) => (v || '').trim())
		),
		text: Object.fromEntries(
			Object.entries(c.text).filter(([, v]) => (v || '').trim())
		),
		...(Object.keys(colors).length && { colors }),
	}
}

function downloadVariantJson() {
	const payload = buildOneVariant()
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = (payload.outputFileName || 'variant').replace(/\s+/g, '-') + '.json'
	a.click()
	URL.revokeObjectURL(url)
}

/** Export one content JSON with a variants array (one template → many outputs). */
function downloadContentJson() {
	const variant = buildOneVariant()
	const payload = { variants: [variant] }
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = 'fall-football-content.json'
	a.click()
	URL.revokeObjectURL(url)
}

// Adobe Firefly image generation UI state
const imagePrompt1 = ref('')
const imagePrompt2 = ref('')
const imagePrompt3 = ref('')
const generatedImages = ref(['', '', ''])
const isGeneratingImages = ref(false)
const imageError = ref('')

async function generateImagesFromFirefly() {
	imageError.value = ''

	const prompts = [imagePrompt1.value, imagePrompt2.value, imagePrompt3.value].map((p) => (p || '').trim())

	if (prompts.some((p) => !p)) {
		imageError.value = 'Please fill in all three prompts before generating images.'
		return
	}

	isGeneratingImages.value = true
	try {
		const response = await fetch('/api/generate-images', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ prompts }),
		})

		if (!response.ok) {
			const errBody = await response.json().catch(() => ({}))
			const msg = errBody.details ? `${errBody.error || 'Failed to generate images.'} ${errBody.details}` : (errBody.error || 'Failed to generate images.')
			throw new Error(msg)
		}

		const data = await response.json()
		if (!data || !Array.isArray(data.images) || data.images.length !== 3) {
			throw new Error('Unexpected response shape from image generation API.')
		}

		generatedImages.value = data.images
	} catch (err) {
		imageError.value = err?.message || 'An unexpected error occurred while generating images.'
	} finally {
		isGeneratingImages.value = false
	}
}

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

function addCustomMood() {
	const value = (meta.value.moodCustom || '').trim()
	if (!value) return
	const existing = meta.value.moods || []
	if (!existing.includes(value)) {
		meta.value.moods = [...existing, value]
	}
	meta.value.moodCustom = ''
}

function addCustomBrandTone() {
	const value = (meta.value.brandToneCustom || '').trim()
	if (!value) return
	const existing = meta.value.brandTones || []
	if (!existing.includes(value)) {
		meta.value.brandTones = [...existing, value]
	}
	meta.value.brandToneCustom = ''
}

function addCustomAudience() {
	const value = (meta.value.audienceCustom || '').trim()
	if (!value) return
	const existing = meta.value.audiences || []
	if (!existing.includes(value)) {
		meta.value.audiences = [...existing, value]
	}
	meta.value.audienceCustom = ''
}

function addCustomAspectRatio() {
	const value = (meta.value.aspectRatioCustom || '').trim()
	if (!value) return
	const existing = meta.value.aspectRatios || []
	if (!existing.includes(value)) {
		meta.value.aspectRatios = [...existing, value]
	}
	meta.value.aspectRatioCustom = ''
}

function addCustomSubjectType() {
	const value = (meta.value.subjectTypeCustom || '').trim()
	if (!value) return
	const existing = meta.value.subjectTypes || []
	if (!existing.includes(value)) {
		meta.value.subjectTypes = [...existing, value]
	}
	meta.value.subjectTypeCustom = ''
}

function addCustomCameraSetting() {
	const value = (meta.value.cameraSettingCustom || '').trim()
	if (!value) return
	const existing = meta.value.cameraSettings || []
	if (!existing.includes(value)) {
		meta.value.cameraSettings = [...existing, value]
	}
	meta.value.cameraSettingCustom = ''
}

</script>

<template>
	<div class="app">
		<header class="header">
			<h1>Metaprompt Studio</h1>
			<p class="tagline">Structuring attributes for high-quality image prompts</p>

			<svg class="site-logo" viewBox="0 0 876.982 757.463" width="1000" height="862" xmlns="http://www.w3.org/2000/svg"
				role="img" aria-label="Farmer John's Botanicals Logo">
				<defs>
					<pattern id="logo-bg" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" x="0" y="0"
						width="876.982" height="757.463">
						<image
							href="https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80"
							x="0"
							y="0"
							width="876.982"
							height="757.463"
							preserveAspectRatio="xMidYMid slice" />
					</pattern>
				</defs>
				<g>
					<g id="XMLID_1_">
						<g id="logo-shape" fill="url(#logo-bg)">
							<path
								d="M849.471,627.245c-0.62,0.54-1.239,1.08-1.859,1.62c-1.78-0.85-3.841-1.359-5.29-2.6
									c-6.58-5.641-13.11-11.34-19.42-17.28c-7.19-6.77-14.601-9.21-25.17-7.93c-10.021,1.2-20.86-1.84-30.971-4.46
									c-20.56-5.32-24.979-1.801-21.93,19.609c1.25,8.761,3.14,17.431,5.11,28.21c-3.7-1.96-5.721-2.58-7.141-3.87
									c-4.05-3.659-7.71-7.75-11.78-11.39c-12.579-11.24-20.39-11.7-34.399-2.149c-3.19,2.17-6.39,4.359-9.29,6.89
									c-7.51,6.54-15.57,8.25-24.95,4.18c-8.689-3.77-17.21-2.83-26.149,0.57c-11.671,4.45-23.811,7.7-35.86,11.06
									c-7.101,1.99-14.13,3.59-20.87-2.46c-1.55-1.39-7.04,1.04-10.43,2.4c-4.73,1.89-9.15,6.28-13.79,6.399
									c-26.58,0.681-53.21-0.029-79.79,0.711c-8.32,0.229-17.3,2-24.69,5.67c-16.01,7.949-31.95,9.27-48.52,3.54
									c-10.31-3.561-20.13-8.61-30.53-11.79c-12.49-3.83-25.25-6.971-38.11-9.25c-7.12-1.261-8.87-3.641-6.18-10.11
									c11.31-27.3,22.6-54.61,33.71-81.98c3.32-8.18,8.15-9.14,15.95-5.72c17.42,7.62,27.56,19.41,25.81,39.45
									c-0.31,3.54,0.72,7.19,1.13,10.8c1.14,0.15,2.29,0.3,3.43,0.45c0.99-3.92,2.65-7.82,2.85-11.78
									c1.33-26.52-17.06-49.439-46.08-55.95c-11.47-2.569-23.57-3.21-35.37-3.159c-20.83,0.08-41.66,1.279-62.48,2.25
									c-3.34,0.159-6.61,1.58-9.92,2.42c0.09,0.8,0.18,1.609,0.26,2.42c13.14-0.61,26.28-1.351,39.42-1.771
									c7.02-0.229,14.17-0.67,21.06,0.34c11.17,1.641,14.15,6.971,10.16,17.79c-4.89,13.25-10.56,26.221-15.69,39.381
									c-2.28,5.84-4.06,11.88-7.11,20.92c-12.36-11.591-24.21-20.431-33.17-31.591c-15.28-19.02-29.95-24.96-52.98-17.399
									c-7.74,2.54-14.42,1.78-20.78-3.271c-4.03-3.189-8.16-6.27-12.43-9.12c-13.19-8.789-20.84-8.289-32.88,2.2
									c-5.3,4.63-10.33,9.59-15.55,14.33c-0.34,0.3-1.2,0.03-3.18,0.03c0.44-3.67,0.86-7.24,1.31-10.811
									c1.18-9.52,2.98-19.02,3.37-28.579c0.31-7.62-4.54-11.131-12.11-9.381c-7.51,1.73-14.8,4.5-22.36,5.86
									c-6.52,1.17-13.64,2.51-19.86,1.05c-9.47-2.229-16.23,0.811-22.75,6.7c-6.43,5.811-12.9,11.58-19.45,17.271
									c-1.82,1.579-3.96,2.79-5.96,4.17c-0.66-0.431-1.31-0.851-1.97-1.28c1.49-3.54,2.38-7.53,4.58-10.561
									c11.96-16.46,24.97-31.85,43.98-40.84c5.49-2.6,11.39-5.21,15.64-9.33c4.03-3.89,8.75-9.979,8.36-14.71
									c-0.38-4.6-6.67-8.89-10.75-12.92c-1.67-1.649-4.35-2.279-6.59-3.38c4.44-8.29,12.89-12.6,22.82-9.77
									c10.43,2.989,18.5,1.729,26.11-6.32c3.13-3.29,8.2-6.32,12.57-6.58c20.06-1.22,39.52-8.21,60.12-5.1
									c8.95,1.35,18.64,0.42,27.6-1.4c15.16-3.08,21.27-14.59,15.83-29.1c-7.44-19.811-20.89-35.37-37.8-47.62
									c-18.01-13.05-20.15-26.59-7.39-44.8c3.52-5.02,4.49-12.53,4.75-18.98c0.45-11.28-0.46-22.81,7.01-32.24
									c5.63-7.11,11.28-15.08,18.76-19.65c9.61-5.85,16.09-12.35,19.99-23.18c7.47-20.75,19.48-39.01,35.52-54.39
									c1.39-1.33,2.87-2.57,4.4-3.72c0.44-0.33,1.2-0.24,4.11-0.71c-7.16,17.48-14.34,33.39-26.15,46.13
									c-10.41,11.23-13.29,24.21-15.24,38.47c-1.27,9.3-4.16,18.65-8.01,27.23c-4.17,9.3-6.09,17.95-2.28,27.76
									c4.4,11.37,7.68,23.18,12.34,34.43c6.45,15.56,13.03,16.22,23.33,3.14c0.92-1.16,2.28-1.98,6.14-2.5
									c-0.28,4.6,0.66,9.75-1.09,13.7c-5.45,12.34-6.84,22.7,3.16,34.54c7.35,8.71,9.98,21.261,15.67,31.57
									c8.9,16.12,22.86,26.62,39.97,33.11c4.73,1.79,8.92,3.189,12.61-2.48c0.85-1.3,6.9-1.24,8.51,0.311
									c10.09,9.75,19.88,19.859,29.2,30.35c4.88,5.49,8.61,11.99,12.81,18.07c7.16,10.38,17.42,14.93,29.3,12.05
									c16.28-3.96,30.8-3.16,44.35,7.84c4.33,3.52,10.9,4.16,15.61,7.35c7.56,5.12,15.479,10.37,21.35,17.19
									c7.86,9.15,16.53,15.26,28.71,14.979c11.54-0.27,23.12-0.71,34.58-1.97c10.87-1.2,13.8-10.35,16.51-19.08
									c1.811-5.819,3-11.92,11.96-13.96c-0.28,3.76-0.55,6.67-0.7,9.59c-0.47,9.03,5.41,14.5,13.15,10.601
									c15.98-8.04,31.62-16.91,46.61-26.66c4.159-2.7,6.88-9.4,7.939-14.73c2.53-12.659,7.42-23.84,15.99-33.439
									c6.979-7.811,9.07-17.021,9.9-27.39c1.319-16.261,4.359-32.381,6.939-48.521c0.48-2.97,2.21-5.729,3.36-8.58
									c0.819,0.01,1.63,0.021,2.45,0.03c0.72,3.8,2.069,7.609,2.04,11.399c-0.2,20.971-1.95,41.94-10,61.44
									c-6.87,16.63,1.949,29.56,5.069,41.38c11.62,1.95,20.87,2.65,29.57,5.2c9.229,2.72,14.79,0.189,18.6-8.24
									c3.83-8.479,7.141-17.35,12.141-25.109c7.06-10.961,15.59-20.95,23.199-31.57c3.421-4.76,6.141-10.01,9.181-15.04
									c0.87,0.2,1.74,0.399,2.6,0.59c-0.47,3.31-0.07,7.1-1.57,9.86c-5.05,9.27-11.159,17.979-16.09,27.31
									c-3.04,5.75-6.54,12.24-6.55,18.4c-0.01,13-3.32,24.6-9.17,35.939c-6.28,12.19-5.1,15.61,6.28,22.721
									c2.3,1.43,4.33,3.3,8.08,6.21c-4.41,2.13-7.101,3.46-9.82,4.739c-12.72,5.94-14.18,18.03-2.92,26.46
									c4.61,3.44,9.62,6.561,14.85,8.9c18.86,8.46,32.2,23.1,44.351,39.04C845.241,618.195,847.101,622.915,849.471,627.245z">
							</path>
							<path d="M194.271,311.115c0,0,0.01,0,0.01,0.01c0,0,0,0,0.01,0.01c0.01,0,0.02,0,0.03,0.02c-0.02-0.02-0.03-0.03-0.04-0.04
									C194.271,311.115,194.271,311.115,194.271,311.115z M194.551,311.166c-0.03-0.03-0.06-0.07-0.08-0.09
									c-0.03-0.03-0.05-0.06-0.07-0.08c0.02,0.02,0.04,0.04,0.07,0.08C194.491,311.095,194.511,311.125,194.551,311.166z
									 M194.351,311.175c0.01,0.02,0.03,0.03,0.04,0.03c0.02,0.02,0.04,0.04,0.06,0.05c0.04,0.04,0.09,0.08,0.14,0.12
									c-0.59,1.22-1.2,2.43-1.81,3.64c-2.14,4.24-4.31,8.45-6.2,12.8c-4.99,11.54-2.85,19.4,7.51,26.77
									c12.02,8.55,24.98,15.959,36.14,25.49c7.04,6.01,13.06,14.34,16.75,22.84c5.01,11.521-1.33,19.91-13.9,19.82
									c-6.91-0.05-14.07-1.54-20.64-3.78c-10.98-3.729-20.53-2.31-30.09,4.13c-15.04,10.131-25.63,6.351-32.32-10.47
									c-2.59-6.53-6.28-12.609-9-19.1c-2.21-5.271-4.88-10.73-5.37-16.28c-2.54-28.38-4.71-56.81-6.32-85.26
									c-0.33-5.78,2.22-11.74,3.55-17.6c0.56-2.48,2.19-4.97,2-7.35c-2.01-26.08,12.64-45.64,27.33-63.9
									c34.11-42.42,74.99-77.43,123.4-102.93c22.42-11.82,45.23-22.53,62.27-42.56c5.07-5.97,13.87-8.99,21.29-12.73
									c26.93-13.59,55.03-23.19,85.67-22.42c12.14,0.3,24.25,1.62,36.35,2.75c2.09,0.2,4.76,1.23,5.96,2.8
									c12.21,15.98,32.27,19.11,47.88,29.5c6.92,4.62,14.49,8.27,21.74,12.39c21.89,12.44,33.8,32.7,43.26,54.95
									c3.27,7.66,7.05,15.1,10.6,22.64c0.141,0.87,0.28,1.74,0.431,2.61c0.199-0.05,0.399-0.11,0.6-0.17
									c-0.33-0.82-0.66-1.65-0.99-2.47c-2.779-9.55-5.91-19.01-8.26-28.66c-3.64-14.92,1.87-19.91,17.08-18.48
									c15.23,1.44,30.67,1.98,45.95,1.33c23.649-1,44.41,2.95,65.479,16.5c19.49,12.52,34.37,28.58,49.801,44.6
									c17.829,18.5,22.319,42.85,26.21,67.09c1.43,8.88,1.35,18.1,3.649,26.7c7.67,28.6,3.86,55.79-7.12,82.83
									c-7.63,18.78-13.35,38.16-9.88,59.07c2.18,13.18-5.95,22.109-13.74,31.42c-10.64,12.71-20.819,25.88-30.38,39.43
									c-6.96,9.86-14.31,14.36-23.859,12.09c-15.311-3.64-20.311-12.82-14.19-29.26c11.64-31.25,11.76-62.79,4.18-94.74
									c-0.88-3.73-2.92-7.19-5.199-12.63c-1.92,3.44-3.08,4.67-3.32,6.06c-4.62,26.84-8.94,53.73-13.8,80.52
									c-1.11,6.11-2.73,12.85-6.34,17.62c-9.44,12.51-17.271,25.37-19.78,41.18c-0.61,3.83-2.84,8.42-5.83,10.66
									c-10.25,7.67-20.96,14.83-31.97,21.39c-3.66,2.19-8.75,1.98-14.24,3.08c0.399-3.899,0.89-5.76,0.7-7.54
									c-0.431-4.13-0.03-10.89-2.061-11.779c-4.04-1.771-10.06-1.591-14.21,0.22c-3.59,1.57-7.62,6.21-8.18,9.97
									c-3.21,21.66-18.92,22.71-35.521,22.76c-15.119,0.051-27.42-4.17-37.76-16.97c-6.13-7.6-17.479-11.02-26.58-16.17
									c-1.62-0.92-3.939-0.67-5.49-1.66c-15.899-10.18-33-15.78-52.029-17.16c-5.69-0.42-11.16-6.89-16.3-11.12
									c-17.07-14.01-33.83-28.39-50.97-42.3c-3.66-2.97-8.29-4.91-12.72-6.72c-5.79-2.37-10.12-0.94-11.28,5.96l-0.02,0.03
									c-6.18-4.98-13.55-9.03-18.28-15.13c-12.76-16.45-24.97-33.4-36.04-51c-2.79-4.42-0.98-12.07-0.42-18.16
									c0.55-5.94,3.72-12.01,2.86-17.58c-0.63-4.03-5.4-8.6-9.45-10.39c-1.92-0.85-7.24,3.65-9.66,6.77c-4.57,5.9-8.22,6.77-10.97-0.26
									c-5.57-14.24-9.9-29.03-13.67-43.87c-0.93-3.68,2.36-8.39,3.55-12.67c3.14-11.29,7.58-22.44,8.89-33.95
									c1.36-11.97,4.54-21.93,12.45-31.37c7.74-9.24,13.46-20.24,19.6-30.74c5.83-9.95,11.11-20.23,16.51-30.43
									c1.12-2.11,1.72-4.5,2.56-6.76c-0.56-0.71-1.13-1.42-1.69-2.13c-3.67,1.86-7.6,3.33-10.96,5.64
									c-27.08,18.66-45.26,44.27-57.05,74.59c-2.96,7.6-7.56,12.48-14.54,16.87c-19.3,12.17-34.24,27.41-34.61,52.83
									c-0.01,0.55-0.03,1.1-0.07,1.64c-0.09,1.1-0.23,2.2-0.42,3.29c-1.25,7.12-4.6,14.21-6.63,21.31l-0.06,0.07h-0.01
									c-0.05-0.04-0.08-0.07-0.12-0.11c-0.01-0.01-0.02-0.01-0.02-0.01c-0.02-0.02-0.04-0.04-0.06-0.05
									C194.371,311.195,194.361,311.175,194.351,311.175z M676.111,318.635c1.659-5.13,2.47-8.48,2.43-10.05
									c-0.04-1.56-0.92-2.95-2.63-4.14c-1.72-1.2-4.32-3.05-7.811-5.55c-3.489-2.5-7.93-7.28-13.33-14.33
									c-5.399-7.05-9.6-12.03-12.59-14.92c-3-2.89-5.71-4.4-8.13-4.55c-2.43-0.14-4.979,0.68-7.66,2.46
									c-2.68,1.79-6.27,3.69-10.76,5.71c-4.55,2.18-6.85,2.63-6.88,1.34c-0.04-1.3,0.98-3.89,3.07-7.79c2.08-3.9,4.76-8.93,8.04-15.09
									c3.27-6.17,6.09-13.16,8.439-21c2.19-7.89,3.021-13.43,2.5-16.61c-0.52-3.19-2.02-4.91-4.5-5.16c-2.479-0.26-5.649,0.5-9.51,2.26
									c-3.87,1.77-7.99,3.77-12.37,6.01c-2.85,1.46-6.05,5.96-9.59,13.5s-7.11,16.58-10.7,27.12c-3.6,10.55-7.08,21.99-10.439,34.35
									c-3.36,12.35-6.41,24.04-9.15,35.04s-4.96,20.71-6.68,29.11c-1.721,8.411-2.67,14.041-2.86,16.9c-0.3,4.3,0.49,7.07,2.38,8.32
									c1.88,1.25,4.26,1.52,7.14,0.8c2.881-0.71,5.921-2.149,9.091-4.32c3.17-2.17,5.819-4.569,7.939-7.17
									c2.12-2.609,3.7-3.92,4.71-3.96c1.021-0.04,2.36,0.9,4.03,2.811s4.25,4.67,7.75,8.27c3.5,3.601,8.85,7.851,16.04,12.74
									c4.82,3.2,8.45,5.521,10.92,6.96c2.46,1.44,4.32,2.18,5.59,2.23c1.26,0.04,2.19-0.58,2.79-1.851c0.59-1.26,1.46-2.95,2.601-5.05
									c1.13-2.1,2.789-4.54,4.97-7.31c2.17-2.771,5.42-5.74,9.74-8.91c6.46-4.681,11.079-9.36,13.869-14.03
									c2.79-4.68,4.79-9.43,5.99-14.25c1.19-4.83,2.01-9.73,2.431-14.72C673.401,328.825,674.451,323.766,676.111,318.635z
									 M574.161,211.545c1.79-2.71,2.45-5.01,1.96-6.91c-0.48-1.89-1.78-3.54-3.88-4.96c-2.11-1.41-4.851-2.67-8.24-3.77
									c-3.4-1.09-7.17-2.32-11.3-3.65c-4.141-1.34-7.33-1.23-9.58,0.33c-2.24,1.56-3.53,3.84-3.86,6.84s0.221,6.52,1.66,10.55
									c1.44,4.03,3.79,7.77,7.07,11.21c3.22,3.6,6.09,5.63,8.6,6.07c2.5,0.45,4.76-0.01,6.76-1.38c1.99-1.36,3.841-3.41,5.561-6.15
									C570.621,216.985,572.361,214.255,574.161,211.545z M560.461,259.375c1.38-5.68,1.79-9.34,1.22-10.99
									c-0.899-2.3-2.88-4.82-5.92-7.54c-3.06-2.73-6.609-5.16-10.67-7.3c-4.07-2.14-8.399-3.86-13.01-5.17s-8.8-1.75-12.6-1.33
									c-2.471,0.29-4.891,0.84-7.25,1.63c-2.36,0.79-4.391,1.82-6.08,3.1c-1.7,1.28-2.86,2.78-3.511,4.49
									c-0.649,1.71-0.38,3.58,0.79,5.61c1.4,2.46,3.45,4.59,6.16,6.38c2.72,1.8,5.47,3.74,8.271,5.83c2.79,2.1,5.279,4.59,7.449,7.49
									c2.171,2.9,3.341,6.75,3.53,11.57c0.17,4.81-0.92,10.86-3.27,18.14c-2.36,7.29-6.66,16.33-12.891,27.11
									c-4.399,7.35-7.439,14.33-9.109,20.92c-1.681,6.59-2.71,12.61-3.11,18.06c-0.39,5.45-0.42,10.2-0.08,14.24s0.46,7.19,0.37,9.45
									c-0.09,2.25-0.71,3.47-1.87,3.65c-1.149,0.17-3.39-0.83-6.71-3c-3.49-2.23-6.47-4.881-8.939-7.971
									c-2.48-3.09-4.711-6.1-6.681-9.02c-1.979-2.931-3.74-5.561-5.27-7.88c-1.54-2.33-3.03-3.91-4.5-4.75
									c-1.471-0.85-2.92-0.72-4.37,0.37c-1.45,1.08-3.09,3.61-4.93,7.59c-2.7,6.08-5.06,11.12-7.09,15.13
									c-2.03,4-3.12,7.359-3.26,10.05c-0.14,2.7,1.02,4.9,3.48,6.62c2.47,1.71,6.84,3.31,13.13,4.8c4.24,1,8.52,2.48,12.83,4.43
									c4.31,1.94,8.479,3.881,12.52,5.83c4.03,1.95,7.92,3.48,11.67,4.61c3.76,1.12,7.13,1.3,10.12,0.53
									c2.99-0.771,5.601-2.761,7.83-5.971c2.23-3.21,3.92-8.29,5.07-15.229c1.149-6.95,2.96-15.05,5.41-24.32
									c2.449-9.26,5.159-18.9,8.119-28.92c2.971-10.01,6.021-20,9.16-29.96c3.13-9.96,5.9-19.07,8.311-27.35
									C557.181,272.035,559.071,265.055,560.461,259.375z M487.121,188.025c0.59-8.04-0.07-13.92-1.97-17.64
									c-1.9-3.73-4.66-5.95-8.271-6.66s-7.83-0.25-12.649,1.39c-4.83,1.64-9.851,3.85-15.05,6.65c-5.21,2.8-10.31,5.85-15.32,9.17
									c-5.01,3.32-9.56,6.23-13.67,8.74c-12.37,7.7-20.14,16.3-23.3,25.79c-3.17,9.5-2.95,19.4,0.67,29.71
									c1.8,5.16,2.86,9.94,3.18,14.34c0.31,4.4,0.11,8.95-0.59,13.66c-0.7,4.71-1.85,9.83-3.46,15.35c-1.6,5.51-3.42,11.97-5.44,19.36
									c-2.29,8.77-4.25,14.81-5.87,18.12c-1.63,3.32-3.1,5.18-4.41,5.57c-1.32,0.4-2.66-0.13-4.02-1.57c-1.36-1.45-3.05-2.59-5.06-3.43
									c-2.02-0.83-4.39-0.73-7.1,0.31c-2.72,1.04-6.09,4.11-10.12,9.21c-4.02,5.1-6.54,10.32-7.54,15.67c-1,5.34-0.85,10.1,0.46,14.27
									c1.3,4.17,3.62,7.58,6.98,10.221c3.35,2.64,7.32,3.93,11.92,3.859c4.59-0.07,9.71-1.75,15.35-5.04
									c5.64-3.3,11.37-8.85,17.19-16.66c5.77-7.65,9.89-14.86,12.36-21.65c2.47-6.79,3.93-12.99,4.38-18.61s0.33-10.64-0.34-15.06
									c-0.67-4.43-1.22-8.22-1.66-11.38c-0.45-3.16-0.33-5.63,0.35-7.43c0.67-1.79,2.6-2.82,5.79-3.06c3.19-0.25,5.57,0.15,7.15,1.21
									s2.81,2.33,3.7,3.81c0.9,1.48,1.67,3.05,2.32,4.73c0.64,1.67,1.59,2.98,2.84,3.93c1.24,0.96,2.98,1.38,5.21,1.28
									c2.22-0.1,5.39-1.13,9.5-3.09c6.25-2.92,11.601-6.58,16.05-11c4.44-4.41,7.36-8.49,8.771-12.25c1.39-3.75,0.979-6.72-1.24-8.9
									c-2.22-2.18-6.9-2.42-14.04-0.71c-7.14,1.72-12.88,2.1-17.24,1.14c-4.35-0.95-7.74-2.78-10.16-5.48c-2.41-2.7-4.15-6.1-5.2-10.19
									c-1.06-4.09-1.88-8.33-2.46-12.73c-0.59-4.4-0.43-8.87,0.5-13.42c0.92-4.55,2.64-7.88,5.16-9.99c2.5-2.11,5.83-2.36,9.98-0.75
									c4.14,1.62,9.18,6.23,15.14,13.82c5.9,7.77,10.66,12.55,14.28,14.36c3.62,1.82,6.54,1.12,8.771-2.09
									c2.229-3.21,3.899-8.8,5.02-16.76C485.071,210.186,486.121,200.146,487.121,188.025z"></path>
							<path d="M659.231,318.655c0.369,1.95-0.561,3.98-2.79,6.09c-2.24,2.12-5.15,4.88-8.721,8.29c-3.58,3.42-6.6,8.66-9.069,15.72
									c-2.471,7.07-5.28,11.78-8.42,14.15c-3.15,2.37-6.66,3.05-10.551,2.07c-3.89-0.99-8.069-3.34-12.529-7.07
									c-4.46-3.73-9.131-8.22-14.021-13.46c-4.939-5.07-7.899-9.51-8.86-13.3c-0.97-3.78-0.609-7.33,1.101-10.61
									c1.7-3.29,4.399-6.67,8.09-10.14c3.68-3.48,7.7-7.43,12.07-11.87c4.359-4.44,8.069-7.13,11.109-8.06
									c3.051-0.94,6.11-0.63,9.17,0.91c3.07,1.54,6.49,3.98,10.261,7.3c3.77,3.32,8.479,7,14.13,11.02
									C655.841,313.715,658.851,316.706,659.231,318.655z"></path>
							<path d="M349.941,536.955c2.4,0.41,3.9,6.07,6.52,10.66c-6.22,15.99-11.99,31.92-18.6,47.5c-5.88,13.88-12.63,27.4-19.09,41.04
									c-10.63,22.41-19.64,45.32-23.59,70.04c-1.04,6.561-4.24,12.76-6.28,19.18c-2.17,6.83-6.5,6.73-12.1,4.391
									c-5.24-2.181-7.69-4.87-5.42-11.021c18.97-51.479,37.6-103.08,56.71-154.51c2.88-7.729,7.22-15.08,11.91-21.91
									C341.991,539.415,346.931,536.445,349.941,536.955z"></path>
							<path
								d="M194.661,311.305c0.08,0.1,0.17,0.21,0.28,0.35c-0.14-0.12-0.24-0.2-0.34-0.28L194.661,311.305z">
							</path>
							<path
								d="M194.471,311.075c0.02,0.02,0.05,0.06,0.08,0.09C194.511,311.125,194.491,311.095,194.471,311.075z">
							</path>
							<path d="M194.281,311.115v0.01c0-0.01-0.01-0.01-0.01-0.01S194.271,311.115,194.281,311.115z">
							</path>
						</g>
						<g></g>
					</g>
				</g>
			</svg>


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
				<p v-else class="prompt-placeholder">Choose input attributes and add any custom descriptions or
					requirements.</p>
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

		<section class="block image-generator">
			<h2>Adobe Firefly image preview (3 prompts → 3 images)</h2>
			<p class="placeholder-hint">
				Enter three prompts below and click
				<code>Generate images</code>
				to generate images with Adobe Firefly.
			</p>

			<div class="image-prompts-grid">
				<div class="image-prompt">
					<label for="image-prompt-1">Prompt 1</label>
					<textarea id="image-prompt-1" v-model="imagePrompt1" rows="3" placeholder="e.g. hyper-detailed portrait of a cyberpunk fox"></textarea>
				</div>
				<div class="image-prompt">
					<label for="image-prompt-2">Prompt 2</label>
					<textarea id="image-prompt-2" v-model="imagePrompt2" rows="3" placeholder="e.g. aerial view of a neon city at dusk"></textarea>
				</div>
				<div class="image-prompt">
					<label for="image-prompt-3">Prompt 3</label>
					<textarea id="image-prompt-3" v-model="imagePrompt3" rows="3" placeholder="e.g. whimsical illustration of a robot tending a garden"></textarea>
				</div>
			</div>

			<div class="actions">
				<button class="btn primary" type="button" :disabled="isGeneratingImages" @click="generateImagesFromFirefly">
					<span v-if="isGeneratingImages" class="loading-inline">
						<span class="progress-ring" />
						<span>Generating images…</span>
					</span>
					<span v-else>Generate images</span>
				</button>
			</div>

			<p v-if="imageError" class="status-error">
				{{ imageError }}
			</p>

			<div v-if="generatedImages.some(Boolean)" class="image-results-grid">
				<div v-for="(src, index) in generatedImages" :key="index" class="image-result">
					<p class="image-result-label">Image {{ index + 1 }}</p>
					<img v-if="src" :src="src" alt="Generated image" />
					<p v-else class="status-note">No image for this prompt yet.</p>
				</div>
			</div>
		</section>

		<section class="block design-template-variants">
			<h2>Design template variants (Illustrator)</h2>
			<p class="block-hint">
				One content JSON (with a <code>variants</code> array) plus one .ai template creates many outputs. Build a variant below, export as content JSON, then run
				<code>apply-template-variants.jsx</code>
				in Illustrator with the template open.
			</p>
			<div class="variant-form">
				<label>Output file name</label>
				<input v-model="variantConfig.outputFileName" type="text" placeholder="e.g. Fall Football - Eagles" />
				<fieldset class="variant-fieldset">
					<legend>Images (layer name = path)</legend>
					<div class="variant-row">
						<label>school_logo</label>
						<input v-model="variantConfig.images.school_logo" type="text" placeholder="path/to/logo.png" />
					</div>
					<div class="variant-row">
						<label>school_mascot</label>
						<input v-model="variantConfig.images.school_mascot" type="text" placeholder="path/to/mascot.png" />
					</div>
					<div class="variant-row">
						<label>bg_image</label>
						<input v-model="variantConfig.images.bg_image" type="text" placeholder="path/to/background.jpg" />
					</div>
					<div class="variant-row">
						<label>year_overlay_image</label>
						<input v-model="variantConfig.images.year_overlay_image" type="text" placeholder="path/to/year-overlay.png" />
					</div>
				</fieldset>
				<fieldset class="variant-fieldset">
					<legend>Text (layer name = content)</legend>
					<div class="variant-row">
						<label>school_title</label>
						<input v-model="variantConfig.text.school_title" type="text" placeholder="School or team name" />
					</div>
					<div class="variant-row">
						<label>school_subtitle</label>
						<input v-model="variantConfig.text.school_subtitle" type="text" placeholder="e.g. 2025 Fall Season" />
					</div>
				</fieldset>
				<fieldset class="variant-fieldset">
					<legend>Colors (layer name = hex)</legend>
					<div class="variant-row">
						<label>primary_color</label>
						<input v-model="variantConfig.colors.primary_color" type="text" placeholder="#C41E3A" />
					</div>
					<div class="variant-row">
						<label>secondary_color</label>
						<input v-model="variantConfig.colors.secondary_color" type="text" placeholder="#1a1a1a" />
					</div>
				</fieldset>
			</div>
			<div class="actions">
				<button type="button" class="btn primary" @click="downloadContentJson">
					Export content JSON (variants array)
				</button>
				<button type="button" class="btn secondary" @click="downloadVariantJson">
					Export single variant only
				</button>
			</div>
		</section>

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
						<textarea v-model="meta.context" rows="2"
							placeholder="Environment, era, or narrative context..." />
						<label class="mt">Context presets</label>
						<div class="chips">
							<button v-for="p in presetContexts" :key="p" type="button" class="chip"
								:class="{ active: meta.contextPresets?.includes(p) }" @click="toggleContextPreset(p)">
								{{ p }}
							</button>
						</div>
					</section>
					<section class="block block-subject-type">
						<h2>Subject type</h2>
						<div class="chips">
							<button
								v-for="s in [...new Set([...(presetSubjectTypes || []), ...(meta.subjectTypes || [])])]"
								:key="s" type="button" class="chip" :class="{ active: meta.subjectTypes?.includes(s) }"
								@click="toggleSubjectType(s)">
								{{ s }}
							</button>
						</div>
						<hr class="custom-input-divider" />
						<div class="custom-input-row">
							<input v-model="meta.subjectTypeCustom" type="text" placeholder="Or custom subject type"
								@keydown.enter="addCustomSubjectType" />
							<button type="button" class="btn-add" @click="addCustomSubjectType"
								aria-label="Add custom subject type">+</button>
						</div>
					</section>
				</div>

				<hr class="attribute-section-divider" />

				<div class="marketing-section">
					<p class="attribute-section-label">Marketing</p>
					<section class="block">
						<h2>Audience</h2>
						<div class="chips">
							<button v-for="aud in [...new Set([...(presetAudiences || []), ...(meta.audiences || [])])]"
								:key="aud" type="button" class="chip" :class="{ active: meta.audiences?.includes(aud) }"
								@click="toggleAudience(aud)">
								{{ aud }}
							</button>
						</div>
						<hr class="custom-input-divider" />
						<div class="custom-input-row">
							<input v-model="meta.audienceCustom" type="text" placeholder="Or type custom audience"
								@keydown.enter="addCustomAudience" />
							<button type="button" class="btn-add" @click="addCustomAudience"
								aria-label="Add custom audience">
								+
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
							<button
								v-for="tone in [...new Set([...(presetBrandTones || []), ...(meta.brandTones || [])])]"
								:key="tone" type="button" class="chip"
								:class="{ active: meta.brandTones?.includes(tone) }" @click="toggleBrandTone(tone)">
								{{ tone }}
							</button>
						</div>
						<hr class="custom-input-divider" />
						<div class="custom-input-row">
							<input v-model="meta.brandToneCustom" type="text" placeholder="Or type custom brand tone"
								@keydown.enter="addCustomBrandTone" />
							<button type="button" class="btn-add" @click="addCustomBrandTone"
								aria-label="Add custom brand tone">
								+
							</button>
						</div>
					</section>
					<section class="block block-logo-hole">
						<h2>Logo placement</h2>
						<div class="logo-grid" role="group" aria-label="Logo placement" aria-multiselectable="true">
							<button v-for="placement in logoHolePlacements" :key="placement" type="button"
								class="logo-grid-cell"
								:class="{ active: (meta.logoHolePlacement || []).includes(placement) }"
								:title="placement" :aria-pressed="(meta.logoHolePlacement || []).includes(placement)"
								@click="setLogoHolePlacement(placement)">
								<span v-if="(meta.logoHolePlacement || []).includes(placement)" class="logo-grid-dot"
									aria-hidden="true" />
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
						<button type="button" class="btn-add" @click="addCustomArtStyle"
							aria-label="Add custom art style">
							+
						</button>
					</div>
				</section>

				<section class="block">
					<h2>Color Palette</h2>
					<div class="chips">
						<button
							v-for="p in [...new Set([...(presetColorPalettes || []), ...(meta.colorPalettes || [])])]"
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
						<button v-for="mood in [...new Set([...(presetMoods || []), ...(meta.moods || [])])]"
							:key="mood" type="button" class="chip" :class="{ active: meta.moods?.includes(mood) }"
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
						<button v-for="l in presetLighting" :key="l" type="button" class="chip"
							:class="{ active: meta.lightings?.includes(l) }" @click="toggleLighting(l)">
							{{ l }}
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
							<button
								v-for="ratio in [...new Set([...(presetAspectRatios || []), ...(meta.aspectRatios || [])])]"
								:key="ratio" type="button" class="chip"
								:class="{ active: meta.aspectRatios?.includes(ratio) }"
								@click="toggleAspectRatio(ratio)">
								{{ ratio }}
							</button>
						</div>
						<hr class="custom-input-divider" />
						<div class="custom-input-row">
							<input v-model="meta.aspectRatioCustom" type="text" placeholder="Or custom ratio (e.g. 2:3)"
								@keydown.enter="addCustomAspectRatio" />
							<button type="button" class="btn-add" @click="addCustomAspectRatio"
								aria-label="Add custom aspect ratio">
								+
							</button>
						</div>
					</section>
					<section class="block">
						<h2>Camera</h2>
						<div class="chips">
							<button
								v-for="c in [...new Set([...(presetCameraSettings || []), ...(meta.cameraSettings || [])])]"
								:key="c" type="button" class="chip"
								:class="{ active: meta.cameraSettings?.includes(c) }" @click="toggleCameraSetting(c)">
								{{ c }}
							</button>
						</div>
						<hr class="custom-input-divider" />
						<div class="custom-input-row">
							<input v-model="meta.cameraSettingCustom" type="text" placeholder="Or custom camera setting"
								@keydown.enter="addCustomCameraSetting" />
							<button type="button" class="btn-add" @click="addCustomCameraSetting"
								aria-label="Add custom camera setting">+</button>
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

.site-logo {
	display: block;
	margin: 1.25rem auto 0;
	max-width: 1000px;
	height: auto;
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

	.descriptive-section .block-subject-type {
		grid-column: 1 / -1;
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

.attribute-section-divider+.attribute-section-label {
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

.image-generator {
	margin-top: 2rem;
}

.design-template-variants {
	margin-top: 2rem;
	max-width: 640px;
}

.design-template-variants .block-hint code {
	background: var(--input);
	padding: 0.15rem 0.4rem;
	border-radius: 4px;
	font-size: 0.8rem;
}

.variant-form {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	margin-top: 0.75rem;
}

.variant-fieldset {
	border: 1px solid var(--border);
	border-radius: 8px;
	padding: 0.75rem 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.variant-fieldset legend {
	font-size: 0.8rem;
	font-weight: 600;
	color: var(--muted);
	padding: 0 0.35rem;
}

.variant-row {
	display: grid;
	grid-template-columns: 140px 1fr;
	align-items: center;
	gap: 0.5rem;
}

.variant-row label {
	margin: 0;
	font-size: 0.85rem;
}

.variant-row input {
	margin: 0;
}

.image-prompts-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 1rem;
	margin-top: 1rem;
}

.image-prompt textarea {
	min-height: 80px;
}

.image-results-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 1rem;
	margin-top: 1rem;
}

.image-result-label {
	font-size: 0.8rem;
	font-weight: 500;
	color: var(--muted);
	margin-bottom: 0.35rem;
}

.image-result img {
	width: 100%;
	border-radius: 8px;
	border: 1px solid var(--border);
	display: block;
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
