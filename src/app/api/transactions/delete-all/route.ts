import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Delete all transactions for the current user
 */
export async function DELETE() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    // First, count transactions
    const { count } = await supabase
      .from('Transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Delete all transactions for this user
    const { error } = await supabase
      .from('Transactions')
      .delete()
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to delete transactions: ${error.message}`)
    }

    return successResponse({
      deleted: count || 0,
      message: `Deleted ${count || 0} transactions`
    })
  } catch (e) {
    return errorResponse(e, 'Failed to delete transactions')
  }
}
