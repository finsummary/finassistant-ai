'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AIAssistant } from './ai-assistant'

type FrameworkData = {
  state: any
  delta: any
  trajectory: any
  exposure: any
  choice: any
}

export default function FrameworkPage() {
  const supabase = createClient()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<FrameworkData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<'state' | 'delta' | 'trajectory' | 'exposure' | 'choice'>('state')

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [stateRes, deltaRes, trajectoryRes, exposureRes, choiceRes] = await Promise.all([
          fetch('/api/framework/state'),
          fetch('/api/framework/delta'),
          fetch('/api/framework/trajectory'),
          fetch('/api/framework/exposure'),
          fetch('/api/framework/choice'),
        ])

        const [stateData, deltaData, trajectoryData, exposureData, choiceData] = await Promise.all([
          stateRes.json(),
          deltaRes.json(),
          trajectoryRes.json(),
          exposureRes.json(),
          choiceRes.json(),
        ])

        if (!stateData.ok || !deltaData.ok || !trajectoryData.ok || !exposureData.ok || !choiceData.ok) {
          throw new Error('Failed to load framework data')
        }

        setData({
          state: stateData.data,
          delta: deltaData.data,
          trajectory: trajectoryData.data,
          exposure: exposureData.data,
          choice: choiceData.data,
        })
      } catch (e: any) {
        setError(e.message || 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const steps = [
    { id: 'state', label: 'STATE', description: 'Where am I now?' },
    { id: 'delta', label: 'DELTA', description: 'What changed?' },
    { id: 'trajectory', label: 'TRAJECTORY', description: 'Where am I heading?' },
    { id: 'exposure', label: 'EXPOSURE', description: 'What could break?' },
    { id: 'choice', label: 'CHOICE', description: 'What should I do next?' },
  ] as const

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading framework data...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4 md:p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error || 'Failed to load data'}</p>
            <Button onClick={() => router.push('/dashboard')} className="mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Financial Framework</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/executive-summary')}>
            Executive Summary
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="mb-8 flex flex-wrap gap-2">
        {steps.map((step) => (
          <Button
            key={step.id}
            variant={activeStep === step.id ? 'default' : 'outline'}
            onClick={() => setActiveStep(step.id)}
            className="flex flex-col items-start h-auto py-3 px-4"
          >
            <span className="font-semibold">{step.label}</span>
            <span className="text-xs text-muted-foreground">{step.description}</span>
          </Button>
        ))}
      </div>

      {/* Step Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeStep === 'state' && <StateStep data={data.state} />}
          {activeStep === 'delta' && <DeltaStep data={data.delta} />}
          {activeStep === 'trajectory' && <TrajectoryStep data={data.trajectory} />}
          {activeStep === 'exposure' && <ExposureStep data={data.exposure} />}
          {activeStep === 'choice' && <ChoiceStep data={data.choice} />}
        </div>
        <div className="lg:col-span-1">
          <AIAssistant currentStep={activeStep} />
        </div>
      </div>
    </div>
  )
}

function StateStep({ data }: { data: StateData }) {
  const hasNoData = !data || (data.currentBalance === 0 && (!data.lastMonth?.inflow && !data.lastMonth?.outflow) && (!data.thisMonth?.inflow && !data.thisMonth?.outflow))
  
  if (hasNoData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>STATE — Where am I now?</CardTitle>
          <CardDescription>Current cash position and recent activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">No transaction data available yet.</p>
            <p className="text-sm text-muted-foreground">Upload a CSV file with your bank transactions to see your cash position.</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/dashboard'}>
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>STATE — Where am I now?</CardTitle>
        <CardDescription>Current cash position and recent activity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Cash Balance</p>
            <p className="text-2xl font-bold">{data.currentBalance?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Last Month Net</p>
            <p className={`text-2xl font-bold ${(data.lastMonth?.net || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(data.lastMonth?.net || 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">This Month Net</p>
            <p className={`text-2xl font-bold ${(data.thisMonth?.net || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(data.thisMonth?.net || 0).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium mb-2">Last Month</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Inflow:</span>
                <span className="text-green-600">{(data.lastMonth?.inflow || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Outflow:</span>
                <span className="text-red-600">{(data.lastMonth?.outflow || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">This Month</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Inflow:</span>
                <span className="text-green-600">{(data.thisMonth?.inflow || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Outflow:</span>
                <span className="text-red-600">{(data.thisMonth?.outflow || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {data.categoryBreakdown && data.categoryBreakdown.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Top Categories</p>
            <div className="space-y-2">
              {data.categoryBreakdown.slice(0, 5).map((cat: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-muted rounded">
                  <span className="text-sm">{cat.name}</span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600">+{cat.income.toFixed(2)}</span>
                    <span className="text-red-600">-{cat.expense.toFixed(2)}</span>
                    <span className={cat.net >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {cat.net >= 0 ? '+' : ''}{cat.net.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DeltaStep({ data }: { data: DeltaData }) {
  const hasNoData = !data || ((data.previousMonthTotal === 0 || !data.previousMonthTotal) && (data.currentMonthTotal === 0 || !data.currentMonthTotal))
  
  if (hasNoData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>DELTA — What changed?</CardTitle>
          <CardDescription>Current month vs previous month comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">Not enough data for comparison yet.</p>
            <p className="text-sm text-muted-foreground">You need at least 2 months of transaction data to see changes.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>DELTA — What changed?</CardTitle>
        <CardDescription>Current month vs previous month comparison</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Previous Month Total</p>
            <p className="text-xl font-bold">{data.previousMonthTotal?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Month Total</p>
            <p className="text-xl font-bold">{data.currentMonthTotal?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Change</p>
            <p className={`text-xl font-bold ${(data.totalDelta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(data.totalDelta || 0) >= 0 ? '+' : ''}{data.totalDelta?.toFixed(2) || '0.00'}
              {data.percentChange !== undefined && ` (${data.percentChange.toFixed(1)}%)`}
            </p>
          </div>
        </div>

        {(!data.topIncreases || data.topIncreases.length === 0) && (!data.topDecreases || data.topDecreases.length === 0) && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No significant category changes detected.</p>
          </div>
        )}

        {data.topIncreases && data.topIncreases.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Top Increases</p>
            <div className="space-y-2">
              {data.topIncreases.map((inc: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-sm">{inc.category}</span>
                  <span className="text-sm font-semibold text-green-600">
                    +{inc.change.toFixed(2)} ({inc.percentChange.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.topDecreases && data.topDecreases.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Top Decreases</p>
            <div className="space-y-2">
              {data.topDecreases.map((dec: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-red-50 rounded">
                  <span className="text-sm">{dec.category}</span>
                  <span className="text-sm font-semibold text-red-600">
                    -{dec.change.toFixed(2)} ({dec.percentChange.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TrajectoryStep({ data }: { data: TrajectoryData }) {
  const hasNoData = !data || (!data.forecast || data.forecast.length === 0)
  
  if (hasNoData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>TRAJECTORY — Where am I heading?</CardTitle>
          <CardDescription>6-month cash forecast</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">Not enough data for forecasting yet.</p>
            <p className="text-sm text-muted-foreground">Add transactions and planned items to generate a cash flow forecast.</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                Add Transactions
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/settings/planned-items'}>
                Add Planned Items
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>TRAJECTORY — Where am I heading?</CardTitle>
        <CardDescription>{data.horizon || 6}-month cash forecast</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-2xl font-bold">{data.currentBalance?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Monthly Change</p>
            <p className={`text-2xl font-bold ${(data.avgMonthlyChange || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(data.avgMonthlyChange || 0) >= 0 ? '+' : ''}{data.avgMonthlyChange?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>

        {data.forecast && data.forecast.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Forecast</p>
            <div className="space-y-2">
              {data.forecast.map((f: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <p className="font-medium">{f.month}</p>
                    <p className="text-xs text-muted-foreground">
                      Income: {f.income.toFixed(2)} | Expenses: {f.expenses.toFixed(2)}
                    </p>
                  </div>
                  <p className={`text-lg font-bold ${f.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {f.balance.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.lowPoints && data.lowPoints.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Projected Low Points</p>
            <div className="space-y-2">
              {data.lowPoints.map((lp: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                  <span className="text-sm">{lp.month}</span>
                  <span className="text-sm font-semibold text-yellow-600">{lp.balance.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!data.lowPoints || data.lowPoints.length === 0) && (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">No low points projected in the forecast period.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ExposureStep({ data }: { data: ExposureData }) {
  const hasNoData = !data || (data.runway === null && (!data.riskFlags || data.riskFlags.length === 0) && (!data.upcomingExpenses || data.upcomingExpenses.length === 0))
  
  if (hasNoData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>EXPOSURE — What could break?</CardTitle>
          <CardDescription>Risk assessment and cash runway</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">Not enough data for risk assessment yet.</p>
            <p className="text-sm text-muted-foreground">Add transactions and planned expenses to calculate cash runway and identify risks.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>EXPOSURE — What could break?</CardTitle>
        <CardDescription>Risk assessment and cash runway</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Cash Runway</p>
            <p className={`text-2xl font-bold ${data.runway !== null && data.runway <= 3 ? 'text-red-600' : data.runway !== null && data.runway <= 6 ? 'text-yellow-600' : 'text-green-600'}`}>
              {data.runway !== null ? `${data.runway} months` : 'Unlimited'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-2xl font-bold">{data.currentBalance?.toFixed(2) || '0.00'}</p>
          </div>
        </div>

        {(!data.riskFlags || data.riskFlags.length === 0) && (!data.upcomingExpenses || data.upcomingExpenses.length === 0) && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No significant risks identified at this time.</p>
          </div>
        )}

        {data.riskFlags && data.riskFlags.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Risk Flags</p>
            <div className="space-y-2">
              {data.riskFlags.map((flag: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 rounded ${
                    flag.severity === 'high' ? 'bg-red-50 border border-red-200' :
                    flag.severity === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <p className={`text-sm font-medium ${
                    flag.severity === 'high' ? 'text-red-800' :
                    flag.severity === 'medium' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {flag.severity.toUpperCase()}: {flag.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.upcomingExpenses && data.upcomingExpenses.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Upcoming Large Expenses</p>
            <div className="space-y-2">
              {data.upcomingExpenses.map((exp: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-muted rounded">
                  <div>
                    <p className="text-sm font-medium">{exp.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(exp.expectedDate).toLocaleDateString()} • {exp.recurrence}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-red-600">-{exp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ChoiceStep({ data }: { data: ChoiceData }) {
  const hasNoData = !data || !data.decisions || data.decisions.length === 0
  
  if (hasNoData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CHOICE — What should I do next?</CardTitle>
          <CardDescription>Decision options based on current state</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">No decision recommendations available yet.</p>
            <p className="text-sm text-muted-foreground">Add more financial data to get personalized decision suggestions.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CHOICE — What should I do next?</CardTitle>
        <CardDescription>Decision options based on current state</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.decisions && data.decisions.length > 0 ? (
          <div className="space-y-4">
            {data.decisions.map((decision: any, idx: number) => (
              <Card key={idx}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold">{decision.description}</h3>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        decision.risk === 'high' ? 'bg-red-100 text-red-800' :
                        decision.risk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {decision.risk} risk
                      </span>
                      <span className="px-2 py-1 rounded text-xs bg-muted">
                        {decision.timeframe.replace('_', ' ')}
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
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No specific decisions available at this time.</p>
        )}
      </CardContent>
    </Card>
  )
}
