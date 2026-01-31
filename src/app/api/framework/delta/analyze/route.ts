import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../../_utils'
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/ai-cache'

export const dynamic = 'force-dynamic'

/**
 * AI-powered analysis for DELTA section
 * Analyzes month-over-month changes and trends
 */
export async function POST(req: Request) {
  try {
    const userId = await requireAuth()
    
    // Check if refresh is requested
    const body = await req.json().catch(() => ({}))
    const forceRefresh = body?.refresh === true
    
    // Check cache first (unless refresh is forced)
    if (!forceRefresh) {
      const cached = getCachedAnalysis(userId, 'delta')
      if (cached) {
        return successResponse({
          ...cached,
          message: 'AI delta analysis (cached)',
        })
      }
    }
    
    const supabase = await createClient()

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    // Get actual transactions for current period
    const { data: transactions } = await supabase
      .from('Transactions')
      .select('amount, category, booked_at')
      .eq('user_id', userId)
      .order('booked_at', { ascending: false })

    // Calculate actuals for current period
    let currentPeriodIncome = 0
    let currentPeriodExpenses = 0
    const currentPeriodByCategory: Record<string, { income: number; expenses: number }> = {}

    transactions?.forEach((tx: any) => {
      const txDate = new Date(tx.booked_at)
      const amount = Number(tx.amount || 0)
      const category = tx.category || 'Uncategorized'

      if (txDate >= currentMonthStart) {
        if (amount >= 0) {
          currentPeriodIncome += amount
          if (!currentPeriodByCategory[category]) {
            currentPeriodByCategory[category] = { income: 0, expenses: 0 }
          }
          currentPeriodByCategory[category].income += amount
        } else {
          currentPeriodExpenses += Math.abs(amount)
          if (!currentPeriodByCategory[category]) {
            currentPeriodByCategory[category] = { income: 0, expenses: 0 }
          }
          currentPeriodByCategory[category].expenses += Math.abs(amount)
        }
      }
    })

    const currentPeriodNet = currentPeriodIncome - currentPeriodExpenses

    // Get last rolling forecast (from saved budget) to compare against
    let lastForecast: any = null
    try {
      const { data: savedBudget } = await supabase
        .from('Budget')
        .select('budget_data, forecast_months')
        .eq('user_id', userId)
        .single()

      if (savedBudget && savedBudget.budget_data && savedBudget.forecast_months) {
        // Get forecast for current month from last rolling forecast
        const budgetData = savedBudget.budget_data
        if (budgetData[currentMonth]) {
          let forecastIncome = 0
          let forecastExpenses = 0
          const forecastByCategory: Record<string, { income: number; expenses: number }> = {}

          Object.entries(budgetData[currentMonth]).forEach(([category, catData]: [string, any]) => {
            forecastIncome += catData.income || 0
            forecastExpenses += catData.expenses || 0
            forecastByCategory[category] = {
              income: catData.income || 0,
              expenses: catData.expenses || 0,
            }
          })

          lastForecast = {
            income: forecastIncome,
            expenses: forecastExpenses,
            net: forecastIncome - forecastExpenses,
            byCategory: forecastByCategory,
          }
        }
      }
    } catch (e) {
      console.warn('[Delta Analyze] Failed to load last forecast:', e)
    }

    // If no saved forecast, use previous month actuals as baseline (fallback)
    let previousMonthIncome = 0
    let previousMonthExpenses = 0
    if (!lastForecast) {
      transactions?.forEach((tx: any) => {
        const txDate = new Date(tx.booked_at)
        const amount = Number(tx.amount || 0)
        if (txDate >= previousMonthStart && txDate <= previousMonthEnd) {
          if (amount >= 0) {
            previousMonthIncome += amount
          } else {
            previousMonthExpenses += Math.abs(amount)
          }
        }
      })
      lastForecast = {
        income: previousMonthIncome,
        expenses: previousMonthExpenses,
        net: previousMonthIncome - previousMonthExpenses,
        byCategory: {},
      }
    }

    // Calculate variances (actuals vs last forecast)
    const revenueVariance = currentPeriodIncome - (lastForecast.income || 0)
    const costVariance = currentPeriodExpenses - (lastForecast.expenses || 0)
    const burnVariance = currentPeriodNet - (lastForecast.net || 0)

    // Calculate runway variance (need to get current and previous runway)
    let currentRunway: number | null = null
    let previousRunway: number | null = null
    let runwayVariance: number | null = null

    try {
      // Get current balance for runway calculation
      let currentBalance = 0
      transactions?.forEach((tx: any) => {
        currentBalance += Number(tx.amount || 0)
      })

      // Calculate current runway (from STATE)
      const avgMonthlyBurn = currentPeriodExpenses - currentPeriodIncome
      if (avgMonthlyBurn > 0 && currentBalance > 0) {
        currentRunway = Math.floor(currentBalance / avgMonthlyBurn)
      }

      // Calculate previous runway (from last forecast)
      const previousAvgMonthlyBurn = (lastForecast.expenses || 0) - (lastForecast.income || 0)
      if (previousAvgMonthlyBurn > 0 && currentBalance > 0) {
        previousRunway = Math.floor(currentBalance / previousAvgMonthlyBurn)
      }

      if (currentRunway !== null && previousRunway !== null) {
        runwayVariance = currentRunway - previousRunway
      }
    } catch (e) {
      console.warn('[Delta Analyze] Failed to calculate runway variance:', e)
    }

    // Calculate category-level variances (actuals vs forecast)
    const categoryVariances: Array<{
      category: string
      actual: number
      forecast: number
      variance: number
      percentVariance: number
      type: 'income' | 'expense'
    }> = []

    const allCategories = new Set([
      ...Object.keys(currentPeriodByCategory),
      ...Object.keys(lastForecast.byCategory || {}),
    ])

    allCategories.forEach(category => {
      const actual = currentPeriodByCategory[category] || { income: 0, expenses: 0 }
      const forecast = lastForecast.byCategory?.[category] || { income: 0, expenses: 0 }
      
      if (actual.income > 0 || forecast.income > 0) {
        const variance = actual.income - forecast.income
        categoryVariances.push({
          category,
          actual: actual.income,
          forecast: forecast.income,
          variance,
          percentVariance: forecast.income !== 0 ? ((variance / forecast.income) * 100) : (actual.income !== 0 ? 100 : 0),
          type: 'income',
        })
      }
      
      if (actual.expenses > 0 || forecast.expenses > 0) {
        const variance = actual.expenses - forecast.expenses
        categoryVariances.push({
          category,
          actual: actual.expenses,
          forecast: forecast.expenses,
          variance,
          percentVariance: forecast.expenses !== 0 ? ((variance / forecast.expenses) * 100) : (actual.expenses !== 0 ? 100 : 0),
          type: 'expense',
        })
      }
    })

    // Identify misalignments (cost increases or cash changes that did not improve outcomes)
    const misalignments = categoryVariances
      .filter(c => {
        if (c.type === 'expense' && c.variance > 0) return true // Expense increased
        if (c.type === 'income' && c.variance < 0) return true // Income decreased
        return false
      })
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 5)

    const incomeVariances = categoryVariances.filter(c => c.type === 'income')
    const expenseVariances = categoryVariances.filter(c => c.type === 'expense')

    const topIncomeIncreases = incomeVariances
      .filter(c => c.variance > 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 5)
      .map(c => ({ category: c.category, change: c.variance, percentChange: c.percentVariance, type: 'income' as const }))

    const topIncomeDecreases = incomeVariances
      .filter(c => c.variance < 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 5)
      .map(c => ({ category: c.category, change: Math.abs(c.variance), percentChange: Math.abs(c.percentVariance), type: 'income' as const }))

    const topExpenseIncreases = expenseVariances
      .filter(c => c.variance > 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 5)
      .map(c => ({ category: c.category, change: c.variance, percentChange: c.percentVariance, type: 'expense' as const }))

    const topExpenseDecreases = expenseVariances
      .filter(c => c.variance < 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 5)
      .map(c => ({ category: c.category, change: Math.abs(c.variance), percentChange: Math.abs(c.percentVariance), type: 'expense' as const }))

    const context = {
      actuals: {
        income: currentPeriodIncome,
        expenses: currentPeriodExpenses,
        net: currentPeriodNet,
      },
      lastForecast: {
        income: lastForecast.income || 0,
        expenses: lastForecast.expenses || 0,
        net: lastForecast.net || 0,
      },
      variances: {
        revenue: revenueVariance,
        cost: costVariance,
        burn: burnVariance,
        runway: runwayVariance,
      },
      percentVariances: {
        revenue: lastForecast.income !== 0 ? ((revenueVariance / lastForecast.income) * 100) : (currentPeriodIncome !== 0 ? 100 : 0),
        cost: lastForecast.expenses !== 0 ? ((costVariance / lastForecast.expenses) * 100) : (currentPeriodExpenses !== 0 ? 100 : 0),
        burn: lastForecast.net !== 0 ? ((burnVariance / Math.abs(lastForecast.net)) * 100) : (currentPeriodNet !== 0 ? 100 : 0),
      },
      currentRunway,
      previousRunway,
      misalignments: misalignments.map(m => ({
        category: m.category,
        type: m.type,
        variance: m.variance,
        description: m.type === 'expense' 
          ? `Expenses increased by ${Math.abs(m.variance)} without improving outcomes`
          : `Income decreased by ${Math.abs(m.variance)}`,
      })),
      topIncomeIncreases,
      topIncomeDecreases,
      topExpenseIncreases,
      topExpenseDecreases,
    }

    const systemPrompt = `You are a financial advisor analyzing changes (DELTA) in a business's finances.

FOCUS: Answer ONLY "What changed?" - explain movement since the last review, nothing else.

DELTA Purpose: Explain movement since the last review. Delta answers: "Why does this feel different than last month?"

What you analyze:
- Revenue variance (actuals vs last rolling forecast)
- Cost variance (actuals vs last rolling forecast)
- Burn variance (actuals vs last rolling forecast)
- Runway variance (how runway changed)
- Where money leaks first appear (cost increases or cash changes that did not improve outcomes)

IMPORTANT:
- You do NOT call them "leaks" yet - you call them "misalignments"
- Compare actuals this period vs last rolling forecast (NOT original budget)
- Focus on identifying cost increases or cash changes that did not improve outcomes

DO:
- Compare actuals this period vs last rolling forecast
- Identify revenue variance, cost variance, burn variance, runway variance
- Explain the magnitude of changes (absolute and percentage)
- Identify misalignments (cost increases or cash changes that did not improve outcomes)
- Describe what changed, not why it changed or what will happen

DO NOT:
- Make predictions or forecasts (that's for TRAJECTORY)
- Identify risks (that's for EXPOSURE)
- Provide recommendations (that's for CHOICE)
- Analyze current state in detail (that's for STATE)
- Project future trends based on changes
- Call misalignments "leaks" (that's for later sections)

Output format:
"Runway shortened by 1.5 months, driven mainly by higher fixed costs rather than revenue decline."

Delta creates signal, not conclusions.

Return a JSON object with this structure:
{
  "summary": "2-3 sentence description of changes, e.g., 'Runway shortened by X months, driven mainly by Y rather than Z.'",
  "insights": [
    {
      "title": "Insight title about what changed",
      "description": "Description of specific changes with numbers and percentages (revenue variance, cost variance, burn variance, runway variance)",
      "type": "positive" | "neutral" | "concern"
    }
  ]
}

Be specific, data-driven, and use actual numbers and percentages from the context. Focus ONLY on what changed, not on predictions or risks.`

    const userPrompt = `DELTA Data (Actuals vs Last Rolling Forecast):
${JSON.stringify(context, null, 2)}

Analyze these variances and provide insights.`

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
        section: 'delta',
      })
      analysis = result
      usedProvider = provider
    } catch (e: any) {
      error = e
      console.error('[Delta Analyze] AI call failed:', e)
    }

    const result = !analysis ? {
      analysis: null,
      summary: generateRuleBasedSummary(context),
      insights: generateRuleBasedInsights(context),
    } : {
      analysis,
      summary: analysis.summary || generateRuleBasedSummary(context),
      insights: analysis.insights || generateRuleBasedInsights(context),
    }
    
    // Cache the result (both AI and rule-based)
    setCachedAnalysis(userId, 'delta', result)
    
    return successResponse({
      ...result,
      message: !analysis 
        ? (error ? `AI analysis failed: ${error.message}. Showing rule-based insights.` : 'AI analysis unavailable.')
        : `AI delta analysis completed${usedProvider ? ` (${usedProvider})` : ''}`,
    })
  } catch (e) {
    return errorResponse(e, 'Failed to analyze delta')
  }
}

function generateRuleBasedSummary(context: any): string {
  const { variances, runwayVariance } = context
  
  if (runwayVariance !== null && runwayVariance < -1) {
    return `Runway shortened by ${Math.abs(runwayVariance).toFixed(1)} months, driven mainly by ${variances.cost > 0 ? 'higher costs' : 'revenue decline'}.`
  }
  
  if (runwayVariance !== null && runwayVariance > 1) {
    return `Runway extended by ${runwayVariance.toFixed(1)} months, driven mainly by ${variances.revenue > 0 ? 'revenue growth' : 'cost reduction'}.`
  }
  
  if (variances.cost > 0 && variances.revenue < 0) {
    return 'Costs increased while revenue declined, creating negative pressure on cash flow.'
  }
  
  if (variances.cost < 0 && variances.revenue > 0) {
    return 'Revenue increased while costs decreased, showing improved efficiency.'
  }
  
  return 'Moderate changes observed this period. Review specific variances for detailed insights.'
}

function generateRuleBasedInsights(context: any): Array<{
  title: string
  description: string
  type: 'positive' | 'neutral' | 'concern'
}> {
  const insights: Array<{ title: string; description: string; type: 'positive' | 'neutral' | 'concern' }> = []
  const { variances, percentVariances, misalignments, currentRunway, previousRunway } = context

  if (variances.runway !== null && variances.runway < -1) {
    insights.push({
      title: 'Runway Shortened',
      description: `Runway decreased by ${Math.abs(variances.runway).toFixed(1)} months (from ${previousRunway} to ${currentRunway} months).`,
      type: 'concern'
    })
  }

  if (variances.revenue < 0 && Math.abs(percentVariances.revenue) > 10) {
    insights.push({
      title: 'Revenue Variance',
      description: `Revenue is ${Math.abs(percentVariances.revenue).toFixed(1)}% below forecast (variance: ${variances.revenue.toFixed(0)}).`,
      type: 'concern'
    })
  }

  if (variances.cost > 0 && percentVariances.cost > 10) {
    insights.push({
      title: 'Cost Variance',
      description: `Costs are ${percentVariances.cost.toFixed(1)}% above forecast (variance: ${variances.cost.toFixed(0)}).`,
      type: 'concern'
    })
  }

  if (misalignments && misalignments.length > 0) {
    insights.push({
      title: 'Misalignments Identified',
      description: `${misalignments.length} category(ies) show cost increases or revenue declines that did not improve outcomes: ${misalignments.slice(0, 3).map((m: any) => m.category).join(', ')}.`,
      type: 'concern'
    })
  }

  if (variances.revenue > 0 && percentVariances.revenue > 10) {
    insights.push({
      title: 'Revenue Variance',
      description: `Revenue is ${percentVariances.revenue.toFixed(1)}% above forecast (variance: ${variances.revenue.toFixed(0)}).`,
      type: 'positive'
    })
  }

  if (variances.cost < 0 && Math.abs(percentVariances.cost) > 10) {
    insights.push({
      title: 'Cost Variance',
      description: `Costs are ${Math.abs(percentVariances.cost).toFixed(1)}% below forecast (variance: ${variances.cost.toFixed(0)}).`,
      type: 'positive'
    })
  }

  if (insights.length === 0) {
    insights.push({
      title: 'Stable Performance',
      description: 'Actuals are closely aligned with last rolling forecast.',
      type: 'neutral'
    })
  }

  return insights
}
