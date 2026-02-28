const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const PROMPT_PLACEHOLDER = '[Insert brand imagery summary here]'

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

function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function onRequestPost(context) {
  const origin = context.request.headers.get('Origin') || '*'
  try {
    const apiKey = context.env.GEMINI_API_KEY
    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not set in this environment.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      )
    }

    const body = await context.request.json().catch(() => ({}))
    const summary = (body.summary ?? '').trim()
    const developerTemplate = (body.developerTemplate ?? '').trim()
    const model = (body.model ?? 'gemini-2.5-flash').trim()

    if (!summary) {
      return new Response(
        JSON.stringify({ error: 'Add prompt details before generating.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      )
    }
    if (!model) {
      return new Response(
        JSON.stringify({ error: 'Select a model before generating.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      )
    }

    const instructionPayload = applyDeveloperTemplate(summary, developerTemplate)
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert image metaprompt generator. Return one polished prompt string only. Never include meta/instructional wording, explanations, template language, labels, or markdown.',
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
      const message = apiError || (response.status === 429 ? 'Rate limit reached.' : response.status === 401 || response.status === 403 ? 'Invalid or unauthorized API key.' : `Request failed (${response.status})`)
      return new Response(
        JSON.stringify({ error: message }),
        { status: response.status >= 500 ? 502 : 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      )
    }

    const prompt = extractPromptText(payload).trim()
    return new Response(JSON.stringify({ prompt }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    })
  } catch (err) {
    const message = err?.message || 'Prompt optimization failed.'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    })
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
