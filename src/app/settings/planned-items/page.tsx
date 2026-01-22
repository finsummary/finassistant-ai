'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'

type PlannedItem = {
  id: string
  description: string
  amount: number
  expected_date: string
  recurrence: 'one-off' | 'monthly'
  created_at: string
}

export default function PlannedItemsPage() {
  const { addToast } = useToast()
  const [incomeItems, setIncomeItems] = useState<PlannedItem[]>([])
  const [expenseItems, setExpenseItems] = useState<PlannedItem[]>([])
  const [loading, setLoading] = useState(false)

  // Form state for income
  const [incomeForm, setIncomeForm] = useState({
    description: '',
    amount: '',
    expected_date: '',
    recurrence: 'one-off' as 'one-off' | 'monthly',
  })

  // Form state for expenses
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    expected_date: '',
    recurrence: 'one-off' as 'one-off' | 'monthly',
  })

  // Editing state
  const [editingIncome, setEditingIncome] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<string | null>(null)

  const loadItems = async () => {
    setLoading(true)
    try {
      const [incomeRes, expenseRes] = await Promise.all([
        fetch('/api/planned-income'),
        fetch('/api/planned-expenses'),
      ])

      const incomeData = await incomeRes.json()
      const expenseData = await expenseRes.json()

      if (incomeData?.ok) setIncomeItems(incomeData.data || [])
      if (expenseData?.ok) setExpenseItems(expenseData.data || [])
    } catch (e: any) {
      addToast(`Load error: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  const addIncome = async () => {
    // Validation
    if (!incomeForm.description.trim()) {
      addToast('Description is required', 'error')
      return
    }
    if (!incomeForm.amount || parseFloat(incomeForm.amount) <= 0) {
      addToast('Amount must be greater than 0', 'error')
      return
    }
    if (!incomeForm.expected_date) {
      addToast('Expected date is required', 'error')
      return
    }
    const date = new Date(incomeForm.expected_date)
    if (isNaN(date.getTime())) {
      addToast('Invalid date format', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/planned-income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomeForm),
      })
      const json = await res.json()
      if (!json?.ok) {
        addToast(`Add error: ${json?.error}`, 'error')
        return
      }
      setIncomeForm({ description: '', amount: '', expected_date: '', recurrence: 'one-off' })
      await loadItems()
      addToast('Income item added', 'success')
    } catch (e: any) {
      addToast(`Add error: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const addExpense = async () => {
    // Validation
    if (!expenseForm.description.trim()) {
      addToast('Description is required', 'error')
      return
    }
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      addToast('Amount must be greater than 0', 'error')
      return
    }
    if (!expenseForm.expected_date) {
      addToast('Expected date is required', 'error')
      return
    }
    const date = new Date(expenseForm.expected_date)
    if (isNaN(date.getTime())) {
      addToast('Invalid date format', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/planned-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseForm),
      })
      const json = await res.json()
      if (!json?.ok) {
        addToast(`Add error: ${json?.error}`, 'error')
        return
      }
      setExpenseForm({ description: '', amount: '', expected_date: '', recurrence: 'one-off' })
      await loadItems()
      addToast('Expense item added', 'success')
    } catch (e: any) {
      addToast(`Add error: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateIncome = async (id: string, updates: Partial<PlannedItem>) => {
    // Validation
    if (updates.description !== undefined && !updates.description.trim()) {
      addToast('Description cannot be empty', 'error')
      return
    }
    if (updates.amount !== undefined && (isNaN(Number(updates.amount)) || Number(updates.amount) <= 0)) {
      addToast('Amount must be greater than 0', 'error')
      return
    }
    if (updates.expected_date !== undefined) {
      const date = new Date(updates.expected_date)
      if (isNaN(date.getTime())) {
        addToast('Invalid date format', 'error')
        return
      }
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/planned-income/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const json = await res.json()
      if (!json?.ok) {
        addToast(`Update error: ${json?.error}`, 'error')
        return
      }
      setEditingIncome(null)
      await loadItems()
      addToast('Income item updated', 'success')
    } catch (e: any) {
      addToast(`Update error: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateExpense = async (id: string, updates: Partial<PlannedItem>) => {
    // Validation
    if (updates.description !== undefined && !updates.description.trim()) {
      addToast('Description cannot be empty', 'error')
      return
    }
    if (updates.amount !== undefined && (isNaN(Number(updates.amount)) || Number(updates.amount) <= 0)) {
      addToast('Amount must be greater than 0', 'error')
      return
    }
    if (updates.expected_date !== undefined) {
      const date = new Date(updates.expected_date)
      if (isNaN(date.getTime())) {
        addToast('Invalid date format', 'error')
        return
      }
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/planned-expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const json = await res.json()
      if (!json?.ok) {
        addToast(`Update error: ${json?.error}`, 'error')
        return
      }
      setEditingExpense(null)
      await loadItems()
      addToast('Expense item updated', 'success')
    } catch (e: any) {
      addToast(`Update error: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const deleteIncome = async (id: string) => {
    if (!confirm('Delete this planned income item?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/planned-income/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json?.ok) {
        addToast(`Delete error: ${json?.error}`, 'error')
        return
      }
      await loadItems()
      addToast('Income item deleted', 'success')
    } catch (e: any) {
      addToast(`Delete error: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this planned expense item?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/planned-expenses/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json?.ok) {
        addToast(`Delete error: ${json?.error}`, 'error')
        return
      }
      await loadItems()
      addToast('Expense item deleted', 'success')
    } catch (e: any) {
      addToast(`Delete error: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals
  const incomeTotal = useMemo(() => {
    return incomeItems.reduce((sum, item) => {
      const multiplier = item.recurrence === 'monthly' ? 6 : 1 // For 6-month forecast
      return sum + (item.amount * multiplier)
    }, 0)
  }, [incomeItems])

  const expenseTotal = useMemo(() => {
    return expenseItems.reduce((sum, item) => {
      const multiplier = item.recurrence === 'monthly' ? 6 : 1
      return sum + (item.amount * multiplier)
    }, 0)
  }, [expenseItems])

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Planned Income & Expenses</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { window.location.href = '/budget' }}>Back to Budget</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Planned Income</CardTitle>
            <CardDescription>Next 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{incomeTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Planned Expenses</CardTitle>
            <CardDescription>Next 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{expenseTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Planned Income Section */}
        <Card>
          <CardHeader>
            <CardTitle>Planned Income</CardTitle>
            <CardDescription>Add expected income items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="income-description">Description</Label>
              <Input
                id="income-description"
                placeholder="e.g., Client payment, Salary"
                value={incomeForm.description}
                onChange={e => setIncomeForm({ ...incomeForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="income-amount">Amount</Label>
              <Input
                id="income-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={incomeForm.amount}
                onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="income-date">Expected Date</Label>
              <Input
                id="income-date"
                type="date"
                value={incomeForm.expected_date}
                onChange={e => setIncomeForm({ ...incomeForm, expected_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="income-recurrence">Recurrence</Label>
              <select
                id="income-recurrence"
                className="w-full border rounded px-3 py-2"
                value={incomeForm.recurrence}
                onChange={e => setIncomeForm({ ...incomeForm, recurrence: e.target.value as 'one-off' | 'monthly' })}
              >
                <option value="one-off">One-off</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <Button onClick={addIncome} disabled={loading} className="w-full">
              Add Income
            </Button>
          </CardContent>
        </Card>

        {/* Planned Expenses Section */}
        <Card>
          <CardHeader>
            <CardTitle>Planned Expenses</CardTitle>
            <CardDescription>Add expected expense items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expense-description">Description</Label>
              <Input
                id="expense-description"
                placeholder="e.g., Rent, Software subscription"
                value={expenseForm.description}
                onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Amount</Label>
              <Input
                id="expense-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-date">Expected Date</Label>
              <Input
                id="expense-date"
                type="date"
                value={expenseForm.expected_date}
                onChange={e => setExpenseForm({ ...expenseForm, expected_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-recurrence">Recurrence</Label>
              <select
                id="expense-recurrence"
                className="w-full border rounded px-3 py-2"
                value={expenseForm.recurrence}
                onChange={e => setExpenseForm({ ...expenseForm, recurrence: e.target.value as 'one-off' | 'monthly' })}
              >
                <option value="one-off">One-off</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <Button onClick={addExpense} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Adding...
                </>
              ) : (
                'Add Expense'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Income Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Planned Income Items</CardTitle>
          <CardDescription>{incomeItems.length} item(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {incomeItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No planned income items yet.</p>
              <p className="text-sm text-muted-foreground">Add your expected income to improve cash flow forecasting.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {incomeItems.map(item => (
                <div key={item.id} className="p-3 border rounded">
                  {editingIncome === item.id ? (
                    <div className="space-y-3">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={e => {
                          const updated = { ...item, description: e.target.value }
                          setIncomeItems(incomeItems.map(i => i.id === item.id ? updated : i))
                        }}
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Amount"
                          value={item.amount}
                          onChange={e => {
                            const updated = { ...item, amount: Number(e.target.value) || 0 }
                            setIncomeItems(incomeItems.map(i => i.id === item.id ? updated : i))
                          }}
                        />
                        <Input
                          type="date"
                          value={item.expected_date}
                          onChange={e => {
                            const updated = { ...item, expected_date: e.target.value }
                            setIncomeItems(incomeItems.map(i => i.id === item.id ? updated : i))
                          }}
                        />
                        <select
                          className="border rounded px-2 py-1"
                          value={item.recurrence}
                          onChange={e => {
                            const updated = { ...item, recurrence: e.target.value as 'one-off' | 'monthly' }
                            setIncomeItems(incomeItems.map(i => i.id === item.id ? updated : i))
                          }}
                        >
                          <option value="one-off">One-off</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            updateIncome(item.id, {
                              description: item.description,
                              amount: item.amount,
                              expected_date: item.expected_date,
                              recurrence: item.recurrence,
                            })
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingIncome(null)
                            loadItems()
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(item.expected_date).toLocaleDateString()} • {item.recurrence === 'monthly' ? 'Monthly' : 'One-off'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-green-600">+{item.amount.toFixed(2)}</span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingIncome(item.id)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteIncome(item.id)}
                            disabled={loading}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Planned Expense Items</CardTitle>
          <CardDescription>{expenseItems.length} item(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {expenseItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No planned expense items yet.</p>
              <p className="text-sm text-muted-foreground">Add your expected expenses to improve cash flow forecasting.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenseItems.map(item => (
                <div key={item.id} className="p-3 border rounded">
                  {editingExpense === item.id ? (
                    <div className="space-y-3">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={e => {
                          const updated = { ...item, description: e.target.value }
                          setExpenseItems(expenseItems.map(i => i.id === item.id ? updated : i))
                        }}
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Amount"
                          value={item.amount}
                          onChange={e => {
                            const updated = { ...item, amount: Number(e.target.value) || 0 }
                            setExpenseItems(expenseItems.map(i => i.id === item.id ? updated : i))
                          }}
                        />
                        <Input
                          type="date"
                          value={item.expected_date}
                          onChange={e => {
                            const updated = { ...item, expected_date: e.target.value }
                            setExpenseItems(expenseItems.map(i => i.id === item.id ? updated : i))
                          }}
                        />
                        <select
                          className="border rounded px-2 py-1"
                          value={item.recurrence}
                          onChange={e => {
                            const updated = { ...item, recurrence: e.target.value as 'one-off' | 'monthly' }
                            setExpenseItems(expenseItems.map(i => i.id === item.id ? updated : i))
                          }}
                        >
                          <option value="one-off">One-off</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            updateExpense(item.id, {
                              description: item.description,
                              amount: item.amount,
                              expected_date: item.expected_date,
                              recurrence: item.recurrence,
                            })
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingExpense(null)
                            loadItems()
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(item.expected_date).toLocaleDateString()} • {item.recurrence === 'monthly' ? 'Monthly' : 'One-off'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-red-600">-{item.amount.toFixed(2)}</span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingExpense(item.id)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteExpense(item.id)}
                            disabled={loading}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
