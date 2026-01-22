'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { Skeleton } from '@/components/ui/skeleton'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler)

type VarianceData = {
  hasBudget: boolean
  horizon?: '6months' | 'yearend'
  forecastMonths?: string[]
  variance?: Array<{
    month: string
    type: 'actual' | 'forecast'
    plan: { income: number; expenses: number; net: number }
    actual: { income: number; expenses: number; net: number }
    variance: { income: number; expenses: number; net: number }
    variancePercent: { income: number; expenses: number; net: number }
    byCategory: Record<string, {
      plan: { income: number; expenses: number; net: number }
      actual: { income: number; expenses: number; net: number }
      variance: { income: number; expenses: number; net: number }
      variancePercent: { income: number; expenses: number; net: number }
    }>
  }>
  budgetCreatedAt?: string
  budgetUpdatedAt?: string
}

export default function BudgetVariancePage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<VarianceData | null>(null)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [selectedView, setSelectedView] = useState<'summary' | 'detailed'>('summary')
  const [noCents, setNoCents] = useState(true)

  const numberFmt = useMemo(() => new Intl.NumberFormat('en-US', { 
    minimumFractionDigits: noCents ? 0 : 2, 
    maximumFractionDigits: noCents ? 0 : 2 
  }), [noCents])
  const format = (n: number) => numberFmt.format(n || 0)

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-')
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/budget/variance')
        const json = await res.json()
        if (!json?.ok) {
          addToast(`Failed to load variance data: ${json?.error}`, 'error')
          return
        }
        setData(json.data)
        if (!json.data.hasBudget) {
          addToast('No saved budget found. Please generate a budget first.', 'warning')
        }
      } catch (e: any) {
        addToast(`Error loading variance: ${e.message}`, 'error')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [addToast])

  const toggleMonthExpansion = (month: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(month)) {
        next.delete(month)
      } else {
        next.add(month)
      }
      return next
    })
  }

  // Chart data for variance visualization
  const chartData = useMemo(() => {
    if (!data?.variance) return []

    return data.variance.map(v => ({
      month: formatMonth(v.month),
      monthKey: v.month,
      type: v.type,
      'Plan Income': v.plan.income,
      'Actual Income': v.actual.income,
      'Plan Expenses': v.plan.expenses,
      'Actual Expenses': v.actual.expenses,
      'Plan Net': v.plan.net,
      'Actual Net': v.actual.net,
      'Variance Income': v.variance.income,
      'Variance Expenses': v.variance.expenses,
      'Variance Net': v.variance.net,
    }))
  }, [data])

  // Filter to show only actual months (past and current)
  const actualVariance = useMemo(() => {
    if (!data?.variance) return []
    return data.variance.filter(v => v.type === 'actual')
  }, [data])

  if (loading && !data) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!data?.hasBudget) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Budget Variance Analysis</CardTitle>
            <CardDescription>Compare actual transactions with your budget</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No saved budget found.</p>
              <Button onClick={() => router.push('/budget')}>
                Go to Budget Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budget Variance Analysis</h1>
          <p className="text-gray-600 mt-1">Plan vs Actual Comparison</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>
          <Button
            variant={selectedView === 'summary' ? 'default' : 'outline'}
            onClick={() => setSelectedView('summary')}
          >
            Summary
          </Button>
          <Button
            variant={selectedView === 'detailed' ? 'default' : 'outline'}
            onClick={() => setSelectedView('detailed')}
          >
            Detailed
          </Button>
          <Button variant="outline" onClick={() => setNoCents(!noCents)}>
            {noCents ? 'Show Cents' : 'Hide Cents'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Variance (Actual Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {format(actualVariance.reduce((sum, v) => sum + v.variance.net, 0))}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {actualVariance.length > 0 && (
                <>
                  {format(actualVariance.reduce((sum, v) => sum + v.plan.net, 0))} planned vs{' '}
                  {format(actualVariance.reduce((sum, v) => sum + v.actual.net, 0))} actual
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Monthly Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {actualVariance.length > 0
                ? format(actualVariance.reduce((sum, v) => sum + v.variance.net, 0) / actualVariance.length)
                : '0'}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {actualVariance.length} month{actualVariance.length !== 1 ? 's' : ''} with actual data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Budget Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.budgetUpdatedAt
                ? new Date(data.budgetUpdatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'N/A'}
            </div>
            <p className="text-xs text-gray-600 mt-1">Last updated</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Income: Plan vs Actual</CardTitle>
            <CardDescription>Comparison of planned and actual income</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Bar
                data={{
                  labels: chartData.map(d => d.month),
                  datasets: [
                    {
                      label: 'Plan Income',
                      data: chartData.map(d => d['Plan Income']),
                      backgroundColor: '#3b82f6',
                    },
                    {
                      label: 'Actual Income',
                      data: chartData.map(d => d['Actual Income']),
                      backgroundColor: '#16a34a',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' as const },
                    tooltip: {
                      callbacks: {
                        label: (context) => `${context.dataset.label}: ${format(context.parsed.y)}`,
                      },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => format(Number(value)),
                      },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses: Plan vs Actual</CardTitle>
            <CardDescription>Comparison of planned and actual expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Bar
                data={{
                  labels: chartData.map(d => d.month),
                  datasets: [
                    {
                      label: 'Plan Expenses',
                      data: chartData.map(d => d['Plan Expenses']),
                      backgroundColor: '#ef4444',
                    },
                    {
                      label: 'Actual Expenses',
                      data: chartData.map(d => d['Actual Expenses']),
                      backgroundColor: '#dc2626',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' as const },
                    tooltip: {
                      callbacks: {
                        label: (context) => `${context.dataset.label}: ${format(context.parsed.y)}`,
                      },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => format(Number(value)),
                      },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Net Variance Over Time</CardTitle>
            <CardDescription>Variance in net cash flow (actual - plan)</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Line
                data={{
                  labels: chartData.map(d => d.month),
                  datasets: [
                    {
                      label: 'Variance Net',
                      data: chartData.map(d => d['Variance Net']),
                      borderColor: '#f59e0b',
                      backgroundColor: '#f59e0b40',
                      borderWidth: 2,
                      fill: true,
                    },
                    {
                      label: 'Plan Net',
                      data: chartData.map(d => d['Plan Net']),
                      borderColor: '#3b82f6',
                      borderDash: [5, 5],
                      borderWidth: 2,
                      fill: false,
                    },
                    {
                      label: 'Actual Net',
                      data: chartData.map(d => d['Actual Net']),
                      borderColor: '#16a34a',
                      borderDash: [5, 5],
                      borderWidth: 2,
                      fill: false,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' as const },
                    tooltip: {
                      callbacks: {
                        label: (context) => `${context.dataset.label}: ${format(context.parsed.y)}`,
                      },
                    },
                  },
                  scales: {
                    y: {
                      ticks: {
                        callback: (value) => format(Number(value)),
                      },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Variance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Variance Details</CardTitle>
          <CardDescription>Click on a month to see category breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Month</th>
                  <th className="text-right p-2">Type</th>
                  <th className="text-right p-2">Plan Income</th>
                  <th className="text-right p-2">Actual Income</th>
                  <th className="text-right p-2">Variance</th>
                  <th className="text-right p-2">%</th>
                  <th className="text-right p-2">Plan Expenses</th>
                  <th className="text-right p-2">Actual Expenses</th>
                  <th className="text-right p-2">Variance</th>
                  <th className="text-right p-2">%</th>
                  <th className="text-right p-2">Plan Net</th>
                  <th className="text-right p-2">Actual Net</th>
                  <th className="text-right p-2">Variance</th>
                  <th className="text-right p-2">%</th>
                </tr>
              </thead>
              <tbody>
                {data.variance?.map((v) => (
                  <React.Fragment key={v.month}>
                    <tr
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleMonthExpansion(v.month)}
                    >
                      <td className="p-2 font-medium">{formatMonth(v.month)}</td>
                      <td className="p-2 text-right">
                        <span className={`px-2 py-1 rounded text-xs ${
                          v.type === 'actual' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {v.type}
                        </span>
                      </td>
                      <td className="p-2 text-right">{format(v.plan.income)}</td>
                      <td className="p-2 text-right">{format(v.actual.income)}</td>
                      <td className={`p-2 text-right ${
                        v.variance.income >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {format(v.variance.income)}
                      </td>
                      <td className={`p-2 text-right ${
                        v.variancePercent.income >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {v.variancePercent.income.toFixed(1)}%
                      </td>
                      <td className="p-2 text-right">{format(v.plan.expenses)}</td>
                      <td className="p-2 text-right">{format(v.actual.expenses)}</td>
                      <td className={`p-2 text-right ${
                        v.variance.expenses <= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {format(v.variance.expenses)}
                      </td>
                      <td className={`p-2 text-right ${
                        v.variancePercent.expenses <= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {v.variancePercent.expenses.toFixed(1)}%
                      </td>
                      <td className="p-2 text-right">{format(v.plan.net)}</td>
                      <td className="p-2 text-right">{format(v.actual.net)}</td>
                      <td className={`p-2 text-right font-medium ${
                        v.variance.net >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {format(v.variance.net)}
                      </td>
                      <td className={`p-2 text-right font-medium ${
                        v.variancePercent.net >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {v.variancePercent.net.toFixed(1)}%
                      </td>
                    </tr>
                    {expandedMonths.has(v.month) && (
                      <tr className="bg-gray-50">
                        <td colSpan={14} className="p-4">
                          <div className="space-y-2">
                            <h4 className="font-medium mb-2">Category Breakdown for {formatMonth(v.month)}</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left p-1">Category</th>
                                    <th className="text-right p-1">Plan Income</th>
                                    <th className="text-right p-1">Actual Income</th>
                                    <th className="text-right p-1">Variance</th>
                                    <th className="text-right p-1">Plan Expenses</th>
                                    <th className="text-right p-1">Actual Expenses</th>
                                    <th className="text-right p-1">Variance</th>
                                    <th className="text-right p-1">Net Variance</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.keys(v.byCategory).map(category => {
                                    const cat = v.byCategory[category]
                                    return (
                                      <tr key={category} className="border-b">
                                        <td className="p-1">{category}</td>
                                        <td className="p-1 text-right">{format(cat.plan.income)}</td>
                                        <td className="p-1 text-right">{format(cat.actual.income)}</td>
                                        <td className={`p-1 text-right ${
                                          cat.variance.income >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                          {format(cat.variance.income)}
                                        </td>
                                        <td className="p-1 text-right">{format(cat.plan.expenses)}</td>
                                        <td className="p-1 text-right">{format(cat.actual.expenses)}</td>
                                        <td className={`p-1 text-right ${
                                          cat.variance.expenses <= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                          {format(cat.variance.expenses)}
                                        </td>
                                        <td className={`p-1 text-right font-medium ${
                                          cat.variance.net >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                          {format(cat.variance.net)}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
