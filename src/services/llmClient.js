import { PROMPT_PLACEHOLDER } from '../constants/promptTemplates.js'

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 30000

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
  if (!cleanKey) throw new Error('Add a Gemini API key in Developer settings.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
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

    const rawText = await response.text().catch(() => '')
    const payload = rawText ? (() => { try { return JSON.parse(rawText) } catch { return {} } })() : {}

    if (!response.ok) {
      const apiError = payload?.error?.message || payload?.message
      if (apiError) throw new Error(apiError)
      if (response.status === 429) throw new Error('Rate limit reached (429). Wait a moment and try again, or switch to a different model.')
      if (response.status === 401 || response.status === 403) throw new Error('Invalid or unauthorized API key. Check your key in Developer settings.')
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
