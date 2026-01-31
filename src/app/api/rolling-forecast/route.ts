import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, errorResponse, successResponse } from '../_utils'

// Allow caching for better performance
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

    // Get Planned Income and Expenses in parallel
    const [plannedIncomeResult, plannedExpensesResult] = await Promise.all([
      supabase.from('PlannedIncome').select('*').eq('user_id', userId),
      supabase.from('PlannedExpenses').select('*').eq('user_id', userId)
    ])

    const plannedIncome = plannedIncomeResult.data
    const plannedExpenses = plannedExpensesResult.data

    // Try to load saved budget first
    let budgetData: any = null
    let isSavedBudget = false
    try {
      const { data: savedBudget, error: loadError } = await supabase
        .from('Budget')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (!loadError && savedBudget) {
        // Use saved budget - check if horizon matches
        if (savedBudget.horizon === horizon) {
          // Always recalculate Planned Items from current PlannedIncome and PlannedExpenses tables
          // This ensures that deleted/updated planned items are reflected in the budget
          const mergedBudget = { ...(savedBudget.budget_data || {}) }
          const forecastMonths = savedBudget.forecast_months || []
          
          forecastMonths.forEach(month => {
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

          budgetData = {
            budget: mergedBudget,
            categoryGrowthRates: savedBudget.category_growth_rates || {},
            forecastMonths: forecastMonths,
          }
          isSavedBudget = true
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

        // First, determine forecast months (including current month)
        let tempForecastMonths: string[] = []
        if (horizon === 'yearend') {
          const currentMonthNum = now.getMonth()
          const currentYear = now.getFullYear()
          for (let i = currentMonthNum; i <= 11; i++) {
            const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`
            tempForecastMonths.push(monthKey)
          }
        } else {
          for (let i = 0; i < 6; i++) {
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
          
          // Calculate how many months ahead this is from the last historical month
          // If current month is included (monthIndex 0), use 0 months ahead
          const monthsAhead = monthIndex
          
          allCategories.forEach(category => {
            const rates = categoryGrowthRates[category]
            if (!rates) return

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

          // Always update Planned Items in budget (remove old values if no planned items exist)
          if (plannedIncomeForMonth > 0 || plannedExpensesForMonth > 0) {
            if (!budget[month]['Planned Items']) {
              budget[month]['Planned Items'] = { income: 0, expenses: 0 }
            }
            budget[month]['Planned Items'].income = plannedIncomeForMonth
            budget[month]['Planned Items'].expenses = plannedExpensesForMonth
          } else {
            // Remove Planned Items if none exist for this month
            if (budget[month] && budget[month]['Planned Items']) {
              delete budget[month]['Planned Items']
            }
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
    // Always include current month
    allMonths.add(currentMonth)
    
    // Fill gaps between last actual month and first forecast month
    const actualMonthsList = Object.keys(actualsByMonth).sort()
    const lastActualMonth = actualMonthsList.length > 0 ? actualMonthsList[actualMonthsList.length - 1] : null
    const firstForecastMonth = forecastMonths.length > 0 ? forecastMonths[0] : null
    
    if (lastActualMonth && firstForecastMonth && lastActualMonth < firstForecastMonth) {
      // Fill months between last actual and first forecast
      const [lastYear, lastMonth] = lastActualMonth.split('-').map(Number)
      const [firstYear, firstMonth] = firstForecastMonth.split('-').map(Number)
      
      let fillYear = lastYear
      let fillMonth = lastMonth + 1
      
      while (fillYear < firstYear || (fillYear === firstYear && fillMonth < firstMonth)) {
        const monthKey = `${fillYear}-${String(fillMonth).padStart(2, '0')}`
        allMonths.add(monthKey)
        
        fillMonth++
        if (fillMonth > 12) {
          fillMonth = 1
          fillYear++
        }
      }
    }
    
    const sortedMonths = Array.from(allMonths).sort()

    // Calculate starting balance (sum of all transactions up to last actual month)
    let startingBalance = 0
    // Use the last actual month that is <= currentMonth for balance calculation
    const lastActualMonthForBalance = sortedMonths.filter(m => actualsByMonth[m] && m <= currentMonth).pop()
    if (lastActualMonthForBalance) {
      transactions?.forEach((tx: any) => {
        const txMonth = (tx.booked_at || '').slice(0, 7)
        if (txMonth <= lastActualMonthForBalance) {
          startingBalance += Number(tx.amount || 0)
        }
      })
    } else {
      startingBalance = currentBalance
    }

    // Track the last actual balance to use as starting point for forecast
    let lastActualBalance = startingBalance
    let runningBalance = startingBalance

    sortedMonths.forEach(month => {
      const isActual = actualsByMonth[month] !== undefined
      const isFuture = month > currentMonth
      const isCurrentMonth = month === currentMonth

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
        lastActualBalance = monthBalance // Update last actual balance

        rollingForecast.push({
          month,
          type: 'actual',
          income: actual.income,
          expenses: actual.expenses,
          net: actual.net,
          balance: runningBalance,
          byCategory: actual.byCategory,
        })
      } else if (isCurrentMonth && !isActual) {
        // Current month without actuals yet - use zero or last balance
        rollingForecast.push({
          month,
          type: 'actual',
          income: 0,
          expenses: 0,
          net: 0,
          balance: runningBalance,
          byCategory: {},
        })
        lastActualBalance = runningBalance // Update last actual balance
      } else if (isFuture && budgetData?.budget[month]) {
        // For forecast months, always start from the last actual balance
        // Reset runningBalance to lastActualBalance for the first forecast month
        const isFirstForecastMonth = rollingForecast.filter(f => f.type === 'forecast').length === 0
        if (isFirstForecastMonth) {
          runningBalance = lastActualBalance
        }
        // Future month with budget
        const budgetMonth = budgetData.budget[month]
        
        // Debug: log budget data for first forecast month
        if (isFirstForecastMonth) {
          console.log(`[Rolling Forecast] ===== FIRST FORECAST MONTH ${month} =====`)
          console.log(`[Rolling Forecast] Last actual balance: ${lastActualBalance}`)
          console.log(`[Rolling Forecast] Starting balance: ${runningBalance}`)
          console.log(`[Rolling Forecast] Budget data:`, JSON.stringify(budgetMonth, null, 2))
        }
        
        let monthIncome = 0
        let monthExpenses = 0
        const monthByCategory: Record<string, { income: number; expenses: number }> = {}

        Object.keys(budgetMonth).forEach(category => {
          const catData = budgetMonth[category]
          
          // Skip if catData is not an object
          if (!catData || typeof catData !== 'object') {
            console.warn(`[Rolling Forecast] Invalid category data for ${category} in ${month}:`, catData)
            return
          }
          
          // Validate and ensure values are numbers and reasonable
          // Cap at 1 billion per category per month (much more reasonable)
          const maxValue = 1e9
          const income = typeof catData?.income === 'number' && !isNaN(catData.income) && isFinite(catData.income) 
            ? Math.max(0, Math.min(catData.income, maxValue))
            : 0
          const expenses = typeof catData?.expenses === 'number' && !isNaN(catData.expenses) && isFinite(catData.expenses)
            ? Math.max(0, Math.min(catData.expenses, maxValue))
            : 0
          
          // Warn if values seem too large or if original was capped
          if (catData?.income > maxValue || catData?.expenses > maxValue) {
            console.error(`[Rolling Forecast] CAPPED large values for ${category} in ${month}: original income=${catData?.income}, expenses=${catData?.expenses}, capped to ${income}/${expenses}`)
          } else if (income > 1e6 || expenses > 1e6) {
            console.warn(`[Rolling Forecast] Large values for ${category} in ${month}: income=${income}, expenses=${expenses}`)
          }
          
          monthIncome += income
          monthExpenses += expenses
          monthByCategory[category] = {
            income,
            expenses,
          }
        })

        // If using saved budget, Planned Items are already included in budgetMonth
        // Only add Planned Items if we generated the budget on the fly (not saved)
        if (!isSavedBudget) {
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

          // Add planned items to totals and category breakdown (only if not already in budget)
          if (!monthByCategory['Planned Items']) {
            monthIncome += plannedIncomeForMonth
            monthExpenses += plannedExpensesForMonth
            
            if (plannedIncomeForMonth > 0 || plannedExpensesForMonth > 0) {
              monthByCategory['Planned Items'] = {
                income: plannedIncomeForMonth,
                expenses: plannedExpensesForMonth,
              }
            }
          }
        }

        const monthNet = monthIncome - monthExpenses
        const balanceBefore = runningBalance
        runningBalance += monthNet

        // Validate balance is reasonable (not trillions)
        if (Math.abs(runningBalance) > 1e12) {
          console.error(`[Rolling Forecast] Suspicious balance for ${month}: ${runningBalance}. Income: ${monthIncome}, Expenses: ${monthExpenses}, Net: ${monthNet}, Last actual balance: ${lastActualBalance}`)
          // Reset to last actual balance + net if balance is too large
          runningBalance = lastActualBalance + monthNet
        }

        // Log for first few forecast months
        if (isFirstForecastMonth || rollingForecast.filter(f => f.type === 'forecast').length < 3) {
          console.log(`[Rolling Forecast] ${month}: Income=${monthIncome}, Expenses=${monthExpenses}, Net=${monthNet}, Balance: ${balanceBefore} -> ${runningBalance}`)
        }

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
        // For first forecast month without budget, start from last actual balance
        const isFirstForecastMonth = rollingForecast.filter(f => f.type === 'forecast').length === 0
        if (isFirstForecastMonth) {
          runningBalance = lastActualBalance
        }
        
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
