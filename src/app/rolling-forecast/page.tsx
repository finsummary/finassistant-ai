'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

type RollingForecastData = {
  currentBalance: number
  currentMonth: string
  horizon: '6months' | 'yearend'
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
  const [horizon, setHorizon] = useState<'6months' | 'yearend'>('6months')
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
        const res = await fetch(`/api/rolling-forecast?horizon=${horizon}`, { cache: 'no-store' })
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
    if (!data || data.currentBalance === 0) return null

    const { currentBalance, rollingForecast } = data

    let runway: number | null = null
    let runwayMessage: string = ''
    let runwayColor: string = 'text-gray-500'
    let negativeMonth: string | null = null

    // Find first month where balance goes negative
    const firstNegativeIndex = rollingForecast.findIndex(f => f.balance <= 0)
    if (firstNegativeIndex >= 0) {
      runway = firstNegativeIndex + 1
      negativeMonth = rollingForecast[firstNegativeIndex].month
    }

    // If no negative month found, calculate based on average monthly change
    if (runway === null) {
      const forecastMonths = rollingForecast.filter(f => f.type === 'forecast')
      if (forecastMonths.length > 0) {
        const avgMonthlyChange = forecastMonths.reduce((sum, m) => sum + m.net, 0) / forecastMonths.length
        if (avgMonthlyChange < 0) {
          runway = Math.floor(currentBalance / Math.abs(avgMonthlyChange))
        }
      }
    }

    if (runway === null) {
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

  // Chart data
  const chartData = useMemo(() => {
    if (!data) return { labels: [], datasets: [] }

    const labels = data.rollingForecast.map(f => formatMonth(f.month))
    
    // Find where forecast starts
    const forecastStartIndex = data.rollingForecast.findIndex(f => f.type === 'forecast')
    
    // Find where balance goes negative (first negative value)
    let negativeIndex = -1
    for (let i = 0; i < data.rollingForecast.length; i++) {
      if (data.rollingForecast[i].balance < 0 && negativeIndex === -1) {
        negativeIndex = i
        break
      }
    }

    // Create actual data - continuous line, split at negative transition for color
    const actualData = data.rollingForecast.map(f => f.type === 'actual' ? f.balance : null)
    const actualPositive = actualData.map((val, idx) => {
      if (val === null) return null
      // Show positive values up to (but not including) transition point
      if (negativeIndex >= 0 && idx >= negativeIndex) return null
      return val > 0 ? val : null
    })
    const actualNegative = actualData.map((val, idx) => {
      if (val === null) return null
      // Show negative values from transition point onwards
      if (negativeIndex >= 0 && idx < negativeIndex) return null
      return val < 0 ? val : (idx === negativeIndex && val === 0 ? 0 : null)
    })
    
    // Add 0 point before first negative for smooth connection
    if (negativeIndex >= 0 && negativeIndex > 0 && actualData[negativeIndex - 1] !== null) {
      actualNegative[negativeIndex - 1] = 0
    }

    // Create forecast data - continuous line, split at negative transition for color
    const forecastData = data.rollingForecast.map(f => f.type === 'forecast' ? f.balance : null)
    const forecastPositive = forecastData.map((val, idx) => {
      if (val === null) return null
      // Show positive values up to (but not including) transition point
      if (negativeIndex >= 0 && idx >= negativeIndex) return null
      return val > 0 ? val : null
    })
    const forecastNegative = forecastData.map((val, idx) => {
      if (val === null) return null
      // Show negative values from transition point onwards
      if (negativeIndex >= 0 && idx < negativeIndex) return null
      return val < 0 ? val : (idx === negativeIndex && val === 0 ? 0 : null)
    })
    
    // Add 0 point before first negative for smooth connection
    if (negativeIndex >= 0 && negativeIndex > 0 && forecastData[negativeIndex - 1] !== null) {
      forecastNegative[negativeIndex - 1] = 0
    }

    return {
      labels,
      datasets: [
        {
          label: 'Actual Balance (Positive)',
          data: actualPositive,
          borderColor: '#16a34a',
          backgroundColor: (context: any) => {
            const ctx = context.chart.ctx
            const gradient = ctx.createLinearGradient(0, 0, 0, 400)
            gradient.addColorStop(0, '#16a34a80')
            gradient.addColorStop(1, '#16a34a00')
            return gradient
          },
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#16a34a',
          spanGaps: true, // Span gaps to connect actual and forecast segments
        },
        {
          label: 'Actual Balance (Negative)',
          data: actualNegative,
          borderColor: '#dc2626',
          backgroundColor: (context: any) => {
            const ctx = context.chart.ctx
            const gradient = ctx.createLinearGradient(0, 0, 0, 400)
            gradient.addColorStop(0, '#dc262680')
            gradient.addColorStop(1, '#dc262600')
            return gradient
          },
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#dc2626',
          spanGaps: false, // Don't span gaps
        },
        {
          label: 'Forecast Balance (Positive)',
          data: forecastPositive,
          borderColor: '#3b82f6',
          borderDash: [5, 5],
          backgroundColor: (context: any) => {
            const ctx = context.chart.ctx
            const gradient = ctx.createLinearGradient(0, 0, 0, 400)
            gradient.addColorStop(0, '#3b82f680')
            gradient.addColorStop(1, '#3b82f600')
            return gradient
          },
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#3b82f6',
          spanGaps: false, // Don't span gaps
        },
        {
          label: 'Forecast Balance (Negative)',
          data: forecastNegative,
          borderColor: '#dc2626',
          borderDash: [5, 5],
          backgroundColor: (context: any) => {
            const ctx = context.chart.ctx
            const gradient = ctx.createLinearGradient(0, 0, 0, 400)
            gradient.addColorStop(0, '#dc262680')
            gradient.addColorStop(1, '#dc262600')
            return gradient
          },
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#dc2626',
          spanGaps: false, // Don't span gaps
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
    }
  }, [data])

  const chartOptions = {
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
      }
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
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading rolling forecast...</p>
        </div>
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
          <Button 
            variant={horizon === '6months' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setHorizon('6months')}
          >
            6 Months
          </Button>
          <Button 
            variant={horizon === 'yearend' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setHorizon('yearend')}
          >
            Until Year End
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setNoCents(!noCents)}
          >
            {noCents ? 'Show Cents' : 'Hide Cents'}
          </Button>
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
              <Line data={chartData} options={chartOptions} />
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
