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

    // Group by category and month
    const currentMonth: Record<string, number> = {}
    const previousMonth: Record<string, number> = {}

    transactions?.forEach((tx: any) => {
      const amount = Number(tx.amount || 0)
      const category = tx.category || 'Uncategorized'
      const txDate = new Date(tx.booked_at)

      if (txDate >= currentMonthStart) {
        currentMonth[category] = (currentMonth[category] || 0) + amount
      } else if (txDate >= previousMonthStart && txDate <= previousMonthEnd) {
        previousMonth[category] = (previousMonth[category] || 0) + amount
      }
    })

    // Calculate changes
    const allCategories = new Set([...Object.keys(currentMonth), ...Object.keys(previousMonth)])
    const changes = Array.from(allCategories)
      .map(category => {
        const current = currentMonth[category] || 0
        const previous = previousMonth[category] || 0
        const delta = current - previous
        return {
          category,
          current,
          previous,
          delta,
          percentChange: previous !== 0 ? ((delta / Math.abs(previous)) * 100) : (current !== 0 ? 100 : 0),
        }
      })
      .filter(c => Math.abs(c.delta) > 0.01) // Filter out negligible changes
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    // Top increases and decreases
    const topIncreases = changes
      .filter(c => c.delta > 0)
      .slice(0, 5)
      .map(c => ({ category: c.category, change: c.delta, percentChange: c.percentChange }))

    const topDecreases = changes
      .filter(c => c.delta < 0)
      .slice(0, 5)
      .map(c => ({ category: c.category, change: Math.abs(c.delta), percentChange: Math.abs(c.percentChange) }))

    // Overall totals
    const currentTotal = Object.values(currentMonth).reduce((sum, val) => sum + val, 0)
    const previousTotal = Object.values(previousMonth).reduce((sum, val) => sum + val, 0)
    const totalDelta = currentTotal - previousTotal

    return successResponse({
      currentMonthTotal: currentTotal,
      previousMonthTotal: previousTotal,
      totalDelta,
      percentChange: previousTotal !== 0 ? ((totalDelta / Math.abs(previousTotal)) * 100) : (currentTotal !== 0 ? 100 : 0),
      topIncreases,
      topDecreases,
      allChanges: changes,
    })
  } catch (e) {
    return errorResponse(e, 'Failed to calculate delta data')
  }
}
