import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Get authenticated user ID from session
 * Returns null if not authenticated
 */
export async function getUserId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user?.id || null
  } catch (e) {
    return null
  }
}

/**
 * Ensure user is authenticated
 * Returns user ID or throws error response
 */
export async function requireAuth(): Promise<string> {
  const userId = await getUserId()
  if (!userId) {
    throw new ApiError('Authentication required', 401)
  }
  return userId
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Standardized error response handler
 */
export function errorResponse(error: unknown, defaultMessage: string = 'An error occurred'): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    )
  }

  if (error instanceof Error) {
    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development'
    return NextResponse.json(
      {
        ok: false,
        error: isDevelopment ? error.message : defaultMessage,
      },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      ok: false,
      error: defaultMessage,
    },
    { status: 500 }
  )
}

/**
 * Standardized success response
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    { status }
  )
}

/**
 * Validate required fields in request body
 */
export function validateRequired(body: Record<string, any>, fields: string[]): void {
  const missing = fields.filter(field => {
    const value = body[field]
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
  })

  if (missing.length > 0) {
    throw new ApiError(
      `Missing required fields: ${missing.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    )
  }
}

/**
 * Validate numeric field
 */
export function validateNumber(value: any, fieldName: string, min?: number, max?: number): number {
  const num = Number(value)
  if (isNaN(num)) {
    throw new ApiError(`${fieldName} must be a valid number`, 400, 'VALIDATION_ERROR')
  }
  if (min !== undefined && num < min) {
    throw new ApiError(`${fieldName} must be at least ${min}`, 400, 'VALIDATION_ERROR')
  }
  if (max !== undefined && num > max) {
    throw new ApiError(`${fieldName} must be at most ${max}`, 400, 'VALIDATION_ERROR')
  }
  return num
}

/**
 * Validate date field
 */
export function validateDate(value: any, fieldName: string): string {
  const dateStr = String(value).trim()
  if (!dateStr) {
    throw new ApiError(`${fieldName} is required`, 400, 'VALIDATION_ERROR')
  }
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new ApiError(`${fieldName} must be a valid date`, 400, 'VALIDATION_ERROR')
  }
  return dateStr
}
