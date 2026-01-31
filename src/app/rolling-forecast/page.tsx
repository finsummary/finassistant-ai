'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading'
import { Skeleton } from '@/components/ui/skeleton'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)


type RollingForecastData = {
  currentBalance: number
  currentMonth: string
  horizon: 'yearend'
  rollingForecast: Array<{
    month: string
    type: 'actual' | 'forecast'
    income: number
    expenses: number
    net: number
    balance: number
    byCategory: Record<string, { income: number; expenses: number }>
  }>
  summary: {
    actual: { months: number; income: number; expenses: number; net: number }
    forecast: { months: number; income: number; expenses: number; net: number }
    total: { months: number; income: number; expenses: number; net: number }
  }
  generatedAt: string
}

export default function RollingForecastPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<RollingForecastData | null>(null)
  const [horizon] = useState<'yearend'>('yearend')
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
        const res = await fetch(`/api/rolling-forecast?horizon=${horizon}`)
        const json = await res.json()
        if (!json?.ok) {
          console.error('Failed to load rolling forecast:', json?.error)
          return
        }
        setData(json.data)
      } catch (e: any) {
        console.error('Error loading rolling forecast:', e.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [horizon])

  // Calculate Cash Runway
  const cashRunway = useMemo(() => {
    if (!data || !data.rollingForecast || data.rollingForecast.length === 0) return null

    const { rollingForecast } = data

    // Get the last actual balance (starting point for forecast)
    const actualMonths = rollingForecast.filter(f => f.type === 'actual')
    const forecastMonths = rollingForecast.filter(f => f.type === 'forecast')
    
    if (forecastMonths.length === 0) return null

    // Starting balance is the last actual balance, or first forecast balance if no actuals
    const startingBalance = actualMonths.length > 0 
      ? actualMonths[actualMonths.length - 1].balance 
      : forecastMonths[0]?.balance || 0

    // Don't count current negative month - look at future forecast months only
    // If starting balance is negative, we still want to see when it will recover or get worse
    let runway: number | null = null
    let runwayMessage: string = ''
    let runwayColor: string = 'text-gray-500'
    let negativeMonth: string | null = null

    // Find first forecast month where balance goes negative (if starting positive)
    // Or find first forecast month where balance goes positive (if starting negative)
    if (startingBalance > 0) {
      // Starting positive - find when it goes negative
      for (let i = 0; i < forecastMonths.length; i++) {
        const month = forecastMonths[i]
        
        if (month.balance <= 0) {
          runway = i + 1 // Months until zero (1-based, from start of forecast)
          negativeMonth = month.month
          break
        }
      }
    } else {
      // Starting negative - find when it recovers to positive, or stays negative
      // For negative starting balance, runway is 0 (already negative)
      runway = 0
      // Find the first forecast month to show when it might recover
      for (let i = 0; i < forecastMonths.length; i++) {
        const month = forecastMonths[i]
        if (month.balance > 0) {
          // Found recovery month
          break
        }
        negativeMonth = month.month
      }
    }

    // If no negative month found, calculate based on average monthly burn
    if (runway === null) {
      const avgMonthlyBurn = forecastMonths.reduce((sum, m) => {
        // Only count months with negative net (burn)
        return sum + Math.max(0, -m.net)
      }, 0) / forecastMonths.length
      
      if (avgMonthlyBurn > 0) {
        runway = Math.floor(startingBalance / avgMonthlyBurn)
      } else {
        // Positive cash flow - runway is infinite
        runway = null
      }
    }

    if (startingBalance <= 0) {
      // Already negative - show recovery or worsening
      if (runway === 0) {
        // Check if forecast shows recovery
        const firstPositiveMonth = forecastMonths.find(m => m.balance > 0)
        if (firstPositiveMonth) {
          const recoveryIndex = forecastMonths.indexOf(firstPositiveMonth)
          runwayMessage = `Recovers in ${recoveryIndex + 1} months`
          runwayColor = 'text-green-600'
        } else {
          runwayMessage = 'Stays negative'
          runwayColor = 'text-red-600'
        }
      } else {
        runwayMessage = 'Stays negative'
        runwayColor = 'text-red-600'
      }
    } else if (runway === null) {
      runwayMessage = 'Positive cash flow trajectory (∞)'
      runwayColor = 'text-green-600'
    } else if (runway <= 1) {
      runwayMessage = `${runway} month (Critical)`
      runwayColor = 'text-red-600'
    } else if (runway <= 3) {
      runwayMessage = `${runway} months (Medium Risk)`
      runwayColor = 'text-orange-500'
    } else if (runway <= 6) {
      runwayMessage = `${runway} months (Low Risk)`
      runwayColor = 'text-yellow-600'
    } else {
      runwayMessage = `${runway} months`
      runwayColor = 'text-green-600'
    }

    return { 
      value: runway, 
      message: runwayMessage, 
      color: runwayColor,
      negativeMonth: negativeMonth 
    }
  }, [data])

  // Find current month index for vertical line
  const currentMonthIndex = useMemo(() => {
    if (!data) return -1
    return data.rollingForecast.findIndex(f => f.month === data.currentMonth)
  }, [data])

  // Chart data
  const chartData = useMemo(() => {
    if (!data) return { labels: [], datasets: [] }

    const labels = data.rollingForecast.map(f => formatMonth(f.month))
    const balances = data.rollingForecast.map(f => f.balance)
    const types = data.rollingForecast.map(f => f.type)
    
    // Find where forecast starts (for styling)
    const forecastStartIndex = data.rollingForecast.findIndex(f => f.type === 'forecast')
    
    // Create a single continuous line for all months
    // Use segment styling to change color based on value and type
    const datasets: any[] = []

    // Main balance line - continuous across all months
    datasets.push({
      label: 'Cash Balance',
      data: balances,
      borderColor: (context: any) => {
        if (!context.parsed || context.parsed.y === null || context.parsed.y === undefined) return '#9ca3af'
        const value = context.parsed.y
        const index = context.dataIndex
        const isForecast = index >= forecastStartIndex && forecastStartIndex >= 0
        // Green for positive, red for negative
        if (value >= 0) {
          return isForecast ? '#3b82f6' : '#16a34a' // Blue for forecast positive, green for actual positive
        } else {
          return '#dc2626' // Red for negative (both actual and forecast)
        }
      },
      backgroundColor: (context: any) => {
        if (!context.parsed || context.parsed.y === null || context.parsed.y === undefined) {
          return '#9ca3af20'
        }
        if (!context.chart || !context.chart.ctx) {
          return '#9ca3af20'
        }
        const ctx = context.chart.ctx
        const gradient = ctx.createLinearGradient(0, 0, 0, 400)
        const value = context.parsed.y
        const index = context.dataIndex
        const isForecast = index >= forecastStartIndex && forecastStartIndex >= 0
        if (value >= 0) {
          if (isForecast) {
            gradient.addColorStop(0, '#3b82f680')
            gradient.addColorStop(1, '#3b82f600')
          } else {
            gradient.addColorStop(0, '#16a34a80')
            gradient.addColorStop(1, '#16a34a00')
          }
        } else {
          gradient.addColorStop(0, '#dc262680')
          gradient.addColorStop(1, '#dc262600')
        }
        return gradient
      },
      fill: {
        target: 'origin', // Fill to the zero line
        above: '#16a34a80', // Green for positive area
        below: '#dc262680', // Red for negative area
      },
      borderDash: (context: any) => {
        if (context.dataIndex === undefined || context.dataIndex === null) {
          return []
        }
        const index = context.dataIndex
        // Dashed line for forecast months
        if (index >= forecastStartIndex && forecastStartIndex >= 0) {
          return [5, 5]
        }
        return []
      },
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: (context: any) => {
        if (!context.parsed || context.parsed.y === null || context.parsed.y === undefined) return '#9ca3af'
        const value = context.parsed.y
        const index = context.dataIndex
        const isForecast = index >= forecastStartIndex && forecastStartIndex >= 0
        if (value >= 0) {
          return isForecast ? '#3b82f6' : '#16a34a'
        } else {
          return '#dc2626'
        }
      },
      spanGaps: true, // Allow spanning gaps to connect lines smoothly
    })

    // Zero line
    datasets.push({
      label: 'Zero Line',
      data: labels.map(() => 0),
      borderColor: '#9ca3af',
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
      tension: 0,
    })

    return {
      labels,
      datasets,
      currentMonthIndex,
    }
  }, [data, currentMonthIndex])

  // Trends chart data - Total Income, Total Expenses, Cash at End
  const trendsChartData = useMemo(() => {
    if (!data) return { labels: [], datasets: [] }

    const labels = data.rollingForecast.map(f => formatMonth(f.month))
    
    // Calculate cumulative totals
    let cumulativeIncome = 0
    let cumulativeExpenses = 0
    
    const incomeData = data.rollingForecast.map(f => {
      cumulativeIncome += f.income
      return cumulativeIncome
    })
    
    const expensesData = data.rollingForecast.map(f => {
      cumulativeExpenses += f.expenses
      return cumulativeExpenses
    })
    
    const balanceData = data.rollingForecast.map(f => f.balance)

    // Find current month index
    const currentMonthIdx = data.rollingForecast.findIndex(f => f.month === data.currentMonth)

    return {
      labels,
      datasets: [
        {
          label: 'Total Income',
          data: incomeData,
          borderColor: '#16a34a',
          backgroundColor: '#16a34a20',
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#16a34a',
        },
        {
          label: 'Total Expenses',
          data: expensesData,
          borderColor: '#dc2626',
          backgroundColor: '#dc262620',
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#dc2626',
        },
        {
          label: 'Cash at End',
          data: balanceData,
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f620',
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#3b82f6',
        },
        {
          label: 'Zero Line',
          data: labels.map(() => 0),
          borderColor: '#9ca3af',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
      currentMonthIndex: currentMonthIdx,
    }
  }, [data, currentMonthIndex])

  const chartOptions = useMemo(() => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Rolling Forecast: Actual vs Budget',
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              let label = context.dataset.label || ''
              if (label) {
                label += ': '
              }
              if (context.parsed.y !== null) {
                label += format(context.parsed.y)
              }
              return label
            }
          }
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Month',
          },
        },
        y: {
          title: {
            display: true,
            text: 'Balance',
          },
          beginAtZero: false,
          ticks: {
            callback: function(value: any) {
              return format(value)
            }
          }
        },
      },
    }), [format])

  const trendsChartOptions = useMemo(() => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Trends: Total Income, Total Expenses, and Cash at End',
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              let label = context.dataset.label || ''
              if (label) {
                label += ': '
              }
              if (context.parsed.y !== null) {
                label += format(context.parsed.y)
              }
              return label
            }
          }
        },
      },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Month',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Amount',
        },
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return format(value)
          }
        }
      },
    },
    }), [format])

  if (loading && !data) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Rolling Forecast</CardTitle>
            <CardDescription>Combined view of actual transactions and budget forecast</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No data available yet.</p>
              <p className="text-sm text-muted-foreground">Generate a budget first to see the rolling forecast.</p>
              <Button variant="outline" className="mt-4" onClick={() => router.push('/budget')}>
                Go to Budget
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
          <h1 className="text-2xl font-bold">Rolling Forecast</h1>
          <p className="text-sm text-muted-foreground">Combined view of actual transactions and budget forecast</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>
        </div>
      </div>

      {/* Cash Runway Metric */}
      {cashRunway && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cash Runway</CardTitle>
            <CardDescription>Months until cash balance reaches zero based on current trends and budget.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className={`text-4xl font-bold ${cashRunway.color}`}>
                {cashRunway.value !== null ? `${cashRunway.value} months` : '∞'}
              </p>
              <p className={`text-lg ${cashRunway.color}`}>
                ({cashRunway.message})
              </p>
            </div>
            {data && (
              <p className="text-sm text-muted-foreground mt-2">
                Current Balance: {format(data.currentBalance)}
                {cashRunway.negativeMonth && (
                  <> • First negative month: {formatMonth(cashRunway.negativeMonth)}</>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Actual</CardTitle>
            <CardDescription>{data.summary.actual.months} months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Income:</span>
                <span className="text-green-600 font-semibold">{format(data.summary.actual.income)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expenses:</span>
                <span className="text-red-600 font-semibold">{format(data.summary.actual.expenses)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-medium">Net:</span>
                <span className={`font-semibold ${data.summary.actual.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {format(data.summary.actual.net)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Forecast</CardTitle>
            <CardDescription>{data.summary.forecast.months} months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Income:</span>
                <span className="text-green-600 font-semibold">{format(data.summary.forecast.income)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expenses:</span>
                <span className="text-red-600 font-semibold">{format(data.summary.forecast.expenses)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-medium">Net:</span>
                <span className={`font-semibold ${data.summary.forecast.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {format(data.summary.forecast.net)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <CardDescription>{data.summary.total.months} months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Income:</span>
                <span className="text-green-600 font-semibold">{format(data.summary.total.income)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expenses:</span>
                <span className="text-red-600 font-semibold">{format(data.summary.total.expenses)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-medium">Net:</span>
                <span className={`font-semibold ${data.summary.total.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {format(data.summary.total.net)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.labels.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cash Balance Forecast</CardTitle>
            <CardDescription>Actual balance (green) and forecast balance (blue dashed)</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: '400px' }}>
              <Line 
                data={chartData} 
                options={chartOptions}
                plugins={[{
                  id: 'verticalLine',
                  afterDraw: (chart: any) => {
                    if (currentMonthIndex < 0) return
                    const ctx = chart.ctx
                    const chartArea = chart.chartArea
                    const meta = chart.getDatasetMeta(0)
                    if (meta && meta.data[currentMonthIndex]) {
                      const x = meta.data[currentMonthIndex].x
                      ctx.save()
                      ctx.strokeStyle = '#f59e0b'
                      ctx.lineWidth = 2
                      ctx.setLineDash([5, 5])
                      ctx.beginPath()
                      ctx.moveTo(x, chartArea.top)
                      ctx.lineTo(x, chartArea.bottom)
                      ctx.stroke()
                      ctx.restore()
                    }
                  }
                }]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trends Chart */}
      {trendsChartData.labels.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Financial Trends</CardTitle>
            <CardDescription>Total Income, Total Expenses, and Cash at End over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: '400px' }}>
              <Line 
                data={trendsChartData} 
                options={trendsChartOptions}
                plugins={[{
                  id: 'trendsVerticalLine',
                  afterDraw: (chart: any) => {
                    if (currentMonthIndex < 0) return
                    const ctx = chart.ctx
                    const chartArea = chart.chartArea
                    const meta = chart.getDatasetMeta(0)
                    if (meta && meta.data[currentMonthIndex]) {
                      const x = meta.data[currentMonthIndex].x
                      ctx.save()
                      ctx.strokeStyle = '#f59e0b'
                      ctx.lineWidth = 2
                      ctx.setLineDash([5, 5])
                      ctx.beginPath()
                      ctx.moveTo(x, chartArea.top)
                      ctx.lineTo(x, chartArea.bottom)
                      ctx.stroke()
                      ctx.restore()
                    }
                  }
                }]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rolling Forecast Details</CardTitle>
          <CardDescription>Month-by-month breakdown of actuals and forecast</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-2 px-4">Month</th>
                  <th className="text-right py-2 px-4">Type</th>
                  <th className="text-right py-2 px-4">Income</th>
                  <th className="text-right py-2 px-4">Expenses</th>
                  <th className="text-right py-2 px-4">Net</th>
                  <th className="text-right py-2 px-4">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.rollingForecast.map((forecast, idx) => (
                  <tr key={forecast.month} className={`border-b hover:bg-muted/30 ${forecast.type === 'forecast' ? 'bg-blue-50/30' : ''}`}>
                    <td className="py-2 px-4 font-medium">{formatMonth(forecast.month)}</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        forecast.type === 'actual' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {forecast.type === 'actual' ? 'Actual' : 'Forecast'}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-green-600">{format(forecast.income)}</td>
                    <td className="py-2 px-4 text-right text-red-600">{format(forecast.expenses)}</td>
                    <td className={`py-2 px-4 text-right font-semibold ${forecast.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {format(forecast.net)}
                    </td>
                    <td className="py-2 px-4 text-right font-semibold">{format(forecast.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
