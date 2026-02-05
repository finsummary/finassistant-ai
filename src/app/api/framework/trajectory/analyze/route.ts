import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../../_utils'
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/ai-cache'
import { searchFinancialKnowledge, searchUserKnowledge, saveUserKnowledge } from '@/lib/knowledge-search'

export const dynamic = 'force-dynamic'

/**
 * AI-powered analysis for TRAJECTORY section
 * Analyzes rolling forecast and cash trajectory
 */
export async function POST(req: Request) {
  try {
    const userId = await requireAuth()
    
    // Check if refresh is requested
    const body = await req.json().catch(() => ({}))
    const forceRefresh = body?.refresh === true
    
    // Check cache first (unless refresh is forced)
    if (!forceRefresh) {
      const cached = getCachedAnalysis(userId, 'trajectory')
      if (cached) {
        return successResponse({
          ...cached,
          message: 'AI trajectory analysis (cached)',
        })
      }
    }
    
    const supabase = await createClient()

    const horizon = '6months' as '6months' | 'yearend'
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Get rolling forecast data from the actual rolling-forecast API
    // This ensures we use the same logic that builds the forecast correctly
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let rollingForecastData: any = null
    let currentBalance = 0 // Declare outside try block so it's accessible later
    let budgetData: any = null // Declare outside try block so it's accessible later
    
    try {
      // We need to call the rolling-forecast API, but we're in a server context
      // So we'll replicate the logic here, but use the same approach as rolling-forecast/route.ts
      
      // Get all actual transactions
      const { data: transactions, error: txError } = await supabase
        .from('Transactions')
        .select('amount, category, booked_at')
        .eq('user_id', userId)
        .order('booked_at', { ascending: true })

      if (txError) {
        throw new Error(`Failed to fetch transactions: ${txError.error?.message || txError.message}`)
      }

      // Group actual transactions by month (same as rolling-forecast)
      const actualsByMonth: Record<string, { income: number; expenses: number; net: number; byCategory: Record<string, { income: number; expenses: number }> }> = {}
      
      transactions?.forEach((tx: any) => {
        const month = (tx.booked_at || '').slice(0, 7)
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

      const plannedIncome = plannedIncomeResult.data || []
      const plannedExpenses = plannedExpensesResult.data || []

      // Try to load saved budget first
      budgetData = null
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
        console.warn('[Trajectory Analyze] Failed to load saved budget:', e)
      }

      // If no saved budget, generate one (same logic as rolling-forecast)
      if (!budgetData) {
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

        // Calculate growth rates per category
        const categoryGrowthRates: Record<string, { incomeRate: number; expenseRate: number; lastValue: { income: number; expenses: number } }> = {}
        const sortedMonths = Object.keys(monthlyCategoryData).sort()
        const allCategories = new Set<string>()
        
        Object.values(monthlyCategoryData).forEach(monthData => {
          Object.keys(monthData).forEach(cat => allCategories.add(cat))
        })

        allCategories.forEach(category => {
          const categoryMonths = sortedMonths
            .map(month => ({ month, data: monthlyCategoryData[month][category] || { income: 0, expenses: 0 } }))
            .filter(m => m.data.income > 0 || m.data.expenses > 0)

          if (categoryMonths.length >= 2) {
            const first = categoryMonths[0].data
            const last = categoryMonths[categoryMonths.length - 1].data
            const monthsDiff = categoryMonths.length - 1

            const incomeRate = first.income > 0 ? ((last.income / first.income) ** (1 / monthsDiff) - 1) * 100 : 0
            const expenseRate = first.expenses > 0 ? ((last.expenses / first.expenses) ** (1 / monthsDiff) - 1) * 100 : 0

            categoryGrowthRates[category] = {
              incomeRate: isFinite(incomeRate) ? incomeRate : 0,
              expenseRate: isFinite(expenseRate) ? expenseRate : 0,
              lastValue: last,
            }
          } else if (categoryMonths.length === 1) {
            categoryGrowthRates[category] = {
              incomeRate: 0,
              expenseRate: 0,
              lastValue: categoryMonths[0].data,
            }
          }
        })

        // Generate forecast months
        const tempForecastMonths: string[] = []
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

        // Build budget using growth rates (same as rolling-forecast)
        const budget: Record<string, Record<string, { income: number; expenses: number }>> = {}

        tempForecastMonths.forEach((month, monthIndex) => {
          budget[month] = {}
          
          const [year, monthNum] = month.split('-').map(Number)
          const forecastDate = new Date(year, monthNum - 1, 1)
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

      // Calculate forecast months
      let forecastMonthsList: string[] = []
      if (budgetData?.forecastMonths && budgetData.forecastMonths.length > 0) {
        forecastMonthsList = budgetData.forecastMonths
      } else {
        for (let i = 1; i <= 6; i++) {
          const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
          const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`
          forecastMonthsList.push(monthKey)
        }
      }

      // Calculate current balance
      currentBalance = 0
      transactions?.forEach((tx: any) => {
        currentBalance += Number(tx.amount || 0)
      })

      // Build rolling forecast: actuals + budget (same logic as rolling-forecast/route.ts)
      const rollingForecast: Array<{
        month: string
        type: 'actual' | 'forecast'
        income: number
        expenses: number
        net: number
        balance: number
      }> = []

      // Get all months (actuals + forecast)
      const allMonths = new Set<string>()
      Object.keys(actualsByMonth).forEach(m => allMonths.add(m))
      forecastMonthsList.forEach(m => allMonths.add(m))
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
      const budget = budgetData?.budget || {}

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
          })
        } else if (isFuture && budget[month]) {
          // Future month with budget
          const budgetMonth = budget[month]
          let monthIncome = 0
          let monthExpenses = 0

          Object.keys(budgetMonth).forEach(category => {
            const catData = budgetMonth[category]
            monthIncome += catData.income || 0
            monthExpenses += catData.expenses || 0
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

          // Check if planned items are already in budget (they should be, but double-check)
          const hasPlannedItemsCategory = budgetMonth['Planned Items']
          if (!hasPlannedItemsCategory) {
            monthIncome += plannedIncomeForMonth
            monthExpenses += plannedExpensesForMonth
          }

          const forecastNet = monthIncome - monthExpenses
          runningBalance += forecastNet

          rollingForecast.push({
            month,
            type: 'forecast',
            income: monthIncome,
            expenses: monthExpenses,
            net: forecastNet,
            balance: runningBalance,
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

          // Only add to forecast if there are planned items
          if (plannedIncomeForMonth > 0 || plannedExpensesForMonth > 0) {
            const forecastNet = plannedIncomeForMonth - plannedExpensesForMonth
            runningBalance += forecastNet

            rollingForecast.push({
              month,
              type: 'forecast',
              income: plannedIncomeForMonth,
              expenses: plannedExpensesForMonth,
              net: forecastNet,
              balance: runningBalance,
            })
          }
          // If no budget and no planned items, skip this month (don't add zero values)
        }
      })

      rollingForecastData = { rollingForecast }
    } catch (e) {
      console.error('[Trajectory Analyze] Failed to build rolling forecast:', e)
      rollingForecastData = { rollingForecast: [] }
    }

    // Calculate cash runway and time to zero cash
    let runway: number | null = null
    let timeToZeroCash: number | null = null
    let zeroCashMonth: string | null = null
    let runwayCalculationMethod: 'forecast_balance' | 'average_burn' | null = null
    let avgMonthlyBurn: number | null = null
    
    if (rollingForecastData?.rollingForecast) {
      // Find first month where balance goes to zero or negative
      const firstNegativeIndex = rollingForecastData.rollingForecast.findIndex((f: any) => f.balance <= 0)
      if (firstNegativeIndex >= 0) {
        runway = firstNegativeIndex + 1
        timeToZeroCash = firstNegativeIndex + 1
        zeroCashMonth = rollingForecastData.rollingForecast[firstNegativeIndex].month
        runwayCalculationMethod = 'forecast_balance'
      } else {
        // Calculate based on average monthly change
        const forecastMonthsArray = rollingForecastData.rollingForecast.filter((f: any) => f.type === 'forecast')
        if (forecastMonthsArray.length > 0) {
          const avgMonthlyChange = forecastMonthsArray.reduce((sum: number, m: any) => sum + m.net, 0) / forecastMonthsArray.length
          if (avgMonthlyChange < 0) {
            avgMonthlyBurn = Math.abs(avgMonthlyChange)
            runway = Math.floor(currentBalance / avgMonthlyBurn)
            timeToZeroCash = Math.floor(currentBalance / avgMonthlyBurn)
            runwayCalculationMethod = 'average_burn'
            // Calculate which month this would be
            if (timeToZeroCash > 0 && timeToZeroCash <= forecastMonthsArray.length) {
              zeroCashMonth = forecastMonthsArray[timeToZeroCash - 1].month
            }
          }
        }
      }
    }

    // Calculate runway direction (lengthening or shortening)
    // Compare current runway with previous period's runway
    let runwayDirection: 'lengthening' | 'shortening' | 'stable' | null = null
    if (runway !== null && rollingForecastData?.rollingForecast) {
      // Get last 3 months of actuals to calculate previous runway
      const actualMonths = rollingForecastData.rollingForecast.filter((f: any) => f.type === 'actual')
      if (actualMonths.length >= 3) {
        const recentActuals = actualMonths.slice(-3)
        const avgMonthlyBurn = recentActuals.reduce((sum: number, m: any) => sum + (m.expenses - m.income), 0) / recentActuals.length
        if (avgMonthlyBurn > 0) {
          const previousRunway = Math.floor(currentBalance / avgMonthlyBurn)
          if (previousRunway !== null && runway !== null) {
            if (runway > previousRunway) {
              runwayDirection = 'lengthening'
            } else if (runway < previousRunway) {
              runwayDirection = 'shortening'
            } else {
              runwayDirection = 'stable'
            }
          }
        }
      }
    }

    // Calculate forward cash balance at key points (3 months, 6 months, end of forecast)
    const forwardCashBalances: Array<{ month: string; balance: number }> = []
    if (rollingForecastData?.rollingForecast) {
      const forecastMonths = rollingForecastData.rollingForecast.filter((f: any) => f.type === 'forecast')
      const keyPoints = [3, 6, forecastMonths.length]
      keyPoints.forEach(point => {
        if (point <= forecastMonths.length && forecastMonths[point - 1]) {
          forwardCashBalances.push({
            month: forecastMonths[point - 1].month,
            balance: forecastMonths[point - 1].balance,
          })
        }
      })
    }

    // Find low points in forecast (structural leaks - costs that keep burn elevated)
    const lowPoints = rollingForecastData?.rollingForecast
      ?.filter((f: any) => f.type === 'forecast')
      .map((f: any, idx: number) => ({ ...f, index: idx }))
      .sort((a: any, b: any) => a.balance - b.balance)
      .slice(0, 3) || []
    
    // Identify structural leaks (costs that persist regardless of revenue)
    const structuralLeaks: Array<{ month: string; description: string; impact: number }> = []
    if (rollingForecastData?.rollingForecast) {
      const forecastMonths = rollingForecastData.rollingForecast.filter((f: any) => f.type === 'forecast')
      forecastMonths.forEach((month: any) => {
        if (month.expenses > 0 && month.income === 0) {
          structuralLeaks.push({
            month: month.month,
            description: `Fixed costs of ${month.expenses.toLocaleString()} with no revenue`,
            impact: month.expenses,
          })
        }
      })
    }

    // Count months with actual data vs forecast data
    const actualMonths = rollingForecastData?.rollingForecast?.filter((f: any) => f.type === 'actual') || []
    const forecastMonthsData = rollingForecastData?.rollingForecast?.filter((f: any) => f.type === 'forecast') || []
    const forecastMonthsWithData = forecastMonthsData.filter((f: any) => f.income > 0 || f.expenses > 0)
    const forecastMonthsWithoutData = forecastMonthsData.filter((f: any) => f.income === 0 && f.expenses === 0)
    
    const context = {
      currentBalance,
      runway,
      timeToZeroCash,
      zeroCashMonth,
      runwayDirection,
      runwayCalculationMethod, // How runway was calculated: 'forecast_balance' or 'average_burn'
      avgMonthlyBurn, // Average monthly burn rate used for calculation (if method is 'average_burn')
      forwardCashBalances,
      currentMonth,
      hasBudgetData: !!budgetData,
      rollingForecast: rollingForecastData?.rollingForecast || [],
      actualMonthsCount: actualMonths.length,
      forecastMonthsCount: forecastMonthsData.length,
      forecastMonthsWithDataCount: forecastMonthsWithData.length,
      forecastMonthsWithoutDataCount: forecastMonthsWithoutData.length,
      note: forecastMonthsWithoutData.length > 0 
        ? `Note: ${forecastMonthsWithoutData.length} forecast month(s) have zero values, indicating missing budget data, not business closure.`
        : null,
      lowPoints: lowPoints.map((lp: any) => ({
        month: lp.month,
        balance: lp.balance,
        net: lp.net,
      })),
      structuralLeaks,
      forecastIncome: rollingForecastData?.forecastIncome || 0,
      forecastExpenses: rollingForecastData?.forecastExpenses || 0,
    }

    // Search for relevant knowledge from vector database
    let financialKnowledge: string[] = []
    let userKnowledge: string[] = []
    
    try {
      // Build query for financial knowledge search
      const knowledgeQuery = `Business has ${currentBalance} cash, ${runway !== null ? runway : 'unknown'} months runway. ` +
        `Time to zero cash: ${timeToZeroCash !== null ? timeToZeroCash : 'unknown'} months. ` +
        `Runway direction: ${runwayDirection}. ` +
        `Structural leaks: ${structuralLeaks.length} identified. ` +
        `Where is the business heading financially?`
      
      const financialResults = await searchFinancialKnowledge(knowledgeQuery, undefined, 5, 0.7)
      financialKnowledge = financialResults.map(k => k.content)
      
      // Search for user-specific knowledge
      const userQuery = `User's financial trajectory: ${currentBalance} cash, ${runway !== null ? runway : 'unknown'} months runway, ${timeToZeroCash !== null ? timeToZeroCash : 'unknown'} months to zero cash.`
      
      const userResults = await searchUserKnowledge(userId, userQuery, undefined, 3, 0.7)
      userKnowledge = userResults.map(k => k.content)
    } catch (error: any) {
      // Log but don't fail - knowledge search is optional
      console.warn('[Trajectory Analyze] Knowledge search failed:', error.message)
    }

    const systemPrompt = `You are a financial advisor analyzing a business's cash flow TRAJECTORY and forecast.

${financialKnowledge.length > 0 ? `RELEVANT FINANCIAL KNOWLEDGE:
${financialKnowledge.map((k, i) => `${i + 1}. ${k}`).join('\n')}

` : ''}${userKnowledge.length > 0 ? `USER-SPECIFIC CONTEXT:
${userKnowledge.map((k, i) => `${i + 1}. ${k}`).join('\n')}

` : ''}FOCUS: Answer ONLY "Where am I heading?" - show financial inertia, nothing else.

TRAJECTORY Purpose: Show financial inertia. Trajectory answers: "If we keep behaving like this, where do we end up?"

Inputs:
- Current revenue trend
- Current cost structure
- No heroic assumptions

What you calculate:
- Forward cash balance (projected cash at key points)
- Time to zero cash (when cash runs out if nothing changes)
- Direction of runway (lengthening or shortening)
- Where money leaks become structural (costs that keep burn elevated, do not self-correct, persist regardless of revenue)

CRITICAL CONTEXT:
- The rollingForecast array contains both "actual" months (with real transaction data) and "forecast" months (projections based on budget and planned items)
- If a forecast month shows income: 0, expenses: 0, net: 0, this means NO BUDGET DATA EXISTS for that month, NOT that operations have ceased
- Zero values in forecast months indicate missing budget data, not business closure

DO:
- Analyze trends: where is cash flow heading based on actual data and forecasts?
- Identify trajectory: improving, declining, or stable?
- Calculate time to zero cash based on forecast data
- Identify direction of runway (lengthening or shortening)
- Identify structural leaks (costs that keep burn elevated, do not self-correct, persist regardless of revenue)
- Project forward cash balance at key points

DO NOT:
- Describe current state in detail (that's for STATE)
- Analyze what changed (that's for DELTA)
- Identify risks (that's for EXPOSURE)
- Provide recommendations (that's for CHOICE)
- Interpret zero forecast values as "business stopping"
- Make heroic assumptions

IMPORTANT:
- Focus on months with type: "actual" or forecast months with non-zero values
- If forecast months show zeros, mention that budget data is missing, but do NOT conclude operations stopped
- Use specific numbers, dates, and months from the context
- Focus on trajectory and financial inertia, not current state or risks
- EXPLAIN how runway/timeToZeroCash was calculated:
  * If runwayCalculationMethod is "forecast_balance": Explain that it's based on projected monthly balances in the forecast
  * If runwayCalculationMethod is "average_burn": Explain that it's calculated from average monthly burn rate (avgMonthlyBurn) and current balance
- Always explain the assumptions: "if current income/expense patterns continue" or "if average burn rate continues"

Output format:
"On the current trajectory, cash runs out in [month] without intervention. This is calculated [explain method: from forecast balances OR from average monthly burn of X]."

Trajectory makes urgency visible.

Return a JSON object with this structure:
{
  "summary": "2-3 sentence description of trajectory, e.g., 'On the current trajectory, cash runs out in [month] without intervention.'",
  "insights": [
    {
      "title": "Insight title about trajectory/trends",
      "description": "Description of trends and trajectory with specific numbers and dates (forward cash balance, time to zero, runway direction)",
      "type": "positive" | "neutral" | "concern"
    }
  ],
  "milestones": [
    {
      "title": "Milestone title",
      "description": "Description of important forecast milestone (e.g., cash runs out, low point reached). MUST explain HOW the calculation was made (from forecast balances OR from average burn rate) and what assumptions are made (e.g., 'if current income/expense patterns continue').",
      "month": "YYYY-MM"
    }
  ]
}

Be specific, data-driven, and use actual numbers, dates, and months from the context. Focus ONLY on trajectory and financial inertia.`

    const userPrompt = `Cash Flow TRAJECTORY Data:
${JSON.stringify(context, null, 2)}

Analyze this trajectory and provide insights.`

    let analysis: any = null
    let error: any = null
    let usedProvider: string | null = null

    // Try AI providers with automatic fallback
    try {
      const { callAI } = await import('@/lib/ai-call')
      const { result, provider } = await callAI({
        systemPrompt,
        userPrompt,
        maxTokens: 1500,
        temperature: 0.7,
        section: 'trajectory',
      })
      analysis = result
      usedProvider = provider
    } catch (e: any) {
      error = e
      console.error('[Trajectory Analyze] AI call failed:', e)
    }

    const result = !analysis ? {
      analysis: null,
      summary: generateRuleBasedSummary(context),
      insights: generateRuleBasedInsights(context),
      milestones: generateRuleBasedMilestones(context),
    } : {
      analysis,
      summary: analysis.summary || generateRuleBasedSummary(context),
      insights: analysis.insights || generateRuleBasedInsights(context),
      milestones: analysis.milestones || generateRuleBasedMilestones(context),
    }
    
    // Cache the result (both AI and rule-based)
    setCachedAnalysis(userId, 'trajectory', result)
    
    // Save user knowledge from this analysis (async, don't wait)
    if (analysis && analysis.summary) {
      saveUserKnowledge(
        userId,
        `In TRAJECTORY analysis: Business has ${currentBalance} cash, ${runway !== null ? runway : 'unknown'} months runway. ` +
        `Time to zero cash: ${timeToZeroCash !== null ? timeToZeroCash : 'unknown'} months. ` +
        `Runway direction: ${runwayDirection}. ` +
        `Structural leaks: ${structuralLeaks.length} identified. ` +
        `AI summary: ${analysis.summary}.`,
        'business_context',
        {
          framework_section: 'trajectory',
          timestamp: new Date().toISOString(),
          cash_balance: currentBalance,
          runway: runway,
          time_to_zero_cash: timeToZeroCash,
          runway_direction: runwayDirection,
          structural_leaks: structuralLeaks,
        }
      ).catch((err) => {
        console.warn('[Trajectory Analyze] Failed to save user knowledge:', err.message)
      })
    }
    
    return successResponse({
      ...result,
      message: !analysis 
        ? (error ? `AI analysis failed: ${error.message}. Showing rule-based insights.` : 'AI analysis unavailable.')
        : `AI trajectory analysis completed${usedProvider ? ` (${usedProvider})` : ''}`,
    })
  } catch (e) {
    return errorResponse(e, 'Failed to analyze trajectory')
  }
}

function generateRuleBasedSummary(context: any): string {
  const { runway, currentBalance, lowPoints } = context
  
  if (runway !== null && runway <= 3) {
    return `Critical: Cash runway is only ${runway} months. Immediate action required to extend runway.`
  }
  
  if (runway !== null && runway <= 6) {
    return `Warning: Cash runway is ${runway} months. Monitor cash flow closely and plan for sustainability.`
  }
  
  if (runway === null && currentBalance > 0) {
    return 'Positive: No immediate cash runway limit detected. Current trajectory appears sustainable.'
  }
  
  if (lowPoints.length > 0 && lowPoints[0].balance < currentBalance * 0.5) {
    return `Forecast shows significant low points. Plan for cash management during those periods.`
  }
  
  return 'Review forecast trajectory to understand cash flow patterns and plan accordingly.'
}

function generateRuleBasedInsights(context: any): Array<{
  title: string
  description: string
  type: 'positive' | 'neutral' | 'concern'
}> {
  const insights: Array<{ title: string; description: string; type: 'positive' | 'neutral' | 'concern' }> = []
  const { runway, lowPoints, forecastIncome, forecastExpenses } = context

  if (runway !== null) {
    if (runway <= 3) {
      insights.push({
        title: 'Critical Cash Runway',
        description: `Cash will run out in ${runway} months. Immediate action required.`,
        type: 'concern'
      })
    } else if (runway <= 6) {
      insights.push({
        title: 'Short Cash Runway',
        description: `Cash runway is ${runway} months. Plan for sustainability.`,
        type: 'concern'
      })
    } else {
      insights.push({
        title: 'Adequate Cash Runway',
        description: `Cash runway is ${runway} months. Position looks sustainable.`,
        type: 'positive'
      })
    }
  }

  if (lowPoints.length > 0) {
    insights.push({
      title: 'Forecast Low Points',
      description: `Lowest balance point in forecast: ${lowPoints[0].balance.toLocaleString()} in ${lowPoints[0].month}.`,
      type: lowPoints[0].balance < 0 ? 'concern' : 'neutral'
    })
  }

  if (forecastIncome > 0 && forecastExpenses > 0) {
    const forecastNet = forecastIncome - forecastExpenses
    if (forecastNet < 0) {
      insights.push({
        title: 'Negative Forecast Cash Flow',
        description: `Forecast shows negative net cash flow of ${Math.abs(forecastNet).toLocaleString()}.`,
        type: 'concern'
      })
    }
  }

  return insights.length > 0 ? insights : [{
    title: 'Trajectory Analysis',
    description: 'Review forecast data to understand cash flow trajectory.',
    type: 'neutral'
  }]
}

function generateRuleBasedMilestones(context: any): Array<{
  title: string
  description: string
  month: string
}> {
  const milestones: Array<{ title: string; description: string; month: string }> = []
  const { timeToZeroCash, zeroCashMonth, lowPoints, forwardCashBalances, runwayCalculationMethod, avgMonthlyBurn, currentBalance } = context

  if (timeToZeroCash !== null && zeroCashMonth) {
    let description = ''
    if (runwayCalculationMethod === 'forecast_balance') {
      description = `Based on the rolling forecast, cash balance reaches zero in ${zeroCashMonth}. This is calculated from the projected monthly balances in the forecast, assuming current income and expense patterns continue.`
    } else if (runwayCalculationMethod === 'average_burn' && avgMonthlyBurn) {
      const burnFormatted = avgMonthlyBurn.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      const balanceFormatted = currentBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      description = `Based on average monthly burn rate of ${burnFormatted} (calculated from forecast months), cash balance of ${balanceFormatted} will reach zero in ${zeroCashMonth} if the current burn rate continues. This assumes expenses exceed income by this amount each month.`
    } else {
      description = `Cash balance reaches zero in ${zeroCashMonth} if current trajectory continues.`
    }
    
    milestones.push({
      title: 'Cash Runs Out',
      description,
      month: zeroCashMonth
    })
  }

  if (lowPoints.length > 0) {
    milestones.push({
      title: 'Lowest Balance Point',
      description: `Forecast shows lowest balance of ${lowPoints[0].balance.toLocaleString()}`,
      month: lowPoints[0].month
    })
  }

  if (forwardCashBalances && forwardCashBalances.length > 0) {
    forwardCashBalances.forEach((point: any) => {
      if (point.balance < 0) {
        milestones.push({
          title: 'Negative Cash Balance',
          description: `Cash balance becomes negative in ${point.month}`,
          month: point.month
        })
      }
    })
  }

  return milestones
}
