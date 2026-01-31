/**
 * AI Provider utility - handles multiple AI providers with automatic fallback
 * Supports: OpenAI, Gemini, Claude (Anthropic), Groq (free open-source models), Ollama (local)
 */

export type AIProvider = 'openai' | 'gemini' | 'claude' | 'groq' | 'ollama'

export interface AIProviderConfig {
  provider: AIProvider
  apiKey: string
  priority: number // Lower number = higher priority
}

/**
 * In-memory cache for quota errors - temporarily disable providers that exceeded quota
 * Key: provider name, Value: timestamp when quota was exceeded
 */
const quotaErrorCache = new Map<AIProvider, number>()

/**
 * Quota error cooldown period: 5 minutes (providers are disabled for 5 minutes after quota error)
 * This allows for temporary rate limits to expire while preventing excessive retries
 */
const QUOTA_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Check if provider is in cooldown (recently exceeded quota)
 */
export function isProviderInCooldown(provider: AIProvider): boolean {
  const cooldownUntil = quotaErrorCache.get(provider)
  if (!cooldownUntil) return false
  
  if (Date.now() < cooldownUntil) {
    return true // Still in cooldown
  } else {
    // Cooldown expired, remove from cache
    quotaErrorCache.delete(provider)
    return false
  }
}

/**
 * Mark provider as having exceeded quota (put in cooldown)
 */
export function markProviderQuotaExceeded(provider: AIProvider): void {
  quotaErrorCache.set(provider, Date.now() + QUOTA_COOLDOWN_MS)
  const retryTime = new Date(Date.now() + QUOTA_COOLDOWN_MS).toLocaleTimeString()
  console.warn(`[AI Provider] ${provider} marked as quota exceeded. Will retry after ${retryTime} (${QUOTA_COOLDOWN_MS / 1000 / 60} minutes)`)
}

/**
 * Clear cooldown for a provider (for testing)
 */
export function clearProviderCooldown(provider: AIProvider): void {
  quotaErrorCache.delete(provider)
}

/**
 * Clear cooldown for all providers (useful for testing or manual reset)
 */
export function clearAllCooldowns(): void {
  quotaErrorCache.clear()
  console.log('[AI Provider] All provider cooldowns cleared')
}

/**
 * Get available AI providers in priority order
 * Excludes providers that are in cooldown (recently exceeded quota)
 * Respects AI_PROVIDER env var if set (puts preferred provider first)
 */
export function getAvailableProviders(): AIProviderConfig[] {
  const providers: AIProviderConfig[] = []

  // OpenAI (highest priority if available and not in cooldown)
  if (process.env.OPENAI_API_KEY && !isProviderInCooldown('openai')) {
    providers.push({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      priority: 1,
    })
  }

  // Claude (Anthropic) - second priority
  if (process.env.ANTHROPIC_API_KEY && !isProviderInCooldown('claude')) {
    providers.push({
      provider: 'claude',
      apiKey: process.env.ANTHROPIC_API_KEY,
      priority: 2,
    })
  }

  // Groq - free open-source models (Llama 3, Mistral, etc.) - priority 3
  if (process.env.GROQ_API_KEY && !isProviderInCooldown('groq')) {
    providers.push({
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY,
      priority: 3,
    })
  }

  // Gemini - priority 4 (free tier has strict limits)
  if (process.env.GEMINI_API_KEY && !isProviderInCooldown('gemini')) {
    providers.push({
      provider: 'gemini',
      apiKey: process.env.GEMINI_API_KEY,
      priority: 4,
    })
  }

  // Ollama - local open-source models - priority 5 (lowest, requires local setup)
  if (process.env.OLLAMA_BASE_URL && !isProviderInCooldown('ollama')) {
    providers.push({
      provider: 'ollama',
      apiKey: process.env.OLLAMA_BASE_URL, // Using base URL as "key"
      priority: 5,
    })
  }

  // Sort by priority
  let sortedProviders = providers.sort((a, b) => a.priority - b.priority)

  // If AI_PROVIDER is set and that provider is available, move it to the front
  // Check AI_PROVIDER directly to avoid circular dependency with getPreferredProvider()
  const envProvider = process.env.AI_PROVIDER?.toLowerCase()
  if (envProvider && ['openai', 'gemini', 'claude', 'groq', 'ollama'].includes(envProvider)) {
    const preferredProvider = envProvider as AIProvider
    const preferredIndex = sortedProviders.findIndex(p => p.provider === preferredProvider)
    if (preferredIndex > 0) {
      // Move preferred provider to the front
      const preferred = sortedProviders[preferredIndex]
      sortedProviders = [preferred, ...sortedProviders.filter(p => p.provider !== preferredProvider)]
    }
  }

  return sortedProviders
}

/**
 * Check if a specific provider is available
 */
export function isProviderAvailable(provider: AIProvider): boolean {
  switch (provider) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'claude':
      return !!process.env.ANTHROPIC_API_KEY
    case 'groq':
      return !!process.env.GROQ_API_KEY
    case 'gemini':
      return !!process.env.GEMINI_API_KEY
    case 'ollama':
      return !!process.env.OLLAMA_BASE_URL
    default:
      return false
  }
}

/**
 * Get the preferred provider based on environment variable or default
 */
export function getPreferredProvider(): AIProvider | null {
  const envProvider = process.env.AI_PROVIDER?.toLowerCase()
  if (envProvider && ['openai', 'gemini', 'claude', 'groq', 'ollama'].includes(envProvider)) {
    if (isProviderAvailable(envProvider as AIProvider)) {
      return envProvider as AIProvider
    }
  }

  // Default priority: OpenAI > Claude > Gemini
  const available = getAvailableProviders()
  return available.length > 0 ? available[0].provider : null
}

/**
 * Check if error is a quota/rate limit error
 * Returns true only for permanent quota errors (not temporary rate limits with retry time)
 */
export function isQuotaError(error: any): boolean {
  const errorMessage = error?.message || error?.error?.message || String(error || '').toLowerCase()
  
  // Check for daily quota exceeded (Gemini free tier: 20 requests/day)
  // These errors typically say "quota exceeded" without a retry time, or mention "daily" limit
  const isDailyQuota = (
    errorMessage.includes('daily') ||
    errorMessage.includes('per day') ||
    errorMessage.includes('rpd') || // Requests Per Day
    (errorMessage.includes('quota exceeded') && errorMessage.includes('limit: 20'))
  )
  
  if (isDailyQuota) {
    console.log(`[AI Provider] Detected daily quota exceeded - marking as quota error (will reset at midnight PST)`)
    return true // Daily quota exceeded - put in cooldown until next day
  }
  
  // First check: If error mentions "retry in" or "retry after" with a time,
  // it's a temporary rate limit, NOT a permanent quota error
  // Don't put provider in cooldown for these - let it retry naturally
  // Match patterns like: "retry in 39.140797526s", "retry after 60 seconds", "Please retry in 48.011067957s"
  const retryMatch = errorMessage.match(/retry (?:in|after)\s+(\d+(?:\.\d+)?)\s*(?:second|sec|s)/i)
  if (retryMatch) {
    const retrySeconds = parseFloat(retryMatch[1])
    // If retry time is less than 10 minutes, it's a temporary rate limit
    if (retrySeconds < 600) { // Less than 10 minutes
      console.log(`[AI Provider] Detected temporary rate limit with retry in ${retrySeconds}s - NOT marking as quota error`)
      return false // Temporary rate limit, not a quota error - don't cooldown
    }
  }
  
  // Check for quota/rate limit keywords
  const isQuotaRelated = (
    errorMessage.includes('quota') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('rate_limit') ||
    errorMessage.includes('429') ||
    errorMessage.includes('exceeded')
  )
  
  if (!isQuotaRelated) {
    return false
  }
  
  // If we got here and it's quota-related but has no retry time,
  // or retry time is very long (> 10 minutes), it's a permanent quota error
  console.log(`[AI Provider] Detected permanent quota error (no retry time or retry > 10min) - marking as quota error`)
  return true // Permanent quota error - put in cooldown
}
