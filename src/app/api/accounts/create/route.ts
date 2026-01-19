import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse, validateRequired, ApiError } from '../../_utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const body = await req.json().catch(() => ({})) as { name?: string; currency?: string }
    
    // Validate required fields
    validateRequired(body, ['name', 'currency'])
    
    const name = String(body.name).trim()
    const currency = String(body.currency).trim().toUpperCase()
    
    // Validate currency format (3 uppercase letters)
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new ApiError('Currency must be a 3-letter code (e.g., USD, EUR, GBP)', 400, 'VALIDATION_ERROR')
    }

    // Generate unique ID for manual account
    const accountId = `manual_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const { data, error } = await supabase
      .from('BankAccounts')
      .insert([{ 
        id: accountId,
        provider: 'Manual', 
        account_name: name, 
        currency,
        user_id: userId,
      }])
      .select('*')
      .single()
    
    if (error) {
      throw new Error(`Failed to create account: ${error.message}`)
    }

    return successResponse({ account: data }, 201)
  } catch (e) {
    return errorResponse(e, 'Failed to create bank account')
  }
}


