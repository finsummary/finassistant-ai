import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

export const dynamic = 'force-dynamic'

/**
 * Delete saved budget from database
 */
export async function DELETE() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const { error } = await supabase
      .from('Budget')
      .delete()
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to delete budget: ${error.message}`)
    }

    return successResponse({ deleted: true, message: 'Budget deleted successfully' })
  } catch (e) {
    return errorResponse(e, 'Failed to delete budget')
  }
}
