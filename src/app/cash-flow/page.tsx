'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type Summary = {
  ok: boolean
  period: 'all' | 'year' | 'quarter'
  fromDate: string | null
  count: number
  monthly: Array<{ month: string; income: number; expenses: number; total: number }>
  byCategory: Array<{ category: string; income: number; expenses: number; total: number }>
  byMonthCategory?: Record<string, Record<string, { income: number; expenses: number; total: number }>>
  totals: { income: number; expenses: number; total: number }
  currentBalance?: number
}

export default function CashFlowPage() {
  const router = useRouter()
  const [period, setPeriod] = useState<'all' | 'year' | 'quarter'>('year')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Summary | null>(null)
  const [categories, setCategories] = useState<Array<{ id: string; name: string; type: 'income' | 'expense'; enabled?: boolean; sort_order?: number }>>([])
  const [noCents, setNoCents] = useState(false)
  const [trajectoryData, setTrajectoryData] = useState<{
    currentBalance: number
    avgMonthlyChange: number
    forecast: Array<{ month: string; balance: number; income: number; expenses: number }>
    runway: number | null
  } | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/reports/summary?period=${period}`)
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
        const res = await fetch('/api/categories')
        const json = await res.json()
        if (json?.ok) {
          setCategories((json.rows || []).filter((c: any) => c?.enabled !== false))
        }
      } catch {}
    }
    loadCategories()
  }, [])

  useEffect(() => {
    const loadTrajectory = async () => {
      try {
        const res = await fetch('/api/framework/trajectory')
        const json = await res.json()
        if (json?.ok && json.data) {
          const { currentBalance, avgMonthlyChange, forecast } = json.data
          
          // Calculate runway
          let runway: number | null = null
          if (avgMonthlyChange < 0) {
            const monthsUntilZero = Math.floor(currentBalance / Math.abs(avgMonthlyChange))
            runway = monthsUntilZero > 0 ? monthsUntilZero : 0
          }
          
          // Check forecast for negative balances
          const firstNegativeMonth = forecast.findIndex((f: any) => f.balance <= 0)
          if (firstNegativeMonth >= 0 && runway === null) {
            runway = firstNegativeMonth + 1
          }
          
          setTrajectoryData({
            currentBalance,
            avgMonthlyChange,
            forecast,
            runway,
          })
        }
      } catch {}
    }
    loadTrajectory()
  }, [])

  const numberFmt = useMemo(() => new Intl.NumberFormat('en-US', { 
    minimumFractionDigits: noCents ? 0 : 2, 
    maximumFractionDigits: noCents ? 0 : 2 
  }), [noCents])
  const format = (n: number) => numberFmt.format(n || 0)

  // Get months from data
  const months = useMemo(() => {
    if (!data?.monthly) return []
    return data.monthly.map(m => m.month).sort()
  }, [data])

  // Build category type map from categories list
  const categoryTypeMap = useMemo(() => {
    const map = new Map<string, 'income' | 'expense'>()
    categories.forEach(c => {
      map.set(c.name.toLowerCase(), c.type)
    })
    return map
  }, [categories])

  // Get income and expense categories from actual data (byMonthCategory) to avoid duplicates
  const incomeCategories = useMemo(() => {
    if (!data?.byMonthCategory) return []
    const categorySet = new Set<string>()
    
    // Collect all unique categories from data
    Object.values(data.byMonthCategory).forEach(monthData => {
      Object.keys(monthData).forEach(cat => {
        categorySet.add(cat)
      })
    })
    
    // Filter to only income categories
    const incomeCats: string[] = []
    categorySet.forEach(cat => {
      // Check category type from categories list first
      const catType = categoryTypeMap.get(cat.toLowerCase())
      
      // If explicitly marked as income, include it
      if (catType === 'income') {
        incomeCats.push(cat)
      } else if (!catType) {
        // If no type defined, check if it has income in data and no expenses
        const hasIncome = months.some(month => {
          const values = data.byMonthCategory?.[month]?.[cat]
          return values && values.income > 0
        })
        const hasExpenses = months.some(month => {
          const values = data.byMonthCategory?.[month]?.[cat]
          return values && values.expenses < 0
        })
        // Only include if it has income and is NOT an expense category
        if (hasIncome && !hasExpenses) {
          incomeCats.push(cat)
        }
      }
    })
    
    // Remove duplicates and sort
    return Array.from(new Set(incomeCats)).sort()
  }, [data, months, categoryTypeMap])

  const expenseCategories = useMemo(() => {
    if (!data?.byMonthCategory) return []
    const categorySet = new Set<string>()
    
    // Collect all unique categories from data
    Object.values(data.byMonthCategory).forEach(monthData => {
      Object.keys(monthData).forEach(cat => {
        categorySet.add(cat)
      })
    })
    
    // Filter to only expense categories
    const expenseCats: string[] = []
    categorySet.forEach(cat => {
      // Check category type from categories list first
      const catType = categoryTypeMap.get(cat.toLowerCase())
      
      // If explicitly marked as expense, include it
      if (catType === 'expense') {
        expenseCats.push(cat)
      } else if (!catType) {
        // If no type defined, check if it has expenses in data
        const hasExpenses = months.some(month => {
          const values = data.byMonthCategory?.[month]?.[cat]
          return values && values.expenses < 0
        })
        // Only include if it has expenses and is NOT an income category
        if (hasExpenses) {
          expenseCats.push(cat)
        }
      }
    })
    
    // Remove duplicates and sort
    return Array.from(new Set(expenseCats)).sort()
  }, [data, months, categoryTypeMap])

  // Get value for a category in a specific month
  const getCategoryMonthValue = (category: string, month: string, type: 'income' | 'expense'): number => {
    if (!data?.byMonthCategory?.[month]?.[category]) return 0
    const values = data.byMonthCategory[month][category]
    return type === 'income' ? values.income : Math.abs(values.expenses)
  }

  // Calculate totals for each month
  const monthTotals = useMemo(() => {
    const totals: Record<string, { income: number; expenses: number; net: number }> = {}
    months.forEach(month => {
      let income = 0
      let expenses = 0
      
      incomeCategories.forEach(cat => {
        income += getCategoryMonthValue(cat, month, 'income')
      })
      
      expenseCategories.forEach(cat => {
        expenses += getCategoryMonthValue(cat, month, 'expense')
      })
      
      totals[month] = {
        income,
        expenses,
        net: income - expenses
      }
    })
    return totals
  }, [months, incomeCategories, expenseCategories, data])

  // Calculate cash at start and cash at end for each month
  const cashBalances = useMemo(() => {
    if (!months.length || !data?.currentBalance) return {}
    
    const balances: Record<string, { start: number; end: number }> = {}
    
    // Start from the last month and work backwards
    // Last month's end = current balance
    // For each month going backwards: start = end of previous month, end = start + net
    
    let runningBalance = data.currentBalance
    
    // Go backwards through months
    for (let i = months.length - 1; i >= 0; i--) {
      const month = months[i]
      const net = monthTotals[month]?.net || 0
      
      // Cash at end for this month = running balance
      const end = runningBalance
      // Cash at start = end - net (because we're going backwards)
      const start = end - net
      
      balances[month] = { start, end }
      
      // Move to previous month: its end = this month's start
      runningBalance = start
    }
    
    return balances
  }, [months, monthTotals, data?.currentBalance])

  // Format month for display
  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-')
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading cash flow data...</p>
        </div>
      </div>
    )
  }

  if (!data || months.length === 0) {
    return (
      <div className="p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Spreadsheet</CardTitle>
            <CardDescription>Income and expenses by category and month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No transaction data available yet.</p>
              <p className="text-sm text-muted-foreground">Upload a CSV file with your bank transactions to see your cash flow.</p>
              <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cash Flow Spreadsheet</h1>
          <p className="text-sm text-muted-foreground">Income and expenses by category and month</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={period === 'quarter' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setPeriod('quarter')}
          >
            Quarter
          </Button>
          <Button 
            variant={period === 'year' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setPeriod('year')}
          >
            Year
          </Button>
          <Button 
            variant={period === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setPeriod('all')}
          >
            All
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left font-semibold min-w-[200px]">
                    Category
                  </th>
                  {months.map(month => (
                    <th key={month} className="px-4 py-3 text-right font-semibold min-w-[120px]">
                      {formatMonth(month)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold min-w-[120px] bg-muted/50">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Cash Balances Section */}
                <tr className="border-b-2 bg-blue-50/50">
                  <td className="sticky left-0 z-10 bg-blue-50/50 px-4 py-2 font-semibold">
                    Cash at Start
                  </td>
                  {months.map(month => {
                    const start = cashBalances[month]?.start ?? 0
                    return (
                      <td key={month} className="px-4 py-2 text-right font-semibold text-blue-700">
                        {format(start)}
                      </td>
                    )
                  })}
                  <td className="px-4 py-2 text-right font-semibold text-blue-700 bg-muted/50">
                    {months.length > 0 ? format(cashBalances[months[0]]?.start ?? 0) : '-'}
                  </td>
                </tr>
                
                {/* Income Section */}
                {incomeCategories.length > 0 && (
                  <>
                    <tr className="border-b bg-green-50/50">
                      <td colSpan={months.length + 2} className="px-4 py-2 font-semibold text-green-700">
                        INCOME
                      </td>
                    </tr>
                    {incomeCategories.map(category => {
                      const categoryTotal = months.reduce((sum, month) => 
                        sum + getCategoryMonthValue(category, month, 'income'), 0
                      )
                      return (
                        <tr key={`income-${category}`} className="border-b hover:bg-muted/30">
                          <td className="sticky left-0 z-10 bg-background px-4 py-2 pl-6 text-sm">
                            {category}
                          </td>
                          {months.map(month => {
                            const value = getCategoryMonthValue(category, month, 'income')
                            return (
                              <td key={month} className="px-4 py-2 text-right text-sm text-green-600">
                                {value !== 0 ? format(value) : '-'}
                              </td>
                            )
                          })}
                          <td className="px-4 py-2 text-right text-sm font-semibold text-green-600 bg-muted/30">
                            {categoryTotal !== 0 ? format(categoryTotal) : '-'}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="border-b-2 bg-green-100/50">
                      <td className="sticky left-0 z-10 bg-green-100/50 px-4 py-2 font-semibold">
                        Total Income
                      </td>
                      {months.map(month => (
                        <td key={month} className="px-4 py-2 text-right font-semibold text-green-700">
                          {format(monthTotals[month]?.income || 0)}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-semibold text-green-700 bg-muted/50">
                        {format(incomeCategories.reduce((sum, cat) => 
                          sum + months.reduce((catSum, month) => 
                            catSum + getCategoryMonthValue(cat, month, 'income'), 0
                          ), 0
                        ))}
                      </td>
                    </tr>
                  </>
                )}

                {/* Expenses Section */}
                {expenseCategories.length > 0 && (
                  <>
                    <tr className="border-b bg-red-50/50">
                      <td colSpan={months.length + 2} className="px-4 py-2 font-semibold text-red-700">
                        EXPENSES
                      </td>
                    </tr>
                    {expenseCategories.map(category => {
                      const categoryTotal = months.reduce((sum, month) => 
                        sum + getCategoryMonthValue(category, month, 'expense'), 0
                      )
                      return (
                        <tr key={`expense-${category}`} className="border-b hover:bg-muted/30">
                          <td className="sticky left-0 z-10 bg-background px-4 py-2 pl-6 text-sm">
                            {category}
                          </td>
                          {months.map(month => {
                            const value = getCategoryMonthValue(category, month, 'expense')
                            return (
                              <td key={month} className="px-4 py-2 text-right text-sm text-red-600">
                                {value !== 0 ? format(value) : '-'}
                              </td>
                            )
                          })}
                          <td className="px-4 py-2 text-right text-sm font-semibold text-red-600 bg-muted/30">
                            {categoryTotal !== 0 ? format(categoryTotal) : '-'}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="border-b-2 bg-red-100/50">
                      <td className="sticky left-0 z-10 bg-red-100/50 px-4 py-2 font-semibold">
                        Total Expenses
                      </td>
                      {months.map(month => (
                        <td key={month} className="px-4 py-2 text-right font-semibold text-red-700">
                          {format(monthTotals[month]?.expenses || 0)}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-semibold text-red-700 bg-muted/50">
                        {format(expenseCategories.reduce((sum, cat) => 
                          sum + months.reduce((catSum, month) => 
                            catSum + getCategoryMonthValue(cat, month, 'expense'), 0
                          ), 0
                        ))}
                      </td>
                    </tr>
                  </>
                )}

                {/* Net Cash Flow */}
                <tr className="border-t-4 bg-blue-50/50">
                  <td className="sticky left-0 z-10 bg-blue-50/50 px-4 py-3 font-bold text-lg">
                    Net Cash Flow
                  </td>
                  {months.map(month => {
                    const net = monthTotals[month]?.net || 0
                    return (
                      <td key={month} className="px-4 py-3 text-right font-bold text-lg" style={{
                        color: net >= 0 ? '#16a34a' : '#dc2626'
                      }}>
                        {format(net)}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-right font-bold text-lg bg-muted/50" style={{
                    color: data.totals.total >= 0 ? '#16a34a' : '#dc2626'
                  }}>
                    {format(data.totals.total)}
                  </td>
                </tr>
                
                {/* Cash at End */}
                <tr className="border-b-2 bg-blue-50/50">
                  <td className="sticky left-0 z-10 bg-blue-50/50 px-4 py-2 font-semibold">
                    Cash at End
                  </td>
                  {months.map(month => {
                    const end = cashBalances[month]?.end ?? 0
                    return (
                      <td key={month} className="px-4 py-2 text-right font-semibold text-blue-700">
                        {format(end)}
                      </td>
                    )
                  })}
                  <td className="px-4 py-2 text-right font-semibold text-blue-700 bg-muted/50">
                    {months.length > 0 ? format(cashBalances[months[months.length - 1]]?.end ?? 0) : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cash Runway Section */}
      {trajectoryData && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Runway Metric */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Runway</CardTitle>
              <CardDescription>Months until cash balance reaches zero</CardDescription>
            </CardHeader>
            <CardContent>
              {trajectoryData.runway !== null ? (
                <div>
                  <div className={`text-5xl font-bold mb-2 ${
                    trajectoryData.runway <= 1 ? 'text-red-600' :
                    trajectoryData.runway <= 3 ? 'text-orange-600' :
                    trajectoryData.runway <= 6 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {trajectoryData.runway}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {trajectoryData.runway === 1 ? 'month' : 'months'} remaining
                  </p>
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Balance:</span>
                        <span className="font-semibold">{format(trajectoryData.currentBalance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Monthly Change:</span>
                        <span className={`font-semibold ${trajectoryData.avgMonthlyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {trajectoryData.avgMonthlyChange >= 0 ? '+' : ''}{format(trajectoryData.avgMonthlyChange)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-5xl font-bold mb-2 text-green-600">∞</div>
                  <p className="text-sm text-muted-foreground">
                    Positive cash flow trajectory
                  </p>
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Balance:</span>
                        <span className="font-semibold">{format(trajectoryData.currentBalance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Monthly Change:</span>
                        <span className="font-semibold text-green-600">
                          +{format(trajectoryData.avgMonthlyChange)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cash Flow Forecast Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Forecast</CardTitle>
              <CardDescription>6-month projection with runway indicator</CardDescription>
            </CardHeader>
            <CardContent>
              {trajectoryData.forecast && trajectoryData.forecast.length > 0 ? (
                <div className="h-64">
                  <Line
                    data={{
                      labels: ['Current', ...trajectoryData.forecast.map(f => f.month)],
                      datasets: [
                        {
                          label: 'Cash Balance',
                          data: [trajectoryData.currentBalance, ...trajectoryData.forecast.map(f => f.balance)],
                          borderColor: trajectoryData.runway !== null && trajectoryData.runway <= 3 
                            ? 'rgb(220, 38, 38)' 
                            : trajectoryData.runway !== null && trajectoryData.runway <= 6
                            ? 'rgb(234, 88, 12)'
                            : 'rgb(34, 197, 94)',
                          backgroundColor: trajectoryData.runway !== null && trajectoryData.runway <= 3
                            ? 'rgba(220, 38, 38, 0.1)'
                            : trajectoryData.runway !== null && trajectoryData.runway <= 6
                            ? 'rgba(234, 88, 12, 0.1)'
                            : 'rgba(34, 197, 94, 0.1)',
                          fill: true,
                          tension: 0.4,
                          pointRadius: 4,
                          pointHoverRadius: 6,
                        },
                        {
                          label: 'Zero Line',
                          data: Array(trajectoryData.forecast.length + 1).fill(0),
                          borderColor: 'rgb(156, 163, 175)',
                          borderDash: [5, 5],
                          borderWidth: 1,
                          pointRadius: 0,
                          fill: false,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: true,
                          position: 'top' as const,
                        },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              if (context.datasetIndex === 0) {
                                return `Balance: ${format(context.parsed.y)}`
                              }
                              return ''
                            },
                          },
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: false,
                          ticks: {
                            callback: (value) => format(Number(value)),
                          },
                          grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                          },
                        },
                        x: {
                          grid: {
                            display: false,
                          },
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <p>No forecast data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
