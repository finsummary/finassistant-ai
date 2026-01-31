/**
 * Simple in-memory cache for AI analysis results
 * Reduces API calls to Gemini/OpenAI by caching results for a short period
 */

interface CacheEntry {
  data: any
  timestamp: number
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

// Cache TTL: 7 days (604800000 ms) - analysis only refreshes when user explicitly requests it
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000

/**
 * Generate cache key from user ID and section name
 */
function getCacheKey(userId: string, section: string): string {
  return `ai-analysis:${userId}:${section}`
}

/**
 * Get cached analysis result
 */
export function getCachedAnalysis(userId: string, section: string): any | null {
  const key = getCacheKey(userId, section)
  const entry = cache.get(key)

  if (!entry) {
    return null
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }

  return entry.data
}

/**
 * Store analysis result in cache
 */
export function setCachedAnalysis(userId: string, section: string, data: any): void {
  const key = getCacheKey(userId, section)
  const now = Date.now()

  cache.set(key, {
    data,
    timestamp: now,
    expiresAt: now + CACHE_TTL,
  })
}

/**
 * Clear cache for a specific user and section
 */
export function clearCachedAnalysis(userId: string, section: string): void {
  const key = getCacheKey(userId, section)
  cache.delete(key)
}

/**
 * Clear all cache entries for a specific user
 */
export function clearUserCache(userId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`ai-analysis:${userId}:`)) {
      cache.delete(key)
    }
  }
}

/**
 * Clear all cache entries (for testing/debugging)
 */
export function clearAllCache(): void {
  cache.clear()
}

/**
 * Clean up expired entries (should be called periodically)
 * Only cleans entries older than 30 days to prevent memory leaks
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now()
  const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days
  for (const [key, entry] of cache.entries()) {
    // Only remove entries older than 30 days (not just expired ones)
    if (now - entry.timestamp > maxAge) {
      cache.delete(key)
    }
  }
}

// Clean up very old entries every hour (only entries older than 30 days)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 60 * 60 * 1000)
}
