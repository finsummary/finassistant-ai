import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'
import { calculateTrajectory } from '../_utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const data = await calculateTrajectory(supabase, userId)

    return successResponse(data)
  } catch (e) {
    return errorResponse(e, 'Failed to calculate trajectory data')
  }
}
