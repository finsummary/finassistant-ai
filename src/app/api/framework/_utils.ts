import { SupabaseClient } from '@supabase/supabase-js'

export async function calculateTrajectory(supabase: SupabaseClient, userId: string) {
  // Get all transactions
  const { data: transactions, error: txError } = await supabase
    .from('Transactions')
    .select('*')
    .eq('user_id', userId)
    .order('booked_at', { ascending: true })

  if (txError) throw txError

  // Get planned income and expenses
  const { data: plannedIncome } = await supabase
    .from('PlannedIncome')
    .select('*')
    .eq('user_id', userId)

  const { data: plannedExpenses } = await supabase
    .from('PlannedExpenses')
    .select('*')
    .eq('user_id', userId)

  // Calculate current balance
  let currentBalance = 0
  transactions?.forEach((tx: any) => {
    currentBalance += Number(tx.amount || 0)
  })

  // Calculate historical monthly averages
  const monthlyTotals: Record<string, number> = {}
  transactions?.forEach((tx: any) => {
    const date = new Date(tx.booked_at)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + Number(tx.amount || 0)
  })

  const monthlyValues = Object.values(monthlyTotals)
  const avgMonthlyChange = monthlyValues.length > 0
    ? monthlyValues.reduce((sum, val) => sum + val, 0) / monthlyValues.length
    : 0

  // Generate 6-month forecast
  const now = new Date()
  const forecast: Array<{ month: string; balance: number; income: number; expenses: number }> = []
  let runningBalance = currentBalance

  for (let i = 0; i < 6; i++) {
    const forecastDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1)
    const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`
    const monthStr = forecastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    // Calculate planned income for this month
    let monthIncome = avgMonthlyChange > 0 ? avgMonthlyChange : 0
    plannedIncome?.forEach((pi: any) => {
      const piDate = new Date(pi.expected_date)
      if (pi.recurrence === 'monthly' || 
          (pi.recurrence === 'one-off' && 
           piDate.getFullYear() === forecastDate.getFullYear() &&
           piDate.getMonth() === forecastDate.getMonth())) {
        monthIncome += Number(pi.amount || 0)
      }
    })

    // Calculate planned expenses for this month
    let monthExpenses = avgMonthlyChange < 0 ? Math.abs(avgMonthlyChange) : 0
    plannedExpenses?.forEach((pe: any) => {
      const peDate = new Date(pe.expected_date)
      if (pe.recurrence === 'monthly' ||
          (pe.recurrence === 'one-off' &&
           peDate.getFullYear() === forecastDate.getFullYear() &&
           peDate.getMonth() === forecastDate.getMonth())) {
        monthExpenses += Number(pe.amount || 0)
      }
    })

    runningBalance += monthIncome - monthExpenses

    forecast.push({
      month: monthStr,
      balance: runningBalance,
      income: monthIncome,
      expenses: monthExpenses,
    })
  }

  // Find projected low points
  const lowPoints = forecast
    .map((f, idx) => ({ ...f, index: idx }))
    .filter((f, idx, arr) => {
      if (idx === 0) return f.balance < arr[1]?.balance
      if (idx === arr.length - 1) return f.balance < arr[idx - 1]?.balance
      return f.balance < arr[idx - 1]?.balance && f.balance < arr[idx + 1]?.balance
    })
    .map(f => ({ month: f.month, balance: f.balance }))

  return {
    currentBalance,
    avgMonthlyChange,
    forecast,
    lowPoints,
    horizon: 6,
  }
}
