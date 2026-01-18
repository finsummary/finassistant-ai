'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

type Summary = {
  generated_at: string
  organization: {
    business_name: string
    country: string | null
  }
  state: any
  delta: any
  trajectory: any
  exposure: any
  choice: any
}

export default function ExecutiveSummaryPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSummary = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/executive-summary')
        const json = await res.json()
        if (!json?.ok) {
          throw new Error(json?.error || 'Failed to load summary')
        }
        setSummary(json.summary)
      } catch (e: any) {
        setError(e.message || 'Failed to load executive summary')
      } finally {
        setIsLoading(false)
      }
    }

    loadSummary()
  }, [])

  const exportToPDF = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Generating executive summary...</p>
        </div>
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="p-4 md:p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error || 'Failed to load summary'}</p>
            <Button onClick={() => router.push('/framework')} className="mt-4">
              Back to Framework
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Executive Summary</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/framework')}>
            Back to Framework
          </Button>
          <Button onClick={exportToPDF}>Export PDF</Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">
        {/* Header */}
        <div className="text-center mb-8 print:mb-4">
          <h1 className="text-3xl font-bold mb-2">{summary.organization.business_name}</h1>
          <p className="text-muted-foreground">Executive Financial Summary</p>
          <p className="text-sm text-muted-foreground mt-2">
            Generated: {new Date(summary.generated_at).toLocaleDateString()}
            {summary.organization.country && ` • ${summary.organization.country}`}
          </p>
        </div>

        {/* STATE */}
        <Card className="print:border-0 print:shadow-none">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-xl">{summary.state.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-2xl font-bold">{summary.state.current_balance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Month Net</p>
                <p className={`text-xl font-semibold ${summary.state.last_month_net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.state.last_month_net >= 0 ? '+' : ''}{summary.state.last_month_net.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month Net</p>
                <p className={`text-xl font-semibold ${summary.state.this_month_net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.state.this_month_net >= 0 ? '+' : ''}{summary.state.this_month_net.toFixed(2)}
                </p>
              </div>
            </div>
            {summary.state.top_categories.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Top Categories</p>
                <div className="space-y-1">
                  {summary.state.top_categories.map((cat: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{cat.name}</span>
                      <span className={cat.net >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {cat.net >= 0 ? '+' : ''}{cat.net.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DELTA */}
        <Card className="print:border-0 print:shadow-none">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-xl">{summary.delta.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Month-over-Month Change</p>
              <p className={`text-2xl font-bold ${summary.delta.total_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.delta.total_change >= 0 ? '+' : ''}{summary.delta.total_change.toFixed(2)}
                {summary.delta.percent_change !== 0 && ` (${summary.delta.percent_change.toFixed(1)}%)`}
              </p>
            </div>
            {summary.delta.top_increases.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Top Increases</p>
                <div className="space-y-1">
                  {summary.delta.top_increases.map((inc: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{inc.category}</span>
                      <span className="text-green-600">+{inc.delta.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.delta.top_decreases.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Top Decreases</p>
                <div className="space-y-1">
                  {summary.delta.top_decreases.map((dec: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{dec.category}</span>
                      <span className="text-red-600">-{dec.change.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TRAJECTORY */}
        <Card className="print:border-0 print:shadow-none">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-xl">{summary.trajectory.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-xl font-bold">{summary.trajectory.current_balance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Monthly Change</p>
                <p className={`text-xl font-bold ${summary.trajectory.avg_monthly_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.trajectory.avg_monthly_change >= 0 ? '+' : ''}{summary.trajectory.avg_monthly_change.toFixed(2)}
                </p>
              </div>
            </div>
            {summary.trajectory.forecast_months.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">6-Month Forecast</p>
                <div className="space-y-1">
                  {summary.trajectory.forecast_months.map((f: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{f.month}</span>
                      <span className={f.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {f.balance.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.trajectory.low_points.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Projected Low Points</p>
                <div className="space-y-1">
                  {summary.trajectory.low_points.map((lp: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm text-yellow-600">
                      <span>{lp.month}</span>
                      <span>{lp.balance.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* EXPOSURE */}
        <Card className="print:border-0 print:shadow-none">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-xl">{summary.exposure.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Cash Runway</p>
              <p className={`text-2xl font-bold ${
                summary.exposure.runway !== null && summary.exposure.runway <= 3 ? 'text-red-600' :
                summary.exposure.runway !== null && summary.exposure.runway <= 6 ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {summary.exposure.runway !== null ? `${summary.exposure.runway} months` : 'Unlimited'}
              </p>
            </div>
            {summary.exposure.risk_flags.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Risk Flags</p>
                <div className="space-y-2">
                  {summary.exposure.risk_flags.map((flag: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-sm ${
                        flag.severity === 'high' ? 'bg-red-50 text-red-800' :
                        flag.severity === 'medium' ? 'bg-yellow-50 text-yellow-800' :
                        'bg-blue-50 text-blue-800'
                      }`}
                    >
                      <span className="font-medium">{flag.severity.toUpperCase()}:</span> {flag.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.exposure.upcoming_expenses.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Upcoming Large Expenses</p>
                <div className="space-y-1">
                  {summary.exposure.upcoming_expenses.map((exp: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{exp.description}</span>
                      <span className="text-red-600">-{exp.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CHOICE */}
        <Card className="print:border-0 print:shadow-none">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-xl">{summary.choice.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.choice.decisions.length > 0 ? (
              <div className="space-y-3">
                {summary.choice.decisions.map((decision: any, idx: number) => (
                  <div key={idx} className="border rounded p-3 print:border-gray-300">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">{decision.description}</h4>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          decision.risk === 'high' ? 'bg-red-100 text-red-800' :
                          decision.risk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {decision.risk} risk
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Cash Impact</p>
                        <p className={`font-semibold ${decision.cashImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {decision.cashImpact >= 0 ? '+' : ''}{decision.cashImpact.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reversibility</p>
                        <p className="font-semibold">{decision.reversibility.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No specific decisions available at this time.</p>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground mt-8 print:mt-4">
          <p>Generated by FinAssistant.ai • {new Date(summary.generated_at).toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
