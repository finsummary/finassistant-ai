import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await requireAuth()
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

    // Get rolling forecast for cash runway
    let runway = null
    try {
      const forecastRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/rolling-forecast?horizon=6months`, {
        headers: {
          'Cookie': (await import('next/headers')).cookies().toString(),
        },
      })
      if (forecastRes.ok) {
        const forecastJson = await forecastRes.json()
        const rollingForecast = forecastJson.data?.rollingForecast
        
        if (rollingForecast) {
          const firstNegativeIndex = rollingForecast.findIndex((f: any) => f.balance <= 0)
          if (firstNegativeIndex >= 0) {
            runway = firstNegativeIndex + 1
          } else {
            const forecastMonths = rollingForecast.filter((f: any) => f.type === 'forecast')
            if (forecastMonths.length > 0) {
              const avgMonthlyChange = forecastMonths.reduce((sum: number, m: any) => sum + m.net, 0) / forecastMonths.length
              if (avgMonthlyChange < 0) {
                runway = Math.floor(currentBalance / Math.abs(avgMonthlyChange))
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Exposure] Failed to fetch rolling forecast:', e)
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

    // Basic risk flags (will be enhanced by AI analysis)
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

    return successResponse({
      runway,
      currentBalance,
      upcomingExpenses,
      riskFlags,
      // AI analysis will be fetched separately by the client
    })
  } catch (e) {
    return errorResponse(e, 'Failed to calculate exposure data')
  }
}
