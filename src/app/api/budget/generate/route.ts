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

    // Calculate monthly growth rates per category using trend detection
    // Uses smoothing + regression + trimmed percent changes to avoid last-month noise
    const categoryGrowthRates: Record<string, {
      incomeRate: number
      expenseRate: number
      lastValue: { income: number; expenses: number }
      baselineValue?: { income: number; expenses: number }
      trend?: {
        income: { direction: 'up' | 'down' | 'flat'; strength: number; volatility: number; windowMonths: number; method: string }
        expense: { direction: 'up' | 'down' | 'flat'; strength: number; volatility: number; windowMonths: number; method: string }
      }
    }> = {}
    const allCategories = new Set<string>()

    // Collect all categories
    months.forEach(month => {
      Object.keys(monthlyCategoryData[month]).forEach(cat => allCategories.add(cat))
    })

    // Helper functions for trend detection
    const mean = (values: number[]) => values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length
    const standardDeviation = (values: number[]) => {
      if (values.length < 2) return 0
      const avg = mean(values)
      const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length
      return Math.sqrt(variance)
    }
    const trimmedMean = (values: number[], trimPct: number = 0.2) => {
      if (values.length === 0) return 0
      if (values.length < 5) return mean(values)
      const sorted = [...values].sort((a, b) => a - b)
      const trimCount = Math.floor(sorted.length * trimPct)
      const trimmed = sorted.slice(trimCount, sorted.length - trimCount)
      return mean(trimmed)
    }
    const movingAverage = (values: number[], windowSize: number) => {
      if (values.length === 0) return []
      const window = Math.max(1, Math.min(windowSize, values.length))
      return values.map((_, idx) => {
        const start = Math.max(0, idx - window + 1)
        const slice = values.slice(start, idx + 1)
        return mean(slice)
      })
    }
    const linearRegressionSlope = (values: number[]) => {
      const n = values.length
      if (n < 2) return 0
      const xMean = (n - 1) / 2
      const yMean = mean(values)
      let num = 0
      let den = 0
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (values[i] - yMean)
        den += Math.pow(i - xMean, 2)
      }
      return den === 0 ? 0 : num / den
    }
    const computeTrend = (series: number[], windowMonths: number) => {
      const lastActual = series[series.length - 1] || 0
      const windowed = series.slice(Math.max(0, series.length - windowMonths))
      const smoothed = movingAverage(windowed, 3)
      const pctChanges: number[] = []
      for (let i = 1; i < smoothed.length; i++) {
        const prev = smoothed[i - 1]
        const curr = smoothed[i]
        if (prev > 0) {
          pctChanges.push(((curr - prev) / prev) * 100)
        } else if (prev === 0 && curr > 0) {
          pctChanges.push(0)
        }
      }
      const avgPct = trimmedMean(pctChanges, 0.2)
      const slope = linearRegressionSlope(smoothed)
      const lastSmoothed = smoothed[smoothed.length - 1] || 0
      const slopeRate = lastSmoothed > 0 ? (slope / lastSmoothed) * 100 : 0
      let combinedRate = (avgPct * 0.6) + (slopeRate * 0.4)
      const volatility = standardDeviation(pctChanges)
      const stabilityFactor = Math.max(0.3, 1 - Math.min(volatility / 100, 0.7))
      combinedRate = combinedRate * stabilityFactor
      const cappedRate = Math.max(-50, Math.min(50, combinedRate))
      const direction: 'up' | 'down' | 'flat' = Math.abs(cappedRate) < 1 ? 'flat' : (cappedRate > 0 ? 'up' : 'down')
      const strength = Math.abs(cappedRate)
      return {
        rate: cappedRate,
        baseline: lastSmoothed,
        lastActual,
        trend: {
          direction,
          strength,
          volatility,
          windowMonths: windowed.length,
          method: 'smoothed-trend'
        }
      }
    }

    // Calculate growth rates for each category
    allCategories.forEach(category => {
      const monthlyValues: Array<{ income: number; expenses: number }> = []
      
      months.forEach(month => {
        const values = monthlyCategoryData[month][category] || { income: 0, expenses: 0 }
        monthlyValues.push(values)
      })

      const windowMonths = Math.min(6, monthlyValues.length)
      const incomeSeries = monthlyValues.map(v => v.income)
      const expenseSeries = monthlyValues.map(v => v.expenses)
      const incomeTrend = computeTrend(incomeSeries, windowMonths)
      const expenseTrend = computeTrend(expenseSeries, windowMonths)
      const lastValue = monthlyValues[monthlyValues.length - 1]

      categoryGrowthRates[category] = {
        incomeRate: incomeTrend.rate,
        expenseRate: expenseTrend.rate,
        lastValue,
        baselineValue: {
          income: incomeTrend.baseline,
          expenses: expenseTrend.baseline,
        },
        trend: {
          income: incomeTrend.trend,
          expense: expenseTrend.trend,
        },
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
      // Forecast until end of current year (including current month)
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      for (let i = currentMonth; i <= 11; i++) {
        const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`
        forecastMonths.push(monthKey)
      }
    } else {
      // Forecast next 6 months (including current month)
      for (let i = 0; i < 6; i++) {
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
      
      // Calculate how many months ahead this is from the last historical month
      // If current month is included (monthIndex 0), use 0 months ahead
      const monthsAhead = monthIndex
      
      allCategories.forEach(category => {
        const rates = categoryGrowthRates[category]
        if (!rates) return

        // Apply growth rate to last known value
        // For current month (index 0), use last value directly (monthsAhead = 0)
        // For future months, apply rate N times (compounding)
        
        // Cap growth rates to prevent exponential explosion
        const cappedIncomeRate = Math.max(-50, Math.min(50, rates.incomeRate)) // -50% to +50% max
        const cappedExpenseRate = Math.max(-50, Math.min(50, rates.expenseRate)) // -50% to +50% max
        
        const incomeGrowthFactor = Math.pow(1 + (cappedIncomeRate / 100), monthsAhead)
        const expenseGrowthFactor = Math.pow(1 + (cappedExpenseRate / 100), monthsAhead)
        
        // Validate base values are reasonable
        const incomeBase = Math.max(0, Math.min(1e9, rates.baselineValue?.income ?? rates.lastValue.income ?? 0))
        const expenseBase = Math.max(0, Math.min(1e9, rates.baselineValue?.expenses ?? rates.lastValue.expenses ?? 0))

        const projectedIncome = incomeBase * incomeGrowthFactor
        const projectedExpenses = expenseBase * expenseGrowthFactor

        // Cap projected values to prevent unreasonable numbers
        const maxProjectedValue = 1e9 // 1 billion max per category per month
        budget[month][category] = {
          income: Math.max(0, Math.min(maxProjectedValue, projectedIncome)),
          expenses: Math.max(0, Math.min(maxProjectedValue, projectedExpenses)),
        }
        
        // Warn if values seem unreasonable
        if (projectedIncome > 1e6 || projectedExpenses > 1e6) {
          console.warn(`[Budget Generate] Large projected values for ${category} in ${month}: income=${projectedIncome}, expenses=${projectedExpenses}, base=${incomeBase}/${expenseBase}, rate=${cappedIncomeRate}/${cappedExpenseRate}%, monthsAhead=${monthsAhead}`)
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
