// Netlify serverless function that proxies chat requests to Groq.
//
// The Groq API key lives ONLY here, as a Netlify environment variable
// (GROQ_API_KEY) — it is never shipped to the browser. The front-end calls
// `/api/groq` (rewritten to this function by netlify.toml) with the same body
// it would send to Groq, minus the key.

exports.handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: { message: 'Method not allowed' } }) }
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: { message: 'Server GROQ_API_KEY is not set in Netlify environment variables.' }
      })
    }
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'Invalid JSON body' } }) }
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    })
    const text = await res.text()
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: text
    }
  } catch (e) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: { message: 'Proxy could not reach Groq.' } })
    }
  }
}
