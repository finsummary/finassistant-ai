import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../../_utils'
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/ai-cache'
import { searchFinancialKnowledge, searchUserKnowledge, saveUserKnowledge } from '@/lib/knowledge-search'

export const dynamic = 'force-dynamic'

/**
 * AI-powered analysis for STATE section
 * Analyzes current financial position and provides insights
 */
export async function POST(req: Request) {
  try {
    const userId = await requireAuth()
    
    // Check if refresh is requested
    const body = await req.json().catch(() => ({}))
    const forceRefresh = body?.refresh === true
    
    // Check cache first (unless refresh is forced)
    if (!forceRefresh) {
      const cached = getCachedAnalysis(userId, 'state')
      if (cached) {
        return successResponse({
          ...cached,
          message: 'AI state analysis (cached)',
        })
      }
    }
    
    const supabase = await createClient()

    // Fetch STATE data from the state API endpoint (which has the correct calculations)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let stateData: any = null
    
    try {
      // Call the state API to get properly calculated metrics
      const stateRes = await fetch(`${baseUrl}/api/framework/state`, {
        headers: {
          'Cookie': req.headers.get('cookie') || '',
        },
      })
      if (stateRes.ok) {
        const stateJson = await stateRes.json()
        if (stateJson?.ok) {
          stateData = stateJson.data
        }
      }
    } catch (e) {
      console.warn('[State Analyze] Failed to fetch state data, calculating directly:', e)
    }

    // Fallback: calculate directly if API call failed
    if (!stateData) {
      const { data: transactions } = await supabase
        .from('Transactions')
        .select('amount, category, booked_at')
        .eq('user_id', userId)
        .order('booked_at', { ascending: false })

      let currentBalance = 0
      transactions?.forEach((tx: any) => {
        currentBalance += Number(tx.amount || 0)
      })

      const now = new Date()
      const yearStart = new Date(now.getFullYear(), 0, 1)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const currentQuarter = Math.floor(now.getMonth() / 3)
      const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1)
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      let monthIncome = 0
      let monthExpenses = 0
      let quarterIncome = 0
      let quarterExpenses = 0
      let ytdIncome = 0
      let ytdExpenses = 0
      const monthlyBreakdown: Record<string, { revenue: number; costs: number }> = {}

      transactions?.forEach((tx: any) => {
        const txDate = new Date(tx.booked_at)
        const amount = Number(tx.amount || 0)
        const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

        if (txDate >= monthStart) {
          if (amount >= 0) monthIncome += amount
          else monthExpenses += Math.abs(amount)
        }
        if (txDate >= quarterStart) {
          if (amount >= 0) quarterIncome += amount
          else quarterExpenses += Math.abs(amount)
        }
        if (txDate >= yearStart) {
          if (amount >= 0) ytdIncome += amount
          else ytdExpenses += Math.abs(amount)
        }
        
        if (txDate >= threeMonthsAgo && txDate < thisMonth) {
          if (!monthlyBreakdown[monthKey]) {
            monthlyBreakdown[monthKey] = { revenue: 0, costs: 0 }
          }
          if (amount > 0) {
            monthlyBreakdown[monthKey].revenue += amount
          } else {
            monthlyBreakdown[monthKey].costs += Math.abs(amount)
          }
        }
      })

      const last3MonthsData = Object.entries(monthlyBreakdown)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-3)
      
      let avgMonthlyRevenue = 0
      let avgMonthlyCosts = 0
      if (last3MonthsData.length > 0) {
        const totalRevenue = last3MonthsData.reduce((sum, [, data]) => sum + data.revenue, 0)
        const totalCosts = last3MonthsData.reduce((sum, [, data]) => sum + data.costs, 0)
        avgMonthlyRevenue = totalRevenue / last3MonthsData.length
        avgMonthlyCosts = totalCosts / last3MonthsData.length
      }
      
      const netMonthlyBurn = avgMonthlyCosts - avgMonthlyRevenue
      let runway: number | null = null
      if (netMonthlyBurn > 0 && currentBalance > 0) {
        runway = Math.floor(currentBalance / netMonthlyBurn)
      } else if (netMonthlyBurn <= 0) {
        runway = null
      }

      const { data: accounts } = await supabase
        .from('BankAccounts')
        .select('currency')
        .eq('user_id', userId)
        .limit(1)
      
      const currency = accounts?.[0]?.currency || 'GBP'

      stateData = {
        currentBalance,
        currency,
        state: {
          avgMonthlyRevenue,
          avgMonthlyCosts,
          netMonthlyBurn,
          runway,
        },
        month: { income: monthIncome, expenses: monthExpenses, net: monthIncome - monthExpenses },
        quarter: { income: quarterIncome, expenses: quarterExpenses, net: quarterIncome - quarterExpenses },
        ytd: { income: ytdIncome, expenses: ytdExpenses, net: ytdIncome - ytdExpenses },
      }
    }

    const context = {
      currentBalance: stateData.currentBalance,
      currency: stateData.currency,
      avgMonthlyRevenue: stateData.state?.avgMonthlyRevenue || 0,
      avgMonthlyCosts: stateData.state?.avgMonthlyCosts || 0,
      netMonthlyBurn: stateData.state?.netMonthlyBurn || 0,
      runway: stateData.state?.runway,
      month: stateData.month,
      quarter: stateData.quarter,
      ytd: stateData.ytd,
    }

    // Search for relevant knowledge from vector database
    let financialKnowledge: string[] = []
    let userKnowledge: string[] = []
    
    try {
      // Build query for financial knowledge search
      const knowledgeQuery = `Business has ${stateData.currentBalance} cash, ${stateData.state?.runway !== null ? stateData.state.runway : 'unknown'} months runway. ` +
        `Average monthly revenue: ${stateData.state?.avgMonthlyRevenue || 0}, costs: ${stateData.state?.avgMonthlyCosts || 0}. ` +
        `Net monthly burn: ${stateData.state?.netMonthlyBurn || 0}. ` +
        `What is the current financial state?`
      
      const financialResults = await searchFinancialKnowledge(knowledgeQuery, undefined, 5, 0.7)
      financialKnowledge = financialResults.map(k => k.content)
      
      // Search for user-specific knowledge
      const userQuery = `User's current financial state: ${stateData.currentBalance} cash, ${stateData.state?.runway !== null ? stateData.state.runway : 'unknown'} months runway.`
      
      const userResults = await searchUserKnowledge(userId, userQuery, undefined, 3, 0.7)
      userKnowledge = userResults.map(k => k.content)
    } catch (error: any) {
      // Log but don't fail - knowledge search is optional
      console.warn('[State Analyze] Knowledge search failed:', error.message)
    }

    const systemPrompt = `You are a financial advisor analyzing a business owner's CURRENT financial STATE.

${financialKnowledge.length > 0 ? `RELEVANT FINANCIAL KNOWLEDGE:
${financialKnowledge.map((k, i) => `${i + 1}. ${k}`).join('\n')}

` : ''}${userKnowledge.length > 0 ? `USER-SPECIFIC CONTEXT:
${userKnowledge.map((k, i) => `${i + 1}. ${k}`).join('\n')}

` : ''}FOCUS: Answer ONLY "Where am I now?" - anchor reality with undeniable facts, nothing else.

FOCUS: Answer ONLY "Where am I now?" - anchor reality with undeniable facts, nothing else.

STATE Purpose: Anchor reality. This is the undeniable financial position of the business today.

Inputs (facts only):
- Current cash balance
- Average monthly revenue (last 3 months)
- Average monthly costs (last 3 months)
- Net monthly burn
- Runway (months)

What is explicitly EXCLUDED:
- Budget
- Forecast
- Targets
- Opinions
- Predictions
- Comparisons to previous periods

DO:
- State the current cash balance and runway in months (if applicable)
- Describe average monthly revenue and costs from last 3 months
- Calculate and explain net monthly burn
- Present facts neutrally - no judgment, no blame, no optimism

DO NOT:
- Make predictions or forecasts (that's for TRAJECTORY)
- Analyze changes from previous periods (that's for DELTA)
- Identify risks (that's for EXPOSURE)
- Provide recommendations (that's for CHOICE)
- Compare to previous periods
- Use budget or forecast data

Output format:
"As of today, the business has £X cash and Y months of runway if nothing changes."

State is neutral. No judgment. No blame. No optimism.

Return a JSON object with this structure:
{
  "summary": "Neutral statement: 'As of today, the business has £X cash and Y months of runway if nothing changes.'",
  "insights": [
    {
      "title": "Factual insight about current state",
      "description": "Neutral description of current financial position with specific numbers (cash, revenue, costs, burn, runway)",
      "type": "neutral"
    }
  ]
}

Be specific, data-driven, and use actual numbers from the context. Focus ONLY on current facts. No opinions.`

    const userPrompt = `Financial STATE Data:
${JSON.stringify(context, null, 2)}

Analyze this current financial position and provide insights.`

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
        section: 'state',
      })
      analysis = result
      usedProvider = provider
    } catch (e: any) {
      error = e
      console.error('[State Analyze] AI call failed:', e)
    }

    // Fallback to rule-based if AI fails
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
    setCachedAnalysis(userId, 'state', result)
    
    // Save user knowledge from this analysis (async, don't wait)
    if (analysis && analysis.summary) {
      saveUserKnowledge(
        userId,
        `In STATE analysis: Business has ${context.currentBalance} cash, ${context.runway !== null ? context.runway : 'unknown'} months runway. ` +
        `Average monthly revenue: ${context.avgMonthlyRevenue}, costs: ${context.avgMonthlyCosts}. ` +
        `Net monthly burn: ${context.netMonthlyBurn}. ` +
        `AI summary: ${analysis.summary}.`,
        'business_context',
        {
          framework_section: 'state',
          timestamp: new Date().toISOString(),
          cash_balance: context.currentBalance,
          runway: context.runway,
          avg_monthly_revenue: context.avgMonthlyRevenue,
          avg_monthly_costs: context.avgMonthlyCosts,
          net_monthly_burn: context.netMonthlyBurn,
        }
      ).catch((err) => {
        console.warn('[State Analyze] Failed to save user knowledge:', err.message)
      })
    }
    
    return successResponse({
      ...result,
      message: !analysis 
        ? (error ? `AI analysis failed: ${error.message}. Showing rule-based insights.` : 'AI analysis unavailable.')
        : `AI state analysis completed${usedProvider ? ` (${usedProvider})` : ''}`,
    })
  } catch (e) {
    return errorResponse(e, 'Failed to analyze state')
  }
}

function generateRuleBasedSummary(context: any): string {
  const { currentBalance, month, quarter, ytd } = context
  
  if (currentBalance <= 0) {
    return 'Critical: Current cash balance is at or below zero. Immediate action required to address cash flow.'
  }
  
  if (month.net < 0 && quarter.net < 0) {
    return 'Warning: Negative cash flow in both current month and quarter. Monitor expenses closely.'
  }
  
  if (ytd.net > 0 && month.net > 0) {
    return 'Healthy: Positive cash flow maintained month-to-month and year-to-date. Current position looks stable.'
  }
  
  return 'Current financial position shows mixed results. Review monthly and quarterly trends for better understanding.'
}

function generateRuleBasedInsights(context: any): Array<{
  title: string
  description: string
  type: 'positive' | 'neutral' | 'concern'
}> {
  const insights: Array<{ title: string; description: string; type: 'positive' | 'neutral' | 'concern' }> = []
  const { currentBalance, month, quarter, ytd } = context

  if (currentBalance <= 0) {
    insights.push({
      title: 'Critical Cash Position',
      description: `Current balance is ${currentBalance >= 0 ? 'at zero' : 'negative'}. Immediate attention required.`,
      type: 'concern'
    })
  }

  if (month.net < 0) {
    insights.push({
      title: 'Negative Monthly Cash Flow',
      description: `This month shows a net loss of ${Math.abs(month.net).toLocaleString()}. Expenses exceed income.`,
      type: 'concern'
    })
  } else if (month.net > 0) {
    insights.push({
      title: 'Positive Monthly Cash Flow',
      description: `This month shows a net gain of ${month.net.toLocaleString()}. Income exceeds expenses.`,
      type: 'positive'
    })
  }

  if (ytd.net > 0 && ytd.net > currentBalance * 0.5) {
    insights.push({
      title: 'Strong Year-to-Date Performance',
      description: `YTD net positive of ${ytd.net.toLocaleString()} represents significant growth.`,
      type: 'positive'
    })
  }

  return insights.length > 0 ? insights : [{
    title: 'Financial Position',
    description: 'Review your financial data to understand current position better.',
    type: 'neutral'
  }]
}
