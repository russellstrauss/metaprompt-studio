import { ref, computed, watch } from 'vue'
import { generateOptimizedPrompt } from '../services/llmClient.js'
import { PROMPT_PLACEHOLDER, defaultDeveloperInstructionTemplate } from '../constants/promptTemplates.js'

const STORAGE_KEYS = {
  apiKey: 'metaprompt.dev.apiKey',
  instructionTemplate: 'metaprompt.dev.instructionTemplate',
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const GEMINI_MODEL = 'gemini-2.5-flash'

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
  negativePrompt: '',
})

export function useMetaprompt() {
  const meta = ref(defaultMetaprompt())
  const developerInstructionTemplate = ref(readFromStorage(STORAGE_KEYS.instructionTemplate, defaultDeveloperInstructionTemplate))

  const envGeminiKey = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_GEMINI_API_KEY || '').trim()
    : ''

  const llmApiKey = ref(readFromStorage(STORAGE_KEYS.apiKey, envGeminiKey))
  const optimizedPrompt = ref('')
  const isOptimizing = ref(false)
  const optimizeError = ref('')
  const lastOptimizedAt = ref('')

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

  /** Final output always favors optimized LLM prompt with deterministic fallback. */
  const finalOutput = computed(() => {
    const optimized = (optimizedPrompt.value || '').trim()
    if (optimized) return optimized
    return baseSummary.value
  })

  function buildPrompt(m) {
    const parts = []

    // 1. Subject & description (core content)
    if (m.subject) parts.push(m.subject)
    if (m.description) parts.push(m.description)

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
    if (m.context) parts.push(m.context)

    // 7. Typography (if relevant for image gen)
    if (m.typography) parts.push(`Typography: [${m.typography}]`)

    // 8. Quality modifiers
    if (m.qualityModifiers?.length) {
      parts.push(`Quality: [${m.qualityModifiers.join(', ')}]`)
    }

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
    const summary = (baseSummary.value || '').trim()
    optimizeError.value = ''

    if (!summary) {
      optimizeError.value = 'Add prompt details before generating.'
      return
    }

    isOptimizing.value = true
    const startedAt = performance.now()
    trackEvent('optimize_start', { model: GEMINI_MODEL })

    try {
      const output = await generateOptimizedPrompt({
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

  function resetDeveloperTemplateToDefault() {
    developerInstructionTemplate.value = defaultDeveloperInstructionTemplate
    optimizedPrompt.value = ''
    optimizeError.value = ''
  }

  function resetDeveloperSettings() {
    llmApiKey.value = envGeminiKey
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

  return {
    meta,
    baseSummary,
    generatedPrompt,
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
    defaultDeveloperInstructionTemplate,
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
