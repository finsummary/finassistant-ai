import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

export const dynamic = 'force-dynamic'

/**
 * Clear categories using SQL RPC (bypasses REST API issues with null/empty updates)
 */
export async function POST() {
  try {
    const userId = await requireAuth()
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for clearing categories')
    }

    const admin = createAdminClient(url, serviceKey)

    // Use SQL to directly update - more reliable than REST API
    const { data, error } = await admin.rpc('exec_sql', {
      query: `UPDATE "Transactions" SET category = '' WHERE user_id = $1`,
      params: [userId]
    })

    if (error) {
      // Try direct SQL via PostgREST
      const { error: updateError } = await admin
        .from('Transactions')
        .update({ category: '' })
        .eq('user_id', userId)

      if (updateError) {
        console.error('[Clear Categories SQL] Update error:', updateError)
        throw new Error(`Failed to clear categories: ${updateError.message}`)
      }
    }

    // Verify by fetching count
    const { data: afterCheck, error: verifyError } = await admin
      .from('Transactions')
      .select('id, category')
      .eq('user_id', userId)
      .limit(20)

    if (verifyError) {
      console.error('[Clear Categories SQL] Verify error:', verifyError)
    }

    const clearedCount = afterCheck?.filter((t: any) => !t.category || t.category === '').length || 0
    const totalCount = afterCheck?.length || 0

    console.log(`[Clear Categories SQL] Cleared ${clearedCount} of ${totalCount} transactions`)

    return successResponse({
      cleared: clearedCount,
      total: totalCount,
      message: `Cleared categories from ${clearedCount} of ${totalCount} transactions`
    })
  } catch (e) {
    console.error('[Clear Categories SQL] Exception:', e)
    return errorResponse(e, 'Failed to clear categories')
  }
}
