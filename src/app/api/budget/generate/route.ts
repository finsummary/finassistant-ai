import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

export const dynamic = 'force-dynamic'

/**
 * Generate budget based on historical data analysis
 * Analyzes monthly growth rates per category and projects future months
 */
export async function POST(req: Request) {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const body = await req.json().catch(() => ({})) as {
      horizon?: '6months' | 'yearend'
    }
    const horizon = body.horizon || '6months'

    // Get all transactions for analysis
    const { data: transactions, error: txError } = await supabase
      .from('Transactions')
      .select('amount, category, booked_at')
      .eq('user_id', userId)
      .order('booked_at', { ascending: true })

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`)
    }

    // Group transactions by month and category
    const monthlyCategoryData: Record<string, Record<string, { income: number; expenses: number }>> = {}
    
    transactions?.forEach((tx: any) => {
      const month = (tx.booked_at || '').slice(0, 7) // YYYY-MM
      const category = (tx.category && tx.category.trim()) ? tx.category : 'Uncategorized'
      const amount = Number(tx.amount || 0)

      if (!monthlyCategoryData[month]) {
        monthlyCategoryData[month] = {}
      }
      if (!monthlyCategoryData[month][category]) {
        monthlyCategoryData[month][category] = { income: 0, expenses: 0 }
      }

      if (amount >= 0) {
        monthlyCategoryData[month][category].income += amount
      } else {
        monthlyCategoryData[month][category].expenses += Math.abs(amount)
      }
    })

    // Get sorted months
    const months = Object.keys(monthlyCategoryData).sort()
    if (months.length < 2) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Need at least 2 months of historical data to generate budget' 
      }, { status: 200 })
    }

    // Calculate monthly growth rates per category
    // For each category, calculate average month-over-month change rate
    const categoryGrowthRates: Record<string, { incomeRate: number; expenseRate: number; lastValue: { income: number; expenses: number } }> = {}
    const allCategories = new Set<string>()

    // Collect all categories
    months.forEach(month => {
      Object.keys(monthlyCategoryData[month]).forEach(cat => allCategories.add(cat))
    })

    // Calculate growth rates for each category
    allCategories.forEach(category => {
      const monthlyValues: Array<{ income: number; expenses: number }> = []
      
      months.forEach(month => {
        const values = monthlyCategoryData[month][category] || { income: 0, expenses: 0 }
        monthlyValues.push(values)
      })

      // Calculate average growth rate (month-over-month)
      // Use geometric mean for more stable growth rates
      let incomeRates: number[] = []
      let expenseRates: number[] = []

      for (let i = 1; i < monthlyValues.length; i++) {
        const prev = monthlyValues[i - 1]
        const curr = monthlyValues[i]

        // Income growth rate
        if (prev.income > 0 && curr.income >= 0) {
          const rate = ((curr.income - prev.income) / prev.income) * 100
          incomeRates.push(rate)
        } else if (prev.income === 0 && curr.income > 0) {
          // New category appeared - use a conservative growth rate
          incomeRates.push(0) // Don't assume infinite growth
        }

        // Expense growth rate
        if (prev.expenses > 0 && curr.expenses >= 0) {
          const rate = ((curr.expenses - prev.expenses) / prev.expenses) * 100
          expenseRates.push(rate)
        } else if (prev.expenses === 0 && curr.expenses > 0) {
          expenseRates.push(0) // Don't assume infinite growth
        }
      }

      // Calculate average (arithmetic mean)
      const avgIncomeRate = incomeRates.length > 0 
        ? incomeRates.reduce((sum, r) => sum + r, 0) / incomeRates.length 
        : 0
      const avgExpenseRate = expenseRates.length > 0 
        ? expenseRates.reduce((sum, r) => sum + r, 0) / expenseRates.length 
        : 0
      const lastValue = monthlyValues[monthlyValues.length - 1]

      categoryGrowthRates[category] = {
        incomeRate: avgIncomeRate,
        expenseRate: avgExpenseRate,
        lastValue,
      }
    })

    // Get Planned Income and Expenses
    const { data: plannedIncome, error: piError } = await supabase
      .from('PlannedIncome')
      .select('*')
      .eq('user_id', userId)

    if (piError) {
      console.warn('[Budget Generate] Failed to fetch planned income:', piError)
    } else {
      console.log('[Budget Generate] Planned Income loaded:', plannedIncome?.length || 0, 'items')
    }

    const { data: plannedExpenses, error: peError } = await supabase
      .from('PlannedExpenses')
      .select('*')
      .eq('user_id', userId)

    if (peError) {
      console.warn('[Budget Generate] Failed to fetch planned expenses:', peError)
    } else {
      console.log('[Budget Generate] Planned Expenses loaded:', plannedExpenses?.length || 0, 'items')
    }

    // Determine forecast months
    const now = new Date()
    const forecastMonths: string[] = []
    
    if (horizon === 'yearend') {
      // Forecast until end of current year
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      for (let i = currentMonth + 1; i <= 11; i++) {
        const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`
        forecastMonths.push(monthKey)
      }
    } else {
      // Forecast next 6 months
      for (let i = 1; i <= 6; i++) {
        const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`
        forecastMonths.push(monthKey)
      }
    }

    // Generate budget for each forecast month
    const budget: Record<string, Record<string, { income: number; expenses: number }>> = {}

    forecastMonths.forEach((month, monthIndex) => {
      budget[month] = {}
      
      // Parse month key (YYYY-MM) to Date for comparison
      const [year, monthNum] = month.split('-').map(Number)
      const forecastDate = new Date(year, monthNum - 1, 1)
      
      allCategories.forEach(category => {
        const rates = categoryGrowthRates[category]
        if (!rates) return

        // Apply growth rate to last known value
        // For month N, apply rate N times (compounding)
        const monthsAhead = monthIndex + 1
        const incomeGrowthFactor = Math.pow(1 + (rates.incomeRate / 100), monthsAhead)
        const expenseGrowthFactor = Math.pow(1 + (rates.expenseRate / 100), monthsAhead)

        const projectedIncome = rates.lastValue.income * incomeGrowthFactor
        const projectedExpenses = rates.lastValue.expenses * expenseGrowthFactor

        budget[month][category] = {
          income: Math.max(0, projectedIncome), // Don't allow negative
          expenses: Math.max(0, projectedExpenses),
        }
      })

      // Add Planned Income for this month
      let plannedIncomeForMonth = 0
      plannedIncome?.forEach((pi: any) => {
        const piDate = new Date(pi.expected_date)
        const amount = Number(pi.amount || 0)
        
        if (pi.recurrence === 'monthly') {
          // Monthly: add to all forecast months (starting from expected_date month)
          // Check if forecast month is on or after the expected_date month
          if (forecastDate >= new Date(piDate.getFullYear(), piDate.getMonth(), 1)) {
            plannedIncomeForMonth += amount
            console.log(`[Budget Generate] Adding monthly planned income for ${month}: ${pi.description} = ${amount}`)
          }
        } else if (pi.recurrence === 'one-off') {
          // One-off: only add if the month matches exactly
          if (piDate.getFullYear() === forecastDate.getFullYear() &&
              piDate.getMonth() === forecastDate.getMonth()) {
            plannedIncomeForMonth += amount
            console.log(`[Budget Generate] Adding one-off planned income for ${month}: ${pi.description} = ${amount}`)
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
          // Check if forecast month is on or after the expected_date month
          if (forecastDate >= new Date(peDate.getFullYear(), peDate.getMonth(), 1)) {
            plannedExpensesForMonth += amount
            console.log(`[Budget Generate] Adding monthly planned expense for ${month}: ${pe.description} = ${amount}`)
          }
        } else if (pe.recurrence === 'one-off') {
          // One-off: only add if the month matches exactly
          if (peDate.getFullYear() === forecastDate.getFullYear() &&
              peDate.getMonth() === forecastDate.getMonth()) {
            plannedExpensesForMonth += amount
            console.log(`[Budget Generate] Adding one-off planned expense for ${month}: ${pe.description} = ${amount}`)
          }
        }
      })

      // Add planned items to budget (as separate category or add to existing)
      // We'll add them as a special "Planned Items" category for visibility
      if (plannedIncomeForMonth > 0 || plannedExpensesForMonth > 0) {
        if (!budget[month]['Planned Items']) {
          budget[month]['Planned Items'] = { income: 0, expenses: 0 }
        }
        budget[month]['Planned Items'].income += plannedIncomeForMonth
        budget[month]['Planned Items'].expenses += plannedExpensesForMonth
        console.log(`[Budget Generate] Planned Items for ${month}: income=${plannedIncomeForMonth}, expenses=${plannedExpensesForMonth}`)
      }
    })

    return successResponse({
      horizon,
      forecastMonths,
      categoryGrowthRates,
      budget,
      historicalMonths: months,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return errorResponse(e, 'Failed to generate budget')
  }
}
