import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse, validateRequired } from '../_utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('Organizations')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      // If organization doesn't exist, return null (not an error)
      if (error.code === 'PGRST116') {
        return successResponse(null)
      }
      throw new Error(`Failed to fetch organization: ${error.message}`)
    }
    return successResponse(data)
  } catch (e) {
    return errorResponse(e, 'Failed to load organization')
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const body = await req.json().catch(() => ({})) as {
      business_name?: string
      country?: string
    }

    // Validate required fields
    validateRequired(body, ['business_name'])

    const business_name = String(body.business_name).trim()
    const country = body.country ? String(body.country).trim() : null

    // Check if organization already exists
    const { data: existing } = await supabase
      .from('Organizations')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (existing) {
      // Update existing organization
      const { data, error } = await supabase
        .from('Organizations')
        .update({
          business_name,
          country,
        })
        .eq('user_id', userId)
        .select('*')
        .single()

      if (error) {
        throw new Error(`Failed to update organization: ${error.message}`)
      }
      return successResponse(data)
    } else {
      // Create new organization
      const { data, error } = await supabase
        .from('Organizations')
        .insert([{
          user_id: userId,
          business_name,
          country,
        }])
        .select('*')
        .single()

      if (error) {
        throw new Error(`Failed to create organization: ${error.message}`)
      }
      return successResponse(data, 201)
    }
  } catch (e) {
    return errorResponse(e, 'Failed to save organization')
  }
}
