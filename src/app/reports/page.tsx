"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Summary = {
  ok: boolean
  period: 'all' | 'year' | 'quarter'
  fromDate: string | null
  count: number
  monthly: Array<{ month: string; income: number; expenses: number; total: number }>
  byCategory: Array<{ category: string; income: number; expenses: number; total: number }>
  totals: { income: number; expenses: number; total: number }
}

export default function ReportsPage() {
  const router = useRouter()
  const [period, setPeriod] = useState<'all' | 'year' | 'quarter'>('year')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Summary | null>(null)

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

  const byMonth = useMemo(() => data?.monthly || [], [data])
  const byCategory = useMemo(() => data?.byCategory || [], [data])
  const incomeCats = useMemo(() => (
    (byCategory || [])
      .filter(c => c.income > 0)
      .sort((a, b) => b.income - a.income)
  ), [byCategory])
  const expenseCats = useMemo(() => (
    (byCategory || [])
      .filter(c => c.expenses < 0)
      .sort((a, b) => Math.abs(b.expenses) - Math.abs(a.expenses))
  ), [byCategory])
  const totals = useMemo(() => data?.totals || { income: 0, expenses: 0, total: 0 }, [data])
  const format = (n: number) => Number(n || 0).toFixed(2)

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Reports</h1>
          <Button variant="outline" onClick={() => router.push('/')}>Dashboard</Button>
        </div>
        <div className="flex gap-2">
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
