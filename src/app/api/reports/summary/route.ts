import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '../../_utils'

type Period = 'all' | 'year' | 'quarter'

function getFromDate(period: Period): string | null {
  if (period === 'all') return null
  const now = new Date()
  const from = new Date(now)
  if (period === 'year') {
    from.setFullYear(now.getFullYear() - 1)
  } else if (period === 'quarter') {
    from.setMonth(now.getMonth() - 3)
  }
  return from.toISOString().slice(0,10)
}

export async function GET(req: Request) {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    const { searchParams } = new URL(req.url)
    const period = (searchParams.get('period') as Period) || 'year'
    const accountId = searchParams.get('accountId') || null
    const fromDate = getFromDate(period)

    let query = supabase
      .from('Transactions')
      .select('amount, category, currency, booked_at, account_id')
      .eq('user_id', userId) // CRITICAL: Filter by user_id

    if (fromDate) query = query.gte('booked_at', fromDate)
    if (accountId) query = query.eq('account_id', accountId)

    const { data, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })

    const rows = (data || []) as Array<{ amount: number; category: string | null; currency: string; booked_at: string; account_id: string }>

    // Monthly aggregates (by YYYY-MM)
    const monthlyMap = new Map<string, { income: number; expenses: number; total: number }>()
    // Per-month per-category aggregates
    const perMonthCategoryMap = new Map<string, Map<string, { income: number; expenses: number; total: number }>>()
    for (const r of rows) {
      const month = (r.booked_at || '').slice(0,7)
      const m = monthlyMap.get(month) || { income: 0, expenses: 0, total: 0 }
      if (r.amount >= 0) m.income += Number(r.amount)
      else m.expenses += Number(r.amount)
      m.total += Number(r.amount)
      monthlyMap.set(month, m)

      const cat = (r.category && r.category.trim()) ? r.category : 'Uncategorized'
      const monthMap = perMonthCategoryMap.get(month) || new Map<string, { income: number; expenses: number; total: number }>()
      const agg = monthMap.get(cat) || { income: 0, expenses: 0, total: 0 }
      if (r.amount >= 0) agg.income += Number(r.amount); else agg.expenses += Number(r.amount)
      agg.total += Number(r.amount)
      monthMap.set(cat, agg)
      perMonthCategoryMap.set(month, monthMap)
    }
    const monthly = [...monthlyMap.entries()]
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Category aggregates
    const catMap = new Map<string, { income: number; expenses: number; total: number }>()
    for (const r of rows) {
      const key = (r.category && r.category.trim()) ? r.category : 'Uncategorized'
      const c = catMap.get(key) || { income: 0, expenses: 0, total: 0 }
      if (r.amount >= 0) c.income += Number(r.amount)
      else c.expenses += Number(r.amount)
      c.total += Number(r.amount)
      catMap.set(key, c)
    }
    const byCategory = [...catMap.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))

    const totals = rows.reduce((acc, r) => {
      if (r.amount >= 0) acc.income += Number(r.amount); else acc.expenses += Number(r.amount)
      acc.total += Number(r.amount)
      return acc
    }, { income: 0, expenses: 0, total: 0 })

    // Calculate current balance (sum of ALL transactions, not just filtered period)
    let currentBalance = 0
    const { data: allTransactions } = await supabase
      .from('Transactions')
      .select('amount')
      .eq('user_id', userId)
    
    allTransactions?.forEach((tx: any) => {
      currentBalance += Number(tx.amount || 0)
    })

    const byMonthCategory: Record<string, Record<string, { income: number; expenses: number; total: number }>> = {}
    for (const [month, mmap] of perMonthCategoryMap.entries()) {
      byMonthCategory[month] = Object.fromEntries(mmap.entries())
    }

    return NextResponse.json({ ok: true, period, fromDate, count: rows.length, monthly, byCategory, byMonthCategory, totals, currentBalance }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}


