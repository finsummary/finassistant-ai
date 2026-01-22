import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../../_utils'

export const dynamic = 'force-dynamic'

/**
 * AI-powered risk assessment for EXPOSURE section
 * Analyzes actual transactions, budget, and variances to identify risks
 */
export async function POST() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    // Get actual transactions (last 6 months)
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    
    const { data: transactions, error: txError } = await supabase
      .from('Transactions')
      .select('amount, category, booked_at, description')
      .eq('user_id', userId)
      .gte('booked_at', sixMonthsAgo.toISOString().slice(0, 10))
      .order('booked_at', { ascending: false })

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`)
    }

    // Get current balance
    let currentBalance = 0
    transactions?.forEach((tx: any) => {
      currentBalance += Number(tx.amount || 0)
    })

    // Get budget data
    const { data: budget, error: budgetError } = await supabase
      .from('Budget')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Calculate variance data directly
    let varianceData = null
    if (budget && !budgetError) {
      try {
        // Get actual transactions grouped by month
        const { data: allTransactions } = await supabase
          .from('Transactions')
          .select('amount, category, booked_at')
          .eq('user_id', userId)

        const actualsByMonth: Record<string, Record<string, { income: number; expenses: number }>> = {}
        allTransactions?.forEach((tx: any) => {
          const month = (tx.booked_at || '').slice(0, 7)
          const category = tx.category || 'Uncategorized'
          const amount = Number(tx.amount || 0)
          
          if (!actualsByMonth[month]) actualsByMonth[month] = {}
          if (!actualsByMonth[month][category]) actualsByMonth[month][category] = { income: 0, expenses: 0 }
          
          if (amount >= 0) {
            actualsByMonth[month][category].income += amount
          } else {
            actualsByMonth[month][category].expenses += Math.abs(amount)
          }
        })

        // Calculate variance summary
        const budgetData = budget.budget_data || {}
        const forecastMonths = budget.forecast_months || []
        let totalVariance = 0
        let monthsWithVariance = 0
        let largestVariance = 0

        forecastMonths.forEach((month: string) => {
          const actual = actualsByMonth[month]
          const planned = budgetData[month]
          if (actual && planned) {
            let monthVariance = 0
            Object.keys({ ...actual, ...planned }).forEach((cat: string) => {
              const act = actual[cat] || { income: 0, expenses: 0 }
              const plan = planned[cat] || { income: 0, expenses: 0 }
              const catVariance = (act.income - plan.income) - (act.expenses - plan.expenses)
              monthVariance += Math.abs(catVariance)
            })
            if (monthVariance > 0) {
              monthsWithVariance++
              totalVariance += monthVariance
              largestVariance = Math.max(largestVariance, monthVariance)
            }
          }
        })

        varianceData = {
          summary: {
            totalVariance,
            monthsWithVariance,
          },
          largestVariance,
        }
      } catch (e) {
        console.warn('[Exposure Analyze] Failed to calculate variance:', e)
      }
    }

    // Get full rolling forecast data (reuse the logic from rolling-forecast API)
    let rollingForecast = null
    try {
      // Import the rolling forecast calculation logic
      // For now, we'll fetch from the actual API endpoint
      // In production, you might want to extract this into a shared utility
      const { data: allTxs } = await supabase
        .from('Transactions')
        .select('amount, category, booked_at')
        .eq('user_id', userId)
        .order('booked_at', { ascending: true })

      // Group actual transactions by month
      const actualsByMonth: Record<string, { income: number; expenses: number; net: number }> = {}
      allTxs?.forEach((tx: any) => {
        const month = (tx.booked_at || '').slice(0, 7)
        const amount = Number(tx.amount || 0)
        
        if (!actualsByMonth[month]) {
          actualsByMonth[month] = { income: 0, expenses: 0, net: 0 }
        }
        
        if (amount >= 0) {
          actualsByMonth[month].income += amount
        } else {
          actualsByMonth[month].expenses += Math.abs(amount)
        }
        actualsByMonth[month].net = actualsByMonth[month].income - actualsByMonth[month].expenses
      })

      // Get budget for forecast
      const { data: savedBudget } = await supabase
        .from('Budget')
        .select('*')
        .eq('user_id', userId)
        .single()

      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      
      // Build forecast months (next 6 months)
      const forecastMonths: string[] = []
      for (let i = 1; i <= 6; i++) {
        const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`
        forecastMonths.push(monthKey)
      }

      // Build rolling forecast array with actuals and forecasts
      const rollingForecastArray: Array<{
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
      forecastMonths.forEach(m => allMonths.add(m))
      const sortedMonths = Array.from(allMonths).sort()

      // Calculate starting balance
      let startingBalance = 0
      const lastActualMonth = sortedMonths.filter(m => actualsByMonth[m] && m <= currentMonth).pop()
      if (lastActualMonth) {
        allTxs?.forEach((tx: any) => {
          const txMonth = (tx.booked_at || '').slice(0, 7)
          if (txMonth <= lastActualMonth) {
            startingBalance += Number(tx.amount || 0)
          }
        })
      } else {
        startingBalance = currentBalance
      }

      // Build rolling forecast
      let runningBalance = startingBalance
      const budgetData = savedBudget?.budget_data || {}

      sortedMonths.forEach((month) => {
        if (actualsByMonth[month]) {
          // Actual month
          const actual = actualsByMonth[month]
          runningBalance += actual.net
          rollingForecastArray.push({
            month,
            type: 'actual',
            income: actual.income,
            expenses: actual.expenses,
            net: actual.net,
            balance: runningBalance,
          })
        } else if (forecastMonths.includes(month)) {
          // Forecast month - use budget data
          const budgetMonth = budgetData[month] || {}
          let forecastIncome = 0
          let forecastExpenses = 0
          
          Object.values(budgetMonth).forEach((cat: any) => {
            forecastIncome += Number(cat.income || 0)
            forecastExpenses += Number(cat.expenses || 0)
          })
          
          const forecastNet = forecastIncome - forecastExpenses
          runningBalance += forecastNet
          
          rollingForecastArray.push({
            month,
            type: 'forecast',
            income: forecastIncome,
            expenses: forecastExpenses,
            net: forecastNet,
            balance: runningBalance,
          })
        }
      })

      // Calculate summary
      const actualMonths = rollingForecastArray.filter(f => f.type === 'actual')
      const forecastMonths_data = rollingForecastArray.filter(f => f.type === 'forecast')
      
      const summary = {
        actual: {
          months: actualMonths.length,
          income: actualMonths.reduce((sum, m) => sum + m.income, 0),
          expenses: actualMonths.reduce((sum, m) => sum + m.expenses, 0),
          net: actualMonths.reduce((sum, m) => sum + m.net, 0),
        },
        forecast: {
          months: forecastMonths_data.length,
          income: forecastMonths_data.reduce((sum, m) => sum + m.income, 0),
          expenses: forecastMonths_data.reduce((sum, m) => sum + m.expenses, 0),
          net: forecastMonths_data.reduce((sum, m) => sum + m.net, 0),
        },
        total: {
          months: rollingForecastArray.length,
          income: rollingForecastArray.reduce((sum, m) => sum + m.income, 0),
          expenses: rollingForecastArray.reduce((sum, m) => sum + m.expenses, 0),
          net: rollingForecastArray.reduce((sum, m) => sum + m.net, 0),
        },
      }

      rollingForecast = {
        rollingForecast: rollingForecastArray,
        currentBalance: startingBalance,
        summary,
      }
    } catch (e) {
      console.warn('[Exposure Analyze] Failed to calculate rolling forecast:', e)
    }

    // Get planned income and expenses
    const [plannedIncomeResult, plannedExpensesResult] = await Promise.all([
      supabase.from('PlannedIncome').select('*').eq('user_id', userId).order('expected_date', { ascending: true }),
      supabase.from('PlannedExpenses').select('*').eq('user_id', userId).order('expected_date', { ascending: true })
    ])

    const plannedIncome = plannedIncomeResult.data
    const plannedExpenses = plannedExpensesResult.data

    // Prepare data summary for LLM
    const monthlyData: Record<string, { income: number; expenses: number; net: number }> = {}
    transactions?.forEach((tx: any) => {
      const month = (tx.booked_at || '').slice(0, 7) // YYYY-MM
      const amount = Number(tx.amount || 0)
      
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expenses: 0, net: 0 }
      }
      
      if (amount >= 0) {
        monthlyData[month].income += amount
      } else {
        monthlyData[month].expenses += Math.abs(amount)
      }
      monthlyData[month].net = monthlyData[month].income - monthlyData[month].expenses
    })

    // Calculate cash runway
    let cashRunway: number | null = null
    if (rollingForecast?.rollingForecast) {
      const firstNegativeIndex = rollingForecast.rollingForecast.findIndex((f: any) => f.balance <= 0)
      if (firstNegativeIndex >= 0) {
        cashRunway = firstNegativeIndex + 1
      } else {
        const forecastMonths = rollingForecast.rollingForecast.filter((f: any) => f.type === 'forecast')
        if (forecastMonths.length > 0) {
          const avgMonthlyChange = forecastMonths.reduce((sum: number, m: any) => sum + m.net, 0) / forecastMonths.length
          if (avgMonthlyChange < 0) {
            cashRunway = Math.floor(currentBalance / Math.abs(avgMonthlyChange))
          }
        }
      }
    }

    // Prepare context for LLM
    const context = {
      currentBalance,
      cashRunway,
      monthlyTrends: Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6) // Last 6 months
        .map(([month, data]) => ({
          month,
          income: data.income,
          expenses: data.expenses,
          net: data.net,
        })),
      budgetSummary: budget ? {
        horizon: budget.horizon,
        forecastMonths: budget.forecast_months?.length || 0,
        hasBudget: true,
        categoryGrowthRates: budget.category_growth_rates || {},
      } : { hasBudget: false },
      varianceSummary: varianceData ? {
        monthsWithVariance: varianceData.variance?.length || 0,
        totalVariance: varianceData.summary?.totalVariance || 0,
        largestVariance: varianceData.variance
          ?.map((v: any) => Math.abs(v.totalVariance))
          .sort((a: number, b: number) => b - a)[0] || 0,
      } : null,
      plannedIncome: (plannedIncome || [])
        .filter((pi: any) => {
          const piDate = new Date(pi.expected_date)
          return piDate >= now
        })
        .slice(0, 10)
        .map((pi: any) => ({
          description: pi.description,
          amount: Number(pi.amount || 0),
          expectedDate: pi.expected_date,
          recurrence: pi.recurrence,
        })),
      upcomingExpenses: (plannedExpenses || [])
        .filter((pe: any) => {
          const peDate = new Date(pe.expected_date)
          return peDate >= now
        })
        .slice(0, 10)
        .map((pe: any) => ({
          description: pe.description,
          amount: Number(pe.amount || 0),
          expectedDate: pe.expected_date,
          recurrence: pe.recurrence,
        })),
      rollingForecast: rollingForecast ? {
        months: rollingForecast.rollingForecast?.slice(-12) || [], // Last 12 months for analysis
        summary: rollingForecast.summary,
        currentBalance: rollingForecast.currentBalance,
        // Key insights
        forecastMonths: rollingForecast.rollingForecast?.filter((f: any) => f.type === 'forecast').length || 0,
        lowestBalance: rollingForecast.rollingForecast?.reduce((min: number, f: any) => Math.min(min, f.balance), Infinity) || null,
        lowestBalanceMonth: rollingForecast.rollingForecast?.reduce((lowest: any, f: any) => 
          !lowest || f.balance < lowest.balance ? f : lowest, null
        )?.month || null,
      } : null,
    }

    // Check for AI provider
    const openaiKey = process.env.OPENAI_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY
    const provider = (process.env.AI_PROVIDER || (geminiKey ? 'gemini' : 'openai')).toLowerCase()

    if (provider === 'openai' && !openaiKey && !geminiKey) {
      // Fallback to rule-based analysis if no AI key
      return successResponse({
        analysis: null,
        risks: generateRuleBasedRisks(context),
        message: 'AI analysis unavailable. Showing rule-based risk assessment.',
      })
    }

    // Build prompt for LLM
    const systemPrompt = `You are a financial risk analyst. Analyze the provided financial data and identify potential risks, concerns, and opportunities.

CRITICAL: You MUST identify risks even if the financial situation looks healthy. Look for:
1. **Dependency risks**: Large single payments, client concentration, revenue concentration
2. **Cash flow sustainability**: Runway calculations, burn rate, monthly trends
3. **Budget vs actual variances**: Spending patterns, revenue shortfalls, unexpected expenses
4. **Missing data risks**: Absence of planned expenses when there should be some, incomplete budget data
5. **Trend analysis**: Declining net income, increasing expenses, revenue volatility
6. **Timing risks**: Large payments due at specific dates, seasonal patterns
7. **Operational risks**: Lack of expense planning, over-reliance on future income

IMPORTANT: 
- If you see a large planned income item (especially >20% of current balance), this is a DEPENDENCY RISK.
- If there are NO planned expenses but the business is operating, this is a MISSING DATA RISK.
- Analyze the rollingForecast data to identify:
  * Months where balance drops significantly
  * Forecast months with negative net cash flow
  * Discrepancies between actual trends and forecast projections
  * Low points in the forecast that could cause cash flow issues

Return a JSON object with this structure:
{
  "overallRisk": "low" | "medium" | "high",
  "summary": "Brief 2-3 sentence summary of financial health and main risks",
  "risks": [
    {
      "severity": "low" | "medium" | "high",
      "category": "cash_flow" | "expenses" | "revenue" | "budget" | "trend" | "dependency" | "data_quality",
      "title": "Short risk title (e.g., 'Dependency on Single Large Payment')",
      "description": "Detailed explanation of the risk with specific numbers and dates",
      "impact": "What could happen if this risk materializes (be specific)",
      "recommendation": "What action should be taken to mitigate this risk"
    }
  ],
  "opportunities": [
    {
      "title": "Opportunity title",
      "description": "Description of positive opportunity or trend"
    }
  ]
}

Be specific, data-driven, and actionable. Use actual numbers, dates, and amounts from the context. Always identify at least 2-3 risks if there is any financial data.`

    const userPrompt = `Financial Context:
${JSON.stringify(context, null, 2)}

Analyze this financial situation and provide a comprehensive risk assessment.`

    let analysis: any = null
    let error: any = null

    // Try OpenAI first
    if (provider === 'openai' && openaiKey) {
      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
          }),
        })

        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error?.message || 'OpenAI API error')
        
        const responseText = data.choices?.[0]?.message?.content || '{}'
        analysis = JSON.parse(responseText)
      } catch (e: any) {
        error = e
        console.error('[Exposure Analyze] OpenAI error:', e)
      }
    }

    // Fallback to Gemini
    if (!analysis && geminiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiKey}`
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `${systemPrompt}\n\n${userPrompt}\n\nReturn only valid JSON, no markdown formatting.`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2000,
              responseMimeType: 'application/json',
            },
          }),
        })

        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error?.message || 'Gemini API error')
        
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        analysis = JSON.parse(responseText)
      } catch (e: any) {
        error = e
        console.error('[Exposure Analyze] Gemini error:', e)
      }
    }

    // Fallback to rule-based if AI fails
    if (!analysis) {
      return successResponse({
        analysis: null,
        risks: generateRuleBasedRisks(context),
        message: error ? `AI analysis failed: ${error.message}. Showing rule-based assessment.` : 'AI analysis unavailable.',
      })
    }

    return successResponse({
      analysis,
      risks: analysis.risks || [],
      opportunities: analysis.opportunities || [],
      message: 'AI risk assessment completed',
    })
  } catch (e) {
    return errorResponse(e, 'Failed to analyze exposure risks')
  }
}

function generateRuleBasedRisks(context: any): Array<{
  severity: 'low' | 'medium' | 'high'
  category: string
  title: string
  description: string
  impact?: string
  recommendation?: string
}> {
  const risks: Array<{
    severity: 'low' | 'medium' | 'high'
    category: string
    title: string
    description: string
    impact?: string
    recommendation?: string
  }> = []

  // Dependency risk: Large planned income items
  if (context.plannedIncome && context.plannedIncome.length > 0) {
    const largeIncomeItems = context.plannedIncome.filter((pi: any) => pi.amount > context.currentBalance * 0.2)
    if (largeIncomeItems.length > 0) {
      const largest = largeIncomeItems[0]
      risks.push({
        severity: largest.amount > context.currentBalance * 0.5 ? 'high' : 'medium',
        category: 'dependency',
        title: 'Dependency on Large Payment',
        description: `Significant planned income of ${largest.amount.toFixed(2)} from "${largest.description}" expected on ${new Date(largest.expectedDate).toLocaleDateString()}. This represents ${((largest.amount / context.currentBalance) * 100).toFixed(1)}% of current balance.`,
        impact: `If this payment is delayed, reduced, or cancelled, it could significantly impact projected cash flow, especially around ${new Date(largest.expectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`,
        recommendation: 'Assess contingency plans for this major client. Consider milestone payments or payment schedules to reduce dependency on a single large payment.',
      })
    }
  }

  // Missing data risk: No planned expenses
  if ((!context.upcomingExpenses || context.upcomingExpenses.length === 0) && context.currentBalance > 0) {
    risks.push({
      severity: 'low',
      category: 'data_quality',
      title: 'Absence of Planned Expenses',
      description: 'No planned expenses are currently recorded. This could be a blind spot in cash flow planning.',
      impact: 'Known but unrecorded expenses (annual subscriptions, tax payments, insurance renewals, equipment purchases) could create unexpected cash flow drains.',
      recommendation: 'Review and add any known upcoming large or recurring expenses to planned items, such as annual software licenses, VAT/Self-Assessment tax payments, business insurance renewals, or major equipment purchases.',
    })
  }

  // Cash runway risks
  if (context.cashRunway !== null) {
    if (context.cashRunway <= 1) {
      risks.push({
        severity: 'high',
        category: 'cash_flow',
        title: 'Critical Cash Runway',
        description: `Cash will run out in ${context.cashRunway} month${context.cashRunway !== 1 ? 's' : ''}.`,
        impact: 'Business operations may be at risk if cash runs out.',
        recommendation: 'Immediately reduce expenses or secure additional funding.',
      })
    } else if (context.cashRunway <= 3) {
      risks.push({
        severity: 'medium',
        category: 'cash_flow',
        title: 'Short Cash Runway',
        description: `Cash runway is ${context.cashRunway} months.`,
        impact: 'Limited time to improve cash flow before running out of funds.',
        recommendation: 'Review expenses and revenue streams to extend runway.',
      })
    } else if (context.cashRunway <= 6) {
      risks.push({
        severity: 'low',
        category: 'cash_flow',
        title: 'Moderate Cash Runway',
        description: `Cash runway is ${context.cashRunway} months.`,
        recommendation: 'Monitor cash flow trends and plan for sustainability.',
      })
    }
  }

  // Trend analysis: Declining net income
  if (context.monthlyTrends && context.monthlyTrends.length >= 2) {
    const recent = context.monthlyTrends.slice(-2)
    if (recent.length === 2) {
      const lastMonth = recent[recent.length - 1]
      const previousMonth = recent[recent.length - 2]
      if (lastMonth.net < previousMonth.net && lastMonth.net > 0) {
        const decline = previousMonth.net - lastMonth.net
        const declinePercent = (decline / previousMonth.net) * 100
        if (declinePercent > 20) {
          risks.push({
            severity: 'low',
            category: 'trend',
            title: 'Declining Monthly Net Income',
            description: `Current month net income (${lastMonth.net.toFixed(2)}) is ${declinePercent.toFixed(1)}% lower than previous month (${previousMonth.net.toFixed(2)}).`,
            impact: 'If this trend continues, it could eventually impact cash runway, even if current balance is healthy.',
            recommendation: 'Monitor this trend closely. Investigate whether this is seasonal variation or a concerning pattern.',
          })
        }
      }
    }
    
    // Negative cash flow trend
    const avgNet = recent.reduce((sum: number, m: any) => sum + m.net, 0) / recent.length
    if (avgNet < 0) {
      risks.push({
        severity: avgNet < -context.currentBalance * 0.1 ? 'high' : 'medium',
        category: 'trend',
        title: 'Negative Cash Flow Trend',
        description: `Average monthly net cash flow is negative: ${avgNet.toFixed(2)}.`,
        impact: 'Sustained negative cash flow will deplete reserves.',
        recommendation: 'Identify and address the root cause of negative cash flow.',
      })
    }
  }

  // Large upcoming expenses
  if (context.upcomingExpenses && context.upcomingExpenses.length > 0) {
    const largeExpenses = context.upcomingExpenses.filter((e: any) => e.amount > context.currentBalance * 0.2)
    if (largeExpenses.length > 0) {
      risks.push({
        severity: 'medium',
        category: 'expenses',
        title: 'Large Upcoming Expenses',
        description: `${largeExpenses.length} large expense${largeExpenses.length !== 1 ? 's' : ''} planned that exceed 20% of current balance.`,
        impact: 'These expenses could significantly impact cash reserves.',
        recommendation: 'Plan for these expenses and ensure sufficient cash is available.',
      })
    }
  }

  // Budget variance
  if (context.varianceSummary && context.varianceSummary.largestVariance > 0) {
    if (context.varianceSummary.largestVariance > context.currentBalance * 0.15) {
      risks.push({
        severity: 'medium',
        category: 'budget',
        title: 'Significant Budget Variance',
        description: `Actual spending/revenue differs significantly from budget (variance: ${context.varianceSummary.largestVariance.toFixed(2)}).`,
        impact: 'Budget projections may not be reliable for planning.',
        recommendation: 'Review and adjust budget assumptions based on actual performance.',
      })
    }
  }

  // Rolling Forecast analysis
  if (context.rollingForecast && context.rollingForecast.months) {
    const forecastMonths = context.rollingForecast.months.filter((m: any) => m.type === 'forecast')
    
    // Check for negative forecast months
    const negativeForecastMonths = forecastMonths.filter((m: any) => m.net < 0)
    if (negativeForecastMonths.length > 0) {
      risks.push({
        severity: negativeForecastMonths.length > 2 ? 'medium' : 'low',
        category: 'cash_flow',
        title: 'Negative Cash Flow in Forecast',
        description: `${negativeForecastMonths.length} forecast month${negativeForecastMonths.length !== 1 ? 's' : ''} show negative net cash flow.`,
        impact: 'Projected negative cash flow could deplete reserves if not addressed.',
        recommendation: 'Review forecast assumptions and consider adjusting expenses or increasing revenue projections.',
      })
    }

    // Check for low balance points
    if (context.rollingForecast.lowestBalance !== null && context.rollingForecast.lowestBalance < context.currentBalance * 0.5) {
      risks.push({
        severity: context.rollingForecast.lowestBalance < 0 ? 'high' : 'medium',
        category: 'cash_flow',
        title: 'Low Balance Point in Forecast',
        description: `Forecast shows balance dropping to ${context.rollingForecast.lowestBalance.toFixed(2)} in ${context.rollingForecast.lowestBalanceMonth || 'future month'}.`,
        impact: 'Low balance points could create cash flow constraints.',
        recommendation: 'Plan for this low point by building reserves or adjusting timing of expenses.',
      })
    }

    // Check forecast vs actual trends
    const actualMonths = context.rollingForecast.months.filter((m: any) => m.type === 'actual')
    if (actualMonths.length >= 3 && forecastMonths.length > 0) {
      const recentActualAvg = actualMonths.slice(-3).reduce((sum: number, m: any) => sum + m.net, 0) / 3
      const forecastAvg = forecastMonths.reduce((sum: number, m: any) => sum + m.net, 0) / forecastMonths.length
      
      if (recentActualAvg > 0 && forecastAvg < 0) {
        risks.push({
          severity: 'medium',
          category: 'trend',
          title: 'Forecast Shows Reversal of Positive Trend',
          description: `Recent actual months show positive net cash flow (avg: ${recentActualAvg.toFixed(2)}), but forecast projects negative (avg: ${forecastAvg.toFixed(2)}).`,
          impact: 'This reversal could indicate overly conservative revenue projections or missing expense reductions.',
          recommendation: 'Review forecast assumptions to ensure they reflect current positive trends.',
        })
      }
    }
  }

  // Category Growth Rates analysis
  if (context.budgetSummary?.categoryGrowthRates) {
    const growthRates = context.budgetSummary.categoryGrowthRates
    const highGrowthCategories = Object.entries(growthRates)
      .filter(([_, rate]: [string, any]) => {
        const rates = rate as { incomeRate?: number; expenseRate?: number }
        return Math.abs(rates.incomeRate || 0) > 30 || Math.abs(rates.expenseRate || 0) > 30
      })
      .map(([category, rate]: [string, any]) => {
        const rates = rate as { incomeRate?: number; expenseRate?: number }
        return { 
          category, 
          incomeRate: rates.incomeRate || 0,
          expenseRate: rates.expenseRate || 0,
        }
      })
      .sort((a, b) => Math.max(Math.abs(b.incomeRate), Math.abs(b.expenseRate)) - Math.max(Math.abs(a.incomeRate), Math.abs(a.expenseRate)))
      .slice(0, 5)

    if (highGrowthCategories.length > 0) {
      const highExpenseGrowth = highGrowthCategories.filter(c => c.expenseRate > 30)
      if (highExpenseGrowth.length > 0) {
        risks.push({
          severity: 'medium',
          category: 'expenses',
          title: 'High Expense Growth Rates',
          description: `${highExpenseGrowth.length} categor${highExpenseGrowth.length !== 1 ? 'ies' : 'y'} showing high expense growth rates (>30%): ${highExpenseGrowth.map(c => `${c.category} (${c.expenseRate.toFixed(1)}%)`).join(', ')}.`,
          impact: 'Rapidly growing expenses could outpace revenue growth and impact cash flow sustainability.',
          recommendation: 'Review these categories to ensure growth is sustainable and aligned with business strategy.',
        })
      }

      const decliningRevenueCategories = highGrowthCategories.filter(c => c.incomeRate < -20)
      if (decliningRevenueCategories.length > 0) {
        risks.push({
          severity: 'medium',
          category: 'revenue',
          title: 'Declining Revenue Categories',
          description: `${decliningRevenueCategories.length} categor${decliningRevenueCategories.length !== 1 ? 'ies' : 'y'} showing declining revenue growth: ${decliningRevenueCategories.map(c => `${c.category} (${c.incomeRate.toFixed(1)}%)`).join(', ')}.`,
          impact: 'Declining revenue categories may indicate market changes or competitive pressures.',
          recommendation: 'Investigate root causes and consider strategies to stabilize or replace these revenue streams.',
        })
      }
    }
  }

  return risks
}
