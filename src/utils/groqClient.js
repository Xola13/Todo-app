// Thin wrapper around Groq's OpenAI-compatible Chat Completions API.
//
// SECURITY NOTE: this calls Groq directly from the browser using a key the user
// pastes into Settings (stored only in their own localStorage). That is fine for
// a personal/offline app, but the key is visible to anyone using that browser.
// For a public deployment, move this call behind a serverless proxy (e.g. an
// Azure Static Web Apps function) and keep the key server-side — only the
// `endpoint` below would change.

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

export async function groqChat({
  apiKey,
  model = 'openai/gpt-oss-20b',
  messages,
  temperature = 0.3,
  json = false,
  signal
}) {
  if (!apiKey) throw new Error('No Groq API key set. Add one in Settings.')

  const body = {
    model,
    messages,
    temperature
  }
  if (json) body.response_format = { type: 'json_object' }

  let res
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal
    })
  } catch (e) {
    // Network/CORS failures land here.
    throw new Error(
      'Could not reach Groq. Check your connection (or CORS if self-hosting a proxy).'
    )
  }

  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err.error?.message || JSON.stringify(err)
    } catch (e) {
      detail = await res.text()
    }
    if (res.status === 401) throw new Error('Invalid Groq API key (401).')
    if (res.status === 404)
      throw new Error(`Model "${model}" not found (404). Try another model in Settings.`)
    if (res.status === 429) throw new Error('Rate limited by Groq (429). Slow down a bit.')
    throw new Error(`Groq error ${res.status}: ${detail}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// Best-effort JSON extraction: handles models that wrap JSON in prose/code fences.
export function parseJsonLoose(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (e) {
    /* fall through */
  }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) {
    try {
      return JSON.parse(fence[1])
    } catch (e) {
      /* fall through */
    }
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch (e) {
      /* give up */
    }
  }
  return null
}
