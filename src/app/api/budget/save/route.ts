import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse, validateRequired } from '../../_utils'

export const dynamic = 'force-dynamic'

/**
 * Save budget to database
 */
export async function POST(req: Request) {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const body = await req.json().catch((e) => {
      console.error('[Budget Save] Failed to parse request body:', e)
      return {}
    }) as {
      horizon?: '6months' | 'yearend'
      forecastMonths?: string[]
      categoryGrowthRates?: Record<string, { incomeRate: number; expenseRate: number; lastValue: { income: number; expenses: number } }>
      budget?: Record<string, Record<string, { income: number; expenses: number }>>
    }

    console.log('[Budget Save] Request body:', {
      hasHorizon: !!body.horizon,
      hasForecastMonths: !!body.forecastMonths,
      forecastMonthsCount: body.forecastMonths?.length || 0,
      hasCategoryGrowthRates: !!body.categoryGrowthRates,
      hasBudget: !!body.budget,
    })

    // Validate required fields
    if (!body.horizon) {
      throw new Error('horizon is required')
    }
    if (!body.forecastMonths || !Array.isArray(body.forecastMonths)) {
      throw new Error('forecastMonths is required and must be an array')
    }
    if (!body.categoryGrowthRates) {
      throw new Error('categoryGrowthRates is required')
    }
    if (!body.budget) {
      throw new Error('budget is required')
    }

    // Check if budget already exists for this user
    const { data: existing, error: checkError } = await supabase
      .from('Budget')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (checkError) {
      console.error('[Budget Save] Error checking existing budget:', checkError)
      // If table doesn't exist, provide helpful error
      if (checkError.code === '42P01' || checkError.message?.includes('does not exist')) {
        throw new Error('Budget table does not exist. Please run the migration: 20251103000000_create_budget.sql')
      }
      throw new Error(`Failed to check existing budget: ${checkError.message}`)
    }

    const budgetData = {
      horizon: body.horizon,
      forecast_months: body.forecastMonths || [],
      category_growth_rates: body.categoryGrowthRates || {},
      budget_data: body.budget || {},
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      // Update existing budget
      console.log('[Budget Save] Updating existing budget:', existing.id)
      const { data, error } = await supabase
        .from('Budget')
        .update(budgetData)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('[Budget Save] Update error:', error)
        throw new Error(`Failed to update budget: ${error.message} (code: ${error.code})`)
      }

      console.log('[Budget Save] Budget updated successfully')
      return successResponse({ budget: data, message: 'Budget updated successfully' })
    } else {
      // Insert new budget
      console.log('[Budget Save] Inserting new budget for user:', userId)
      const { data, error } = await supabase
        .from('Budget')
        .insert({
          user_id: userId,
          ...budgetData,
        })
        .select()
        .single()

      if (error) {
        console.error('[Budget Save] Insert error:', error)
        // If table doesn't exist, provide helpful error
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          throw new Error('Budget table does not exist. Please run the migration: 20251103000000_create_budget.sql')
        }
        throw new Error(`Failed to save budget: ${error.message} (code: ${error.code})`)
      }

      console.log('[Budget Save] Budget saved successfully:', data?.id)
      return successResponse({ budget: data, message: 'Budget saved successfully' })
    }
  } catch (e) {
    return errorResponse(e, 'Failed to save budget')
  }
}
