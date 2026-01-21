'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

type BudgetData = {
  horizon: '6months' | 'yearend'
  forecastMonths: string[]
  categoryGrowthRates: Record<string, { incomeRate: number; expenseRate: number; lastValue: { income: number; expenses: number } }>
  budget: Record<string, Record<string, { income: number; expenses: number }>> // API uses 'expenses' key
  historicalMonths: string[]
  generatedAt: string
}

export default function BudgetPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null)
  const [horizon, setHorizon] = useState<'6months' | 'yearend'>('6months')
  const [editing, setEditing] = useState<Record<string, Record<string, { income: number; expenses: number }>>>({}) // Use 'expenses' to match API
  const [noCents, setNoCents] = useState(true) // Default to hide cents
  const [currentBalance, setCurrentBalance] = useState<number | null>(null)
  const [editingCell, setEditingCell] = useState<{ month: string; category: string; type: 'income' | 'expense' } | null>(null)
  const [editingGrowthRates, setEditingGrowthRates] = useState<Record<string, { incomeRate: number; expenseRate: number }>>({})
  const [editingGrowthRateCell, setEditingGrowthRateCell] = useState<{ category: string; type: 'incomeRate' | 'expenseRate' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

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

  // Fetch current balance and load saved budget
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch current balance
        const balanceRes = await fetch('/api/reports/summary?period=all', { cache: 'no-store' })
        const balanceJson = await balanceRes.json()
        if (balanceJson?.ok && balanceJson.currentBalance !== undefined) {
          setCurrentBalance(balanceJson.currentBalance)
        }

        // Load saved budget
        const budgetRes = await fetch('/api/budget/load', { cache: 'no-store' })
        const budgetJson = await budgetRes.json()
        console.log('[Budget Page] Load response:', budgetJson)
        // API returns { ok: true, data: { budget: {...} } }
        const loadedBudget = budgetJson?.data?.budget || budgetJson?.budget
        if (budgetJson?.ok && loadedBudget) {
          console.log('[Budget Page] Setting budget data:', {
            horizon: loadedBudget.horizon,
            forecastMonthsCount: loadedBudget.forecastMonths?.length || 0,
            categoriesCount: Object.keys(loadedBudget.categoryGrowthRates || {}).length,
            budgetMonthsCount: Object.keys(loadedBudget.budget || {}).length,
          })
          setBudgetData(loadedBudget)
          setHorizon(loadedBudget.horizon || '6months')
          if (loadedBudget.generatedAt) {
            setLastSaved(new Date(loadedBudget.generatedAt))
          }
        } else {
          console.log('[Budget Page] No budget found or error:', budgetJson)
        }
      } catch {}
    }
    fetchData()
  }, [])

  const saveBudget = async () => {
    if (!budgetData) {
      addToast('No budget to save', 'warning')
      return
    }

    setSaving(true)
    try {
      // Merge edited values with budget data
      const mergedBudget = { ...budgetData.budget }
      Object.keys(editing).forEach(editMonth => {
        if (!mergedBudget[editMonth]) mergedBudget[editMonth] = {}
        Object.keys(editing[editMonth]).forEach(editCategory => {
          if (!mergedBudget[editMonth][editCategory]) {
            mergedBudget[editMonth][editCategory] = { income: 0, expenses: 0 }
          }
          mergedBudget[editMonth][editCategory] = {
            ...mergedBudget[editMonth][editCategory],
            ...editing[editMonth][editCategory],
          }
        })
      })

      // Merge edited growth rates
      const mergedGrowthRates = { ...budgetData.categoryGrowthRates }
      Object.keys(editingGrowthRates).forEach(category => {
        if (!mergedGrowthRates[category]) {
          mergedGrowthRates[category] = {
            incomeRate: 0,
            expenseRate: 0,
            lastValue: { income: 0, expenses: 0 },
          }
        }
        mergedGrowthRates[category] = {
          ...mergedGrowthRates[category],
          ...editingGrowthRates[category],
        }
      })

      const saveRes = await fetch('/api/budget/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horizon: budgetData.horizon,
          forecastMonths: budgetData.forecastMonths,
          categoryGrowthRates: mergedGrowthRates,
          budget: mergedBudget,
        }),
      })
      if (!saveRes.ok) {
        const errorText = await saveRes.text()
        console.error('[Budget Page] Save HTTP error:', saveRes.status, errorText)
        addToast(`Failed to save budget: HTTP ${saveRes.status}`, 'error')
        return
      }

      const saveJson = await saveRes.json()
      console.log('[Budget Page] Save response:', saveJson)
      if (saveJson?.ok && saveJson?.data?.budget) {
        // Update budgetData with merged values
        const updatedBudget = {
          ...budgetData,
          categoryGrowthRates: mergedGrowthRates,
          budget: mergedBudget,
        }
        setBudgetData(updatedBudget)
        setEditing({}) // Clear editing state
        setEditingGrowthRates({})
        setLastSaved(new Date())
        
        // Verify save by reloading
        setTimeout(async () => {
          try {
            const verifyRes = await fetch('/api/budget/load', { cache: 'no-store' })
            const verifyJson = await verifyRes.json()
            const verifiedBudget = verifyJson?.data?.budget || verifyJson?.budget
            if (verifyJson?.ok && verifiedBudget) {
              console.log('[Budget Page] Budget verified in database')
              addToast('Budget saved successfully and verified', 'success')
            } else {
              console.warn('[Budget Page] Budget save verification failed:', verifyJson)
              addToast('Budget saved but verification failed', 'warning')
            }
          } catch (e) {
            console.error('[Budget Page] Verification error:', e)
            addToast('Budget saved successfully', 'success')
          }
        }, 500)
      } else {
        console.error('[Budget Page] Save failed:', saveJson)
        const errorMsg = saveJson?.error || 'Unknown error'
        // Check if error mentions missing table
        if (errorMsg.includes('does not exist') || errorMsg.includes('42P01')) {
          addToast('Budget table not found. Please run migration: 20251103000000_create_budget.sql', 'error')
        } else {
          addToast(`Failed to save budget: ${errorMsg}`, 'error')
        }
      }
    } catch (e: any) {
      console.error('[Budget Page] Save exception:', e)
      addToast(`Save error: ${e.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const generateBudget = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/budget/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizon }),
      })
      const json = await res.json()
      if (!json?.ok) {
        addToast(`Budget generation failed: ${json?.error}`, 'error')
        return
      }
      console.log('[Budget Page] Generated budget data:', {
        forecastMonths: json.data?.forecastMonths?.length || 0,
        categories: Object.keys(json.data?.budget || {}).length > 0 
          ? Object.keys(Object.values(json.data.budget)[0] || {}) 
          : [],
        plannedItemsInFirstMonth: json.data?.budget?.[json.data?.forecastMonths?.[0]]?.['Planned Items']
      })
      setBudgetData(json.data)
      setEditing({}) // Reset editing state
      setEditingCell(null)
      setEditingGrowthRates({}) // Reset growth rates editing
      setEditingGrowthRateCell(null)
      
      // Auto-save budget
      try {
        const saveRes = await fetch('/api/budget/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            horizon: json.data.horizon,
            forecastMonths: json.data.forecastMonths,
            categoryGrowthRates: json.data.categoryGrowthRates,
            budget: json.data.budget,
          }),
        })
        const saveJson = await saveRes.json()
        console.log('[Budget Page] Auto-save after generate:', saveJson)
        if (saveJson?.ok) {
          setLastSaved(new Date())
          addToast('Budget generated and saved successfully', 'success')
        } else {
          console.error('[Budget Page] Auto-save failed:', saveJson)
          addToast('Budget generated but failed to save', 'warning')
        }
      } catch (e: any) {
        addToast('Budget generated but failed to save', 'warning')
      }
    } catch (e: any) {
      addToast(`Budget generation error: ${e.message}`, 'error')
    } finally {
      setGenerating(false)
    }
  }

  // Get all unique categories from budget
  const allCategories = useMemo(() => {
    if (!budgetData?.budget) return []
    const cats = new Set<string>()
    Object.values(budgetData.budget).forEach(monthData => {
      Object.keys(monthData).forEach(cat => cats.add(cat))
    })
    return Array.from(cats).sort()
  }, [budgetData])

  // Get value for category in month (from editing or budget)
  const getCategoryMonthValue = (category: string, month: string, type: 'income' | 'expense'): number => {
    // Check if value was edited
    if (editing[month]?.[category] !== undefined) {
      // Editing uses 'expenses' key (to match API structure)
      const editingKey = type === 'expense' ? 'expenses' : type
      return editing[month][category][editingKey] || 0
    }
    // Otherwise use budget data (API uses 'expenses' key)
    const apiKey = type === 'expense' ? 'expenses' : type
    return budgetData?.budget[month]?.[category]?.[apiKey] || 0
  }

  // Get growth rate (from editing or budgetData)
  const getGrowthRate = (category: string, type: 'incomeRate' | 'expenseRate'): number => {
    if (editingGrowthRates[category]?.[type] !== undefined) {
      return editingGrowthRates[category][type]
    }
    return budgetData?.categoryGrowthRates[category]?.[type] || 0
  }

  // Update growth rate and recalculate budget
  const updateGrowthRate = (category: string, type: 'incomeRate' | 'expenseRate', value: number) => {
    if (!budgetData) return

    // Update editing state
    setEditingGrowthRates(prev => {
      const updated = {
        ...prev,
        [category]: {
          ...(prev[category] || budgetData.categoryGrowthRates[category] || { incomeRate: 0, expenseRate: 0 }),
          [type]: value,
        },
      }
      
      // Get the updated rates for this category
      const updatedRates = updated[category]
      const currentIncomeRate = updatedRates.incomeRate
      const currentExpenseRate = updatedRates.expenseRate

      // Update growth rates in budgetData
      const updatedGrowthRates = { ...budgetData.categoryGrowthRates }
      if (!updatedGrowthRates[category]) {
        updatedGrowthRates[category] = {
          incomeRate: 0,
          expenseRate: 0,
          lastValue: { income: 0, expenses: 0 }
        }
      }

      updatedGrowthRates[category].incomeRate = currentIncomeRate
      updatedGrowthRates[category].expenseRate = currentExpenseRate
      const lastValue = updatedGrowthRates[category].lastValue

      // Recalculate budget for this category
      const updatedBudget = { ...budgetData.budget }
      
      budgetData.forecastMonths.forEach((month, monthIndex) => {
        if (!updatedBudget[month]) {
          updatedBudget[month] = {}
        }
        if (!updatedBudget[month][category]) {
          updatedBudget[month][category] = { income: 0, expenses: 0 }
        }

        const monthsAhead = monthIndex + 1
        const incomeGrowthFactor = Math.pow(1 + (currentIncomeRate / 100), monthsAhead)
        const expenseGrowthFactor = Math.pow(1 + (currentExpenseRate / 100), monthsAhead)

        const projectedIncome = lastValue.income * incomeGrowthFactor
        const projectedExpenses = lastValue.expenses * expenseGrowthFactor

        updatedBudget[month][category] = {
          income: Math.max(0, projectedIncome),
          expenses: Math.max(0, projectedExpenses),
        }
      })

      // Update budget data
      const newBudgetData = {
        ...budgetData,
        categoryGrowthRates: updatedGrowthRates,
        budget: updatedBudget,
      }
      setBudgetData(newBudgetData)
      
      return updated
    })
  }


  // Update edited value
  const updateValue = (category: string, month: string, type: 'income' | 'expense', value: number) => {
    // API uses 'expenses' key, so we need to map 'expense' to 'expenses'
    const apiKey = type === 'expense' ? 'expenses' : type
    setEditing(prev => ({
      ...prev,
      [month]: {
        ...(prev[month] || {}),
        [category]: {
          ...(prev[month]?.[category] || budgetData?.budget[month]?.[category] || { income: 0, expenses: 0 }),
          [apiKey]: value,
        },
      },
    }))
  }

  // Calculate totals for each month
  const monthTotals = useMemo(() => {
    if (!budgetData) return {}
    const totals: Record<string, { income: number; expenses: number; net: number }> = {}
    budgetData.forecastMonths.forEach(month => {
      let income = 0
      let expenses = 0
      allCategories.forEach(cat => {
        income += getCategoryMonthValue(cat, month, 'income')
        expenses += getCategoryMonthValue(cat, month, 'expense')
      })
      totals[month] = { income, expenses, net: income - expenses }
    })
    return totals
  }, [budgetData, allCategories, editing])

  // Calculate cash balances (Cash at Start/End) for budget months
  const budgetCashBalances = useMemo(() => {
    if (!budgetData || currentBalance === null) return {}
    
    const balances: Record<string, { start: number; end: number }> = {}
    
    // Start from current balance and project forward
    let runningBalance = currentBalance
    
    budgetData.forecastMonths.forEach((month, index) => {
      const net = monthTotals[month]?.net || 0
      const start = runningBalance
      const end = start + net
      
      balances[month] = { start, end }
      runningBalance = end
    })
    
    return balances
  }, [budgetData, currentBalance, monthTotals])

  // Calculate Cash Runway
  const cashRunway = useMemo(() => {
    if (!budgetData || currentBalance === null || currentBalance === 0) return null

    let runway: number | null = null
    let runwayMessage: string = ''
    let runwayColor: string = 'text-gray-500'
    let negativeMonth: string | null = null

    // Find first month where balance goes negative
    let runningBalance = currentBalance
    for (let i = 0; i < budgetData.forecastMonths.length; i++) {
      const month = budgetData.forecastMonths[i]
      const net = monthTotals[month]?.net || 0
      runningBalance += net
      
      if (runningBalance <= 0 && runway === null) {
        runway = i + 1
        negativeMonth = month
        break
      }
    }

    // If no negative month found, calculate based on average monthly change
    if (runway === null) {
      const avgMonthlyChange = budgetData.forecastMonths.reduce((sum, month) => 
        sum + (monthTotals[month]?.net || 0), 0
      ) / budgetData.forecastMonths.length
      
      if (avgMonthlyChange < 0) {
        runway = Math.floor(currentBalance / Math.abs(avgMonthlyChange))
        // Calculate which month that would be
        if (runway <= budgetData.forecastMonths.length) {
          negativeMonth = budgetData.forecastMonths[runway - 1]
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
  }, [budgetData, currentBalance, monthTotals])

  // Chart data for budget forecast
  const chartData = useMemo(() => {
    if (!budgetData || currentBalance === null) return { labels: [], datasets: [] }

    const monthLabels = budgetData.forecastMonths.map(m => formatMonth(m))
    const dataPoints: number[] = []
    
    let runningBalance = currentBalance
    dataPoints.push(runningBalance) // Start with current balance
    
    budgetData.forecastMonths.forEach(month => {
      const net = monthTotals[month]?.net || 0
      runningBalance += net
      dataPoints.push(runningBalance)
      console.log(`[Budget Chart] Month ${month}: net=${net}, runningBalance=${runningBalance}`)
    })

    const labels = ['Current', ...monthLabels]
    const zeroLineData = labels.map(() => 0)

    // Debug: log dataPoints to see actual values
    console.log('[Budget Chart] Data points:', dataPoints.map((val, idx) => ({ 
      label: labels[idx], 
      value: val 
    })))

    // Find the index where balance goes negative (first negative value)
    // Also check if balance crosses zero (goes from positive to negative)
    let negativeIndex = -1
    for (let i = 1; i < dataPoints.length; i++) {
      // Check if balance crosses from positive/zero to negative
      if (dataPoints[i-1] >= 0 && dataPoints[i] < 0) {
        negativeIndex = i
        break
      }
    }
    
    // If no crossing found, check for first negative value
    if (negativeIndex === -1) {
      for (let i = 0; i < dataPoints.length; i++) {
        if (dataPoints[i] < 0) {
          negativeIndex = i
          break
        }
      }
    }
    
    console.log('[Budget Chart] Negative index:', negativeIndex, 'at label:', negativeIndex >= 0 ? labels[negativeIndex] : 'none')
    console.log('[Budget Chart] Data points around negative:', negativeIndex >= 0 ? {
      before: negativeIndex > 0 ? { label: labels[negativeIndex - 1], value: dataPoints[negativeIndex - 1] } : null,
      at: { label: labels[negativeIndex], value: dataPoints[negativeIndex] },
      after: negativeIndex < dataPoints.length - 1 ? { label: labels[negativeIndex + 1], value: dataPoints[negativeIndex + 1] } : null,
    } : 'none')

    const datasets: any[] = []

    // Create positive data array - show all positive values up to (but not including) transition
    const positiveData = dataPoints.map((val, idx) => {
      if (negativeIndex >= 0) {
        // If we found a negative transition point
        if (idx < negativeIndex) {
          // Before transition: show positive values
          return val > 0 ? val : null
        } else {
          // At and after transition: null (negative values go to negative dataset)
          return null
        }
      }
      // No transition: show all positive values
      return val > 0 ? val : null
    })

    // Create negative data array - show 0 before first negative, then all negative values
    const negativeData = dataPoints.map((val, idx) => {
      if (negativeIndex >= 0) {
        // If we found a negative transition point
        if (idx < negativeIndex) {
          // Before transition: null
          return null
        } else if (idx === negativeIndex) {
          // At transition: if previous was positive, show 0 first, then the negative value
          // But we can only show one value per index, so show the actual negative value
          // The connection will be handled by showing the last positive value and first negative
          return val < 0 ? val : (val === 0 ? 0 : null)
        } else {
          // After transition: show ALL negative values
          return val < 0 ? val : null
        }
      }
      // No transition: all null
      return null
    })
    
    // To connect lines smoothly, add 0 at the point before first negative in negativeData
    if (negativeIndex >= 0 && negativeIndex > 0) {
      // Set the point before negativeIndex to 0 in negativeData to connect the lines
      negativeData[negativeIndex - 1] = 0
    }
    
    console.log('[Budget Chart] Data points:', dataPoints)
    console.log('[Budget Chart] Negative index:', negativeIndex)
    console.log('[Budget Chart] Negative data (after fix):', negativeData)
    console.log('[Budget Chart] Positive data (after fix):', positiveData)

    // Positive segment (green) - always add
    datasets.push({
      label: 'Positive Balance',
      data: positiveData,
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
      spanGaps: false, // Don't span gaps to avoid connecting through nulls
    })

    // Negative segment (red) - only add if there are negative values
    if (negativeIndex >= 0) {
      datasets.push({
        label: 'Negative Balance',
        data: negativeData,
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
      })
    }

    // Zero line
    datasets.push({
      label: 'Zero Line',
      data: zeroLineData,
      borderColor: '#9ca3af',
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
      tension: 0,
    })

    return {
      labels,
      datasets,
    }
  }, [budgetData, currentBalance, monthTotals, cashRunway])

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
        text: 'Budget Cash Flow Forecast',
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

  // Separate income and expense categories
  const incomeCategories = useMemo(() => {
    return allCategories.filter(cat => {
      // Check if category has any income in any month
      return budgetData?.forecastMonths.some(month => 
        getCategoryMonthValue(cat, month, 'income') > 0
      ) || false
    })
  }, [allCategories, budgetData])

  const expenseCategories = useMemo(() => {
    return allCategories.filter(cat => {
      // Check if category has any expenses in any month
      return budgetData?.forecastMonths.some(month => 
        getCategoryMonthValue(cat, month, 'expense') > 0
      ) || false
    })
  }, [allCategories, budgetData])

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget Generator</h1>
          <p className="text-sm text-muted-foreground">AI-powered budget based on historical data analysis</p>
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

      {/* Generate Budget Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate Budget</CardTitle>
          <CardDescription>
            Analyze your historical transactions and generate a budget based on monthly growth rates.
            The system calculates average month-over-month change rates for each category and projects future months.
            You can edit any value in the generated budget table.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label>Forecast Horizon</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {horizon === '6months' 
                  ? 'Generate budget for next 6 months' 
                  : 'Generate budget until end of current year'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={generateBudget} 
                disabled={generating}
                className="min-w-[150px]"
              >
                {generating ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Generating...
                  </>
                ) : (
                  'Generate Budget'
                )}
              </Button>
              {budgetData && (
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={saveBudget} 
                    disabled={saving}
                    variant="outline"
                    className="min-w-[120px]"
                  >
                    {saving ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save Budget'
                    )}
                  </Button>
                  {lastSaved && (
                    <span className="text-xs text-muted-foreground">
                      Saved {lastSaved.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!budgetData && !generating && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Click "Generate Budget" to analyze your historical data and create a budget
              </p>
              <p className="text-sm text-muted-foreground">
                The system will analyze monthly growth rates for each category and project future months
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {budgetData && (
        <>
          {/* Growth Rates Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Category Growth Rates</CardTitle>
              <CardDescription>Average monthly change rates calculated from historical data. Click values to edit manually.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Category</th>
                      <th className="text-right py-2 px-3">Last Month Income</th>
                      <th className="text-right py-2 px-3">Income Growth Rate</th>
                      <th className="text-right py-2 px-3">Last Month Expenses</th>
                      <th className="text-right py-2 px-3">Expense Growth Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allCategories.map(category => {
                      const rates = budgetData.categoryGrowthRates[category]
                      if (!rates) return null
                      
                      const incomeRate = getGrowthRate(category, 'incomeRate')
                      const expenseRate = getGrowthRate(category, 'expenseRate')
                      const isEditingIncome = editingGrowthRateCell?.category === category && editingGrowthRateCell?.type === 'incomeRate'
                      const isEditingExpense = editingGrowthRateCell?.category === category && editingGrowthRateCell?.type === 'expenseRate'
                      
                      return (
                        <tr key={category} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-3 font-medium">{category}</td>
                          <td className="py-2 px-3 text-right text-green-600">
                            {format(rates.lastValue.income)}
                          </td>
                          <td className={`py-2 px-3 ${incomeRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {isEditingIncome ? (
                              <Input
                                type="number"
                                step="0.1"
                                value={Math.round(incomeRate * 10) / 10}
                                onChange={(e) => updateGrowthRate(category, 'incomeRate', Math.round(parseFloat(e.target.value) * 10) / 10 || 0)}
                                onBlur={() => setEditingGrowthRateCell(null)}
                                autoFocus
                                className="text-right text-sm w-24 ml-auto"
                              />
                            ) : (
                              <div
                                onClick={() => setEditingGrowthRateCell({ category, type: 'incomeRate' })}
                                className="text-right cursor-pointer hover:bg-muted px-2 py-1 rounded"
                              >
                                {incomeRate >= 0 ? '+' : ''}{format(incomeRate)}%
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-red-600">
                            {format(rates.lastValue.expenses)}
                          </td>
                          <td className={`py-2 px-3 ${expenseRate >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {isEditingExpense ? (
                              <Input
                                type="number"
                                step="0.1"
                                value={Math.round(expenseRate * 10) / 10}
                                onChange={(e) => updateGrowthRate(category, 'expenseRate', Math.round(parseFloat(e.target.value) * 10) / 10 || 0)}
                                onBlur={() => setEditingGrowthRateCell(null)}
                                autoFocus
                                className="text-right text-sm w-24 ml-auto"
                              />
                            ) : (
                              <div
                                onClick={() => setEditingGrowthRateCell({ category, type: 'expenseRate' })}
                                className="text-right cursor-pointer hover:bg-muted px-2 py-1 rounded"
                              >
                                {expenseRate >= 0 ? '+' : ''}{format(expenseRate)}%
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Budget Table */}
          <Card>
            <CardHeader>
              <CardTitle>Budget Forecast</CardTitle>
              <CardDescription>
                Projected budget for {budgetData.forecastMonths.length} months. Click values to edit.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left font-semibold min-w-[200px]">
                        Category
                      </th>
                      {budgetData.forecastMonths.map(month => (
                        <th key={month} className="px-4 py-3 text-right font-semibold min-w-[150px]">
                          {formatMonth(month)}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right font-semibold min-w-[120px] bg-muted/50">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Cash at Start */}
                    {currentBalance !== null && (
                      <tr className="border-b-2 bg-blue-50/50">
                        <td className="sticky left-0 z-10 bg-blue-50/50 px-4 py-2 font-semibold">
                          Cash at Start
                        </td>
                        {budgetData.forecastMonths.map(month => {
                          const start = budgetCashBalances[month]?.start ?? 0
                          return (
                            <td key={month} className="px-4 py-2 text-right font-semibold text-blue-700">
                              {format(start)}
                            </td>
                          )
                        })}
                        <td className="px-4 py-2 text-right font-semibold text-blue-700 bg-muted/50">
                          {budgetData.forecastMonths.length > 0 ? format(budgetCashBalances[budgetData.forecastMonths[0]]?.start ?? 0) : '-'}
                        </td>
                      </tr>
                    )}

                    {/* Income Section */}
                    {incomeCategories.length > 0 && (
                      <>
                        <tr className="border-b bg-green-50/50">
                          <td colSpan={budgetData.forecastMonths.length + 2} className="px-4 py-2 font-semibold text-green-700">
                            INCOME
                          </td>
                        </tr>
                        {incomeCategories.map(category => {
                          const categoryTotal = budgetData.forecastMonths.reduce((sum, month) => 
                            sum + getCategoryMonthValue(category, month, 'income'), 0
                          )
                          return (
                            <tr key={`income-${category}`} className="border-b hover:bg-muted/30">
                              <td className="sticky left-0 z-10 bg-background px-4 py-2 pl-6 text-sm font-medium">
                                {category}
                              </td>
                              {budgetData.forecastMonths.map(month => {
                                const value = getCategoryMonthValue(category, month, 'income')
                                const isEditing = editingCell?.month === month && editingCell?.category === category && editingCell?.type === 'income'
                                return (
                                  <td key={month} className="px-4 py-2">
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        step="1"
                                        value={Math.round(value) || ''}
                                        onChange={(e) => updateValue(category, month, 'income', Math.round(parseFloat(e.target.value) || 0))}
                                        onBlur={() => setEditingCell(null)}
                                        autoFocus
                                        className="text-right text-sm text-green-600 border-green-200 focus:border-green-400 w-full"
                                      />
                                    ) : (
                                      <div
                                        onClick={() => setEditingCell({ month, category, type: 'income' })}
                                        className="text-right text-sm text-green-600 cursor-pointer hover:bg-green-50 px-2 py-1 rounded"
                                      >
                                        {value !== 0 ? format(value) : '-'}
                                      </div>
                                    )}
                                  </td>
                                )
                              })}
                              <td className="px-4 py-2 text-right text-sm font-semibold text-green-600 bg-muted/30">
                                {format(categoryTotal)}
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="border-b-2 bg-green-100/50">
                          <td className="sticky left-0 z-10 bg-green-100/50 px-4 py-2 font-semibold">
                            Total Income
                          </td>
                          {budgetData.forecastMonths.map(month => (
                            <td key={month} className="px-4 py-2 text-right font-semibold text-green-700">
                              {format(monthTotals[month]?.income || 0)}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right font-semibold text-green-700 bg-muted/50">
                            {format(budgetData.forecastMonths.reduce((sum, month) => 
                              sum + (monthTotals[month]?.income || 0), 0
                            ))}
                          </td>
                        </tr>
                      </>
                    )}

                    {/* Expenses Section */}
                    {expenseCategories.length > 0 && (
                      <>
                        <tr className="border-b bg-red-50/50">
                          <td colSpan={budgetData.forecastMonths.length + 2} className="px-4 py-2 font-semibold text-red-700">
                            EXPENSES
                          </td>
                        </tr>
                        {expenseCategories.map(category => {
                          const categoryTotal = budgetData.forecastMonths.reduce((sum, month) => 
                            sum + getCategoryMonthValue(category, month, 'expense'), 0
                          )
                          return (
                            <tr key={`expense-${category}`} className="border-b hover:bg-muted/30">
                              <td className="sticky left-0 z-10 bg-background px-4 py-2 pl-6 text-sm font-medium">
                                {category}
                              </td>
                              {budgetData.forecastMonths.map(month => {
                                const value = getCategoryMonthValue(category, month, 'expense')
                                const isEditing = editingCell?.month === month && editingCell?.category === category && editingCell?.type === 'expense'
                                return (
                                  <td key={month} className="px-4 py-2">
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        step="1"
                                        value={Math.round(value) || ''}
                                        onChange={(e) => updateValue(category, month, 'expense', Math.round(parseFloat(e.target.value) || 0))}
                                        onBlur={() => setEditingCell(null)}
                                        autoFocus
                                        className="text-right text-sm text-red-600 border-red-200 focus:border-red-400 w-full"
                                      />
                                    ) : (
                                      <div
                                        onClick={() => setEditingCell({ month, category, type: 'expense' })}
                                        className="text-right text-sm text-red-600 cursor-pointer hover:bg-red-50 px-2 py-1 rounded"
                                      >
                                        {value !== 0 ? format(value) : '-'}
                                      </div>
                                    )}
                                  </td>
                                )
                              })}
                              <td className="px-4 py-2 text-right text-sm font-semibold text-red-600 bg-muted/30">
                                {format(categoryTotal)}
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="border-b-2 bg-red-100/50">
                          <td className="sticky left-0 z-10 bg-red-100/50 px-4 py-2 font-semibold">
                            Total Expenses
                          </td>
                          {budgetData.forecastMonths.map(month => (
                            <td key={month} className="px-4 py-2 text-right font-semibold text-red-700">
                              {format(monthTotals[month]?.expenses || 0)}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right font-semibold text-red-700 bg-muted/50">
                            {format(budgetData.forecastMonths.reduce((sum, month) => 
                              sum + (monthTotals[month]?.expenses || 0), 0
                            ))}
                          </td>
                        </tr>
                      </>
                    )}

                    {/* Net Budget */}
                    <tr className="border-t-4 bg-blue-50/50">
                      <td className="sticky left-0 z-10 bg-blue-50/50 px-4 py-3 font-bold text-lg">
                        Net Cash Flow
                      </td>
                      {budgetData.forecastMonths.map(month => {
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
                        color: budgetData.forecastMonths.reduce((sum, month) => 
                          sum + (monthTotals[month]?.net || 0), 0
                        ) >= 0 ? '#16a34a' : '#dc2626'
                      }}>
                        {format(budgetData.forecastMonths.reduce((sum, month) => 
                          sum + (monthTotals[month]?.net || 0), 0
                        ))}
                      </td>
                    </tr>

                    {/* Cash at End */}
                    {currentBalance !== null && (
                      <tr className="border-b-2 bg-blue-50/50">
                        <td className="sticky left-0 z-10 bg-blue-50/50 px-4 py-2 font-semibold">
                          Cash at End
                        </td>
                        {budgetData.forecastMonths.map(month => {
                          const end = budgetCashBalances[month]?.end ?? 0
                          return (
                            <td key={month} className="px-4 py-2 text-right font-semibold text-blue-700">
                              {format(end)}
                            </td>
                          )
                        })}
                        <td className="px-4 py-2 text-right font-semibold text-blue-700 bg-muted/50">
                          {budgetData.forecastMonths.length > 0 ? format(budgetCashBalances[budgetData.forecastMonths[budgetData.forecastMonths.length - 1]]?.end ?? 0) : '-'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Cash Runway and Chart */}
      {budgetData && currentBalance !== null && (
        <>
          {/* Cash Runway Metric */}
          {cashRunway && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Budget Cash Runway</CardTitle>
                <CardDescription>Months until cash balance reaches zero based on budget forecast.</CardDescription>
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
                {cashRunway.negativeMonth && (
                  <p className={`text-lg font-semibold mt-2 ${cashRunway.color}`}>
                    You will run out of cash in {formatMonth(cashRunway.negativeMonth)}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  Current Balance: {format(currentBalance)}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Budget Forecast Chart */}
          {chartData.labels.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Budget Cash Flow Forecast</CardTitle>
                <CardDescription>Projected cash balance over the budget period.</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ height: '400px' }}>
                  <Line data={chartData} options={chartOptions} />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
