import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse, validateRequired, validateNumber, validateDate } from '../_utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('PlannedExpenses')
      .select('*')
      .eq('user_id', userId)
      .order('expected_date', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch planned expenses: ${error.message}`)
    }
    return successResponse(data || [])
  } catch (e) {
    return errorResponse(e, 'Failed to load planned expense items')
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const body = await req.json().catch(() => ({})) as {
      description?: string
      amount?: number | string
      expected_date?: string
      recurrence?: 'one-off' | 'monthly'
    }

    // Validate required fields
    validateRequired(body, ['description', 'amount', 'expected_date'])

    const description = String(body.description).trim()
    const amount = validateNumber(body.amount, 'Amount', 0.01)
    const expected_date = validateDate(body.expected_date, 'Expected date')
    const recurrence = body.recurrence === 'monthly' ? 'monthly' : 'one-off'

    // Format date
    const dateObj = new Date(expected_date)
    const formattedDate = dateObj.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('PlannedExpenses')
      .insert([{
        user_id: userId,
        description,
        amount,
        expected_date: formattedDate,
        recurrence,
      }])
      .select('*')
      .single()

    if (error) {
      throw new Error(`Failed to create planned expense: ${error.message}`)
    }
    return successResponse(data, 201)
  } catch (e) {
    return errorResponse(e, 'Failed to create planned expense item')
  }
}
