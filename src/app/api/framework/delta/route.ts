import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    // Get transactions for current and previous month
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const { data: transactions, error: txError } = await supabase
      .from('Transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('booked_at', previousMonthStart.toISOString().slice(0, 10))
      .order('booked_at', { ascending: false })

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`)
    }

    // Group by category and month, separate income and expenses
    const currentMonthIncome: Record<string, number> = {}
    const currentMonthExpenses: Record<string, number> = {}
    const previousMonthIncome: Record<string, number> = {}
    const previousMonthExpenses: Record<string, number> = {}

    let currentMonthIncomeTotal = 0
    let currentMonthExpensesTotal = 0
    let previousMonthIncomeTotal = 0
    let previousMonthExpensesTotal = 0

    transactions?.forEach((tx: any) => {
      const amount = Number(tx.amount || 0)
      const category = tx.category || 'Uncategorized'
      const txDate = new Date(tx.booked_at)

      if (txDate >= currentMonthStart) {
        if (amount >= 0) {
          currentMonthIncome[category] = (currentMonthIncome[category] || 0) + amount
          currentMonthIncomeTotal += amount
        } else {
          currentMonthExpenses[category] = (currentMonthExpenses[category] || 0) + Math.abs(amount)
          currentMonthExpensesTotal += Math.abs(amount)
        }
      } else if (txDate >= previousMonthStart && txDate <= previousMonthEnd) {
        if (amount >= 0) {
          previousMonthIncome[category] = (previousMonthIncome[category] || 0) + amount
          previousMonthIncomeTotal += amount
        } else {
          previousMonthExpenses[category] = (previousMonthExpenses[category] || 0) + Math.abs(amount)
          previousMonthExpensesTotal += Math.abs(amount)
        }
      }
    })

    const currentMonthNet = currentMonthIncomeTotal - currentMonthExpensesTotal
    const previousMonthNet = previousMonthIncomeTotal - previousMonthExpensesTotal

    // Calculate changes by category (separate income and expense changes)
    const allCategories = new Set([
      ...Object.keys(currentMonthIncome),
      ...Object.keys(currentMonthExpenses),
      ...Object.keys(previousMonthIncome),
      ...Object.keys(previousMonthExpenses),
    ])

    const incomeChanges = Array.from(allCategories)
      .map(category => {
        const current = currentMonthIncome[category] || 0
        const previous = previousMonthIncome[category] || 0
        const delta = current - previous
        return {
          category,
          current,
          previous,
          delta,
          percentChange: previous !== 0 ? ((delta / previous) * 100) : (current !== 0 ? 100 : 0),
          type: 'income' as const,
        }
      })
      .filter(c => Math.abs(c.delta) > 0.01)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    const expenseChanges = Array.from(allCategories)
      .map(category => {
        const current = currentMonthExpenses[category] || 0
        const previous = previousMonthExpenses[category] || 0
        const delta = current - previous // Positive delta = expenses increased (bad)
        return {
          category,
          current,
          previous,
          delta,
          percentChange: previous !== 0 ? ((delta / previous) * 100) : (current !== 0 ? 100 : 0),
          type: 'expense' as const,
        }
      })
      .filter(c => Math.abs(c.delta) > 0.01)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    // Top income increases (good - green)
    const topIncomeIncreases = incomeChanges
      .filter(c => c.delta > 0)
      .slice(0, 5)
      .map(c => ({ category: c.category, change: c.delta, percentChange: c.percentChange, type: 'income' as const }))

    // Top income decreases (bad - red)
    const topIncomeDecreases = incomeChanges
      .filter(c => c.delta < 0)
      .slice(0, 5)
      .map(c => ({ category: c.category, change: Math.abs(c.delta), percentChange: Math.abs(c.percentChange), type: 'income' as const }))

    // Top expense increases (bad - red)
    const topExpenseIncreases = expenseChanges
      .filter(c => c.delta > 0)
      .slice(0, 5)
      .map(c => ({ category: c.category, change: c.delta, percentChange: c.percentChange, type: 'expense' as const }))

    // Top expense decreases (good - green)
    const topExpenseDecreases = expenseChanges
      .filter(c => c.delta < 0)
      .slice(0, 5)
      .map(c => ({ category: c.category, change: Math.abs(c.delta), percentChange: Math.abs(c.percentChange), type: 'expense' as const }))

    return successResponse({
      previousMonth: {
        income: previousMonthIncomeTotal,
        expenses: previousMonthExpensesTotal,
        net: previousMonthNet,
      },
      currentMonth: {
        income: currentMonthIncomeTotal,
        expenses: currentMonthExpensesTotal,
        net: currentMonthNet,
      },
      changes: {
        income: currentMonthIncomeTotal - previousMonthIncomeTotal,
        expenses: currentMonthExpensesTotal - previousMonthExpensesTotal,
        net: currentMonthNet - previousMonthNet,
      },
      percentChanges: {
        income: previousMonthIncomeTotal !== 0 ? (((currentMonthIncomeTotal - previousMonthIncomeTotal) / previousMonthIncomeTotal) * 100) : (currentMonthIncomeTotal !== 0 ? 100 : 0),
        expenses: previousMonthExpensesTotal !== 0 ? (((currentMonthExpensesTotal - previousMonthExpensesTotal) / previousMonthExpensesTotal) * 100) : (currentMonthExpensesTotal !== 0 ? 100 : 0),
        net: previousMonthNet !== 0 ? (((currentMonthNet - previousMonthNet) / Math.abs(previousMonthNet)) * 100) : (currentMonthNet !== 0 ? 100 : 0),
      },
      topIncomeIncreases,
      topIncomeDecreases,
      topExpenseIncreases,
      topExpenseDecreases,
    })
  } catch (e) {
    return errorResponse(e, 'Failed to calculate delta data')
  }
}
