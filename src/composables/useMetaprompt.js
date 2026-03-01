import { ref, computed, watch } from 'vue'
import { generateOptimizedPrompt, generateOptimizedPromptViaProxy, generateDescriptionSuggestions, generateDescriptionSuggestionsViaProxy } from '../services/llmClient.js'
import { PROMPT_PLACEHOLDER, defaultDeveloperInstructionTemplate } from '../constants/promptTemplates.js'

const STORAGE_KEYS = {
  apiKey: 'metaprompt.dev.apiKey',
  instructionTemplate: 'metaprompt.dev.instructionTemplate',
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const GEMINI_MODEL = 'gemini-2.5-flash-lite'

const defaultMetaprompt = () => ({
  description: '',
  subject: '',
  artStyles: [],
  artStyleCustom: '',
  medium: '',
  colorPalettes: [],
  colorPaletteCustom: '',
  compositions: [],
  compositionCustom: '',
  framing: '',
  lightings: [],
  lightingCustom: '',
  moods: [],
  moodCustom: '',
  context: '',
  typography: '',
  qualityModifiers: [],
  brandTones: [],
  audiences: [],
  subjectTypes: [],
  cameraSettings: [],
  aspectRatios: [],
  timeOfDay: [],
  weather: [],
  materials: [],
  abstractionLevel: '',
  renderMediums: [],
  logoHolePlacement: [], // array of: 'top-left'|'top-center'|'top-right'|'center-left'|'center'|'center-right'|'bottom-left'|'bottom-center'|'bottom-right'
})

export function useMetaprompt() {
  const meta = ref(defaultMetaprompt())
  const developerInstructionTemplate = ref(readFromStorage(STORAGE_KEYS.instructionTemplate, defaultDeveloperInstructionTemplate))

  // Key NEVER from build in production. Dev: .env (VITE_GEMINI_API_KEY). Prod: runtime config or fetch from parent's config endpoint.
  const getDefaultApiKey = () => {
    if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.GEMINI_API_KEY) {
      return (window.__RUNTIME_CONFIG__.GEMINI_API_KEY || '').trim()
    }
    if (import.meta.env.DEV) {
      return (import.meta.env.VITE_GEMINI_API_KEY || '').trim()
    }
    return ''
  }
  const optimizeProxyUrl =
    (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.OPTIMIZE_PROXY_URL) || '/api/optimize-prompt'
  const suggestDescriptionProxyUrl =
    (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.SUGGEST_DESCRIPTION_PROXY_URL) || '/api/suggest-description'

  const llmApiKey = ref(readFromStorage(STORAGE_KEYS.apiKey, getDefaultApiKey()))

  // Production: key not in build; fetch from parent's config endpoint (same env var, exposed at runtime only).
  if (typeof window !== 'undefined' && !(llmApiKey.value || '').trim()) {
    const configUrl = (window.__RUNTIME_CONFIG__?.METAPROMPT_CONFIG_URL) || '/api/metaprompt-config'
    fetch(configUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const key = (data?.GEMINI_API_KEY || '').trim()
        if (key) llmApiKey.value = key
      })
      .catch(() => {})
  }
  const optimizedPrompt = ref('')
  const isOptimizing = ref(false)
  const optimizeError = ref('')
  const lastOptimizedAt = ref('')
  const characterLimit = ref(400)

  const descriptionSuggestions = ref([])
  const isSuggestingDescription = ref(false)
  const descriptionSuggestionError = ref('')
  /** Suggestions run once, 5s after user stops typing in description/context. */
  const DESCRIPTION_SUGGEST_DEBOUNCE_MS = 5000
  let descriptionSuggestDebounceId = null
  /** Once true, no further suggestion API calls (max 1 per session). */
  let descriptionSuggestionsAlreadyRequested = false

  function isPageVisible() {
    return typeof document !== 'undefined' && document.visibilityState === 'visible'
  }

  const presetStyles = [
    'cinematic', 'digital painting', 'oil painting', 'watercolor', 'ink illustration',
    'photorealistic', 'concept art', 'anime', 'flat design', 'minimalist',
    'surrealist', 'impressionist', 'art deco', 'retro', 'cyberpunk', 'fantasy',
    'sci-fi', 'noir', 'vintage', 'brutalist', 'organic', 'geometric',
  ]

  const presetColorPalettes = [
    'warm earth tones', 'cool blues and grays', 'teal and coral', 'monochrome',
    'pastel', 'vibrant saturated', 'muted desaturated', 'golden and amber',
    'forest greens', 'sunset orange and purple', 'neutral beige', 'high contrast B&W',
    'jewel tones', 'dusty rose and sage', 'electric neon', 'sepia',
  ]

  const presetCompositions = [
    'rule of thirds', 'centered', 'golden ratio', 'symmetrical', 'dynamic diagonal',
    'leading lines', 'frame within frame', 'negative space', 'close-up', 'wide shot',
    'bird\'s eye', 'low angle', 'Dutch angle', 'portrait', 'landscape',
  ]

  const presetLighting = [
    'soft natural light', 'dramatic chiaroscuro', 'golden hour', 'blue hour',
    'studio lighting', 'rim light', 'backlit', 'overcast', 'neon', 'candlelight',
    'volumetric', 'high contrast', 'low key', 'high key', 'dappled light',
  ]

  const presetMoods = [
    'serene', 'mysterious', 'epic', 'intimate', 'melancholic', 'joyful',
    'tense', 'dreamy', 'nostalgic', 'ethereal', 'powerful', 'whimsical',
    'ominous', 'hopeful', 'chaotic', 'peaceful',
  ]

  const qualityTags = [
    'highly detailed', 'sharp focus', '8k', 'masterpiece', 'professional',
    'intricate', 'atmospheric', 'dynamic', 'expressive', 'stylized',
  ]

  const presetSubjectTypes = []
  const presetCameraSettings = []
  const presetTimeOfDay = ['dawn', 'midday', 'golden hour', 'dusk', 'night', 'blue hour']
  const presetWeather = ['clear', 'overcast', 'rain', 'snow', 'fog', 'dramatic clouds']
  const presetMaterials = ['matte', 'glossy', 'textured', 'metallic', 'translucent', 'organic']
  const presetAbstractionLevels = ['literal', 'stylized', 'abstract', 'schematic']
  const presetRenderMediums = ['3D render', 'digital painting', 'photo', 'illustration', 'mixed media']
  const presetBrandTones = ['professional', 'playful', 'luxury', 'minimal', 'bold', 'trustworthy']
  const presetAudiences = ['consumer', 'B2B', 'creative', 'technical', 'general']
  const presetAspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9']

  const baseSummary = computed(() => buildPrompt(meta.value))
  const generatedPrompt = computed(() => baseSummary.value) // Backward-compatible alias for existing UI references.
  const selectedModel = computed(() => GEMINI_MODEL)
  const llmInputPreview = computed(() => {
    const template = (developerInstructionTemplate.value || '').trim()
    const summary = baseSummary.value
    if (!template) return summary
    if (template.includes(PROMPT_PLACEHOLDER)) {
      return template.replaceAll(PROMPT_PLACEHOLDER, summary)
    }
    return `${template}\n\n${summary}`
  })

  /** Parsed array of prompt options when LLM returns multiple (e.g. three prompts separated by blank lines). */
  const optimizedPromptOptions = computed(() => {
    const raw = (optimizedPrompt.value || '').trim()
    if (!raw) return []
    return raw.split(/\n\n+/).map((s) => s.trim()).filter(Boolean)
  })

  /** Convert placement keys to natural prompt wording (e.g. "top-left" → "top left"). */
  function formatLogoPlacementAsPromptText(placements) {
    if (!placements?.length) return ''
    const toWords = (key) => key.replace(/-/g, ' ')
    const list = placements.map(toWords)
    if (list.length === 1) return `Leave clear space for a logo in the ${list[0]}.`
    const last = list.pop()
    return `Leave clear space for a logo in the ${list.join(', ')} and ${last}.`
  }

  /** Logo placement as natural prompt wording to append when user has selected placements. */
  const logoPlacementSuffix = computed(() => formatLogoPlacementAsPromptText(meta.value.logoHolePlacement || []))

  /** Prompt options with logo placement appended when set (for display and copy). */
  const finalPromptOptions = computed(() => {
    const options = optimizedPromptOptions.value
    const suffix = logoPlacementSuffix.value
    if (!suffix) return options
    return options.map((o) => `${o}. ${suffix}`)
  })

  /** Final output always favors optimized LLM prompt with deterministic fallback. Logo placement is appended when set so it is never dropped. */
  const finalOutput = computed(() => {
    const optimized = (optimizedPrompt.value || '').trim()
    if (optimized) {
      const options = finalPromptOptions.value
      return options.length ? options.join('\n\n') : optimized + (logoPlacementSuffix.value ? `. ${logoPlacementSuffix.value}` : '')
    }
    return baseSummary.value
  })

  function buildPrompt(m) {
    const parts = []

    // 1. Subject & description (core content)
    if (m.subject) parts.push(m.subject)
    if (m.description) parts.push(`Description: ${m.description}`)

    // 2. Art style & medium
    const styleParts = [...(m.artStyles || []), m.artStyleCustom, m.medium].filter(Boolean)
    if (styleParts.length) parts.push(`Art Style: [${styleParts.join(', ')}]`)

    // 3. Composition & framing
    const compParts = [...(m.compositions || []), m.compositionCustom, m.framing].filter(Boolean)
    if (compParts.length) parts.push(`Composition: [${compParts.join(', ')}]`)

    // 4. Lighting & mood
    const atmParts = [...(m.lightings || []), m.lightingCustom, ...(m.moods || []), m.moodCustom].filter(Boolean)
    if (atmParts.length) parts.push(`Lighting & Mood: [${atmParts.join(', ')}]`)

    // 5. Color palette
    const colorParts = [...(m.colorPalettes || []), m.colorPaletteCustom].filter(Boolean)
    if (colorParts.length) parts.push(`Color Palette: [${colorParts.join(', ')}]`)

    // 6. Context (scene/setting)
    if (m.context) parts.push(`Setting: ${m.context}`)

    // 7. Typography (if relevant for image gen)
    if (m.typography) parts.push(`Typography: [${m.typography}]`)

    // 8. Quality modifiers
    if (m.qualityModifiers?.length) {
      parts.push(`Quality: [${m.qualityModifiers.join(', ')}]`)
    }

    // 9. Brand, audience
    const brandParts = [...(m.brandTones || []), ...(m.audiences || [])].filter(Boolean)
    if (brandParts.length) parts.push(`Brand / Audience: [${brandParts.join(', ')}]`)
    if (m.logoHolePlacement?.length) parts.push(formatLogoPlacementAsPromptText(m.logoHolePlacement))

    // 10. Aspect ratio, time, weather, materials, abstraction, render mediums
    if (m.aspectRatios?.length) parts.push(`Aspect ratio: [${m.aspectRatios.join(', ')}]`)
    const timeParts = [...(m.timeOfDay || []), ...(m.weather || [])].filter(Boolean)
    if (timeParts.length) parts.push(`Time / Weather: [${timeParts.join(', ')}]`)
    if (m.materials?.length) parts.push(`Materials: [${m.materials.join(', ')}]`)
    if (m.abstractionLevel) parts.push(`Abstraction: ${m.abstractionLevel}`)
    if (m.renderMediums?.length) parts.push(`Render medium: [${m.renderMediums.join(', ')}]`)

    return parts.filter(Boolean).join('. ')
  }

  function toggleInArray(field, value) {
    const arr = meta.value[field] || []
    const i = arr.indexOf(value)
    if (i === -1) meta.value[field] = [...arr, value]
    else meta.value[field] = arr.filter((_, idx) => idx !== i)
  }

  function toggleArtStyle(s) {
    toggleInArray('artStyles', s)
  }

  function toggleColorPalette(p) {
    toggleInArray('colorPalettes', p)
  }

  function toggleComposition(c) {
    toggleInArray('compositions', c)
  }

  function toggleLighting(l) {
    toggleInArray('lightings', l)
  }

  function toggleMood(m) {
    toggleInArray('moods', m)
  }

  function toggleQualityTag(tag) {
    toggleInArray('qualityModifiers', tag)
  }

  function toggleSubjectType(s) { toggleInArray('subjectTypes', s) }
  function toggleAspectRatio(r) { toggleInArray('aspectRatios', r) }
  function toggleCameraSetting(c) { toggleInArray('cameraSettings', c) }
  function toggleTimeOfDay(t) { toggleInArray('timeOfDay', t) }
  function toggleWeather(w) { toggleInArray('weather', w) }
  function toggleMaterial(m) { toggleInArray('materials', m) }
  function toggleRenderMedium(m) { toggleInArray('renderMediums', m) }
  function toggleBrandTone(t) { toggleInArray('brandTones', t) }
  function toggleAudience(a) { toggleInArray('audiences', a) }
  function setAbstractionLevel(level) {
    meta.value.abstractionLevel = level
  }
  const logoHolePlacements = [
    'top-left', 'top-center', 'top-right',
    'center-left', 'center', 'center-right',
    'bottom-left', 'bottom-center', 'bottom-right',
  ]
  function setLogoHolePlacement(placement) {
    toggleInArray('logoHolePlacement', placement)
  }
  function clearSelections() {
    reset()
  }

  function reset() {
    meta.value = defaultMetaprompt()
  }

  function sanitizePromptOutput(text) {
    const clean = (text || '').trim()
    if (!clean) return ''

    return clean
      .replace(/^```[\w-]*\s*/i, '')
      .replace(/\s*```$/i, '')
      .replace(/^\s*(here(?:'s| is)\s+(?:your|the)\s+prompt\s*:)\s*/i, '')
      .trim()
  }

  function trackEvent(eventName, metadata = {}) {
    // Stub for future analytics hook; no-op in current app.
    void eventName
    void metadata
  }

  async function optimizePrompt() {
    if (isOptimizing.value) return
    isOptimizing.value = true

    const summary = (baseSummary.value || '').trim()
    optimizeError.value = ''

    if (!summary) {
      optimizeError.value = 'Add prompt details before generating.'
      isOptimizing.value = false
      return
    }

    const hasExplicitProxy = typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.OPTIMIZE_PROXY_URL
    const keyEmpty = !(llmApiKey.value || '').trim()
    if (keyEmpty && !hasExplicitProxy) {
      optimizeError.value = 'No API key. Ensure the host provides GET /api/metaprompt-config and sets GEMINI_API_KEY in Cloudflare Pages.'
      isOptimizing.value = false
      return
    }
    const startedAt = performance.now()
    trackEvent('optimize_start', { model: GEMINI_MODEL })

    try {
      const useProxy = keyEmpty && hasExplicitProxy
      const output = useProxy
        ? await generateOptimizedPromptViaProxy({
            summary,
            developerTemplate: developerInstructionTemplate.value,
            model: GEMINI_MODEL,
            proxyUrl: optimizeProxyUrl,
          })
        : await generateOptimizedPrompt({
            summary,
            developerTemplate: developerInstructionTemplate.value,
            model: GEMINI_MODEL,
            apiKey: llmApiKey.value,
            endpoint: GEMINI_ENDPOINT,
          })

      const sanitized = sanitizePromptOutput(output)
      if (!sanitized) {
        throw new Error('LLM returned an empty prompt.')
      }

      optimizedPrompt.value = sanitized
      lastOptimizedAt.value = new Date().toISOString()
      trackEvent('optimize_success', { latencyMs: Math.round(performance.now() - startedAt) })
    } catch (error) {
      optimizeError.value = error?.message || 'Prompt optimization failed.'
      optimizedPrompt.value = ''
      trackEvent('optimize_failure', {
        latencyMs: Math.round(performance.now() - startedAt),
        error: optimizeError.value,
      })
    } finally {
      isOptimizing.value = false
    }
  }

  async function suggestDescription() {
    if (!isPageVisible()) return
    if (descriptionSuggestionsAlreadyRequested) return
    descriptionSuggestionError.value = ''

    const inputsSummary = (baseSummary.value || '').trim()
    if (!inputsSummary) {
      descriptionSuggestions.value = []
      return
    }

    const hasExplicitProxy = typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.OPTIMIZE_PROXY_URL
    const keyEmpty = !(llmApiKey.value || '').trim()
    if (keyEmpty && !hasExplicitProxy) {
      descriptionSuggestionError.value = 'No API key. Set in Developer settings or use a host that provides the suggest-description API.'
      return
    }

    descriptionSuggestionsAlreadyRequested = true
    isSuggestingDescription.value = true
    try {
      const useProxy = keyEmpty && hasExplicitProxy
      const suggestions = useProxy
        ? await generateDescriptionSuggestionsViaProxy({
            inputsSummary,
            model: GEMINI_MODEL,
            proxyUrl: suggestDescriptionProxyUrl,
          })
        : await generateDescriptionSuggestions({
            inputsSummary,
            model: GEMINI_MODEL,
            apiKey: llmApiKey.value,
            endpoint: GEMINI_ENDPOINT,
          })
      descriptionSuggestions.value = Array.isArray(suggestions) ? suggestions : []
    } catch (error) {
      descriptionSuggestionError.value = error?.message || 'Could not get suggestions.'
    } finally {
      isSuggestingDescription.value = false
    }
  }

  function scheduleDescriptionSuggest() {
    if (descriptionSuggestionsAlreadyRequested) return
    if (descriptionSuggestDebounceId) clearTimeout(descriptionSuggestDebounceId)
    if (!isPageVisible()) return
    const inputsSummary = (baseSummary.value || '').trim()
    if (!inputsSummary) {
      descriptionSuggestions.value = []
      descriptionSuggestionError.value = ''
      return
    }
    const hasKey = (llmApiKey.value || '').trim()
    const hasProxy = typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.OPTIMIZE_PROXY_URL
    if (!hasKey && !hasProxy) return
    descriptionSuggestDebounceId = setTimeout(() => {
      descriptionSuggestDebounceId = null
      if (isPageVisible() && !descriptionSuggestionsAlreadyRequested) suggestDescription()
    }, DESCRIPTION_SUGGEST_DEBOUNCE_MS)
  }

  function applyDescriptionSuggestion(word) {
    const current = (meta.value.description || '').trim()
    meta.value.description = current ? `${current} ${word}` : word
  }

  function resetDeveloperTemplateToDefault() {
    developerInstructionTemplate.value = defaultDeveloperInstructionTemplate
    optimizedPrompt.value = ''
    optimizeError.value = ''
  }

  function resetDeveloperSettings() {
    llmApiKey.value = getDefaultApiKey()
    resetDeveloperTemplateToDefault()
  }

  watch(meta, () => {
    optimizedPrompt.value = ''
    optimizeError.value = ''
  }, { deep: true })

  watch([developerInstructionTemplate], () => {
    optimizedPrompt.value = ''
    optimizeError.value = ''
  })

  watch(llmApiKey, (value) => { writeToStorage(STORAGE_KEYS.apiKey, value) })
  watch(developerInstructionTemplate, (value) => { writeToStorage(STORAGE_KEYS.instructionTemplate, value) })

  // No auto-call for description suggestions: Gemini is only invoked when the user clicks "Generate prompt".

  return {
    meta,
    baseSummary,
    generatedPrompt,
    finalOutput,
    optimizePrompt,
    optimizedPrompt,
    optimizedPromptOptions,
    finalPromptOptions,
    isOptimizing,
    optimizeError,
    lastOptimizedAt,
    descriptionSuggestions,
    isSuggestingDescription,
    descriptionSuggestionError,
    suggestDescription,
    applyDescriptionSuggestion,
    developerInstructionTemplate,
    llmApiKey,
    GEMINI_MODEL,
    llmInputPreview,
    PROMPT_PLACEHOLDER,
    defaultDeveloperInstructionTemplate,
    resetDeveloperTemplateToDefault,
    resetDeveloperSettings,
    presetStyles,
    presetColorPalettes,
    presetCompositions,
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
    presetAspectRatios,
    characterLimit,
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
  }
}

function readFromStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback
  const value = window.localStorage.getItem(key)
  return value ?? fallback
}

function writeToStorage(key, value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, value ?? '')
}
