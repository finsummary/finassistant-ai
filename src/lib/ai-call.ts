/**
 * Universal AI call utility with automatic fallback between providers
 * Supports: OpenAI, Claude (Anthropic), Gemini, Groq (free open-source), Ollama (local)
 */

import { getAvailableProviders, isQuotaError, markProviderQuotaExceeded, type AIProvider } from './ai-provider'

export interface AICallOptions {
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
  temperature?: number
  section?: string // For logging
}

/**
 * Extract JSON from markdown code blocks
 */
function extractJSON(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
  }
  return cleaned
}

/**
 * Call OpenAI API
 */
async function callOpenAI(apiKey: string, options: AICallOptions): Promise<any> {
  const { systemPrompt, userPrompt, maxTokens = 1500, temperature = 0.7 } = options

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  })

  const data = await resp.json()
  if (!resp.ok) {
    throw new Error(data.error?.message || 'OpenAI API error')
  }

  let responseText = data.choices?.[0]?.message?.content || '{}'
  responseText = extractJSON(responseText)
  return JSON.parse(responseText)
}

/**
 * Call Claude (Anthropic) API
 */
async function callClaude(apiKey: string, options: AICallOptions): Promise<any> {
  const { systemPrompt, userPrompt, maxTokens = 1500, temperature = 0.7 } = options

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${userPrompt}\n\nReturn only valid JSON, no markdown formatting.`,
        },
      ],
    }),
  })

  const data = await resp.json()
  if (!resp.ok) {
    throw new Error(data.error?.message || 'Claude API error')
  }

  let responseText = data.content?.[0]?.text || '{}'
  responseText = extractJSON(responseText)
  return JSON.parse(responseText)
}

/**
 * Call Groq API (free open-source models: Llama 3, Mistral, etc.)
 */
async function callGroq(apiKey: string, options: AICallOptions): Promise<any> {
  const { systemPrompt, userPrompt, maxTokens = 1500, temperature = 0.7 } = options
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant' // Default to fast free model

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  })

  const data = await resp.json()
  if (!resp.ok) {
    // Groq error messages often include retry time, preserve it in error message
    const errorMsg = data.error?.message || data.message || 'Groq API error'
    const error = new Error(errorMsg)
    // Attach original error data for better error handling
    ;(error as any).groqError = data.error || data
    throw error
  }
  
  let responseText = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(extractJSON(responseText))
}

/**
 * Call Ollama API (local open-source models)
 */
async function callOllama(baseUrl: string, options: AICallOptions): Promise<any> {
  const { systemPrompt, userPrompt, maxTokens = 1500, temperature = 0.7 } = options
  const model = process.env.OLLAMA_MODEL || 'llama3.1:8b' // Default model

  // Ollama uses a different API format - combine system and user prompts
  const prompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn only valid JSON, no markdown formatting.`

  const resp = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      options: {
        temperature,
        num_predict: maxTokens,
      },
      stream: false,
    }),
  })

  const data = await resp.json()
  if (!resp.ok) {
    throw new Error(data.error || 'Ollama API error')
  }
  
  let responseText = data.response || '{}'
  return JSON.parse(extractJSON(responseText))
}

/**
 * Call Gemini API
 */
async function callGemini(apiKey: string, options: AICallOptions): Promise<any> {
  const { systemPrompt, userPrompt, maxTokens = 1500, temperature = 0.7 } = options

  // First, try to list available models
  let availableModels: string[] = []
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    const listResp = await fetch(listUrl)
    const listData = await listResp.json()
    if (listResp.ok && listData.models) {
      availableModels = listData.models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''))
    }
  } catch (e: any) {
    console.warn(`[AI Call] ListModels exception:`, e.message)
  }

  // Use only available models from the list, or fallback to known working models
  const modelsToTry = availableModels.length > 0
    ? availableModels
    : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.5-pro']

  let lastError: any = null
  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\n${userPrompt}\n\nReturn only valid JSON, no markdown formatting.`
            }]
          }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
      })

      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.error?.message || 'Gemini API error')
      }

      let responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      responseText = extractJSON(responseText)
      return JSON.parse(responseText)
    } catch (e: any) {
      lastError = e
      // If quota error, don't try other models
      if (isQuotaError(e)) {
        throw e
      }
      continue
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('No Gemini models available')
}

/**
 * Call AI provider with automatic fallback
 * Tries providers in priority order: OpenAI > Claude > Gemini
 * Automatically falls back on quota errors
 */
export async function callAI(options: AICallOptions): Promise<{ result: any; provider: AIProvider }> {
  const providers = getAvailableProviders()
  const { section = 'unknown' } = options

  if (providers.length === 0) {
    throw new Error('No AI providers available. Please set OPENAI_API_KEY, GROQ_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or OLLAMA_BASE_URL')
  }

  console.log(`[AI Call] Attempting ${section} analysis with ${providers.length} provider(s): ${providers.map(p => p.provider).join(', ')}`)

  let lastError: any = null
  let lastQuotaError: any = null

  for (const providerConfig of providers) {
    try {
      let result: any

      switch (providerConfig.provider) {
        case 'openai':
          result = await callOpenAI(providerConfig.apiKey, options)
          break
        case 'claude':
          result = await callClaude(providerConfig.apiKey, options)
          break
        case 'groq':
          result = await callGroq(providerConfig.apiKey, options)
          break
        case 'gemini':
          result = await callGemini(providerConfig.apiKey, options)
          break
        case 'ollama':
          result = await callOllama(providerConfig.apiKey, options)
          break
        default:
          continue
      }

      console.log(`[AI Call] Success with ${providerConfig.provider} for section: ${section}`)
      return { result, provider: providerConfig.provider }
    } catch (e: any) {
      lastError = e
      
      if (isQuotaError(e)) {
        lastQuotaError = e
        // Mark provider as quota exceeded (put in cooldown)
        // Only mark if it's a permanent quota error (not a temporary rate limit)
        markProviderQuotaExceeded(providerConfig.provider)
        console.warn(`[AI Call] Permanent quota error with ${providerConfig.provider} for section: ${section}, marked in cooldown. Trying next provider...`)
        continue // Try next provider
      } else {
        // Check if it's a temporary rate limit (retry in X seconds)
        const errorMessage = e?.message || String(e || '').toLowerCase()
        const retryMatch = errorMessage.match(/retry (?:in|after) (\d+(?:\.\d+)?)\s*(?:second|sec|s)/i)
        if (retryMatch) {
          const retrySeconds = parseFloat(retryMatch[1])
          console.warn(`[AI Call] Temporary rate limit with ${providerConfig.provider} for section: ${section}. Retry in ${retrySeconds}s. Trying next provider (not marking in cooldown)...`)
          // Don't mark in cooldown for temporary rate limits - they will resolve soon
          continue
        }
        
        // Non-quota error - log but continue to next provider
        console.warn(`[AI Call] Error with ${providerConfig.provider} for section: ${section}:`, e.message)
        continue
      }
    }
  }

  // All providers failed
  if (lastQuotaError) {
    const availableProviders = getAvailableProviders()
    if (availableProviders.length === 0) {
      // Check if the error mentions retry time (temporary rate limit)
      const errorMessage = lastQuotaError?.message || String(lastQuotaError || '')
      const retryMatch = errorMessage.match(/retry (?:in|after)\s+(\d+(?:\.\d+)?)\s*(?:second|sec|s)/i)
      
      if (retryMatch) {
        const retrySeconds = parseFloat(retryMatch[1])
        const retryMinutes = Math.ceil(retrySeconds / 60)
        throw new Error(`All AI providers are temporarily rate-limited. Please retry in ${retryMinutes} minute(s). This is a temporary limit that will reset automatically. Last error: ${lastQuotaError.message}`)
      }
      
      throw new Error(`All AI providers exceeded quota and are in cooldown. Please wait ${QUOTA_COOLDOWN_MS / 1000 / 60} minutes or add more API keys. Last error: ${lastQuotaError.message}`)
    }
    throw new Error(`All available AI providers exceeded quota. Last error: ${lastQuotaError.message}`)
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message || 'Unknown error'}`)
}
