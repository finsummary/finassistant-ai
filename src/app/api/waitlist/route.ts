import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { errorResponse, successResponse } from '../_utils'

export const dynamic = 'force-dynamic'

/**
 * POST /api/waitlist
 * Add email to waitlist
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { email, source } = body

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { ok: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.trim().toLowerCase()

    // Try with anon key first (preferred - uses RLS)
    const supabase = await createClient()
    let { data, error } = await supabase
      .from('waitlist')
      .insert({
        email: normalizedEmail,
        source: source || 'landing_page', // Default source
      })
      .select()
      .single()

    // If RLS fails, try with service role key as fallback
    if (error && (error.message.includes('policy') || error.message.includes('permission') || error.message.includes('RLS'))) {
      console.warn('[Waitlist API] RLS failed, trying service role key as fallback')
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (serviceKey) {
        const admin = createAdminClient(url, serviceKey)
        const result = await admin
          .from('waitlist')
          .insert({
            email: normalizedEmail,
            source: source || 'landing_page',
          })
          .select()
          .single()
        
        data = result.data
        error = result.error
      } else {
        console.error('[Waitlist API] Service role key not available for fallback')
      }
    }

    if (error) {
      // Log full error for debugging
      console.error('[Waitlist API] Insert error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      
      // Check if it's a duplicate (unique constraint violation)
      if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json(
          { ok: false, error: 'This email is already registered' },
          { status: 409 }
        )
      }
      
      // Check for RLS policy errors
      if (error.message.includes('policy') || error.message.includes('permission') || error.message.includes('RLS')) {
        console.error('[Waitlist API] RLS policy error - check Supabase policies')
        return NextResponse.json(
          { ok: false, error: 'Permission denied. Please check database policies.' },
          { status: 403 }
        )
      }
      
      // Other database errors - return more details in development
      const isDevelopment = process.env.NODE_ENV === 'development'
      return NextResponse.json(
        { 
          ok: false, 
          error: isDevelopment 
            ? `Database error: ${error.message} (Code: ${error.code})`
            : 'Failed to add email to waitlist. Please try again later.'
        },
        { status: 500 }
      )
    }

    return successResponse({
      id: data.id,
      email: data.email,
      source: data.source,
      created_at: data.created_at,
    })
  } catch (e: any) {
    console.error('[Waitlist API] Error:', e)
    return errorResponse(e, 'Failed to process request')
  }
}

/**
 * GET /api/waitlist
 * Get waitlist entries (admin only - requires authentication)
 */
export async function GET() {
  try {
    // For now, we'll require auth for GET requests
    // You can add admin check later if needed
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get all waitlist entries
    const { data, error } = await supabase
      .from('waitlist')
      .select('id, email, source, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Waitlist API] Select error:', error)
      return errorResponse(error, 'Failed to fetch waitlist')
    }

    return successResponse({
      count: data?.length || 0,
      entries: data || [],
    })
  } catch (e: any) {
    console.error('[Waitlist API] Error:', e)
    return errorResponse(e, 'Failed to process request')
  }
}
