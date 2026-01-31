import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

// Allow caching for better performance
export const dynamic = 'force-dynamic'

/**
 * Budget Variance Analysis - Compare actual transactions with budget
 * Returns plan vs actual comparison with variance calculations
 */
export async function GET() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Get primary currency from bank accounts (use first account's currency, or default to GBP)
    const { data: accounts } = await supabase
      .from('BankAccounts')
      .select('currency')
      .eq('user_id', userId)
      .limit(1)
    
    const primaryCurrency = accounts?.[0]?.currency || 'GBP'

    // Load saved budget
    const { data: savedBudget, error: budgetError } = await supabase
      .from('Budget')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (budgetError || !savedBudget) {
      return successResponse({
        hasBudget: false,
        message: 'No saved budget found. Please generate a budget first.',
        variance: [],
      })
    }

    // Get Planned Items in parallel
    const [plannedIncomeResult, plannedExpensesResult] = await Promise.all([
      supabase.from('PlannedIncome').select('*').eq('user_id', userId),
      supabase.from('PlannedExpenses').select('*').eq('user_id', userId)
    ])

    const plannedIncome = plannedIncomeResult.data
    const plannedExpenses = plannedExpensesResult.data

    // Always recalculate Planned Items from current PlannedIncome and PlannedExpenses tables
    // This ensures that deleted/updated planned items are reflected in the budget
    const budget = { ...savedBudget.budget_data } || {}
    const forecastMonths = savedBudget.forecast_months || []

    forecastMonths.forEach(month => {
      const [year, monthNum] = month.split('-').map(Number)
      const forecastDate = new Date(year, monthNum - 1, 1)
      
      // Calculate Planned Income for this month from current PlannedIncome table
      let plannedIncomeForMonth = 0
      plannedIncome?.forEach((pi: any) => {
        const piDate = new Date(pi.expected_date)
        const amount = Number(pi.amount || 0)
        
        if (pi.recurrence === 'monthly') {
          if (forecastDate >= new Date(piDate.getFullYear(), piDate.getMonth(), 1)) {
            plannedIncomeForMonth += amount
          }
        } else if (pi.recurrence === 'one-off') {
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
          if (forecastDate >= new Date(peDate.getFullYear(), peDate.getMonth(), 1)) {
            plannedExpensesForMonth += amount
          }
        } else if (pe.recurrence === 'one-off') {
          if (peDate.getFullYear() === forecastDate.getFullYear() &&
              peDate.getMonth() === forecastDate.getMonth()) {
            plannedExpensesForMonth += amount
          }
        }
      })

      // Always update Planned Items in budget (remove old values if no planned items exist)
      if (!budget[month]) {
        budget[month] = {}
      }
      
      if (plannedIncomeForMonth > 0 || plannedExpensesForMonth > 0) {
        budget[month]['Planned Items'] = { income: plannedIncomeForMonth, expenses: plannedExpensesForMonth }
      } else {
        // Remove Planned Items if none exist for this month
        delete budget[month]['Planned Items']
      }
    })

    // Get all actual transactions
    const { data: transactions, error: txError } = await supabase
      .from('Transactions')
      .select('amount, category, booked_at')
      .eq('user_id', userId)
      .order('booked_at', { ascending: true })

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`)
    }

    // Group actual transactions by month and category
    const actualsByMonth: Record<string, Record<string, { income: number; expenses: number }>> = {}
    
    transactions?.forEach((tx: any) => {
      const month = (tx.booked_at || '').slice(0, 7) // YYYY-MM
      const category = (tx.category && tx.category.trim()) ? tx.category : 'Uncategorized'
      const amount = Number(tx.amount || 0)

      if (!actualsByMonth[month]) {
        actualsByMonth[month] = {}
      }
      if (!actualsByMonth[month][category]) {
        actualsByMonth[month][category] = { income: 0, expenses: 0 }
      }

      if (amount >= 0) {
        actualsByMonth[month][category].income += amount
      } else {
        actualsByMonth[month][category].expenses += Math.abs(amount)
      }
    })

    // Calculate variance for each month in budget
    const variance: Array<{
      month: string
      type: 'actual' | 'forecast' // actual if month has passed, forecast if future
      plan: { income: number; expenses: number; net: number }
      actual: { income: number; expenses: number; net: number }
      variance: { income: number; expenses: number; net: number }
      variancePercent: { income: number; expenses: number; net: number }
      byCategory: Record<string, {
        plan: { income: number; expenses: number; net: number }
        actual: { income: number; expenses: number; net: number }
        variance: { income: number; expenses: number; net: number }
        variancePercent: { income: number; expenses: number; net: number }
      }>
    }> = []

    forecastMonths.forEach(month => {
      const isPast = month < currentMonth
      const isCurrent = month === currentMonth
      const type = (isPast || isCurrent) ? 'actual' : 'forecast'

      // Calculate plan totals for this month
      let planIncome = 0
      let planExpenses = 0
      const planByCategory: Record<string, { income: number; expenses: number }> = {}

      if (budget[month]) {
        Object.keys(budget[month]).forEach(category => {
          const catData = budget[month][category]
          const catIncome = catData.income || 0
          const catExpenses = catData.expenses || 0
          
          planIncome += catIncome
          planExpenses += catExpenses
          planByCategory[category] = { income: catIncome, expenses: catExpenses }
        })
      }

      const planNet = planIncome - planExpenses

      // Calculate actual totals for this month
      let actualIncome = 0
      let actualExpenses = 0
      const actualByCategory: Record<string, { income: number; expenses: number }> = {}

      if (actualsByMonth[month]) {
        Object.keys(actualsByMonth[month]).forEach(category => {
          const catData = actualsByMonth[month][category]
          const catIncome = catData.income || 0
          const catExpenses = catData.expenses || 0
          
          actualIncome += catIncome
          actualExpenses += catExpenses
          actualByCategory[category] = { income: catIncome, expenses: catExpenses }
        })
      }

      const actualNet = actualIncome - actualExpenses

      // Calculate variance
      const varianceIncome = actualIncome - planIncome
      const varianceExpenses = actualExpenses - planExpenses
      const varianceNet = actualNet - planNet

      // Calculate variance percentage
      const variancePercentIncome = planIncome !== 0 ? (varianceIncome / planIncome) * 100 : 0
      const variancePercentExpenses = planExpenses !== 0 ? (varianceExpenses / planExpenses) * 100 : 0
      const variancePercentNet = planNet !== 0 ? (varianceNet / planNet) * 100 : 0

      // Get all unique categories from both plan and actual
      const allCategories = new Set<string>()
      Object.keys(planByCategory).forEach(cat => allCategories.add(cat))
      Object.keys(actualByCategory).forEach(cat => allCategories.add(cat))

      // Calculate variance by category
      const varianceByCategory: Record<string, {
        plan: { income: number; expenses: number; net: number }
        actual: { income: number; expenses: number; net: number }
        variance: { income: number; expenses: number; net: number }
        variancePercent: { income: number; expenses: number; net: number }
      }> = {}

      allCategories.forEach(category => {
        const planCat = planByCategory[category] || { income: 0, expenses: 0 }
        const actualCat = actualByCategory[category] || { income: 0, expenses: 0 }
        
        const planCatNet = planCat.income - planCat.expenses
        const actualCatNet = actualCat.income - actualCat.expenses
        const varianceCatIncome = actualCat.income - planCat.income
        const varianceCatExpenses = actualCat.expenses - planCat.expenses
        const varianceCatNet = actualCatNet - planCatNet

        const varianceCatPercentIncome = planCat.income !== 0 ? (varianceCatIncome / planCat.income) * 100 : 0
        const varianceCatPercentExpenses = planCat.expenses !== 0 ? (varianceCatExpenses / planCat.expenses) * 100 : 0
        const varianceCatPercentNet = planCatNet !== 0 ? (varianceCatNet / planCatNet) * 100 : 0

        varianceByCategory[category] = {
          plan: {
            income: planCat.income,
            expenses: planCat.expenses,
            net: planCatNet,
          },
          actual: {
            income: actualCat.income,
            expenses: actualCat.expenses,
            net: actualCatNet,
          },
          variance: {
            income: varianceCatIncome,
            expenses: varianceCatExpenses,
            net: varianceCatNet,
          },
          variancePercent: {
            income: varianceCatPercentIncome,
            expenses: varianceCatPercentExpenses,
            net: varianceCatPercentNet,
          },
        }
      })

      variance.push({
        month,
        type,
        plan: { income: planIncome, expenses: planExpenses, net: planNet },
        actual: { income: actualIncome, expenses: actualExpenses, net: actualNet },
        variance: { income: varianceIncome, expenses: varianceExpenses, net: varianceNet },
        variancePercent: {
          income: variancePercentIncome,
          expenses: variancePercentExpenses,
          net: variancePercentNet,
        },
        byCategory: varianceByCategory,
      })
    })

    return successResponse({
      hasBudget: true,
      horizon: savedBudget.horizon,
      forecastMonths,
      variance,
      currency: primaryCurrency,
      budgetCreatedAt: savedBudget.created_at,
      budgetUpdatedAt: savedBudget.updated_at,
    })
  } catch (e) {
    return errorResponse(e, 'Failed to calculate budget variance')
  }
}
