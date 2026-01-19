import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

export const dynamic = 'force-dynamic'

/**
 * Clear categories from all user's transactions
 * Useful for re-categorization
 */
export async function POST() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()
    
    // Use service role key if available (bypasses RLS)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const client = serviceKey ? createAdminClient(url, serviceKey) : supabase

    // First, check how many transactions we have for this user
    const { data: beforeCheck, error: checkError } = await client
      .from('Transactions')
      .select('id, category, user_id')
      .eq('user_id', userId)

    if (checkError) {
      throw new Error(`Failed to check transactions: ${checkError.message}`)
    }

    console.log(`[Clear Categories] User ${userId} has ${beforeCheck?.length || 0} transactions`)
    console.log(`[Clear Categories] Sample categories:`, beforeCheck?.slice(0, 5).map((t: any) => t.category))
    console.log(`[Clear Categories] Using ${serviceKey ? 'service_role' : 'anon'} client`)

    // Try using SQL function first (more reliable)
    let clearedCount = 0
    try {
      const { data: rpcResult, error: rpcError } = await client.rpc('clear_user_transaction_categories', {
        target_user_id: userId
      })
      
      if (!rpcError && rpcResult !== null && rpcResult !== undefined) {
        clearedCount = Number(rpcResult) || 0
        console.log(`[Clear Categories] SQL function cleared ${clearedCount} transactions`)
      } else {
        console.log(`[Clear Categories] SQL function not available, using direct UPDATE:`, rpcError?.message)
        // Fallback to direct UPDATE if function doesn't exist
        const { error: updateError } = await client
          .from('Transactions')
          .update({ category: '' })
          .eq('user_id', userId)
        
        if (updateError) {
          throw new Error(`Failed to clear categories: ${updateError.message}`)
        }
      }
    } catch (rpcException: any) {
      // If RPC function doesn't exist, fall back to direct UPDATE
      console.log(`[Clear Categories] SQL function not available (${rpcException.message}), using direct UPDATE`)
      const { error: updateError } = await client
        .from('Transactions')
        .update({ category: '' })
        .eq('user_id', userId)
      
      if (updateError) {
        throw new Error(`Failed to clear categories: ${updateError.message}`)
      }
    }

    // Fetch updated data to verify
    const { data, error } = await client
      .from('Transactions')
      .select('id, category')
      .eq('user_id', userId)
      .limit(20)

    if (error) {
      console.error('[Clear Categories] Update error:', error)
      throw new Error(`Failed to clear categories: ${error.message}`)
    }

    console.log(`[Clear Categories] Updated ${data?.length || 0} transactions`)
    console.log(`[Clear Categories] Sample after update:`, data?.slice(0, 5).map((t: any) => ({ id: t.id, category: t.category })))

    // Verify the update worked
    const { data: afterCheck, error: verifyError } = await client
      .from('Transactions')
      .select('id, category')
      .eq('user_id', userId)
      .limit(10)

    if (verifyError) {
      console.error('[Clear Categories] Verify error:', verifyError)
    } else {
      const nullCount = afterCheck?.filter((t: any) => !t.category || t.category === null || t.category === '').length || 0
      console.log(`[Clear Categories] Verification: ${nullCount} of ${afterCheck?.length || 0} transactions now have null/empty category`)
    }

    return successResponse({
      cleared: data?.length || 0,
      message: `Cleared categories from ${data?.length || 0} transactions`,
      verified: afterCheck?.filter((t: any) => !t.category || t.category === null || t.category === '').length || 0
    })
  } catch (e) {
    console.error('[Clear Categories] Exception:', e)
    return errorResponse(e, 'Failed to clear categories')
  }
}
