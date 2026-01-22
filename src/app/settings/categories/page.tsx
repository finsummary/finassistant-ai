"use client"

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Category = { id: string; name: string; type: 'income' | 'expense'; enabled: boolean; sort_order: number }

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')

  const income = useMemo(() => items.filter(i => i.type === 'income'), [items])
  const expense = useMemo(() => items.filter(i => i.type === 'expense'), [items])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' })
      const json = await res.json()
      if (json?.ok) {
        // Remove duplicates: prefer user-defined over global (same logic as Dashboard)
        const allCats = (json.rows || []).filter((c: any) => c?.enabled !== false)
        const uniqueCats = Array.from(
          new Map(
            allCats
              .sort((a: any, b: any) => {
                // User-defined categories first (user_id !== null), then global (user_id === null)
                if (a.user_id && !b.user_id) return -1
                if (!a.user_id && b.user_id) return 1
                return 0
              })
              .map((c: any) => [String(c.name).toLowerCase(), c])
          ).values()
        )
        setItems(uniqueCats)
      } else {
        alert(`Load error: ${json?.error}`)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const add = async () => {
    const body = { name: name.trim(), type }
    if (!body.name) { alert('Name required'); return }
    const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!json?.ok) { alert(`Add error: ${json?.error}`); return }
    setName('')
    await load()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this category?')) return
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json?.ok) { alert(`Delete error: ${json?.error}`); return }
    await load()
  }

  const toggle = async (it: Category) => {
    const res = await fetch(`/api/categories/${it.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !it.enabled }) })
    const json = await res.json()
    if (!json?.ok) { alert(`Update error: ${json?.error}`); return }
    await load()
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button variant="outline" onClick={() => { window.location.href = '/dashboard' }}>Dashboard</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap items-center">
            <Input className="w-64" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
            <select className="border rounded px-2 py-1" value={type} onChange={e => setType(e.target.value as any)}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <Button onClick={add} disabled={loading}>Add</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Income</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <ul className="space-y-2">
                {income.map(it => (
                  <li key={it.id} className="flex items-center justify-between border rounded p-2">
                    <span>{it.name}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggle(it)}>{it.enabled ? 'Disable' : 'Enable'}</Button>
                      {it.id && (
                        <Button variant="outline" size="sm" onClick={() => remove(it.id)}>Delete</Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <ul className="space-y-2">
                {expense.map(it => (
                  <li key={it.id} className="flex items-center justify-between border rounded p-2">
                    <span>{it.name}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggle(it)}>{it.enabled ? 'Disable' : 'Enable'}</Button>
                      {it.id && (
                        <Button variant="outline" size="sm" onClick={() => remove(it.id)}>Delete</Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


