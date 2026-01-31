import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

// Allow caching for better performance
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

    // Get Planned Income and Expenses in parallel
    const [plannedIncomeResult, plannedExpensesResult] = await Promise.all([
      supabase.from('PlannedIncome').select('*').eq('user_id', userId),
      supabase.from('PlannedExpenses').select('*').eq('user_id', userId)
    ])

    const plannedIncome = plannedIncomeResult.data
    const plannedExpenses = plannedExpensesResult.data

    // Transform database format to API format
    const budgetData = {
      horizon: budget.horizon,
      forecastMonths: budget.forecast_months || [],
      categoryGrowthRates: budget.category_growth_rates || {},
      budget: budget.budget_data || {},
      historicalMonths: [], // Not stored, will be empty
      generatedAt: budget.updated_at || budget.created_at,
    }

    // Always recalculate Planned Items from current PlannedIncome and PlannedExpenses tables
    // This ensures that deleted/updated planned items are reflected in the budget
    // Also validate and clean budget data to remove unreasonable values
    const mergedBudget: Record<string, Record<string, { income: number; expenses: number }>> = {}
    const maxValue = 1e9 // 1 billion max per category per month
    
    // Clean and validate existing budget data
    Object.keys(budgetData.budget || {}).forEach(month => {
      mergedBudget[month] = {}
      const monthData = budgetData.budget[month]
      
      Object.keys(monthData || {}).forEach(category => {
        const catData = monthData[category]
        if (catData && typeof catData === 'object') {
          const income = typeof catData.income === 'number' && !isNaN(catData.income) && isFinite(catData.income)
            ? Math.max(0, Math.min(catData.income, maxValue))
            : 0
          const expenses = typeof catData.expenses === 'number' && !isNaN(catData.expenses) && isFinite(catData.expenses)
            ? Math.max(0, Math.min(catData.expenses, maxValue))
            : 0
          
          if (catData.income > maxValue || catData.expenses > maxValue) {
            console.error(`[Budget Load] Capped large values for ${category} in ${month}: original income=${catData.income}, expenses=${catData.expenses}`)
          }
          
          mergedBudget[month][category] = { income, expenses }
        }
      })
    })
    
    budgetData.forecastMonths.forEach(month => {
      // Parse month key (YYYY-MM) to Date for comparison
      const [year, monthNum] = month.split('-').map(Number)
      const forecastDate = new Date(year, monthNum - 1, 1)
      
      // Calculate Planned Income for this month from current PlannedIncome table
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

      // Calculate Planned Expenses for this month from current PlannedExpenses table
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

      // Always update Planned Items in budget (remove old values if no planned items exist)
      if (!mergedBudget[month]) {
        mergedBudget[month] = {}
      }
      
      if (plannedIncomeForMonth > 0 || plannedExpensesForMonth > 0) {
        mergedBudget[month]['Planned Items'] = { income: plannedIncomeForMonth, expenses: plannedExpensesForMonth }
      } else {
        // Remove Planned Items if none exist for this month
        delete mergedBudget[month]['Planned Items']
      }
    })

    budgetData.budget = mergedBudget

    return successResponse({ budget: budgetData, message: 'Budget loaded successfully' })
  } catch (e) {
    return errorResponse(e, 'Failed to load budget')
  }
}
