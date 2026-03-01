import { PROMPT_PLACEHOLDER } from '../constants/promptTemplates.js'

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 30000

/** Max retries when API returns 429 (rate limit). */
const RATE_LIMIT_MAX_RETRIES = 3

/**
 * Retries a fetch when the response is 429, with exponential backoff or Retry-After.
 * @param {() => Promise<Response>} fetchFn - Function that performs one fetch (no body read).
 * @returns {Promise<Response>} - The response once non-429 or retries exhausted.
 */
async function fetchWithRetryOn429(fetchFn) {
  let response = await fetchFn()
  for (let attempt = 0; response.status === 429 && attempt < RATE_LIMIT_MAX_RETRIES; attempt++) {
    const retryAfter = response.headers.get('Retry-After')
    const waitMs = retryAfter
      ? Math.min(parseInt(retryAfter, 10) * 1000, 60000)
      : Math.min(2000 * Math.pow(2, attempt), 30000)
    await new Promise((r) => setTimeout(r, waitMs))
    response = await fetchFn()
  }
  return response
}

function applyDeveloperTemplate(summary, developerTemplate) {
  const template = (developerTemplate || '').trim()
  const cleanSummary = (summary || '').trim()
  if (!template) return cleanSummary

  if (template.includes(PROMPT_PLACEHOLDER)) {
    return template.replaceAll(PROMPT_PLACEHOLDER, cleanSummary)
  }

  return `${template}\n\n${cleanSummary}`
}

function normalizeMessageContent(content) {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === 'string' ? item : item?.text || ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function extractPromptText(payload) {
  const choice = payload?.choices?.[0]
  const messageContent = normalizeMessageContent(choice?.message?.content)
  if (messageContent) return messageContent

  const textContent = normalizeMessageContent(choice?.text)
  if (textContent) return textContent

  const outputText = normalizeMessageContent(payload?.output_text)
  if (outputText) return outputText

  throw new Error('No prompt text found in LLM response.')
}

function normalizeError(error) {
  if (error?.name === 'AbortError') {
    return 'Request timed out while generating an optimized prompt.'
  }
  return error?.message || 'Prompt optimization failed.'
}

export async function generateOptimizedPrompt({ summary, developerTemplate, model, apiKey, endpoint = DEFAULT_ENDPOINT }) {
  const cleanSummary = (summary || '').trim()
  const cleanModel = (model || '').trim()
  const cleanKey = (apiKey || '').trim()
  const instructionPayload = applyDeveloperTemplate(cleanSummary, developerTemplate)

  if (!cleanSummary) throw new Error('Add prompt details before generating.')
  if (!cleanModel) throw new Error('Select a model before generating.')
  if (!cleanKey) throw new Error('No Gemini API key. In dev: add to Developer settings or .env. In production: host must add functions/api/metaprompt-config.js and set GEMINI_API_KEY in Cloudflare Pages env.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetchWithRetryOn429(() =>
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: cleanModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert image metaprompt generator. Return one polished prompt string only. Never include meta/instructional wording, explanations, template language, labels, or markdown.',
            },
            {
              role: 'user',
              content: `Craft one final image prompt from these instructions:\n\n${instructionPayload}\n\nImportant: output only the final prompt text. Do not include process language, template instructions, marketing terms, or explanation.`,
            },
          ],
          temperature: 0.7,
        }),
      })
    )

    const rawText = await response.text().catch(() => '')
    const payload = rawText ? (() => { try { return JSON.parse(rawText) } catch { return {} } })() : {}

    if (!response.ok) {
      const apiError = payload?.error?.message || payload?.message
      if (apiError) throw new Error(apiError)
      if (response.status === 429) throw new Error('Rate limit reached (429). Wait a moment and try again, or switch to a different model.')
      if (response.status === 403) {
        const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : ''
        const hint = origin
          ? ` If your API key is restricted by HTTP referrer, add "${origin}/*" and "${origin}" in Google Cloud Console → Credentials → your key → Application restrictions.`
          : ' If your API key is restricted by HTTP referrer, add this site’s domain in Google Cloud Console → Credentials → your key → Application restrictions.'
        throw new Error(`Invalid or unauthorized API key. Check your key in Developer settings.${hint}`)
      }
      if (response.status === 401) throw new Error('Invalid or unauthorized API key. Check your key in Developer settings.')
      const detail = rawText ? ` — ${rawText.slice(0, 200)}` : ''
      throw new Error(`Request failed (${response.status})${detail}`)
    }

    return extractPromptText(payload).trim()
  } catch (error) {
    throw new Error(normalizeError(error))
  } finally {
    clearTimeout(timeout)
  }
}

const PROXY_ENDPOINT = '/api/optimize-prompt'
const REQUEST_TIMEOUT_MS_PROXY = 30000

/**
 * Call the Cloudflare Pages Function that uses the encrypted GEMINI_API_KEY at runtime.
 * Use when no client-side API key is available (e.g. production with encrypted env).
 */
/**
 * Ask the LLM for one set of short inspiration words based on current prompt inputs.
 * Returns an array of lowercase words (e.g. ["misty", "serene", "dawn", "soft"]).
 */
export async function generateDescriptionSuggestions({ inputsSummary, model, apiKey, endpoint = DEFAULT_ENDPOINT }) {
  const cleanInputs = (inputsSummary || '').trim()
  const cleanModel = (model || '').trim()
  const cleanKey = (apiKey || '').trim()
  if (!cleanModel) throw new Error('Select a model before generating.')
  if (!cleanKey) throw new Error('No API key configured.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetchWithRetryOn429(() =>
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: cleanModel,
          messages: [
            {
              role: 'system',
              content: 'You suggest inspiration words for image prompts. Output only a single set of 5–10 related words, comma-separated, all lowercase. No sentences, no explanation. Example: misty, serene, dawn, soft, atmospheric.',
            },
            {
              role: 'user',
              content: cleanInputs
                ? `Current prompt inputs:\n\n${cleanInputs}\n\nSuggest 5–10 short inspiration words that fit this vibe. Output only comma-separated words, all lowercase.`
                : 'Suggest 5–10 versatile image-prompt inspiration words. Output only comma-separated words, all lowercase.',
            },
          ],
          temperature: 0.6,
        }),
      })
    )

    const rawText = await response.text().catch(() => '')
    const payload = rawText ? (() => { try { return JSON.parse(rawText) } catch { return {} } })() : {}

    if (!response.ok) {
      const apiError = payload?.error?.message || payload?.message
      if (apiError) throw new Error(apiError)
      if (response.status === 429) throw new Error('Rate limit reached. Wait a moment and try again.')
      throw new Error(`Request failed (${response.status})`)
    }

    const text = extractPromptText(payload).trim().toLowerCase()
    const words = text.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
    return words.length ? words : []
  } catch (error) {
    throw new Error(normalizeError(error))
  } finally {
    clearTimeout(timeout)
  }
}

const SUGGEST_DESCRIPTION_PROXY = '/api/suggest-description'

function isRateLimitError(response, data) {
  return response.status === 429 || ((response.status === 400 || response.status >= 500) && (data?.error || '').toLowerCase().includes('rate limit'))
}

/** Retry proxy requests when response indicates rate limit (429 or error message). */
async function proxyFetchWithRetry(fetchFn) {
  let response
  let rawText = ''
  let data = {}
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    response = await fetchFn()
    rawText = await response.text().catch(() => '')
    data = rawText ? (() => { try { return JSON.parse(rawText) } catch { return {} } })() : {}
    if (!response.ok && isRateLimitError(response, data) && attempt < RATE_LIMIT_MAX_RETRIES) {
      const waitMs = Math.min(2000 * Math.pow(2, attempt), 30000)
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }
    break
  }
  return { response, rawText, data }
}

export async function generateDescriptionSuggestionsViaProxy({ inputsSummary, model, proxyUrl = SUGGEST_DESCRIPTION_PROXY }) {
  const cleanInputs = (inputsSummary || '').trim()
  const cleanModel = (model || '').trim()
  if (!cleanModel) throw new Error('Select a model before generating.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS_PROXY)

  try {
    const url = proxyUrl.startsWith('http') ? proxyUrl : new URL(proxyUrl, typeof window !== 'undefined' ? window.location.origin : '').href
    const { response, data } = await proxyFetchWithRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          inputsSummary: cleanInputs,
          model: cleanModel,
        }),
      })
    )

    if (!response.ok) {
      const message = data?.error || `Request failed (${response.status})`
      throw new Error(message)
    }

    const suggestions = data?.suggestions
    if (!Array.isArray(suggestions)) return []
    return suggestions.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
  } catch (error) {
    throw new Error(normalizeError(error))
  } finally {
    clearTimeout(timeout)
  }
}

export async function generateOptimizedPromptViaProxy({ summary, developerTemplate, model, proxyUrl = PROXY_ENDPOINT }) {
  const cleanSummary = (summary || '').trim()
  const cleanModel = (model || '').trim()
  if (!cleanSummary) throw new Error('Add prompt details before generating.')
  if (!cleanModel) throw new Error('Select a model before generating.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS_PROXY)

  try {
    const url = proxyUrl.startsWith('http') ? proxyUrl : new URL(proxyUrl, typeof window !== 'undefined' ? window.location.origin : '').href
    const { response, data } = await proxyFetchWithRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          summary: cleanSummary,
          developerTemplate: (developerTemplate || '').trim(),
          model: cleanModel,
        }),
      })
    )

    if (!response.ok) {
      const message = data?.error || `Request failed (${response.status})`
      throw new Error(message)
    }

    const prompt = (data?.prompt ?? '').trim()
    if (!prompt) throw new Error('No prompt text found in response.')
    return prompt
  } catch (error) {
    throw new Error(normalizeError(error))
  } finally {
    clearTimeout(timeout)
  }
}
