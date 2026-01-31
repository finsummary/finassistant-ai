import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    // Get primary currency from bank accounts (use first account's currency, or default to GBP)
    const { data: accounts } = await supabase
      .from('BankAccounts')
      .select('currency')
      .eq('user_id', userId)
      .limit(1)
    
    const primaryCurrency = accounts?.[0]?.currency || 'GBP'
    const currentDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

    // Get all transactions for the user
    const { data: transactions, error: txError } = await supabase
      .from('Transactions')
      .select('*')
      .eq('user_id', userId)
      .order('booked_at', { ascending: false })

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`)
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Date ranges for KPI calculations
    const yearStart = new Date(now.getFullYear(), 0, 1) // January 1st
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1) // First day of current month
    
    // Calculate quarter start (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
    const currentQuarter = Math.floor(now.getMonth() / 3)
    const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1)
    
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    // Calculate last 3 months for average revenue/costs (STATE requirement)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const monthlyData: Array<{ month: string; revenue: number; costs: number; net: number }> = []

    // Calculate current cash balance (sum of all transactions)
    let currentBalance = 0
    
    // KPI accumulators
    let monthIncome = 0
    let monthExpenses = 0
    let quarterIncome = 0
    let quarterExpenses = 0
    let ytdIncome = 0
    let ytdExpenses = 0
    
    // Legacy fields for backward compatibility
    let lastMonthInflow = 0
    let lastMonthOutflow = 0
    let thisMonthInflow = 0
    let thisMonthOutflow = 0
    
    // Category breakdowns for different periods
    const categoryBreakdownAllTime: Record<string, { income: number; expense: number }> = {}
    const categoryBreakdownYTD: Record<string, { income: number; expense: number }> = {}
    
    // Group transactions by month for last 3 months calculation
    const monthlyBreakdown: Record<string, { revenue: number; costs: number }> = {}

    transactions?.forEach((tx: any) => {
      const amount = Number(tx.amount || 0)
      currentBalance += amount

      const txDate = new Date(tx.booked_at)
      const category = tx.category || 'Uncategorized'
      const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

      // Initialize category breakdowns
      if (!categoryBreakdownAllTime[category]) {
        categoryBreakdownAllTime[category] = { income: 0, expense: 0 }
      }
      if (!categoryBreakdownYTD[category]) {
        categoryBreakdownYTD[category] = { income: 0, expense: 0 }
      }
      
      // Track monthly data for last 3 months (STATE requirement)
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

      // Calculate KPI for different periods
      if (txDate >= monthStart && txDate <= today) {
        // Current month (up to today)
        if (amount > 0) {
          monthIncome += amount
          thisMonthInflow += amount
        } else {
          monthExpenses += Math.abs(amount)
          thisMonthOutflow += Math.abs(amount)
        }
      }

      if (txDate >= quarterStart && txDate <= today) {
        // Current quarter (up to today)
        if (amount > 0) {
          quarterIncome += amount
        } else {
          quarterExpenses += Math.abs(amount)
        }
      }

      if (txDate >= yearStart && txDate <= today) {
        // Year to date (up to today)
        if (amount > 0) {
          ytdIncome += amount
          categoryBreakdownYTD[category].income += amount
        } else {
          ytdExpenses += Math.abs(amount)
          categoryBreakdownYTD[category].expense += Math.abs(amount)
        }
      }

      // Legacy: last month calculation
      if (txDate >= lastMonth && txDate < thisMonth) {
        if (amount >= 0) {
          lastMonthInflow += amount
        } else {
          lastMonthOutflow += Math.abs(amount)
        }
      }

      // Category breakdown (all time) - for backward compatibility
      if (amount >= 0) {
        categoryBreakdownAllTime[category].income += amount
      } else {
        categoryBreakdownAllTime[category].expense += Math.abs(amount)
      }
    })

    const lastMonthNet = lastMonthInflow - lastMonthOutflow
    const thisMonthNet = thisMonthInflow - thisMonthOutflow
    
    // Calculate net results
    const monthNet = monthIncome - monthExpenses
    const quarterNet = quarterIncome - quarterExpenses
    const ytdNet = ytdIncome - ytdExpenses

    // Convert category breakdown to array and sort (all time - for backward compatibility)
    const categoryArray = Object.entries(categoryBreakdownAllTime)
      .map(([name, values]) => ({
        name,
        income: values.income,
        expense: values.expense,
        net: values.income - values.expense,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 10) // Top 10 categories

    // Separate categories into income and expense (YTD - Year to Date)
    const incomeCategories = Object.entries(categoryBreakdownYTD)
      .map(([name, values]) => ({
        name,
        income: values.income,
      }))
      .filter(cat => cat.income > 0)
      .sort((a, b) => b.income - a.income)
      .slice(0, 5)
    
    const expenseCategories = Object.entries(categoryBreakdownYTD)
      .map(([name, values]) => ({
        name,
        expense: values.expense,
      }))
      .filter(cat => cat.expense > 0)
      .sort((a, b) => b.expense - a.expense)
      .slice(0, 5)

    // Calculate STATE metrics: average monthly revenue/costs from last 3 months
    const last3MonthsData = Object.entries(monthlyBreakdown)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-3) // Last 3 complete months
    
    let avgMonthlyRevenue = 0
    let avgMonthlyCosts = 0
    if (last3MonthsData.length > 0) {
      const totalRevenue = last3MonthsData.reduce((sum, [, data]) => sum + data.revenue, 0)
      const totalCosts = last3MonthsData.reduce((sum, [, data]) => sum + data.costs, 0)
      avgMonthlyRevenue = totalRevenue / last3MonthsData.length
      avgMonthlyCosts = totalCosts / last3MonthsData.length
    }
    
    // Net monthly burn (negative if spending more than earning)
    const netMonthlyBurn = avgMonthlyCosts - avgMonthlyRevenue
    
    // Calculate runway (months until cash runs out)
    let runway: number | null = null
    if (netMonthlyBurn > 0 && currentBalance > 0) {
      runway = Math.floor(currentBalance / netMonthlyBurn)
    } else if (netMonthlyBurn <= 0) {
      runway = null // Positive cash flow, no runway concern
    }

    return successResponse({
      currentBalance,
      currentDate,
      currency: primaryCurrency,
      // Main KPI metrics
      kpis: {
        month: {
          income: monthIncome,
          expenses: monthExpenses,
          net: monthNet,
        },
        quarter: {
          income: quarterIncome,
          expenses: quarterExpenses,
          net: quarterNet,
        },
        ytd: {
          income: ytdIncome,
          expenses: ytdExpenses,
          net: ytdNet,
        },
      },
      // Legacy fields for backward compatibility
      lastMonth: {
        inflow: lastMonthInflow,
        outflow: lastMonthOutflow,
        net: lastMonthNet,
      },
      thisMonth: {
        inflow: thisMonthInflow,
        outflow: thisMonthOutflow,
        net: thisMonthNet,
      },
      categoryBreakdown: categoryArray,
      incomeCategories,
      expenseCategories,
      // STATE-specific metrics (facts only)
      state: {
        avgMonthlyRevenue,
        avgMonthlyCosts,
        netMonthlyBurn,
        runway,
      },
    })
  } catch (e) {
    return errorResponse(e, 'Failed to calculate state data')
  }
}
