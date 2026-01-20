import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

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
    
    const categoryBreakdown: Record<string, { income: number; expense: number }> = {}

    transactions?.forEach((tx: any) => {
      const amount = Number(tx.amount || 0)
      currentBalance += amount

      const txDate = new Date(tx.booked_at)
      const category = tx.category || 'Uncategorized'

      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { income: 0, expense: 0 }
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
        } else {
          ytdExpenses += Math.abs(amount)
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

      // Category breakdown (all time)
      if (amount >= 0) {
        categoryBreakdown[category].income += amount
      } else {
        categoryBreakdown[category].expense += Math.abs(amount)
      }
    })

    const lastMonthNet = lastMonthInflow - lastMonthOutflow
    const thisMonthNet = thisMonthInflow - thisMonthOutflow
    
    // Calculate net results
    const monthNet = monthIncome - monthExpenses
    const quarterNet = quarterIncome - quarterExpenses
    const ytdNet = ytdIncome - ytdExpenses

    // Convert category breakdown to array and sort
    const categoryArray = Object.entries(categoryBreakdown)
      .map(([name, values]) => ({
        name,
        income: values.income,
        expense: values.expense,
        net: values.income - values.expense,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 10) // Top 10 categories

    return successResponse({
      currentBalance,
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
    })
  } catch (e) {
    return errorResponse(e, 'Failed to calculate state data')
  }
}
