import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse, validateNumber, validateDate, ApiError } from '../../_utils'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const body = await req.json().catch(() => null) as {
      description?: string
      amount?: number | string
      expected_date?: string
      recurrence?: 'one-off' | 'monthly'
    } | null

    const updates: any = {}
    if (body?.description !== undefined) {
      const desc = String(body.description).trim()
      if (!desc) throw new ApiError('Description cannot be empty', 400, 'VALIDATION_ERROR')
      updates.description = desc
    }
    if (body?.amount !== undefined) {
      updates.amount = validateNumber(body.amount, 'Amount', 0.01)
    }
    if (body?.expected_date !== undefined) {
      updates.expected_date = validateDate(body.expected_date, 'Expected date')
      const dateObj = new Date(updates.expected_date)
      updates.expected_date = dateObj.toISOString().slice(0, 10)
    }
    if (body?.recurrence !== undefined) {
      updates.recurrence = body.recurrence === 'monthly' ? 'monthly' : 'one-off'
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError('No fields to update', 400, 'VALIDATION_ERROR')
    }

    const { data, error } = await supabase
      .from('PlannedExpenses')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) {
      throw new Error(`Failed to update planned expense: ${error.message}`)
    }
    if (!data) {
      throw new ApiError('Planned expense item not found', 404, 'NOT_FOUND')
    }
    return successResponse(data)
  } catch (e) {
    return errorResponse(e, 'Failed to update planned expense item')
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const { error } = await supabase
      .from('PlannedExpenses')
      .delete()
      .eq('id', params.id)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to delete planned expense: ${error.message}`)
    }
    return successResponse({ deleted: true })
  } catch (e) {
    return errorResponse(e, 'Failed to delete planned expense item')
  }
}
