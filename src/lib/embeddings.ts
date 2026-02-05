/**
 * Utility for generating text embeddings
 * Supports multiple providers with automatic fallback
 * Used for vector database similarity search
 */

/**
 * Generate embedding using OpenAI
 */
async function generateEmbeddingOpenAI(text: string): Promise<number[]> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not set')
  }

  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small', // 1536 dimensions
      input: text,
    }),
  })

  const data = await resp.json()
  
  if (!resp.ok) {
    throw new Error(data.error?.message || `OpenAI API error: ${resp.statusText}`)
  }

  if (!data.data || !data.data[0] || !data.data[0].embedding) {
    throw new Error('Invalid response format from OpenAI embeddings API')
  }

  return data.data[0].embedding
}

/**
 * Generate embedding using Gemini (if available)
 * Note: Gemini doesn't have a dedicated embedding API, but we can use text-embedding-004
 */
async function generateEmbeddingGemini(text: string): Promise<number[]> {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY not set')
  }

  // Try using Gemini's embedding model (if available)
  // Note: Gemini may not have a direct embedding API, this is a placeholder
  // For now, we'll skip Gemini and use other alternatives
  throw new Error('Gemini embedding API not available - use Hugging Face or Cohere instead')
}

/**
 * Generate embedding using Cohere (free tier available)
 */
async function generateEmbeddingCohere(text: string): Promise<number[]> {
  const cohereKey = process.env.COHERE_API_KEY
  if (!cohereKey) {
    throw new Error('COHERE_API_KEY not set')
  }

  const resp = await fetch('https://api.cohere.ai/v1/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cohereKey}`,
    },
    body: JSON.stringify({
      model: 'embed-english-v3.0', // 1024 dimensions, free tier available
      texts: [text],
      input_type: 'search_document',
    }),
  })

  const data = await resp.json()
  
  if (!resp.ok) {
    throw new Error(data.message || `Cohere API error: ${resp.statusText}`)
  }

  if (!data.embeddings || !Array.isArray(data.embeddings) || data.embeddings.length === 0) {
    throw new Error('Invalid response format from Cohere API')
  }

  // Cohere returns 1024 dimensions, we need to pad to 1536 for compatibility
  const embedding = data.embeddings[0]
  // Pad with zeros to match OpenAI's 1536 dimensions
  while (embedding.length < 1536) {
    embedding.push(0)
  }
  return embedding.slice(0, 1536) // Ensure exactly 1536 dimensions
}

/**
 * Generate embedding using Hugging Face Inference API (free, no API key needed)
 * Note: This uses a different model, so dimensions differ - we'll pad to 1536
 */
async function generateEmbeddingHuggingFace(text: string): Promise<number[]> {
  // Try multiple Hugging Face endpoints
  const endpoints = [
    'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
    'https://router.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
    'https://huggingface.co/api/models/sentence-transformers/all-MiniLM-L6-v2',
  ]

  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: true },
        }),
      })

      if (resp.ok) {
        const embedding = await resp.json()
        
        if (!Array.isArray(embedding) || embedding.length === 0) {
          continue // Try next endpoint
        }

        const embeddingVector = Array.isArray(embedding[0]) ? embedding[0] : embedding
        
        // Hugging Face returns 384 dimensions, we need to pad to 1536 for compatibility
        // Pad with zeros to match OpenAI's 1536 dimensions
        while (embeddingVector.length < 1536) {
          embeddingVector.push(0)
        }
        return embeddingVector.slice(0, 1536) // Ensure exactly 1536 dimensions
      }
    } catch (error: any) {
      // Try next endpoint
      continue
    }
  }

  throw new Error('All Hugging Face endpoints failed. Hugging Face API may have changed or requires authentication.')
}

/**
 * Generate embedding using Ollama (local, free)
 * Requires Ollama to be running locally with an embedding model
 */
async function generateEmbeddingOllama(text: string): Promise<number[]> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  
  // Try to use Ollama's embedding model (if available)
  // Note: Ollama doesn't have a standard embedding API, this is experimental
  // We'll use a text generation model and extract features, but this is not ideal
  // For now, skip Ollama for embeddings as it's not designed for this
  throw new Error('Ollama embedding API not implemented - Ollama is for text generation, not embeddings')
}

/**
 * Generate embedding vector for a given text with automatic fallback
 * Priority: Cohere (if available) > Hugging Face (free) > OpenAI (if quota available)
 * @param text - The text to generate embedding for
 * @returns Array of numbers representing the embedding vector (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const errors: string[] = []

  // Try Cohere first (free tier, good quality, 1024 dims - we pad to 1536)
  const cohereKey = process.env.COHERE_API_KEY
  if (cohereKey) {
    try {
      console.log('[Embeddings] Trying Cohere...')
      return await generateEmbeddingCohere(text)
    } catch (error: any) {
      errors.push(`Cohere: ${error.message}`)
      console.warn(`[Embeddings] Cohere failed: ${error.message}`)
    }
  }

  // Try Hugging Face (free, no API key needed, 384 dims - we pad to 1536)
  try {
    console.log('[Embeddings] Trying Hugging Face (free)...')
    return await generateEmbeddingHuggingFace(text)
  } catch (error: any) {
    errors.push(`Hugging Face: ${error.message}`)
    console.warn(`[Embeddings] Hugging Face failed: ${error.message}`)
  }

  // Try OpenAI as last resort (best quality, but may have quota issues)
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      console.log('[Embeddings] Trying OpenAI...')
      return await generateEmbeddingOpenAI(text)
    } catch (error: any) {
      errors.push(`OpenAI: ${error.message}`)
      console.warn(`[Embeddings] OpenAI failed: ${error.message}`)
    }
  }

  throw new Error(`Failed to generate embedding with all providers:\n${errors.join('\n')}\n\nSuggestions:\n1. Get a free Cohere API key: https://cohere.com\n2. Wait for OpenAI quota to reset\n3. Use a local embedding model via Ollama (requires setup)`)
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to generate embeddings for
 * @returns Array of embedding vectors
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not set. Required for generating embeddings.')
  }

  if (texts.length === 0) {
    return []
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
      }),
    })

    const data = await resp.json()
    
    if (!resp.ok) {
      throw new Error(data.error?.message || `OpenAI API error: ${resp.statusText}`)
    }

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from OpenAI embeddings API')
    }

    return data.data.map((item: any) => item.embedding)
  } catch (error: any) {
    if (error.message.includes('OPENAI_API_KEY')) {
      throw error
    }
    throw new Error(`Failed to generate embeddings batch: ${error.message}`)
  }
}
