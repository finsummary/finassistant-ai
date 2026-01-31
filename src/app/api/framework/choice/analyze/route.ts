import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../../_utils'
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/ai-cache'

export const dynamic = 'force-dynamic'

/**
 * AI-powered decision recommendations for CHOICE section
 * Analyzes current financial state, risks, and opportunities to suggest actionable decisions
 */
export async function POST(req: Request) {
  try {
    const userId = await requireAuth()
    
    // Check if refresh is requested
    const body = await req.json().catch(() => ({}))
    const forceRefresh = body?.refresh === true
    
    // Check cache first (unless refresh is forced)
    if (!forceRefresh) {
      const cached = getCachedAnalysis(userId, 'choice')
      if (cached) {
        return successResponse({
          ...cached,
          message: 'AI choice analysis (cached)',
        })
      }
    }
    
    const supabase = await createClient()

    // Get current balance
    const { data: transactions } = await supabase
      .from('Transactions')
      .select('amount')
      .eq('user_id', userId)

    let currentBalance = 0
    transactions?.forEach((tx: any) => {
      currentBalance += Number(tx.amount || 0)
    })

    // Get recent transactions for trend analysis
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    
    const { data: recentTransactions } = await supabase
      .from('Transactions')
      .select('amount, category, booked_at')
      .eq('user_id', userId)
      .gte('booked_at', sixMonthsAgo.toISOString().slice(0, 10))
      .order('booked_at', { ascending: false })

    // Calculate monthly trends
    const monthlyData: Record<string, { income: number; expenses: number; net: number }> = {}
    recentTransactions?.forEach((tx: any) => {
      const month = (tx.booked_at || '').slice(0, 7)
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

    // Get budget
    const { data: budget } = await supabase
      .from('Budget')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Get planned expenses
    const { data: plannedExpenses } = await supabase
      .from('PlannedExpenses')
      .select('*')
      .eq('user_id', userId)
      .order('expected_date', { ascending: true })

    // Get rolling forecast for cash runway
    let cashRunway: number | null = null
    try {
      const { data: allTxs } = await supabase
        .from('Transactions')
        .select('amount, booked_at')
        .eq('user_id', userId)
        .order('booked_at', { ascending: true })

      const actualsByMonth: Record<string, { net: number }> = {}
      allTxs?.forEach((tx: any) => {
        const month = (tx.booked_at || '').slice(0, 7)
        const amount = Number(tx.amount || 0)
        
        if (!actualsByMonth[month]) {
          actualsByMonth[month] = { net: 0 }
        }
        actualsByMonth[month].net += amount
      })

      const forecastMonths = budget?.forecast_months || []
      if (forecastMonths.length > 0) {
        const recentMonths = Object.keys(actualsByMonth).sort().slice(-3)
        if (recentMonths.length > 0) {
          const avgMonthlyChange = recentMonths.reduce((sum, month) => sum + actualsByMonth[month].net, 0) / recentMonths.length
          if (avgMonthlyChange < 0) {
            cashRunway = Math.floor(currentBalance / Math.abs(avgMonthlyChange))
          }
        }
      }
    } catch (e) {
      console.warn('[Choice Analyze] Failed to calculate runway:', e)
    }

    // Get data from all Framework sections
    // STATE data
    const { data: stateTransactions } = await supabase
      .from('Transactions')
      .select('amount, category, booked_at')
      .eq('user_id', userId)
      .order('booked_at', { ascending: false })

    // Use existing 'now' variable from line 28
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    let monthIncome = 0
    let monthExpenses = 0
    let ytdIncome = 0
    let ytdExpenses = 0
    let lastMonthIncome = 0
    let lastMonthExpenses = 0
    let thisMonthIncome = 0
    let thisMonthExpenses = 0

    stateTransactions?.forEach((tx: any) => {
      const amount = Number(tx.amount || 0)
      const txDate = new Date(tx.booked_at)

      if (txDate >= monthStart) {
        if (amount > 0) {
          monthIncome += amount
          thisMonthIncome += amount
        } else {
          monthExpenses += Math.abs(amount)
          thisMonthExpenses += Math.abs(amount)
        }
      }

      if (txDate >= yearStart) {
        if (amount > 0) {
          ytdIncome += amount
        } else {
          ytdExpenses += Math.abs(amount)
        }
      }

      if (txDate >= lastMonth && txDate < thisMonth) {
        if (amount > 0) {
          lastMonthIncome += amount
        } else {
          lastMonthExpenses += Math.abs(amount)
        }
      }
    })

    // DELTA data
    const deltaData = {
      previousMonth: {
        income: lastMonthIncome,
        expenses: lastMonthExpenses,
        net: lastMonthIncome - lastMonthExpenses,
      },
      currentMonth: {
        income: thisMonthIncome,
        expenses: thisMonthExpenses,
        net: thisMonthIncome - thisMonthExpenses,
      },
      changes: {
        income: thisMonthIncome - lastMonthIncome,
        expenses: thisMonthExpenses - lastMonthExpenses,
        net: (thisMonthIncome - thisMonthExpenses) - (lastMonthIncome - lastMonthExpenses),
      },
    }

    // TRAJECTORY data (rolling forecast)
    let trajectoryData = null
    try {
      const { data: allTxs } = await supabase
        .from('Transactions')
        .select('amount, booked_at')
        .eq('user_id', userId)
        .order('booked_at', { ascending: true })

      const actualsByMonth: Record<string, { net: number }> = {}
      allTxs?.forEach((tx: any) => {
        const month = (tx.booked_at || '').slice(0, 7)
        const amount = Number(tx.amount || 0)
        if (!actualsByMonth[month]) actualsByMonth[month] = { net: 0 }
        actualsByMonth[month].net += amount
      })

      const { data: savedBudget } = await supabase
        .from('Budget')
        .select('*')
        .eq('user_id', userId)
        .single()

      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const forecastMonths: string[] = []
      for (let i = 1; i <= 6; i++) {
        const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`
        forecastMonths.push(monthKey)
      }

      const rollingForecast: Array<{ month: string; type: 'actual' | 'forecast'; net: number; balance: number }> = []
      let runningBalance = currentBalance
      const budgetData = savedBudget?.budget_data || {}

      const allMonths = new Set<string>()
      Object.keys(actualsByMonth).forEach(m => allMonths.add(m))
      forecastMonths.forEach(m => allMonths.add(m))
      const sortedMonths = Array.from(allMonths).sort()

      sortedMonths.forEach((month) => {
        if (actualsByMonth[month]) {
          runningBalance += actualsByMonth[month].net
          rollingForecast.push({
            month,
            type: 'actual',
            net: actualsByMonth[month].net,
            balance: runningBalance,
          })
        } else if (forecastMonths.includes(month)) {
          const budgetMonth = budgetData[month] || {}
          let forecastIncome = 0
          let forecastExpenses = 0
          Object.values(budgetMonth).forEach((cat: any) => {
            forecastIncome += Number(cat.income || 0)
            forecastExpenses += Number(cat.expenses || 0)
          })
          const forecastNet = forecastIncome - forecastExpenses
          runningBalance += forecastNet
          rollingForecast.push({
            month,
            type: 'forecast',
            net: forecastNet,
            balance: runningBalance,
          })
        }
      })

      trajectoryData = {
        rollingForecast: rollingForecast.slice(-12), // Last 12 months
        cashRunway,
        avgMonthlyChange: rollingForecast.length > 0 
          ? rollingForecast.reduce((sum, m) => sum + m.net, 0) / rollingForecast.length 
          : 0,
      }
    } catch (e) {
      console.warn('[Choice Analyze] Failed to calculate trajectory:', e)
    }

    // EXPOSURE data (risks)
    let exposureData = null
    try {
      // Get planned income for dependency analysis
      const { data: plannedIncome } = await supabase
        .from('PlannedIncome')
        .select('*')
        .eq('user_id', userId)
        .order('expected_date', { ascending: true })

      const largePlannedIncome = (plannedIncome || [])
        .filter((pi: any) => {
          const piDate = new Date(pi.expected_date)
          return piDate >= now && Number(pi.amount || 0) > currentBalance * 0.2
        })
        .map((pi: any) => ({
          description: pi.description,
          amount: Number(pi.amount || 0),
          expectedDate: pi.expected_date,
        }))

      exposureData = {
        cashRunway,
        hasNoPlannedExpenses: (!plannedExpenses || plannedExpenses.length === 0) && currentBalance > 0,
        largePlannedIncome: largePlannedIncome.length > 0 ? largePlannedIncome[0] : null,
        upcomingExpenses: (plannedExpenses || [])
          .filter((pe: any) => {
            const peDate = new Date(pe.expected_date)
            return peDate >= now
          })
          .slice(0, 5)
          .map((pe: any) => ({
            description: pe.description,
            amount: Number(pe.amount || 0),
            expectedDate: pe.expected_date,
          })),
      }
    } catch (e) {
      console.warn('[Choice Analyze] Failed to calculate exposure:', e)
    }

    // Prepare comprehensive context for LLM
    const context = {
      // STATE
      state: {
        currentBalance,
        currentMonth: {
          income: monthIncome,
          expenses: monthExpenses,
          net: monthIncome - monthExpenses,
        },
        yearToDate: {
          income: ytdIncome,
          expenses: ytdExpenses,
          net: ytdIncome - ytdExpenses,
        },
      },
      // DELTA
      delta: deltaData,
      // TRAJECTORY
      trajectory: trajectoryData,
      // EXPOSURE
      exposure: exposureData,
      // Additional context
      hasBudget: !!budget,
      categoryGrowthRates: budget?.category_growth_rates || {},
      monthlyTrends: Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, data]) => ({
          month,
          income: data.income,
          expenses: data.expenses,
          net: data.net,
        })),
    }

    // Build prompt for LLM
    const systemPrompt = `You are a financial advisor helping a business owner make strategic decisions about their cash flow.

FOCUS: Answer ONLY "What should I do next?" - force intelligent action, nothing else.

CHOICE Purpose: Force intelligent action. Choice answers: "Given reality, what is the highest-leverage move right now?"

Inputs:
- State
- Delta
- Trajectory
- Exposure
- Leak diagnosis (from above)

How decisions are framed:
Each option is evaluated by:
- Runway impact (how many months does this add/subtract from runway?)
- Downside risk (what's the worst case if this goes wrong?)
- Reversibility (can this decision be undone?)
- Optionality created (does this create future options or lock us in?)

How money leaks are addressed:
You don't "cut costs".
You remove or reshape costs that shorten runway without improving trajectory or reducing exposure.

You have access to comprehensive financial data from four framework sections:

1. **STATE** - Current financial position (balance, month-to-date, year-to-date) - use this to understand WHERE they are now
2. **DELTA** - Changes from previous month (income/expense changes) - use this to understand WHAT CHANGED
3. **TRAJECTORY** - Rolling forecast showing actual + projected cash flow - use this to understand WHERE they are HEADING
4. **EXPOSURE** - Risk assessment (runway, dependencies, upcoming expenses) - use this to understand WHAT COULD BREAK

DO:
- Provide 3-5 specific, actionable recommendations based on ALL four sections
- Evaluate each decision by: runway impact, downside risk, reversibility, optionality created
- Prioritize recommendations based on highest leverage (biggest impact on runway with acceptable risk)
- Reference specific data from STATE, DELTA, TRAJECTORY, and EXPOSURE in your rationale
- Make recommendations specific and actionable (not generic advice)
- Focus on removing or reshaping costs that shorten runway without improving trajectory or reducing exposure
- Consider the interplay between all sections

DO NOT:
- Describe current state in detail (that's for STATE)
- Analyze what changed (that's for DELTA)
- Make predictions or forecasts (that's for TRAJECTORY)
- Identify risks (that's for EXPOSURE)
- Provide generic advice without specific actions
- Simply "cut costs" - instead, remove or reshape costs that shorten runway without improving trajectory

Output format:
"This month, priority is reducing fixed costs that reduce runway fastest under stress while stabilising revenue above £X."

Choice is narrow, specific, and time-bound.

Each decision must have:
- A clear, specific description (what exactly to do)
- Cash impact (positive for inflow, negative for outflow, 0 for neutral/setting aside)
- Runway impact (how many months this adds/subtracts from runway)
- Downside risk (low, medium, high)
- Reversibility (reversible, partially_reversible, irreversible)
- Optionality (creates_options, neutral, locks_in)
- Timeframe (immediate = act now, short_term = within 1-3 months, long_term = 3+ months)
- Brief rationale explaining how this addresses specific issues from STATE/DELTA/TRAJECTORY/EXPOSURE and why it's the highest-leverage move

Return a JSON object with this structure:
{
  "decisions": [
    {
      "description": "Specific, actionable decision (e.g., 'Negotiate payment terms with BigClient to receive 50% upfront instead of single payment in June')",
      "cashImpact": number (e.g., 250000 for receiving half upfront, -5000 for reducing expenses, 0 for setting aside reserves),
      "runwayImpact": number (e.g., +3 for adding 3 months to runway, -1 for reducing runway by 1 month),
      "downsideRisk": "low" | "medium" | "high",
      "reversibility": "reversible" | "partially_reversible" | "irreversible",
      "optionality": "creates_options" | "neutral" | "locks_in",
      "timeframe": "immediate" | "short_term" | "long_term",
      "rationale": "Explain how this addresses specific issues from STATE/DELTA/TRAJECTORY/EXPOSURE and why it's the highest-leverage move"
    }
  ],
  "summary": "Brief 2-3 sentence summary, e.g., 'This month, priority is reducing fixed costs that reduce runway fastest under stress while stabilising revenue above £X.'"
}

Be specific, data-driven, and actionable. Reference actual numbers, dates, and trends from the context. Focus ONLY on recommendations.`

    const userPrompt = `Financial Context:
${JSON.stringify(context, null, 2)}

Based on this financial situation, what specific decisions should the business owner consider?`

    let analysis: any = null
    let error: any = null
    let usedProvider: string | null = null

    // Try AI providers with automatic fallback
    try {
      const { callAI } = await import('@/lib/ai-call')
      const { result, provider } = await callAI({
        systemPrompt,
        userPrompt,
        maxTokens: 2000,
        temperature: 0.7,
        section: 'choice',
      })
      analysis = result
      usedProvider = provider
    } catch (e: any) {
      error = e
      console.error('[Choice Analyze] AI call failed:', e)
    }

    const result = !analysis ? {
      decisions: generateRuleBasedDecisions(context),
    } : {
      decisions: analysis.decisions || [],
      summary: analysis.summary || null,
    }
    
    // Cache the result (both AI and rule-based)
    setCachedAnalysis(userId, 'choice', result)
    
    return successResponse({
      ...result,
      message: !analysis 
        ? (error ? `AI analysis failed: ${error.message}. Showing rule-based recommendations.` : 'AI analysis unavailable.')
        : `AI decision recommendations generated${usedProvider ? ` (${usedProvider})` : ''}`,
    })
  } catch (e) {
    return errorResponse(e, 'Failed to analyze choice decisions')
  }
}

function generateRuleBasedDecisions(context: any): Array<{
  description: string
  cashImpact: number
  risk: 'low' | 'medium' | 'high'
  reversibility: 'reversible' | 'partially_reversible' | 'irreversible'
  timeframe: 'immediate' | 'short_term' | 'long_term'
  rationale?: string
}> {
  const decisions: Array<{
    description: string
    cashImpact: number
    risk: 'low' | 'medium' | 'high'
    reversibility: 'reversible' | 'partially_reversible' | 'irreversible'
    timeframe: 'immediate' | 'short_term' | 'long_term'
    rationale?: string
  }> = []

  const state = context.state || {}
  const delta = context.delta || {}
  const trajectory = context.trajectory || {}
  const exposure = context.exposure || {}

  // Decision based on EXPOSURE: Short runway
  const runway = exposure.cashRunway || trajectory.cashRunway
  if (runway !== null && runway <= 3) {
    decisions.push({
      description: 'Reduce monthly expenses to extend runway',
      cashImpact: 0, // Neutral - just reducing outflow
      risk: 'low',
      reversibility: 'reversible',
      timeframe: 'immediate',
      rationale: `EXPOSURE shows only ${runway} months of runway. Reducing expenses is critical to extend cash availability.`,
    })
  }

  // Decision based on EXPOSURE: Dependency on large payment
  if (exposure.largePlannedIncome) {
    const largePayment = exposure.largePlannedIncome
    decisions.push({
      description: `Negotiate payment terms with ${largePayment.description} to receive partial payment upfront`,
      cashImpact: largePayment.amount * 0.3, // Example: 30% upfront
      risk: 'low',
      reversibility: 'reversible',
      timeframe: 'short_term',
      rationale: `EXPOSURE identifies dependency on large payment of ${largePayment.amount.toFixed(2)}. Receiving partial payment upfront reduces risk and improves cash flow timing.`,
    })
  }

  // Decision based on EXPOSURE: Missing planned expenses
  if (exposure.hasNoPlannedExpenses && state.currentBalance > 0) {
    decisions.push({
      description: 'Add known upcoming expenses to planned items',
      cashImpact: 0, // Neutral - just planning
      risk: 'low',
      reversibility: 'reversible',
      timeframe: 'immediate',
      rationale: 'EXPOSURE shows no planned expenses recorded. Adding known expenses (taxes, subscriptions, insurance) improves cash flow visibility.',
    })
  }

  // Decision based on DELTA: Declining income
  if (delta.changes && delta.changes.income < 0) {
    const declinePercent = delta.previousMonth.income > 0 
      ? (Math.abs(delta.changes.income) / delta.previousMonth.income) * 100 
      : 0
    if (declinePercent > 20) {
      decisions.push({
        description: 'Investigate and address income decline',
        cashImpact: Math.abs(delta.changes.income) * 0.5, // Potential recovery
        risk: 'medium',
        reversibility: 'partially_reversible',
        timeframe: 'short_term',
        rationale: `DELTA shows ${declinePercent.toFixed(1)}% income decline from previous month. Investigate root cause and take corrective action.`,
      })
    }
  }

  // Decision based on DELTA: Increasing expenses
  if (delta.changes && delta.changes.expenses > 0) {
    const increasePercent = delta.previousMonth.expenses > 0
      ? (delta.changes.expenses / delta.previousMonth.expenses) * 100
      : 0
    if (increasePercent > 20) {
      decisions.push({
        description: 'Review and optimize expense categories showing significant increases',
        cashImpact: delta.changes.expenses * 0.2, // Potential savings
        risk: 'low',
        reversibility: 'reversible',
        timeframe: 'immediate',
        rationale: `DELTA shows ${increasePercent.toFixed(1)}% expense increase. Review categories to identify optimization opportunities.`,
      })
    }
  }

  // Decision based on TRAJECTORY: Negative forecast months
  if (trajectory.rollingForecast) {
    const negativeForecastMonths = trajectory.rollingForecast.filter((m: any) => m.type === 'forecast' && m.net < 0)
    if (negativeForecastMonths.length > 0) {
      const firstNegative = negativeForecastMonths[0]
      decisions.push({
        description: `Plan for negative cash flow in ${firstNegative.month}`,
        cashImpact: Math.abs(firstNegative.net), // Amount needed
        risk: 'medium',
        reversibility: 'reversible',
        timeframe: 'short_term',
        rationale: `TRAJECTORY forecasts negative cash flow of ${Math.abs(firstNegative.net).toFixed(2)} in ${firstNegative.month}. Plan ahead to cover this shortfall.`,
      })
    }
  }

  // Decision based on Category Growth Rates: High expense growth
  if (context.categoryGrowthRates && Object.keys(context.categoryGrowthRates).length > 0) {
    const highExpenseGrowth = Object.entries(context.categoryGrowthRates)
      .filter(([_, rate]: [string, any]) => {
        const rates = rate as { incomeRate?: number; expenseRate?: number }
        return (rates.expenseRate || 0) > 30
      })
      .map(([category, rate]: [string, any]) => {
        const rates = rate as { incomeRate?: number; expenseRate?: number }
        return { category, expenseRate: rates.expenseRate || 0 }
      })
      .sort((a, b) => b.expenseRate - a.expenseRate)
      .slice(0, 3)

    if (highExpenseGrowth.length > 0) {
      decisions.push({
        description: `Optimize expense categories with high growth: ${highExpenseGrowth.map(c => c.category).join(', ')}`,
        cashImpact: state.currentMonth?.expenses * 0.1 || 0, // Potential savings
        risk: 'low',
        reversibility: 'reversible',
        timeframe: 'immediate',
        rationale: `Category growth rates show ${highExpenseGrowth.length} categor${highExpenseGrowth.length !== 1 ? 'ies' : 'y'} with expense growth >30% (${highExpenseGrowth.map(c => `${c.category}: ${c.expenseRate.toFixed(1)}%`).join(', ')}). Review and optimize to ensure sustainable growth.`,
      })
    }

    // Declining revenue categories
    const decliningRevenue = Object.entries(context.categoryGrowthRates)
      .filter(([_, rate]: [string, any]) => {
        const rates = rate as { incomeRate?: number; expenseRate?: number }
        return (rates.incomeRate || 0) < -20
      })
      .map(([category, rate]: [string, any]) => {
        const rates = rate as { incomeRate?: number; expenseRate?: number }
        return { category, incomeRate: rates.incomeRate || 0 }
      })
      .sort((a, b) => a.incomeRate - b.incomeRate)
      .slice(0, 3)

    if (decliningRevenue.length > 0) {
      decisions.push({
        description: `Address declining revenue in: ${decliningRevenue.map(c => c.category).join(', ')}`,
        cashImpact: Math.abs(decliningRevenue[0].incomeRate) * (state.currentMonth?.income || 0) * 0.5 / 100, // Potential recovery
        risk: 'medium',
        reversibility: 'partially_reversible',
        timeframe: 'short_term',
        rationale: `Category growth rates show declining revenue in ${decliningRevenue.length} categor${decliningRevenue.length !== 1 ? 'ies' : 'y'} (${decliningRevenue.map(c => `${c.category}: ${c.incomeRate.toFixed(1)}%`).join(', ')}). Investigate and take corrective action.`,
      })
    }
  }

  // Decision based on STATE + TRAJECTORY: Healthy cash position
  if (state.currentBalance > 0 && (runway === null || runway > 6) && trajectory.avgMonthlyChange > 0) {
    const avgExpenses = context.monthlyTrends?.slice(-3).reduce((sum: number, m: any) => sum + m.expenses, 0) / 3 || 0
    if (avgExpenses > 0) {
      decisions.push({
        description: 'Build emergency cash reserve (3-6 months expenses)',
        cashImpact: 0, // Neutral - setting aside existing cash
        risk: 'low',
        reversibility: 'reversible',
        timeframe: 'long_term',
        rationale: `STATE shows healthy balance and TRAJECTORY shows positive trend. Building reserve of ${(avgExpenses * 3).toFixed(0)}-${(avgExpenses * 6).toFixed(0)} provides security.`,
      })
    }
  }

  // Decision based on STATE: Strong position allows strategic investment
  if (state.currentBalance > 0 && state.yearToDate?.net > 0 && (runway === null || runway > 6)) {
    decisions.push({
      description: 'Consider strategic investment or growth spending',
      cashImpact: -state.currentBalance * 0.1,
      risk: 'medium',
      reversibility: 'partially_reversible',
      timeframe: 'long_term',
      rationale: `STATE shows strong YTD performance (net: ${state.yearToDate.net.toFixed(2)}) and healthy runway. Strategic investments can accelerate growth.`,
    })
  }

  // Default decision if no specific recommendations
  if (decisions.length === 0) {
    decisions.push({
      description: 'Monitor cash flow trends and maintain current strategy',
      cashImpact: 0,
      risk: 'low',
      reversibility: 'reversible',
      timeframe: 'immediate',
      rationale: 'Continue monitoring STATE, DELTA, TRAJECTORY, and EXPOSURE sections and adjust strategy as needed.',
    })
  }

  return decisions.slice(0, 5)
}
