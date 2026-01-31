'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { LoadingSpinner } from '@/components/ui/loading'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AIAssistant } from './ai-assistant'
import { formatCurrency, getCurrencySymbol } from '@/lib/currency'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { TrendingUp, TrendingDown, AlertTriangle, Target, BarChart3, ArrowRight, Wallet } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

type DeltaData = {
  previousMonth?: { income: number; expenses: number; net: number }
  currentMonth?: { income: number; expenses: number; net: number }
  changes?: { income: number; expenses: number; net: number }
  percentChanges?: { income: number; expenses: number; net: number }
  topIncomeIncreases?: Array<{ category: string; change: number; percentChange: number; type: 'income' }>
  topIncomeDecreases?: Array<{ category: string; change: number; percentChange: number; type: 'income' }>
  topExpenseIncreases?: Array<{ category: string; change: number; percentChange: number; type: 'expense' }>
  topExpenseDecreases?: Array<{ category: string; change: number; percentChange: number; type: 'expense' }>
  // Legacy fields for backward compatibility
  previousMonthTotal?: number
  currentMonthTotal?: number
  totalDelta?: number
  percentChange?: number
  topIncreases?: Array<{ category: string; change: number; percentChange: number }>
  topDecreases?: Array<{ category: string; change: number; percentChange: number }>
}

type FrameworkData = {
  state: any
  delta: any
  trajectory: any
  exposure: any
  choice: any
  currency?: string
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
          currency: stateData.data?.currency || 'GBP', // Pass currency to all steps
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
    { id: 'state', label: 'STATE', description: 'Where am I now?', icon: BarChart3 },
    { id: 'delta', label: 'DELTA', description: 'What changed?', icon: TrendingUp },
    { id: 'trajectory', label: 'TRAJECTORY', description: 'Where am I heading?', icon: ArrowRight },
    { id: 'exposure', label: 'EXPOSURE', description: 'What could break?', icon: AlertTriangle },
    { id: 'choice', label: 'CHOICE', description: 'What should I do next?', icon: Target },
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Framework</h1>
          <p className="text-sm text-muted-foreground mt-1">Comprehensive financial analysis and decision support</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>
        </div>
      </div>

      {/* Step Navigation with Tabs */}
      <Tabs value={activeStep} onValueChange={(value) => setActiveStep(value as typeof activeStep)} className="mb-8">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1 bg-muted/50">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <TabsTrigger
                key={step.id}
                value={step.id}
                className="flex flex-col items-center gap-1 py-3 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Icon className="h-4 w-4" />
                <span className="font-semibold text-xs">{step.label}</span>
                <span className="text-[10px] text-muted-foreground hidden sm:block">{step.description}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* Step Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-6">
            <TabsContent value="state" className="mt-0">
              <StateStep data={data.state} />
            </TabsContent>
            <TabsContent value="delta" className="mt-0">
              <DeltaStep data={data.delta} currency={data.currency} />
            </TabsContent>
            <TabsContent value="trajectory" className="mt-0">
              <TrajectoryStep data={data.trajectory} currency={data.currency} />
            </TabsContent>
            <TabsContent value="exposure" className="mt-0">
              <ExposureStep data={data.exposure} currency={data.currency} />
            </TabsContent>
            <TabsContent value="choice" className="mt-0">
              <ChoiceStep data={data.choice} />
            </TabsContent>
          </div>
          <div className="lg:col-span-1">
            <AIAssistant currentStep={activeStep} />
          </div>
        </div>
      </Tabs>
    </div>
  )
}

function StateStep({ data }: { data: any }) {
  const currency = data?.currency || 'GBP'
  const currentDate = data?.currentDate || new Date().toISOString().split('T')[0]
  const formatValue = (value: number) => formatCurrency(value, currency, true)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  useEffect(() => {
    const loadAIAnalysis = async () => {
      setLoadingAnalysis(true)
      setAnalysisError(null)
      try {
        const res = await fetch('/api/framework/state/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: false }), // Initial load uses cache
        })
        const json = await res.json()
        if (json?.ok) {
          setAiAnalysis(json.data)
        } else {
          setAnalysisError(json?.error || 'Failed to load AI analysis')
        }
      } catch (e: any) {
        setAnalysisError(e.message || 'Failed to load AI analysis')
      } finally {
        setLoadingAnalysis(false)
      }
    }
    loadAIAnalysis()
  }, [])

  const hasNoData = !data || (data.currentBalance === 0 && (!data.kpis?.month?.income && !data.kpis?.month?.expenses))
  
  if (hasNoData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>STATE — Where am I now?</CardTitle>
          <CardDescription>Current cash position and summary</CardDescription>
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

  const kpis = data.kpis || {}
  const month = kpis.month || { income: 0, expenses: 0, net: 0 }
  const quarter = kpis.quarter || { income: 0, expenses: 0, net: 0 }
  const ytd = kpis.ytd || { income: 0, expenses: 0, net: 0 }
  
  const incomeCategories = data?.incomeCategories || []
  const expenseCategories = data?.expenseCategories || []

  return (
    <Card className="border-2 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">STATE — Where am I now?</CardTitle>
          </div>
          {currentDate && (
            <Badge variant="outline" className="text-xs">
              {new Date(currentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Badge>
          )}
        </div>
        <CardDescription className="mt-1">Current cash position and summary</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Cash Balance - Prominent Display */}
        <div className="text-center p-8 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border-2 border-primary/20 shadow-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Wallet className="h-6 w-6 text-primary" />
            <p className="text-4xl font-bold tracking-tight">{formatValue(data.currentBalance || 0)}</p>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Current Cash Balance</p>
        </div>

        {/* Summary Cards - Month, Quarter, YTD */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">This Month</p>
                <p className={`text-2xl font-bold mb-2 ${month.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {month.net >= 0 ? '+' : ''}{formatValue(month.net)}
                </p>
                <Separator className="my-2" />
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Income:</span>
                    <span className="text-green-600 font-medium">{formatValue(month.income)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expenses:</span>
                    <span className="text-red-600 font-medium">{formatValue(month.expenses)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">This Quarter</p>
                <p className={`text-2xl font-bold mb-2 ${quarter.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {quarter.net >= 0 ? '+' : ''}{formatValue(quarter.net)}
                </p>
                <Separator className="my-2" />
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Income:</span>
                    <span className="text-green-600 font-medium">{formatValue(quarter.income)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expenses:</span>
                    <span className="text-red-600 font-medium">{formatValue(quarter.expenses)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Year to Date</p>
                <p className={`text-2xl font-bold mb-2 ${ytd.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {ytd.net >= 0 ? '+' : ''}{formatValue(ytd.net)}
                </p>
                <Separator className="my-2" />
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Income:</span>
                    <span className="text-green-600 font-medium">{formatValue(ytd.income)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expenses:</span>
                    <span className="text-red-600 font-medium">{formatValue(ytd.expenses)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Income Categories */}
        {incomeCategories.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top 5 Income Categories (Year to Date)
            </h3>
            <div className="space-y-2">
              {incomeCategories.map((cat: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-green-50/50 border border-green-200 rounded-lg hover:bg-green-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                      #{idx + 1}
                    </Badge>
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <Badge variant="secondary" className="bg-green-600 text-white font-semibold">
                    {formatValue(cat.income)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expense Categories */}
        {expenseCategories.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Top 5 Expense Categories (Year to Date)
            </h3>
            <div className="space-y-2">
              {expenseCategories.map((cat: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-red-50/50 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                      #{idx + 1}
                    </Badge>
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <Badge variant="secondary" className="bg-red-600 text-white font-semibold">
                    {formatValue(cat.expense)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DeltaStep({ data, currency = 'GBP' }: { data: DeltaData; currency?: string }) {
  const formatValue = (value: number) => formatCurrency(value, currency, true)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  useEffect(() => {
    const loadAIAnalysis = async () => {
      setLoadingAnalysis(true)
      setAnalysisError(null)
      try {
        const res = await fetch('/api/framework/delta/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        const json = await res.json()
        if (json?.ok) {
          setAiAnalysis(json.data)
        } else {
          setAnalysisError(json?.error || 'Failed to load AI analysis')
        }
      } catch (e: any) {
        setAnalysisError(e.message || 'Failed to load AI analysis')
      } finally {
        setLoadingAnalysis(false)
      }
    }
    loadAIAnalysis()
  }, [])

  // Support both new and legacy data formats
  const prevMonth = data.previousMonth || {
    income: 0,
    expenses: 0,
    net: (data.previousMonthTotal || 0),
  }
  const currMonth = data.currentMonth || {
    income: 0,
    expenses: 0,
    net: (data.currentMonthTotal || 0),
  }
  const changes = data.changes || {
    income: 0,
    expenses: 0,
    net: (data.totalDelta || 0),
  }
  const percentChanges = data.percentChanges || {
    income: 0,
    expenses: 0,
    net: (data.percentChange || 0),
  }

  const hasNoData = !data || (
    (prevMonth.income === 0 && prevMonth.expenses === 0 && currMonth.income === 0 && currMonth.expenses === 0)
  )
  
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
      <CardContent className="space-y-6">
        {/* Summary Table */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Metric</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Previous Month</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Current Month</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Change</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-muted/50">
                  <td className="py-3 px-3 font-medium">Income</td>
                  <td className="py-3 px-3 text-right text-green-600">{formatValue(prevMonth.income)}</td>
                  <td className="py-3 px-3 text-right text-green-600">{formatValue(currMonth.income)}</td>
                  <td className={`py-3 px-3 text-right font-semibold ${changes.income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {changes.income >= 0 ? '+' : ''}{formatValue(changes.income)}
                    {percentChanges.income !== 0 && ` (${percentChanges.income >= 0 ? '+' : ''}${percentChanges.income.toFixed(1)}%)`}
                  </td>
                </tr>
                <tr className="border-b hover:bg-muted/50">
                  <td className="py-3 px-3 font-medium">Expenses</td>
                  <td className="py-3 px-3 text-right text-red-600">{formatValue(prevMonth.expenses)}</td>
                  <td className="py-3 px-3 text-right text-red-600">{formatValue(currMonth.expenses)}</td>
                  <td className={`py-3 px-3 text-right font-semibold ${changes.expenses <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {changes.expenses >= 0 ? '+' : ''}{formatValue(changes.expenses)}
                    {percentChanges.expenses !== 0 && ` (${percentChanges.expenses >= 0 ? '+' : ''}${percentChanges.expenses.toFixed(1)}%)`}
                  </td>
                </tr>
                <tr className="border-b-2 hover:bg-muted/50 font-semibold">
                  <td className="py-3 px-3">Net Result</td>
                  <td className={`py-3 px-3 text-right ${prevMonth.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatValue(prevMonth.net)}
                  </td>
                  <td className={`py-3 px-3 text-right ${currMonth.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatValue(currMonth.net)}
                  </td>
                  <td className={`py-3 px-3 text-right ${changes.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {changes.net >= 0 ? '+' : ''}{formatValue(changes.net)}
                    {percentChanges.net !== 0 && ` (${percentChanges.net >= 0 ? '+' : ''}${percentChanges.net.toFixed(1)}%)`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Category Changes */}
        {(data.topIncomeIncreases && data.topIncomeIncreases.length > 0) ||
         (data.topIncomeDecreases && data.topIncomeDecreases.length > 0) ||
         (data.topExpenseIncreases && data.topExpenseIncreases.length > 0) ||
         (data.topExpenseDecreases && data.topExpenseDecreases.length > 0) ? (
          <>
            {/* Income Increases (Good - Green) */}
            {data.topIncomeIncreases && data.topIncomeIncreases.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Income Increases (Good)</p>
                <div className="space-y-2">
                  {data.topIncomeIncreases.map((inc: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">{inc.category}</span>
                      <span className="text-sm font-semibold text-green-600">
                        +{formatValue(inc.change)} ({inc.percentChange.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Income Decreases (Bad - Red) */}
            {data.topIncomeDecreases && data.topIncomeDecreases.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Income Decreases (Bad)</p>
                <div className="space-y-2">
                  {data.topIncomeDecreases.map((dec: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span className="text-sm">{dec.category}</span>
                      <span className="text-sm font-semibold text-red-600">
                        -{formatValue(dec.change)} ({dec.percentChange.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expense Increases (Bad - Red) */}
            {data.topExpenseIncreases && data.topExpenseIncreases.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Expense Increases (Bad)</p>
                <div className="space-y-2">
                  {data.topExpenseIncreases.map((inc: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span className="text-sm">{inc.category}</span>
                      <span className="text-sm font-semibold text-red-600">
                        +{formatValue(inc.change)} ({inc.percentChange.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expense Decreases (Good - Green) */}
            {data.topExpenseDecreases && data.topExpenseDecreases.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Expense Decreases (Good)</p>
                <div className="space-y-2">
                  {data.topExpenseDecreases.map((dec: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">{dec.category}</span>
                      <span className="text-sm font-semibold text-green-600">
                        -{formatValue(dec.change)} ({dec.percentChange.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No significant category changes detected.</p>
          </div>
        )}

        {/* AI Analysis Section */}
        <Separator />
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              AI Analysis
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setLoadingAnalysis(true)
                setAnalysisError(null)
                try {
                  const res = await fetch('/api/framework/delta/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh: true }),
                  })
                  const json = await res.json()
                  if (json?.ok) {
                    setAiAnalysis(json.data)
                  } else {
                    setAnalysisError(json?.error || 'Failed to refresh analysis')
                  }
                } catch (e: any) {
                  setAnalysisError(e.message || 'Failed to refresh analysis')
                } finally {
                  setLoadingAnalysis(false)
                }
              }}
              disabled={loadingAnalysis}
            >
              {loadingAnalysis ? 'Analyzing...' : 'Refresh Analysis'}
            </Button>
          </div>

          {loadingAnalysis && !aiAnalysis && (
            <div className="text-center py-8">
              <LoadingSpinner size="lg" />
              <p className="text-muted-foreground mt-4">AI is analyzing month-over-month changes...</p>
            </div>
          )}

          {analysisError && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                {analysisError}
                {aiAnalysis?.insights && aiAnalysis.insights.length > 0 && ' Showing rule-based insights instead.'}
              </p>
            </div>
          )}

          {aiAnalysis && (
            <div className="space-y-4">
              {aiAnalysis.summary && (
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm font-medium mb-1">Summary</p>
                  <p className="text-sm text-muted-foreground">{aiAnalysis.summary}</p>
                </div>
              )}

              {aiAnalysis.insights && aiAnalysis.insights.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Key Insights</p>
                  <div className="space-y-2">
                    {aiAnalysis.insights.map((insight: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          insight.type === 'positive' ? 'bg-green-50 border-green-200' :
                          insight.type === 'concern' ? 'bg-red-50 border-red-200' :
                          'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <p className={`text-sm font-semibold mb-1 ${
                          insight.type === 'positive' ? 'text-green-800' :
                          insight.type === 'concern' ? 'text-red-800' :
                          'text-blue-800'
                        }`}>
                          {insight.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{insight.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}


              {aiAnalysis.message && (
                <p className="text-xs text-muted-foreground mt-2">{aiAnalysis.message}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

type TrajectoryData = {
  currentBalance?: number
  currentMonth?: string
  horizon?: '6months' | 'yearend'
  rollingForecast?: Array<{
    month: string
    type: 'actual' | 'forecast'
    income: number
    expenses: number
    net: number
    balance: number
  }>
  summary?: {
    actual: { months: number; income: number; expenses: number; net: number }
    forecast: { months: number; income: number; expenses: number; net: number }
    total: { months: number; income: number; expenses: number; net: number }
  }
  // Legacy fields
  forecast?: Array<{ month: string; income: number; expenses: number; balance: number }>
  avgMonthlyChange?: number
  lowPoints?: Array<{ month: string; balance: number }>
}

function TrajectoryStep({ data, currency = 'GBP' }: { data: TrajectoryData; currency?: string }) {
  const [rollingForecastData, setRollingForecastData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [horizon, setHorizon] = useState<'6months' | 'yearend'>('6months')
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const formatValue = useMemo(() => (value: number) => formatCurrency(value, currency, true), [currency])

  const formatMonth = useMemo(() => (month: string) => {
    const [year, monthNum] = month.split('-')
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }, [])

  useEffect(() => {
    const loadRollingForecast = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/rolling-forecast?horizon=${horizon}`)
        const json = await res.json()
        if (json?.ok) {
          setRollingForecastData(json.data)
        }
      } catch (e: any) {
        console.error('Error loading rolling forecast:', e.message)
      } finally {
        setLoading(false)
      }
    }
    loadRollingForecast()
  }, [horizon])

  useEffect(() => {
    const loadAIAnalysis = async () => {
      setLoadingAnalysis(true)
      setAnalysisError(null)
      try {
        const res = await fetch('/api/framework/trajectory/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        const json = await res.json()
        if (json?.ok) {
          setAiAnalysis(json.data)
        } else {
          setAnalysisError(json?.error || 'Failed to load AI analysis')
        }
      } catch (e: any) {
        setAnalysisError(e.message || 'Failed to load AI analysis')
      } finally {
        setLoadingAnalysis(false)
      }
    }
    loadAIAnalysis()
  }, [])

  const forecastData = rollingForecastData || data

  // All hooks must be before conditional returns (Rules of Hooks)
  // Calculate Cash Runway
  const cashRunway = useMemo(() => {
    if (!forecastData || !forecastData.rollingForecast) return null

    const { currentBalance, rollingForecast } = forecastData
    if (currentBalance === 0) return null

    let runway: number | null = null
    let runwayMessage: string = ''
    let runwayColor: string = 'text-gray-500'
    let negativeMonth: string | null = null

    const firstNegativeIndex = rollingForecast.findIndex((f: any) => f.balance <= 0)
    if (firstNegativeIndex >= 0) {
      runway = firstNegativeIndex + 1
      negativeMonth = rollingForecast[firstNegativeIndex].month
    }

    if (runway === null) {
      const forecastMonths = rollingForecast.filter((f: any) => f.type === 'forecast')
      if (forecastMonths.length > 0) {
        const avgMonthlyChange = forecastMonths.reduce((sum: number, m: any) => sum + m.net, 0) / forecastMonths.length
        if (avgMonthlyChange < 0) {
          runway = Math.floor(currentBalance / Math.abs(avgMonthlyChange))
        }
      }
    }

    if (runway !== null) {
      if (runway <= 3) {
        runwayColor = 'text-red-600'
        runwayMessage = negativeMonth ? `Critical: Cash runs out in ${runway} month${runway !== 1 ? 's' : ''} (${formatMonth(negativeMonth)})` : `Critical: ${runway} month${runway !== 1 ? 's' : ''} until cash runs out`
      } else if (runway <= 6) {
        runwayColor = 'text-yellow-600'
        runwayMessage = negativeMonth ? `Warning: Cash runs out in ${runway} month${runway !== 1 ? 's' : ''} (${formatMonth(negativeMonth)})` : `Warning: ${runway} month${runway !== 1 ? 's' : ''} until cash runs out`
      } else {
        runwayColor = 'text-green-600'
        runwayMessage = negativeMonth ? `${runway} month${runway !== 1 ? 's' : ''} until cash runs out (${formatMonth(negativeMonth)})` : `${runway} month${runway !== 1 ? 's' : ''} until cash runs out`
      }
    } else {
      runwayMessage = 'No cash runway limit detected'
      runwayColor = 'text-green-600'
    }

    return { value: runway, message: runwayMessage, color: runwayColor, negativeMonth }
  }, [forecastData, formatMonth])

  // Chart data
  const chartData = useMemo(() => {
    if (!forecastData?.rollingForecast) return { labels: [], datasets: [] }

    const labels = forecastData.rollingForecast.map((f: any) => formatMonth(f.month))
    
    const forecastStartIndex = forecastData.rollingForecast.findIndex((f: any) => f.type === 'forecast')
    
    let negativeIndex = -1
    for (let i = 0; i < forecastData.rollingForecast.length; i++) {
      if (forecastData.rollingForecast[i].balance < 0 && negativeIndex === -1) {
        negativeIndex = i
        break
      }
    }

    const actualData = forecastData.rollingForecast.map((f: any) => f.type === 'actual' ? f.balance : null)
    const actualPositive = actualData.map((val: any, idx: number) => {
      if (val === null) return null
      if (negativeIndex >= 0 && idx >= negativeIndex) return null
      return val > 0 ? val : null
    })
    const actualNegative = actualData.map((val: any, idx: number) => {
      if (val === null) return null
      if (negativeIndex >= 0 && idx < negativeIndex) return null
      return val < 0 ? val : (idx === negativeIndex && val === 0 ? 0 : null)
    })
    
    if (negativeIndex >= 0 && negativeIndex > 0 && actualData[negativeIndex - 1] !== null) {
      actualNegative[negativeIndex - 1] = 0
    }

    const forecastData_vals = forecastData.rollingForecast.map((f: any) => f.type === 'forecast' ? f.balance : null)
    const forecastPositive = forecastData_vals.map((val: any, idx: number) => {
      if (val === null) return null
      if (negativeIndex >= 0 && idx >= negativeIndex) return null
      return val > 0 ? val : null
    })
    const forecastNegative = forecastData_vals.map((val: any, idx: number) => {
      if (val === null) return null
      if (negativeIndex >= 0 && idx < negativeIndex) return null
      return val < 0 ? val : (idx === negativeIndex && val === 0 ? 0 : null)
    })
    
    if (negativeIndex >= 0 && negativeIndex > 0 && forecastData_vals[negativeIndex - 1] !== null) {
      forecastNegative[negativeIndex - 1] = 0
    }

    return {
      labels,
      datasets: [
        {
          label: 'Actual Balance (Positive)',
          data: actualPositive,
          borderColor: '#3b82f6',
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
          spanGaps: true,
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
          spanGaps: true,
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
          spanGaps: true,
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
          spanGaps: true,
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
  }, [forecastData, formatMonth])

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
        text: 'Cash Flow Trajectory: Actual vs Forecast',
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${formatValue(context.parsed.y)}`
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: function(value: any) {
            return formatValue(value)
          },
        },
      },
    },
  }), [formatValue])

  // Conditional returns AFTER all hooks
  const hasNoData = !forecastData || (!forecastData.rollingForecast || forecastData.rollingForecast.length === 0)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>TRAJECTORY — Where am I heading?</CardTitle>
          <CardDescription>Cash flow forecast with budget</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <LoadingSpinner size="lg" />
            <p className="text-muted-foreground mt-4">Loading forecast data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (hasNoData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>TRAJECTORY — Where am I heading?</CardTitle>
          <CardDescription>Cash flow forecast with budget</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">Not enough data for forecasting yet.</p>
            <p className="text-sm text-muted-foreground">Add transactions and generate a budget to see cash flow forecast.</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                Add Transactions
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/budget'}>
                Generate Budget
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
        <CardDescription>Cash flow forecast combining actual transactions with budget</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Horizon selector */}
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
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
            <p className="text-2xl font-bold">{formatValue(forecastData.currentBalance || 0)}</p>
          </div>
          {forecastData.summary && (
            <>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Forecast Income</p>
                <p className="text-2xl font-bold text-green-600">{formatValue(forecastData.summary.forecast.income)}</p>
                <p className="text-xs text-muted-foreground mt-1">{forecastData.summary.forecast.months} months</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Forecast Expenses</p>
                <p className="text-2xl font-bold text-red-600">{formatValue(forecastData.summary.forecast.expenses)}</p>
                <p className="text-xs text-muted-foreground mt-1">{forecastData.summary.forecast.months} months</p>
              </div>
            </>
          )}
        </div>

        {/* Cash Runway */}
        {cashRunway && (
          <div className={`p-4 rounded-lg border-2 ${cashRunway.color === 'text-red-600' ? 'bg-red-50 border-red-200' : cashRunway.color === 'text-yellow-600' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-sm font-medium mb-1">Cash Runway</p>
            <p className={`text-xl font-bold ${cashRunway.color}`}>
              {cashRunway.value !== null ? `${cashRunway.value} month${cashRunway.value !== 1 ? 's' : ''}` : 'Unlimited'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{cashRunway.message}</p>
          </div>
        )}

        {/* Chart */}
        <div style={{ height: '400px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>

        {/* Summary Table */}
        {forecastData.summary && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Period</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Months</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Income</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Expenses</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.summary.actual && (
                    <tr className="border-b hover:bg-muted/50">
                      <td className="py-3 px-3 font-medium">Actual</td>
                      <td className="py-3 px-3 text-right">{forecastData.summary.actual.months}</td>
                      <td className="py-3 px-3 text-right text-green-600">{formatValue(forecastData.summary.actual.income)}</td>
                      <td className="py-3 px-3 text-right text-red-600">{formatValue(forecastData.summary.actual.expenses)}</td>
                      <td className={`py-3 px-3 text-right font-semibold ${forecastData.summary.actual.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatValue(forecastData.summary.actual.net)}
                      </td>
                    </tr>
                  )}
                  {forecastData.summary.forecast && (
                    <tr className="border-b hover:bg-muted/50">
                      <td className="py-3 px-3 font-medium">Forecast</td>
                      <td className="py-3 px-3 text-right">{forecastData.summary.forecast.months}</td>
                      <td className="py-3 px-3 text-right text-green-600">{formatValue(forecastData.summary.forecast.income)}</td>
                      <td className="py-3 px-3 text-right text-red-600">{formatValue(forecastData.summary.forecast.expenses)}</td>
                      <td className={`py-3 px-3 text-right font-semibold ${forecastData.summary.forecast.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatValue(forecastData.summary.forecast.net)}
                      </td>
                    </tr>
                  )}
                  {forecastData.summary.total && (
                    <tr className="border-b-2 hover:bg-muted/50 font-semibold">
                      <td className="py-3 px-3">Total</td>
                      <td className="py-3 px-3 text-right">{forecastData.summary.total.months}</td>
                      <td className="py-3 px-3 text-right text-green-600">{formatValue(forecastData.summary.total.income)}</td>
                      <td className="py-3 px-3 text-right text-red-600">{formatValue(forecastData.summary.total.expenses)}</td>
                      <td className={`py-3 px-3 text-right ${forecastData.summary.total.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatValue(forecastData.summary.total.net)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI Analysis Section */}
        <Separator />
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              AI Analysis
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setLoadingAnalysis(true)
                setAnalysisError(null)
                try {
                  const res = await fetch('/api/framework/trajectory/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh: true }),
                  })
                  const json = await res.json()
                  if (json?.ok) {
                    setAiAnalysis(json.data)
                  } else {
                    setAnalysisError(json?.error || 'Failed to refresh analysis')
                  }
                } catch (e: any) {
                  setAnalysisError(e.message || 'Failed to refresh analysis')
                } finally {
                  setLoadingAnalysis(false)
                }
              }}
              disabled={loadingAnalysis}
            >
              {loadingAnalysis ? 'Analyzing...' : 'Refresh Analysis'}
            </Button>
          </div>

          {loadingAnalysis && !aiAnalysis && (
            <div className="text-center py-8">
              <LoadingSpinner size="lg" />
              <p className="text-muted-foreground mt-4">AI is analyzing your cash trajectory...</p>
            </div>
          )}

          {analysisError && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                {analysisError}
                {aiAnalysis?.insights && aiAnalysis.insights.length > 0 && ' Showing rule-based insights instead.'}
              </p>
            </div>
          )}

          {aiAnalysis && (
            <div className="space-y-4">
              {aiAnalysis.summary && (
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm font-medium mb-1">Summary</p>
                  <p className="text-sm text-muted-foreground">{aiAnalysis.summary}</p>
                </div>
              )}

              {aiAnalysis.insights && aiAnalysis.insights.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Key Insights</p>
                  <div className="space-y-2">
                    {aiAnalysis.insights.map((insight: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          insight.type === 'positive' ? 'bg-green-50 border-green-200' :
                          insight.type === 'concern' ? 'bg-red-50 border-red-200' :
                          'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <p className={`text-sm font-semibold mb-1 ${
                          insight.type === 'positive' ? 'text-green-800' :
                          insight.type === 'concern' ? 'text-red-800' :
                          'text-blue-800'
                        }`}>
                          {insight.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{insight.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiAnalysis.milestones && aiAnalysis.milestones.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Key Milestones</p>
                  <div className="space-y-2">
                    {aiAnalysis.milestones.map((milestone: any, idx: number) => (
                      <div key={idx} className="p-3 bg-muted/50 rounded-lg border">
                        <p className="text-sm font-semibold mb-1">{milestone.title} - {formatMonth(milestone.month)}</p>
                        <p className="text-sm text-muted-foreground">{milestone.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiAnalysis.message && (
                <p className="text-xs text-muted-foreground mt-2">{aiAnalysis.message}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ExposureStep({ data, currency = 'GBP' }: { data: ExposureData; currency?: string }) {
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true) // Start with loading true
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const formatValue = useMemo(() => (value: number) => formatCurrency(value, currency, true), [currency])

  useEffect(() => {
    const loadAIAnalysis = async () => {
      setLoadingAnalysis(true)
      setAnalysisError(null)
      try {
        const res = await fetch('/api/framework/exposure/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        const json = await res.json()
        if (json?.ok) {
          setAiAnalysis(json.data)
        } else {
          setAnalysisError(json?.error || 'Failed to load AI analysis')
        }
      } catch (e: any) {
        setAnalysisError(e.message || 'Failed to load AI analysis')
      } finally {
        setLoadingAnalysis(false)
      }
    }
    loadAIAnalysis()
  }, [])

  const hasNoData = !data || (data.runway === null && (!data.riskFlags || data.riskFlags.length === 0) && (!data.upcomingExpenses || data.upcomingExpenses.length === 0))
  
  // Show loading state while AI analysis is being fetched
  if (loadingAnalysis && !aiAnalysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>EXPOSURE — What could break?</CardTitle>
          <CardDescription>AI-powered risk assessment and cash runway</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <LoadingSpinner size="lg" />
            <p className="text-muted-foreground mt-4">AI is analyzing your financial data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Only show "no data" message if AI analysis also failed and we have no data
  if (hasNoData && !aiAnalysis && !loadingAnalysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>EXPOSURE — What could break?</CardTitle>
          <CardDescription>AI-powered risk assessment and cash runway</CardDescription>
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

  const risks = aiAnalysis?.risks || data.riskFlags || []
  const opportunities = aiAnalysis?.opportunities || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>EXPOSURE — What could break?</CardTitle>
        <CardDescription>AI-powered risk assessment and cash runway</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Cash Runway</p>
            <p className={`text-2xl font-bold ${data.runway !== null && data.runway <= 3 ? 'text-red-600' : data.runway !== null && data.runway <= 6 ? 'text-yellow-600' : 'text-green-600'}`}>
              {data.runway !== null ? `${data.runway} months` : 'Unlimited'}
            </p>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
            <p className="text-2xl font-bold">{formatValue(data.currentBalance || 0)}</p>
          </div>
        </div>

        {/* AI Analysis Summary */}
        {aiAnalysis?.analysis && (
          <div className={`p-4 rounded-lg border-2 ${
            aiAnalysis.analysis.overallRisk === 'high' ? 'bg-red-50 border-red-200' :
            aiAnalysis.analysis.overallRisk === 'medium' ? 'bg-yellow-50 border-yellow-200' :
            'bg-green-50 border-green-200'
          }`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm font-medium mb-1">Overall Risk Assessment</p>
                <p className={`text-lg font-bold ${
                  aiAnalysis.analysis.overallRisk === 'high' ? 'text-red-800' :
                  aiAnalysis.analysis.overallRisk === 'medium' ? 'text-yellow-800' :
                  'text-green-800'
                }`}>
                  {aiAnalysis.analysis.overallRisk?.toUpperCase() || 'UNKNOWN'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setLoadingAnalysis(true)
                  setAnalysisError(null)
                  try {
                    const res = await fetch('/api/framework/exposure/analyze', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ refresh: true }),
                    })
                    const json = await res.json()
                    if (json?.ok) {
                      setAiAnalysis(json.data)
                    } else {
                      setAnalysisError(json?.error || 'Failed to refresh analysis')
                    }
                  } catch (e: any) {
                    setAnalysisError(e.message || 'Failed to refresh analysis')
                  } finally {
                    setLoadingAnalysis(false)
                  }
                }}
                disabled={loadingAnalysis}
              >
                {loadingAnalysis ? 'Analyzing...' : 'Refresh Analysis'}
              </Button>
            </div>
            {aiAnalysis.analysis.summary && (
              <p className="text-sm text-muted-foreground">{aiAnalysis.analysis.summary}</p>
            )}
            {aiAnalysis.message && (
              <p className="text-xs text-muted-foreground mt-2">{aiAnalysis.message}</p>
            )}
          </div>
        )}

        {/* Loading State */}
        {loadingAnalysis && !aiAnalysis && (
          <div className="text-center py-8">
            <LoadingSpinner size="lg" />
            <p className="text-muted-foreground mt-4">AI is analyzing your financial data...</p>
          </div>
        )}

        {/* Error State */}
        {analysisError && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              {analysisError}
              {aiAnalysis?.risks && aiAnalysis.risks.length > 0 && ' Showing rule-based risks instead.'}
            </p>
          </div>
        )}

        {/* AI-Powered Risks */}
        {risks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Identified Risks</h3>
            <div className="space-y-3">
              {risks.map((risk: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-2 ${
                    risk.severity === 'high' ? 'bg-red-50 border-red-200' :
                    risk.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${
                        risk.severity === 'high' ? 'text-red-800' :
                        risk.severity === 'medium' ? 'text-yellow-800' :
                        'text-blue-800'
                      }`}>
                        {risk.severity?.toUpperCase() || 'RISK'}: {risk.title || risk.message || 'Risk identified'}
                      </p>
                      {risk.category && (
                        <p className="text-xs text-muted-foreground mt-1">Category: {risk.category.replace('_', ' ')}</p>
                      )}
                    </div>
                  </div>
                  {risk.description && (
                    <p className="text-sm text-muted-foreground mb-2">{risk.description}</p>
                  )}
                  {risk.impact && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Potential Impact:</p>
                      <p className="text-xs text-muted-foreground">{risk.impact}</p>
                    </div>
                  )}
                  {risk.recommendation && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Recommendation:</p>
                      <p className="text-xs text-muted-foreground">{risk.recommendation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunities */}
        {opportunities.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Opportunities</h3>
            <div className="space-y-2">
              {opportunities.map((opp: any, idx: number) => (
                <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-semibold text-green-800 mb-1">{opp.title}</p>
                  {opp.description && (
                    <p className="text-xs text-green-700">{opp.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Expenses */}
        {data.upcomingExpenses && data.upcomingExpenses.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Upcoming Large Expenses</h3>
            <div className="space-y-2">
              {data.upcomingExpenses.map((exp: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{exp.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(exp.expectedDate).toLocaleDateString()} • {exp.recurrence}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-red-600">-{formatValue(exp.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Risks Message */}
        {risks.length === 0 && opportunities.length === 0 && !loadingAnalysis && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No significant risks or opportunities identified at this time.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ChoiceStep({ data, currency = 'GBP' }: { data: ChoiceData; currency?: string }) {
  const [aiDecisions, setAiDecisions] = useState<any>(null)
  const [loadingDecisions, setLoadingDecisions] = useState(true)
  const [decisionsError, setDecisionsError] = useState<string | null>(null)

  const formatValue = useMemo(() => (value: number) => formatCurrency(value, currency, true), [currency])

  useEffect(() => {
    const loadAIDecisions = async () => {
      setLoadingDecisions(true)
      setDecisionsError(null)
      try {
        const res = await fetch('/api/framework/choice/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        const json = await res.json()
        if (json?.ok) {
          setAiDecisions(json.data)
        } else {
          setDecisionsError(json?.error || 'Failed to load AI recommendations')
        }
      } catch (e: any) {
        setDecisionsError(e.message || 'Failed to load AI recommendations')
      } finally {
        setLoadingDecisions(false)
      }
    }
    loadAIDecisions()
  }, [])

  const decisions = aiDecisions?.decisions || data?.decisions || []
  const hasNoData = decisions.length === 0

  if (loadingDecisions && !aiDecisions) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CHOICE — What should I do next?</CardTitle>
          <CardDescription>AI-powered decision recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <LoadingSpinner size="lg" />
            <p className="text-muted-foreground mt-4">AI is analyzing your financial situation to provide recommendations...</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  if (hasNoData && !loadingDecisions) {
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
        <CardDescription>AI-powered decision recommendations based on your financial situation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Summary */}
        {aiDecisions?.summary && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium mb-1">Recommended Strategy</p>
            <p className="text-sm text-muted-foreground">{aiDecisions.summary}</p>
            {aiDecisions.message && (
              <p className="text-xs text-muted-foreground mt-2">{aiDecisions.message}</p>
            )}
          </div>
        )}

        {/* Error State */}
        {decisionsError && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              {decisionsError}
              {decisions.length > 0 && ' Showing rule-based recommendations instead.'}
            </p>
          </div>
        )}

        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setLoadingDecisions(true)
              setDecisionsError(null)
              try {
                const res = await fetch('/api/framework/choice/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refresh: true }),
                })
                const json = await res.json()
                if (json?.ok) {
                  setAiDecisions(json.data)
                } else {
                  setDecisionsError(json?.error || 'Failed to refresh recommendations')
                }
              } catch (e: any) {
                setDecisionsError(e.message || 'Failed to refresh recommendations')
              } finally {
                setLoadingDecisions(false)
              }
            }}
            disabled={loadingDecisions}
          >
            {loadingDecisions ? 'Analyzing...' : 'Refresh Recommendations'}
          </Button>
        </div>

        {decisions.length > 0 ? (
          <div className="space-y-4">
            {decisions.map((decision: any, idx: number) => (
              <div key={idx} className="p-4 border-2 rounded-lg space-y-3 hover:bg-muted/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-lg mb-2">{decision.description}</p>
                    {decision.rationale && (
                      <p className="text-sm text-muted-foreground mb-3">{decision.rationale}</p>
                    )}
                    <div className="flex gap-3 text-sm">
                      <span className={`px-3 py-1 rounded-full font-medium ${
                        decision.risk === 'high' ? 'bg-red-100 text-red-800' :
                        decision.risk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {decision.risk} risk
                      </span>
                      <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                        {decision.timeframe.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cash Impact</p>
                    <p className={`text-lg font-bold ${decision.cashImpact > 0 ? 'text-green-600' : decision.cashImpact < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {decision.cashImpact > 0 ? '+' : ''}{formatValue(decision.cashImpact)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reversibility</p>
                    <p className="text-sm font-medium">{decision.reversibility.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No specific decisions available at this time.</p>
        )}
      </CardContent>
    </Card>
  )
}
