import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'
import { calculateTrajectory } from '../_utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    // Get current balance and forecast
    const trajectoryData = await calculateTrajectory(supabase, userId)
    const { currentBalance, forecast, avgMonthlyChange } = trajectoryData

    // Calculate runway (months until cash <= 0)
    let runway = null
    if (avgMonthlyChange < 0) {
      const monthsUntilZero = Math.floor(currentBalance / Math.abs(avgMonthlyChange))
      runway = monthsUntilZero > 0 ? monthsUntilZero : 0
    } else {
      runway = null // Positive trajectory, no runway limit
    }

    // Check forecast for negative balances
    const firstNegativeMonth = forecast.findIndex(f => f.balance <= 0)
    if (firstNegativeMonth >= 0 && runway === null) {
      runway = firstNegativeMonth + 1
    }

    // Get upcoming large expenses (from planned expenses)
    const { data: plannedExpenses } = await supabase
      .from('PlannedExpenses')
      .select('*')
      .eq('user_id', userId)
      .order('expected_date', { ascending: true })

    const now = new Date()
    const threeMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 3, 1)

    const upcomingExpenses = (plannedExpenses || [])
      .filter((pe: any) => {
        const peDate = new Date(pe.expected_date)
        return peDate >= now && peDate <= threeMonthsFromNow
      })
      .map((pe: any) => ({
        description: pe.description,
        amount: Number(pe.amount || 0),
        expectedDate: pe.expected_date,
        recurrence: pe.recurrence,
      }))
      .sort((a, b) => Number(a.amount) - Number(b.amount))
      .reverse()
      .slice(0, 5) // Top 5 largest

    // Risk flags
    const riskFlags: Array<{ type: string; severity: 'low' | 'medium' | 'high'; message: string }> = []

    if (runway !== null && runway <= 1) {
      riskFlags.push({
        type: 'runway',
        severity: 'high',
        message: `Cash runway is ${runway} month${runway !== 1 ? 's' : ''}. Critical risk.`,
      })
    } else if (runway !== null && runway <= 3) {
      riskFlags.push({
        type: 'runway',
        severity: 'medium',
        message: `Cash runway is ${runway} months. Monitor closely.`,
      })
    }

    if (upcomingExpenses.length > 0) {
      const largestExpense = upcomingExpenses[0]
      if (largestExpense.amount > currentBalance * 0.3) {
        riskFlags.push({
          type: 'large_expense',
          severity: 'medium',
          message: `Large expense coming: ${largestExpense.description} (${largestExpense.amount.toFixed(2)})`,
        })
      }
    }

    if (avgMonthlyChange < 0 && Math.abs(avgMonthlyChange) > currentBalance * 0.1) {
      riskFlags.push({
        type: 'burn_rate',
        severity: 'medium',
        message: `High monthly burn rate: ${Math.abs(avgMonthlyChange).toFixed(2)}`,
      })
    }

    // Downside scenario (revenue -20%)
    const downsideScenario = forecast.map(f => ({
      month: f.month,
      balance: f.balance - (f.income * 0.2), // Reduce income by 20%
    }))

    const downsideRunway = downsideScenario.findIndex(f => f.balance <= 0)
    if (downsideRunway >= 0 && downsideRunway < (runway || Infinity)) {
      riskFlags.push({
        type: 'downside',
        severity: 'low',
        message: `If revenue drops 20%, runway reduces to ${downsideRunway + 1} months`,
      })
    }

    return successResponse({
      runway,
      currentBalance,
      avgMonthlyChange,
      upcomingExpenses,
      riskFlags,
      downsideScenario,
    })
  } catch (e) {
    return errorResponse(e, 'Failed to calculate exposure data')
  }
}
