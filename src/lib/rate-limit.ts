/**
 * Simple rate limiting utility
 * 
 * This is a basic in-memory rate limiter for MVP.
 * For production, consider using Redis or a dedicated service.
 */

type RateLimitStore = {
  [key: string]: {
    count: number
    resetAt: number
  }
}

const store: RateLimitStore = {}

/**
 * Check if request should be rate limited
 * 
 * @param identifier - Unique identifier (e.g., user ID, IP address)
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if request should be allowed, false if rate limited
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute default
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const key = identifier
  const record = store[key]

  // No record or window expired - allow request
  if (!record || now > record.resetAt) {
    store[key] = {
      count: 1,
      resetAt: now + windowMs,
    }
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    }
  }

  // Within window - check count
  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
    }
  }

  // Increment count
  record.count++
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt,
  }
}

/**
 * Clear rate limit for an identifier (useful for testing)
 */
export function clearRateLimit(identifier: string): void {
  delete store[identifier]
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  Object.keys(store).forEach(key => delete store[key])
}
