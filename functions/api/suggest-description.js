const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

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
  throw new Error('No text found in LLM response.')
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
    const inputsSummary = (body.inputsSummary ?? '').trim()
    const model = (body.model ?? 'gemini-2.5-flash-lite').trim()

    if (!model) {
      return new Response(
        JSON.stringify({ error: 'Select a model before generating.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      )
    }

    const userContent = inputsSummary
      ? `Current prompt inputs:\n\n${inputsSummary}\n\nSuggest 5–10 short inspiration words that fit this vibe. Output only comma-separated words, all lowercase.`
      : 'Suggest 5–10 versatile image-prompt inspiration words. Output only comma-separated words, all lowercase.'

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
            content: 'You suggest inspiration words for image prompts. Output only a single set of 5–10 related words, comma-separated, all lowercase. No sentences, no explanation. Example: misty, serene, dawn, soft, atmospheric.',
          },
          { role: 'user', content: userContent },
        ],
        temperature: 0.6,
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

    const text = extractPromptText(payload).trim().toLowerCase()
    const result = text.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)

    return new Response(JSON.stringify({ suggestions: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    })
  } catch (err) {
    const message = err?.message || 'Description suggestion failed.'
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
