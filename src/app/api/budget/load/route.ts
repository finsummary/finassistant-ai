import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

export const dynamic = 'force-dynamic'

/**
 * Load saved budget from database
 */
export async function GET() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const { data: budget, error } = await supabase
      .from('Budget')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - return null
        return successResponse({ budget: null, message: 'No budget found' })
      }
      throw new Error(`Failed to load budget: ${error.message}`)
    }

    // Get Planned Income and Expenses to merge with saved budget
    const { data: plannedIncome, error: piError } = await supabase
      .from('PlannedIncome')
      .select('*')
      .eq('user_id', userId)

    if (piError) {
      console.warn('[Budget Load] Failed to fetch planned income:', piError)
    } else {
      console.log('[Budget Load] Planned Income loaded:', plannedIncome?.length || 0, 'items')
    }

    const { data: plannedExpenses, error: peError } = await supabase
      .from('PlannedExpenses')
      .select('*')
      .eq('user_id', userId)

    if (peError) {
      console.warn('[Budget Load] Failed to fetch planned expenses:', peError)
    } else {
      console.log('[Budget Load] Planned Expenses loaded:', plannedExpenses?.length || 0, 'items')
    }

    // Transform database format to API format
    const budgetData = {
      horizon: budget.horizon,
      forecastMonths: budget.forecast_months || [],
      categoryGrowthRates: budget.category_growth_rates || {},
      budget: budget.budget_data || {},
      historicalMonths: [], // Not stored, will be empty
      generatedAt: budget.updated_at || budget.created_at,
    }

    // Merge Planned Items into budget for each forecast month
    const mergedBudget = { ...budgetData.budget }
    budgetData.forecastMonths.forEach(month => {
      // Parse month key (YYYY-MM) to Date for comparison
      const [year, monthNum] = month.split('-').map(Number)
      const forecastDate = new Date(year, monthNum - 1, 1)
      
      // Add Planned Income for this month
      let plannedIncomeForMonth = 0
      plannedIncome?.forEach((pi: any) => {
        const piDate = new Date(pi.expected_date)
        const amount = Number(pi.amount || 0)
        
        if (pi.recurrence === 'monthly') {
          // Monthly: add to all forecast months (starting from expected_date month)
          if (forecastDate >= new Date(piDate.getFullYear(), piDate.getMonth(), 1)) {
            plannedIncomeForMonth += amount
          }
        } else if (pi.recurrence === 'one-off') {
          // One-off: only add if the month matches exactly
          if (piDate.getFullYear() === forecastDate.getFullYear() &&
              piDate.getMonth() === forecastDate.getMonth()) {
            plannedIncomeForMonth += amount
          }
        }
      })

      // Add Planned Expenses for this month
      let plannedExpensesForMonth = 0
      plannedExpenses?.forEach((pe: any) => {
        const peDate = new Date(pe.expected_date)
        const amount = Number(pe.amount || 0)
        
        if (pe.recurrence === 'monthly') {
          // Monthly: add to all forecast months (starting from expected_date month)
          if (forecastDate >= new Date(peDate.getFullYear(), peDate.getMonth(), 1)) {
            plannedExpensesForMonth += amount
          }
        } else if (pe.recurrence === 'one-off') {
          // One-off: only add if the month matches exactly
          if (peDate.getFullYear() === forecastDate.getFullYear() &&
              peDate.getMonth() === forecastDate.getMonth()) {
            plannedExpensesForMonth += amount
          }
        }
      })

      // Add planned items to budget
      if (plannedIncomeForMonth > 0 || plannedExpensesForMonth > 0) {
        if (!mergedBudget[month]) {
          mergedBudget[month] = {}
        }
        if (!mergedBudget[month]['Planned Items']) {
          mergedBudget[month]['Planned Items'] = { income: 0, expenses: 0 }
        }
        mergedBudget[month]['Planned Items'].income += plannedIncomeForMonth
        mergedBudget[month]['Planned Items'].expenses += plannedExpensesForMonth
        console.log(`[Budget Load] Added Planned Items for ${month}: income=${plannedIncomeForMonth}, expenses=${plannedExpensesForMonth}`)
      }
    })

    budgetData.budget = mergedBudget

    console.log('[Budget Load] Loaded budget:', {
      horizon: budgetData.horizon,
      forecastMonthsCount: budgetData.forecastMonths.length,
      categoriesCount: Object.keys(budgetData.categoryGrowthRates).length,
      budgetMonthsCount: Object.keys(budgetData.budget).length,
    })

    return successResponse({ budget: budgetData, message: 'Budget loaded successfully' })
  } catch (e) {
    return errorResponse(e, 'Failed to load budget')
  }
}
