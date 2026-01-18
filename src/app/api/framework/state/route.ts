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
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Calculate current cash balance (sum of all transactions)
    let currentBalance = 0
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

      if (txDate >= lastMonth && txDate < thisMonth) {
        if (amount >= 0) {
          lastMonthInflow += amount
        } else {
          lastMonthOutflow += Math.abs(amount)
        }
      } else if (txDate >= thisMonth) {
        if (amount >= 0) {
          thisMonthInflow += amount
        } else {
          thisMonthOutflow += Math.abs(amount)
        }
      }

      if (amount >= 0) {
        categoryBreakdown[category].income += amount
      } else {
        categoryBreakdown[category].expense += Math.abs(amount)
      }
    })

    const lastMonthNet = lastMonthInflow - lastMonthOutflow
    const thisMonthNet = thisMonthInflow - thisMonthOutflow

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
