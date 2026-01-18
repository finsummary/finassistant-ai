import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, successResponse } from '../../_utils'
import { calculateTrajectory } from '../_utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    // Calculate exposure data for context
    const trajectoryData = await calculateTrajectory(supabase, userId)
    const { currentBalance, avgMonthlyChange, forecast } = trajectoryData

    // Calculate runway
    let runway = null
    if (avgMonthlyChange < 0) {
      const monthsUntilZero = Math.floor(currentBalance / Math.abs(avgMonthlyChange))
      runway = monthsUntilZero > 0 ? monthsUntilZero : 0
    }
    const firstNegativeMonth = forecast.findIndex(f => f.balance <= 0)
    if (firstNegativeMonth >= 0 && runway === null) {
      runway = firstNegativeMonth + 1
    }

    // Get risk flags (simplified)
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

    // Get upcoming expenses
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
      .slice(0, 5)

    // Generate decision cards based on current state
    const decisions: Array<{
      description: string
      cashImpact: number
      risk: 'low' | 'medium' | 'high'
      reversibility: 'reversible' | 'partially_reversible' | 'irreversible'
      timeframe: 'immediate' | 'short_term' | 'long_term'
    }> = []

    // Decision 1: Based on runway
    if (runway !== null && runway <= 3) {
      decisions.push({
        description: 'Reduce monthly expenses to extend runway',
        cashImpact: avgMonthlyChange < 0 ? Math.abs(avgMonthlyChange) * 0.2 : 0,
        risk: 'low',
        reversibility: 'reversible',
        timeframe: 'immediate',
      })
    }

    // Decision 2: Based on large expenses
    if (upcomingExpenses.length > 0) {
      const largestExpense = upcomingExpenses[0]
      if (largestExpense.amount > currentBalance * 0.2) {
        decisions.push({
          description: `Delay or negotiate ${largestExpense.description}`,
          cashImpact: -largestExpense.amount,
          risk: 'low',
          reversibility: 'reversible',
          timeframe: 'short_term',
        })
      }
    }

    // Decision 3: Based on burn rate
    if (avgMonthlyChange < 0 && Math.abs(avgMonthlyChange) > currentBalance * 0.15) {
      decisions.push({
        description: 'Accelerate revenue collection or increase income',
        cashImpact: Math.abs(avgMonthlyChange) * 0.3,
        risk: 'medium',
        reversibility: 'partially_reversible',
        timeframe: 'short_term',
      })
    }

    // Decision 4: If runway is healthy, suggest investment
    if (runway === null || runway > 6) {
      decisions.push({
        description: 'Consider strategic investment or growth spending',
        cashImpact: -currentBalance * 0.1,
        risk: 'medium',
        reversibility: 'partially_reversible',
        timeframe: 'long_term',
      })
    }

    // Decision 5: Build cash reserve
    if (currentBalance > 0 && avgMonthlyChange > 0) {
      decisions.push({
        description: 'Build emergency cash reserve (3-6 months expenses)',
        cashImpact: 0, // Neutral, just setting aside
        risk: 'low',
        reversibility: 'reversible',
        timeframe: 'long_term',
      })
    }

    // If no specific decisions, provide general guidance
    if (decisions.length === 0) {
      decisions.push({
        description: 'Monitor cash flow trends and maintain current strategy',
        cashImpact: 0,
        risk: 'low',
        reversibility: 'reversible',
        timeframe: 'immediate',
      })
    }

    return successResponse({
      decisions: decisions.slice(0, 5), // Limit to 5 decisions
      context: {
        runway,
        currentBalance,
        riskLevel: riskFlags?.some((f: any) => f.severity === 'high') ? 'high' :
                   riskFlags?.some((f: any) => f.severity === 'medium') ? 'medium' : 'low',
      },
    })
  } catch (e) {
    return errorResponse(e, 'Failed to generate choice data')
  }
}
