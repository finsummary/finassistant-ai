"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Summary = {
  ok: boolean
  period: 'all' | 'year' | 'quarter'
  fromDate: string | null
  count: number
  monthly: Array<{ month: string; income: number; expenses: number; total: number }>
  byCategory: Array<{ category: string; income: number; expenses: number; total: number }>
  byMonthCategory?: Record<string, Record<string, { income: number; expenses: number; total: number }>>
  totals: { income: number; expenses: number; total: number }
}

export default function ReportsPage() {
  const router = useRouter()
  const [period, setPeriod] = useState<'all' | 'year' | 'quarter'>('year')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Summary | null>(null)
  const [categories, setCategories] = useState<Array<{ id: string; name: string; type: 'income' | 'expense'; enabled?: boolean; sort_order?: number }>>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/reports/summary?period=${period}`, { cache: 'no-store' })
        const json = await res.json()
        setData(json)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [period])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories', { cache: 'no-store' })
        const json = await res.json()
        if (json?.ok) {
          setCategories((json.rows || []).filter((c: any) => c?.enabled !== false))
        }
      } catch {}
    }
    loadCategories()
  }, [])

  useEffect(() => {
    // Load saved forecasts if any
    const loadForecasts = async () => {
      try {
        const res = await fetch('/api/forecasts', { cache: 'no-store' })
        const json = await res.json()
        if (json?.ok) {
          const map: Record<string, Record<string, number>> = {}
          for (const it of (json.rows || [])) {
            const m = String(it.month)
            map[m] = map[m] || {}
            map[m][String(it.key)] = Number(it.value || 0)
          }
          setForecast(map)
          // Ensure forecastMonths includes months from saved data not in actual months
          const actualMonths = (data?.monthly || []).map((mm: any) => mm.month)
          const extra = Object.keys(map).filter(m => !actualMonths.includes(m))
          if (extra.length) setForecastMonths(prev => [...new Set([...prev, ...extra])])
        }
      } catch {}
    }
    loadForecasts()
  }, [data])

  const byMonth = useMemo(() => data?.monthly || [], [data])
  const byCategory = useMemo(() => data?.byCategory || [], [data])
  const categoryTotalsMap = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number; total: number }>()
    for (const c of byCategory) {
      map.set(String((c as any).category || '').toLowerCase(), { income: c.income, expenses: c.expenses, total: c.total })
    }
    return map
  }, [byCategory])

  const incomeCats = useMemo(() => {
    const list = categories.filter(c => c.type === 'income')
    return list.map(c => {
      const t = categoryTotalsMap.get(String(c.name || '').toLowerCase()) || { income: 0, expenses: 0, total: 0 }
      return { category: c.name, income: t.income }
    })
  }, [categories, categoryTotalsMap])

  const expenseCats = useMemo(() => {
    const list = categories.filter(c => c.type === 'expense')
    return list.map(c => {
      const t = categoryTotalsMap.get(String(c.name || '').toLowerCase()) || { income: 0, expenses: 0, total: 0 }
      return { category: c.name, expenses: t.expenses }
    })
  }, [categories, categoryTotalsMap])
  const totals = useMemo(() => data?.totals || { income: 0, expenses: 0, total: 0 }, [data])
  const [noCents, setNoCents] = useState(false)
  const numberFmt = useMemo(() => new Intl.NumberFormat('en-US', { minimumFractionDigits: noCents ? 0 : 2, maximumFractionDigits: noCents ? 0 : 2 }), [noCents])
  const format = (n: number) => numberFmt.format(n || 0)
  const months = useMemo(() => (data?.monthly || []).map(m => m.month), [data])
  const [forecastMonths, setForecastMonths] = useState<string[]>([])
  const monthsDisplayed = useMemo(() => [...months, ...forecastMonths], [months, forecastMonths])

  const [forecast, setForecast] = useState<Record<string, Record<string, number>>>({})
  const ensureForecastMonth = (month: string) => {
    setForecast(prev => (prev[month] ? prev : { ...prev, [month]: {} }))
  }
  const setForecastValue = (month: string, key: string, value: number) => {
    setForecast(prev => ({ ...prev, [month]: { ...(prev[month] || {}), [key]: value } }))
  }
  const addNextMonth = () => {
    const last = (monthsDisplayed[monthsDisplayed.length - 1] || new Date().toISOString().slice(0,7))
    const [yy, mm] = last.split('-').map(n => Number(n))
    const d = new Date(yy, (mm - 1) + 1, 1)
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`
    if (!forecastMonths.includes(next)) setForecastMonths(prev => [...prev, next])
    ensureForecastMonth(next)
  }

  const [startCash, setStartCash] = useState<number>(0)
  const today = useMemo(() => new Date(), [])
  const currentMonthKey = useMemo(() => today.toISOString().slice(0,7), [today])
  const [todayStr, setTodayStr] = useState('')
  useEffect(() => { setTodayStr(new Date().toLocaleDateString()) }, [])

  const computeNextMonth = (yyyymm: string) => {
    const [yy, mm] = yyyymm.split('-').map(n => Number(n))
    const d = new Date(yy, (mm - 1) + 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`
  }

  type AutofillMode = 'last' | 'avg12' | 'avg3' | 'sameMonthLY'
  const [autofillMode, setAutofillMode] = useState<AutofillMode>('last')
  const [autofillMultiplier, setAutofillMultiplier] = useState<number>(1)

  type KindKey = 'income' | 'expenses'
  const getMonthCategoryValue = (byMonthCat: any, month: string, name: string, kind: KindKey) => {
    const monthMap = byMonthCat[month] || {}
    let entry = monthMap[name]
    if (!entry) {
      const want = String(name).trim().toLowerCase()
      for (const k of Object.keys(monthMap)) {
        if (String(k).trim().toLowerCase() === want) { entry = monthMap[k]; break }
      }
    }
    return Number((entry?.[kind]) || 0)
  }

  const getHistoricalSeries = (name: string, kind: KindKey) => {
    const byMonthCat: any = (data as any)?.byMonthCategory || {}
    const monthsList = Object.keys(byMonthCat).sort()
    return monthsList.map(m => {
      const v = getMonthCategoryValue(byMonthCat, m, name, kind)
      return { month: m, value: Number(v) }
    })
  }

  const computeAutofillValue = (name: string, kind: KindKey, targetMonth: string) => {
    const series = getHistoricalSeries(name, kind)
    if (!series.length) return 0

    const applyMul = (v: number) => Number((v * (autofillMultiplier || 1)).toFixed(2))

    if (autofillMode === 'last') {
      return applyMul(series[series.length - 1].value)
    }
    if (autofillMode === 'avg12') {
      const tail = series.slice(-12)
      const avg = tail.reduce((s, x) => s + x.value, 0) / (tail.length || 1)
      return applyMul(avg)
    }
    if (autofillMode === 'avg3') {
      const tail = series.slice(-3)
      const avg = tail.reduce((s, x) => s + x.value, 0) / (tail.length || 1)
      return applyMul(avg)
    }
    if (autofillMode === 'sameMonthLY') {
      const [ty, tm] = targetMonth.split('-').map(Number)
      const ly = ty - 1
      const key = `${ly}-${String(tm).padStart(2,'0')}`
      const found = series.find(it => it.month === key)
      return applyMul(found ? found.value : 0)
    }
    return 0
  }

  const autofillGeneric = () => {
    const byMonthCat: any = (data as any)?.byMonthCategory || {}
    const actualMonths = Object.keys(byMonthCat).sort()
    const src = actualMonths[actualMonths.length - 1]
    if (!src && (autofillMode === 'last' || autofillMode === 'avg12' || autofillMode === 'avg3')) {
      alert('No historical data to compute from');
      return
    }

    let target = forecastMonths[forecastMonths.length - 1]
    if (!target) {
      const lastActual = months[months.length - 1] || currentMonthKey
      target = computeNextMonth(lastActual)
      if (!forecastMonths.includes(target)) setForecastMonths(prev => [...prev, target!])
    }
    ensureForecastMonth(target)

    const incNames = categories.filter(c => c.type === 'income').map(c => c.name)
    const expNames = categories.filter(c => c.type === 'expense').map(c => c.name)

    setForecast(prev => {
      const next = { ...(prev[target] || {}) }
      for (const name of incNames) {
        const v = computeAutofillValue(name, 'income', target!)
        next[`inc_${name}`] = Number(v)
      }
      for (const name of expNames) {
        const v = computeAutofillValue(name, 'expenses', target!)
        next[`exp_${name}`] = -Math.abs(Number(v))
      }
      return { ...prev, [target]: next }
    })
  }

  const autofillFromLastMonth = () => {
    setAutofillMode('last')
    setAutofillMultiplier(1)
    autofillGeneric()
  }
  const tableContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll horizontally to current month column when present
    try {
      const wrap = tableContainerRef.current
      const th = document.querySelector<HTMLTableCellElement>(`th[data-month="${currentMonthKey}"]`)
      if (wrap && th) {
        const offset = th.offsetLeft - 64 // small left padding
        wrap.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' })
      }
    } catch {}
  }, [currentMonthKey, monthsDisplayed.join(',')])
  const cashflow = useMemo(() => {
    const perMonth = data?.byMonthCategory || {}
    const incomeNames = categories.filter(c => c.type === 'income').map(c => c.name)
    const expenseNames = categories.filter(c => c.type === 'expense').map(c => c.name)

    const rows: Array<{ key: string; label: string; values: number[] }> = []
    // Row 0: Cash at start
    const startRow = { key: 'cash_start', label: 'Cash at start', values: [] as number[] }
    // Income category rows
    const incRows = incomeNames.map(name => ({ key: `inc_${name}`, label: name, values: [] as number[] }))
    // Total income row
    const totalInc = { key: 'total_income', label: 'Total income', values: [] as number[] }
    // Expense category rows
    const expRows = expenseNames.map(name => ({ key: `exp_${name}`, label: name, values: [] as number[] }))
    // Total expenses row
    const totalExp = { key: 'total_expenses', label: 'Total expenses', values: [] as number[] }
    // Cash at end row
    const endRow = { key: 'cash_end', label: 'Cash at end', values: [] as number[] }

    let prevEnd = startCash || 0
    for (const month of monthsDisplayed) {
      const catAgg = perMonth[month] || {}
      // Cash start
      startRow.values.push(prevEnd)
      // Incomes
      let incSum = 0
      for (const r of incRows) {
        const forecastVal = (forecast[month] || {})[r.key]
        const agg = typeof forecastVal === 'number' ? forecastVal : (catAgg[r.label]?.income || 0)
        r.values.push(agg)
        incSum += agg
      }
      totalInc.values.push(incSum)
      // Expenses: keep negative sign from API aggregation
      let expSum = 0
      for (const r of expRows) {
        const forecastVal = (forecast[month] || {})[r.key]
        const agg = typeof forecastVal === 'number' ? forecastVal : ((catAgg[r.label]?.expenses || 0) as number)
        r.values.push(agg)
        expSum += agg
      }
      totalExp.values.push(expSum)
      const end = prevEnd + incSum + expSum
      endRow.values.push(end)
      prevEnd = end
    }

    rows.push(startRow, ...incRows, totalInc, ...expRows, totalExp, endRow)
    return rows
  }, [data, categories, monthsDisplayed, startCash, forecast])

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Reports</h1>
          <Button variant="outline" onClick={() => router.push('/')}>Dashboard</Button>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant={noCents ? 'default' : 'outline'} onClick={() => setNoCents(v => !v)} title="Toggle cents">
            {noCents ? 'No cents' : 'Show cents'}
          </Button>
          <Button variant={period==='all'?'default':'outline'} onClick={() => setPeriod('all')}>All</Button>
          <Button variant={period==='year'?'default':'outline'} onClick={() => setPeriod('year')}>Year</Button>
          <Button variant={period==='quarter'?'default':'outline'} onClick={() => setPeriod('quarter')}>Quarter</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>By month</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">Month</th>
                      <th className="py-2 pr-4">Income</th>
                      <th className="py-2 pr-4">Expenses</th>
                      <th className="py-2 pr-4">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMonth.map(m => (
                      <tr key={m.month} className="border-t">
                        <td className="py-2 pr-4 whitespace-nowrap">{m.month}</td>
                        <td className="py-2 pr-4">{format(m.income)}</td>
                        <td className="py-2 pr-4">{format(Math.abs(m.expenses))}</td>
                        <td className="py-2 pr-4">{format(m.income + m.expenses)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income by category</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Income</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeCats.map(c => (
                      <tr key={c.category} className="border-t">
                        <td className="py-2 pr-4 whitespace-nowrap">{c.category}</td>
                        <td className="py-2 pr-4">{format(c.income)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by category</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Expenses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseCats.map(c => (
                      <tr key={c.category} className="border-t">
                        <td className="py-2 pr-4 whitespace-nowrap">{c.category}</td>
                        <td className="py-2 pr-4">{format(Math.abs(c.expenses))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cashflow table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-1">Today: <span suppressHydrationWarning>{todayStr}</span></div>
          <div className="mb-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Start cash:</span>
              <Input className="w-36" value={startCash} type="number" onChange={e => setStartCash(Number(e.target.value || 0))} />
            </div>
            <Button variant="outline" onClick={addNextMonth}>Add next month</Button>
            <Button variant="outline" onClick={autofillFromLastMonth}>Autofill from last month</Button>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Mode:</label>
              <select className="h-9 px-2 border rounded" value={autofillMode} onChange={e => setAutofillMode(e.target.value as AutofillMode)}>
                <option value="last">last month</option>
                <option value="avg12">average 12m</option>
                <option value="avg3">average 3m</option>
                <option value="sameMonthLY">same month last year</option>
              </select>
              <label className="text-sm text-muted-foreground">x</label>
              <Input className="w-24" type="number" value={autofillMultiplier} onChange={e => setAutofillMultiplier(Number(e.target.value || 1))} />
              <Button variant="outline" onClick={autofillGeneric}>Autofill</Button>
            </div>
            <Button variant="outline" onClick={async ()=>{
              const items: Array<{ month: string; key: string; value: number }> = []
              for (const m of monthsDisplayed) {
                const row = forecast[m] || {}
                for (const [k, v] of Object.entries(row)) items.push({ month: m, key: k, value: Number(v||0) })
              }
              if (!items.length) { alert('Nothing to save'); return }
              const res = await fetch('/api/forecasts', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ items }) })
              const json = await res.json()
              if (!json?.ok) { alert(`Save error: ${json?.error}`); return }
              alert(`Saved ${json.upserted} items`)
            }}>Save forecast</Button>
          </div>
          <div className="overflow-x-auto" ref={tableContainerRef}>
            <div className="rounded-lg border shadow-md">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 bg-muted border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Row</th>
                    {monthsDisplayed.map(m => {
                      const isForecastCol = forecastMonths.includes(m)
                      const isCurrent = m === currentMonthKey
                      return (
                        <th key={m} data-month={m} className={`py-2 pr-4 whitespace-nowrap ${isForecastCol ? 'text-center' : 'text-right'} ${isCurrent ? 'bg-blue-50' : ''}`}>{m}</th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {cashflow.map(r => {
                    const isCategoryRow = r.key.startsWith('inc_') || r.key.startsWith('exp_')
                    const rowEmphasis = (
                      r.key === 'cash_start' || r.key === 'cash_end'
                        ? 'bg-yellow-50 font-semibold'
                        : r.key === 'total_income'
                        ? 'bg-green-50 font-semibold'
                        : r.key === 'total_expenses'
                        ? 'bg-red-50 font-semibold'
                        : ''
                    )
                    return (
                      <tr key={r.key} className={`border-t hover:bg-accent/40 transition-colors ${rowEmphasis} ${isCategoryRow ? 'text-[13px]' : ''}`}>
                        <td className="py-2 pr-4 whitespace-nowrap">{r.label}</td>
                        {r.values.map((v, i) => {
                          const month = monthsDisplayed[i]
                          const isForecastCol = forecastMonths.includes(month)
                          const isEditable = isCategoryRow && isForecastCol
                          const isExpenseRow = r.key.startsWith('exp_')
                          const isCurrentCol = month === currentMonthKey
                          const isCashRow = r.key === 'cash_start' || r.key === 'cash_end'
                          const isNegCash = isCashRow && Number(v) < 0
                          if (!isEditable) return (
                            <td key={i} className={`py-2 pr-4 ${isForecastCol ? 'text-center' : 'text-right'} ${isCategoryRow ? 'text-[13px]' : ''} ${isCurrentCol ? 'bg-blue-50' : ''} ${isNegCash ? 'text-red-600' : ''}`}>{format(v)}</td>
                          )
                          return (
                            <td key={i} className={`py-2 pr-4 text-center ${isCurrentCol ? 'bg-blue-50' : ''} ${isNegCash ? 'text-red-600' : ''}`}>
                              <Input
                                className={`h-8 w-28 text-center mx-auto ${isNegCash ? 'text-red-600' : ''}`}
                                type="number"
                                step={noCents ? 1 : 0.01}
                                value={String(noCents ? Math.round(v) : Number((v ?? 0).toFixed(2)))}
                                onChange={e => {
                                  const raw = Number(e.target.value || 0)
                                  const rounded = noCents ? Math.round(raw) : Number(raw.toFixed(2))
                                  const coerced = isExpenseRow ? -Math.abs(rounded) : Math.abs(rounded)
                                  setForecastValue(month, r.key, coerced)
                                }}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="text-sm text-muted-foreground">
              <div>Transactions: {data.count}</div>
              <div>Income: {format(totals.income)}</div>
              <div>Expenses: {format(Math.abs(totals.expenses))}</div>
              <div>Net: {format(totals.income + totals.expenses)}</div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
