import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse } from '../_utils'

export const dynamic = 'force-dynamic'

/**
 * Rolling Forecast - combines actual transactions with budget forecasts
 * Shows actuals for past/current months and budget for future months
 */
export async function GET(req: Request) {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const { searchParams } = new URL(req.url)
    const horizon = (searchParams.get('horizon') as '6months' | 'yearend') || '6months'

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Get all actual transactions
    const { data: transactions, error: txError } = await supabase
      .from('Transactions')
      .select('amount, category, booked_at')
      .eq('user_id', userId)
      .order('booked_at', { ascending: true })

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.error?.message || txError.message}`)
    }

    // Group actual transactions by month
    const actualsByMonth: Record<string, { income: number; expenses: number; net: number; byCategory: Record<string, { income: number; expenses: number }> }> = {}
    
    transactions?.forEach((tx: any) => {
      const month = (tx.booked_at || '').slice(0, 7) // YYYY-MM
      const category = (tx.category && tx.category.trim()) ? tx.category : 'Uncategorized'
      const amount = Number(tx.amount || 0)

      if (!actualsByMonth[month]) {
        actualsByMonth[month] = { income: 0, expenses: 0, net: 0, byCategory: {} }
      }
      if (!actualsByMonth[month].byCategory[category]) {
        actualsByMonth[month].byCategory[category] = { income: 0, expenses: 0 }
      }

      if (amount >= 0) {
        actualsByMonth[month].income += amount
        actualsByMonth[month].byCategory[category].income += amount
      } else {
        actualsByMonth[month].expenses += Math.abs(amount)
        actualsByMonth[month].byCategory[category].expenses += Math.abs(amount)
      }
      actualsByMonth[month].net = actualsByMonth[month].income - actualsByMonth[month].expenses
    })

    // Get Planned Income and Expenses (for both saved and generated budgets)
    const { data: plannedIncome, error: piError } = await supabase
      .from('PlannedIncome')
      .select('*')
      .eq('user_id', userId)

    if (piError) {
      console.warn('Failed to fetch planned income:', piError)
    }

    const { data: plannedExpenses, error: peError } = await supabase
      .from('PlannedExpenses')
      .select('*')
      .eq('user_id', userId)

    if (peError) {
      console.warn('Failed to fetch planned expenses:', peError)
    }

    // Try to load saved budget first
    let budgetData: any = null
    try {
      const { data: savedBudget, error: loadError } = await supabase
        .from('Budget')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (!loadError && savedBudget) {
        // Use saved budget - check if horizon matches
        if (savedBudget.horizon === horizon) {
          budgetData = {
            budget: savedBudget.budget_data || {},
            categoryGrowthRates: savedBudget.category_growth_rates || {},
            forecastMonths: savedBudget.forecast_months || [],
          }
        } else {
          // Horizon doesn't match, will generate new budget below
          budgetData = null
        }
      }
    } catch (e) {
      console.warn('Failed to load saved budget:', e)
    }

    // If no saved budget, generate one
    if (!budgetData) {
      try {
      // Group transactions by month and category for budget calculation
      const monthlyCategoryData: Record<string, Record<string, { income: number; expenses: number }>> = {}
      
      transactions?.forEach((tx: any) => {
        const month = (tx.booked_at || '').slice(0, 7)
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

      const months = Object.keys(monthlyCategoryData).sort()
      if (months.length >= 2) {
        // Calculate growth rates (simplified version)
        const categoryGrowthRates: Record<string, { incomeRate: number; expenseRate: number; lastValue: { income: number; expenses: number } }> = {}
        const allCategories = new Set<string>()
        months.forEach(month => {
          Object.keys(monthlyCategoryData[month]).forEach(cat => allCategories.add(cat))
        })

        allCategories.forEach(category => {
          const monthlyValues: Array<{ income: number; expenses: number }> = []
          months.forEach(month => {
            const values = monthlyCategoryData[month][category] || { income: 0, expenses: 0 }
            monthlyValues.push(values)
          })

          let incomeRates: number[] = []
          let expenseRates: number[] = []

          for (let i = 1; i < monthlyValues.length; i++) {
            const prev = monthlyValues[i - 1]
            const curr = monthlyValues[i]

            if (prev.income > 0 && curr.income >= 0) {
              const rate = ((curr.income - prev.income) / prev.income) * 100
              incomeRates.push(rate)
            }
            if (prev.expenses > 0 && curr.expenses >= 0) {
              const rate = ((curr.expenses - prev.expenses) / prev.expenses) * 100
              expenseRates.push(rate)
            }
          }

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

        // First, determine forecast months
        let tempForecastMonths: string[] = []
        if (horizon === 'yearend') {
          const currentMonthNum = now.getMonth()
          const currentYear = now.getFullYear()
          for (let i = currentMonthNum + 1; i <= 11; i++) {
            const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`
            tempForecastMonths.push(monthKey)
          }
        } else {
          for (let i = 1; i <= 6; i++) {
            const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
            const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`
            tempForecastMonths.push(monthKey)
          }
        }

        // Generate budget for forecast months
        const budget: Record<string, Record<string, { income: number; expenses: number }>> = {}

        tempForecastMonths.forEach((month, monthIndex) => {
          budget[month] = {}
          
          // Parse month key (YYYY-MM) to Date for comparison
          const [year, monthNum] = month.split('-').map(Number)
          const forecastDate = new Date(year, monthNum - 1, 1)
          
          allCategories.forEach(category => {
            const rates = categoryGrowthRates[category]
            if (!rates) return

            const monthsAhead = monthIndex + 1
            const incomeGrowthFactor = Math.pow(1 + (rates.incomeRate / 100), monthsAhead)
            const expenseGrowthFactor = Math.pow(1 + (rates.expenseRate / 100), monthsAhead)

            const projectedIncome = rates.lastValue.income * incomeGrowthFactor
            const projectedExpenses = rates.lastValue.expenses * expenseGrowthFactor

            budget[month][category] = {
              income: Math.max(0, projectedIncome),
              expenses: Math.max(0, projectedExpenses),
            }
          })

          // Add Planned Income for this month
          let plannedIncomeForMonth = 0
          plannedIncome?.forEach((pi: any) => {
            const piDate = new Date(pi.expected_date)
            if (pi.recurrence === 'monthly' || 
                (pi.recurrence === 'one-off' && 
                 piDate.getFullYear() === forecastDate.getFullYear() &&
                 piDate.getMonth() === forecastDate.getMonth())) {
              plannedIncomeForMonth += Number(pi.amount || 0)
            }
          })

          // Add Planned Expenses for this month
          let plannedExpensesForMonth = 0
          plannedExpenses?.forEach((pe: any) => {
            const peDate = new Date(pe.expected_date)
            if (pe.recurrence === 'monthly' ||
                (pe.recurrence === 'one-off' &&
                 peDate.getFullYear() === forecastDate.getFullYear() &&
                 peDate.getMonth() === forecastDate.getMonth())) {
              plannedExpensesForMonth += Number(pe.amount || 0)
            }
          })

          // Add planned items to budget
          if (plannedIncomeForMonth > 0 || plannedExpensesForMonth > 0) {
            if (!budget[month]['Planned Items']) {
              budget[month]['Planned Items'] = { income: 0, expenses: 0 }
            }
            budget[month]['Planned Items'].income += plannedIncomeForMonth
            budget[month]['Planned Items'].expenses += plannedExpensesForMonth
          }
        })

        budgetData = {
          budget,
          categoryGrowthRates,
          forecastMonths: tempForecastMonths,
        }
      }
      } catch (e) {
        console.warn('Failed to generate budget for rolling forecast:', e)
      }
    }

    // Determine forecast months (use from saved budget if available, otherwise calculate)
    let forecastMonths: string[] = []
    if (budgetData?.forecastMonths && budgetData.forecastMonths.length > 0) {
      forecastMonths = budgetData.forecastMonths
    } else {
      if (horizon === 'yearend') {
        const currentMonthNum = now.getMonth()
        const currentYear = now.getFullYear()
        for (let i = currentMonthNum + 1; i <= 11; i++) {
          const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`
          forecastMonths.push(monthKey)
        }
      } else {
        for (let i = 1; i <= 6; i++) {
          const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
          const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`
          forecastMonths.push(monthKey)
        }
      }
      // Update budgetData with calculated forecastMonths
      if (budgetData) {
        budgetData.forecastMonths = forecastMonths
      }
    }

    // Calculate current balance
    let currentBalance = 0
    transactions?.forEach((tx: any) => {
      currentBalance += Number(tx.amount || 0)
    })

    // Build rolling forecast: actuals + budget
    const rollingForecast: Array<{
      month: string
      type: 'actual' | 'forecast'
      income: number
      expenses: number
      net: number
      balance: number
      byCategory: Record<string, { income: number; expenses: number }>
    }> = []

    // Get all months (actuals + forecast)
    const allMonths = new Set<string>()
    Object.keys(actualsByMonth).forEach(m => allMonths.add(m))
    forecastMonths.forEach(m => allMonths.add(m))
    const sortedMonths = Array.from(allMonths).sort()

    // Calculate starting balance (sum of all transactions up to last actual month)
    let startingBalance = 0
    const lastActualMonth = sortedMonths.filter(m => actualsByMonth[m] && m <= currentMonth).pop()
    if (lastActualMonth) {
      transactions?.forEach((tx: any) => {
        const txMonth = (tx.booked_at || '').slice(0, 7)
        if (txMonth <= lastActualMonth) {
          startingBalance += Number(tx.amount || 0)
        }
      })
    } else {
      startingBalance = currentBalance
    }

    let runningBalance = startingBalance

    sortedMonths.forEach(month => {
      const isActual = actualsByMonth[month] !== undefined
      const isFuture = month > currentMonth

      if (isActual && !isFuture) {
        // Past/current month with actuals
        const actual = actualsByMonth[month]
        // Calculate balance for this month by summing all transactions up to this month
        let monthBalance = 0
        transactions?.forEach((tx: any) => {
          const txMonth = (tx.booked_at || '').slice(0, 7)
          if (txMonth <= month) {
            monthBalance += Number(tx.amount || 0)
          }
        })
        runningBalance = monthBalance

        rollingForecast.push({
          month,
          type: 'actual',
          income: actual.income,
          expenses: actual.expenses,
          net: actual.net,
          balance: runningBalance,
          byCategory: actual.byCategory,
        })
      } else if (isFuture && budgetData?.budget[month]) {
        // Future month with budget
        const budgetMonth = budgetData.budget[month]
        let monthIncome = 0
        let monthExpenses = 0
        const monthByCategory: Record<string, { income: number; expenses: number }> = {}

        Object.keys(budgetMonth).forEach(category => {
          const catData = budgetMonth[category]
          monthIncome += catData.income || 0
          monthExpenses += catData.expenses || 0
          monthByCategory[category] = {
            income: catData.income || 0,
            expenses: catData.expenses || 0,
          }
        })

        // Add Planned Items for this month (if not already in budget)
        const [year, monthNum] = month.split('-').map(Number)
        const forecastDate = new Date(year, monthNum - 1, 1)
        
        let plannedIncomeForMonth = 0
        plannedIncome?.forEach((pi: any) => {
          const piDate = new Date(pi.expected_date)
          if (pi.recurrence === 'monthly' || 
              (pi.recurrence === 'one-off' && 
               piDate.getFullYear() === forecastDate.getFullYear() &&
               piDate.getMonth() === forecastDate.getMonth())) {
            plannedIncomeForMonth += Number(pi.amount || 0)
          }
        })

        let plannedExpensesForMonth = 0
        plannedExpenses?.forEach((pe: any) => {
          const peDate = new Date(pe.expected_date)
          if (pe.recurrence === 'monthly' ||
              (pe.recurrence === 'one-off' &&
               peDate.getFullYear() === forecastDate.getFullYear() &&
               peDate.getMonth() === forecastDate.getMonth())) {
            plannedExpensesForMonth += Number(pe.amount || 0)
          }
        })

        // Add planned items to totals and category breakdown
        monthIncome += plannedIncomeForMonth
        monthExpenses += plannedExpensesForMonth
        
        if (plannedIncomeForMonth > 0 || plannedExpensesForMonth > 0) {
          if (!monthByCategory['Planned Items']) {
            monthByCategory['Planned Items'] = { income: 0, expenses: 0 }
          }
          monthByCategory['Planned Items'].income += plannedIncomeForMonth
          monthByCategory['Planned Items'].expenses += plannedExpensesForMonth
        }

        const monthNet = monthIncome - monthExpenses
        runningBalance += monthNet

        rollingForecast.push({
          month,
          type: 'forecast',
          income: monthIncome,
          expenses: monthExpenses,
          net: monthNet,
          balance: runningBalance,
          byCategory: monthByCategory,
        })
      } else if (isFuture) {
        // Future month without budget - use planned items only
        const [year, monthNum] = month.split('-').map(Number)
        const forecastDate = new Date(year, monthNum - 1, 1)
        
        let plannedIncomeForMonth = 0
        plannedIncome?.forEach((pi: any) => {
          const piDate = new Date(pi.expected_date)
          if (pi.recurrence === 'monthly' || 
              (pi.recurrence === 'one-off' && 
               piDate.getFullYear() === forecastDate.getFullYear() &&
               piDate.getMonth() === forecastDate.getMonth())) {
            plannedIncomeForMonth += Number(pi.amount || 0)
          }
        })

        let plannedExpensesForMonth = 0
        plannedExpenses?.forEach((pe: any) => {
          const peDate = new Date(pe.expected_date)
          if (pe.recurrence === 'monthly' ||
              (pe.recurrence === 'one-off' &&
               peDate.getFullYear() === forecastDate.getFullYear() &&
               peDate.getMonth() === forecastDate.getMonth())) {
            plannedExpensesForMonth += Number(pe.amount || 0)
          }
        })

        const monthNet = plannedIncomeForMonth - plannedExpensesForMonth
        runningBalance += monthNet

        rollingForecast.push({
          month,
          type: 'forecast',
          income: plannedIncomeForMonth,
          expenses: plannedExpensesForMonth,
          net: monthNet,
          balance: runningBalance,
          byCategory: (plannedIncomeForMonth > 0 || plannedExpensesForMonth > 0) ? {
            'Planned Items': {
              income: plannedIncomeForMonth,
              expenses: plannedExpensesForMonth,
            }
          } : {},
        })
      }
    })

    // Calculate summary statistics
    const actualMonths = rollingForecast.filter(f => f.type === 'actual')
    const forecastMonthsData = rollingForecast.filter(f => f.type === 'forecast')

    const totalActualIncome = actualMonths.reduce((sum, m) => sum + m.income, 0)
    const totalActualExpenses = actualMonths.reduce((sum, m) => sum + m.expenses, 0)
    const totalForecastIncome = forecastMonthsData.reduce((sum, m) => sum + m.income, 0)
    const totalForecastExpenses = forecastMonthsData.reduce((sum, m) => sum + m.expenses, 0)

    return successResponse({
      currentBalance,
      currentMonth,
      horizon,
      rollingForecast,
      summary: {
        actual: {
          months: actualMonths.length,
          income: totalActualIncome,
          expenses: totalActualExpenses,
          net: totalActualIncome - totalActualExpenses,
        },
        forecast: {
          months: forecastMonthsData.length,
          income: totalForecastIncome,
          expenses: totalForecastExpenses,
          net: totalForecastIncome - totalForecastExpenses,
        },
        total: {
          months: rollingForecast.length,
          income: totalActualIncome + totalForecastIncome,
          expenses: totalActualExpenses + totalForecastExpenses,
          net: (totalActualIncome + totalForecastIncome) - (totalActualExpenses + totalForecastExpenses),
        },
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return errorResponse(e, 'Failed to generate rolling forecast')
  }
}
