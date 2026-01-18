import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateTrajectory } from '../framework/_utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

    // Get organization
    const { data: organization } = await supabase
      .from('Organizations')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Get all framework data directly (avoid internal fetch)
    const { data: transactions } = await supabase
      .from('Transactions')
      .select('*')
      .eq('user_id', userId)
      .order('booked_at', { ascending: false })

    // Calculate state
    let currentBalance = 0
    let lastMonthInflow = 0
    let lastMonthOutflow = 0
    let thisMonthInflow = 0
    let thisMonthOutflow = 0
    const categoryBreakdown: Record<string, { income: number; expense: number }> = {}

    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    transactions?.forEach((tx: any) => {
      const amount = Number(tx.amount || 0)
      currentBalance += amount
      const txDate = new Date(tx.booked_at)
      const category = tx.category || 'Uncategorized'
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { income: 0, expense: 0 }
      }
      if (txDate >= lastMonth && txDate < thisMonth) {
        if (amount >= 0) lastMonthInflow += amount
        else lastMonthOutflow += Math.abs(amount)
      } else if (txDate >= thisMonth) {
        if (amount >= 0) thisMonthInflow += amount
        else thisMonthOutflow += Math.abs(amount)
      }
      if (amount >= 0) {
        categoryBreakdown[category].income += amount
      } else {
        categoryBreakdown[category].expense += Math.abs(amount)
      }
    })

    const categoryArray = Object.entries(categoryBreakdown)
      .map(([name, values]) => ({
        name,
        income: values.income,
        expense: values.expense,
        net: values.income - values.expense,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 5)

    // Calculate delta
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

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

    const currentMonthTotal = Object.values(currentMonth).reduce((sum, val) => sum + val, 0)
    const previousMonthTotal = Object.values(previousMonth).reduce((sum, val) => sum + val, 0)
    const totalDelta = currentMonthTotal - previousMonthTotal

    const allCategories = new Set([...Object.keys(currentMonth), ...Object.keys(previousMonth)])
    const changes = Array.from(allCategories)
      .map(category => {
        const current = currentMonth[category] || 0
        const previous = previousMonth[category] || 0
        return { category, current, previous, delta: current - previous }
      })
      .filter(c => Math.abs(c.delta) > 0.01)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    const topIncreases = changes.filter(c => c.delta > 0).slice(0, 5)
    const topDecreases = changes.filter(c => c.delta < 0).slice(0, 5).map(c => ({
      category: c.category,
      change: Math.abs(c.delta),
    }))

    // Get trajectory
    const trajectoryData = await calculateTrajectory(supabase, userId)

    // Calculate exposure
    let runway = null
    if (trajectoryData.avgMonthlyChange < 0) {
      const monthsUntilZero = Math.floor(trajectoryData.currentBalance / Math.abs(trajectoryData.avgMonthlyChange))
      runway = monthsUntilZero > 0 ? monthsUntilZero : 0
    }
    const firstNegativeMonth = trajectoryData.forecast.findIndex(f => f.balance <= 0)
    if (firstNegativeMonth >= 0 && runway === null) {
      runway = firstNegativeMonth + 1
    }

    const { data: plannedExpenses } = await supabase
      .from('PlannedExpenses')
      .select('*')
      .eq('user_id', userId)
      .order('expected_date', { ascending: true })

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

    // Get decisions
    const decisions: Array<{
      description: string
      cashImpact: number
      risk: 'low' | 'medium' | 'high'
      reversibility: string
      timeframe: string
    }> = []

    if (runway !== null && runway <= 3) {
      decisions.push({
        description: 'Reduce monthly expenses to extend runway',
        cashImpact: trajectoryData.avgMonthlyChange < 0 ? Math.abs(trajectoryData.avgMonthlyChange) * 0.2 : 0,
        risk: 'low',
        reversibility: 'reversible',
        timeframe: 'immediate',
      })
    }

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

    // Build executive summary structure per PRD section 7.7
    const summary = {
      generated_at: new Date().toISOString(),
      organization: {
        business_name: organization?.business_name || 'Your Business',
        country: organization?.country || null,
      },
      state: {
        title: 'STATE — Where am I now?',
        current_balance: currentBalance,
        last_month_net: lastMonthInflow - lastMonthOutflow,
        this_month_net: thisMonthInflow - thisMonthOutflow,
        top_categories: categoryArray,
      },
      delta: {
        title: 'DELTA — What changed?',
        total_change: totalDelta,
        percent_change: previousMonthTotal !== 0 ? ((totalDelta / Math.abs(previousMonthTotal)) * 100) : 0,
        top_increases: topIncreases,
        top_decreases: topDecreases,
      },
      trajectory: {
        title: 'TRAJECTORY — Where am I heading?',
        current_balance: trajectoryData.currentBalance,
        avg_monthly_change: trajectoryData.avgMonthlyChange,
        forecast_months: trajectoryData.forecast,
        low_points: trajectoryData.lowPoints,
      },
      exposure: {
        title: 'EXPOSURE — What could break?',
        runway: runway,
        risk_flags: riskFlags,
        upcoming_expenses: upcomingExpenses,
      },
      choice: {
        title: 'CHOICE — What should I do next?',
        decisions: decisions.slice(0, 5),
        context: {
          runway,
          currentBalance,
          riskLevel: riskFlags.some(f => f.severity === 'high') ? 'high' :
                     riskFlags.some(f => f.severity === 'medium') ? 'medium' : 'low',
        },
      },
    }

    return NextResponse.json({ ok: true, summary }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}
