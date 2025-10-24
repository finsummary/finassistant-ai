'use client'

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type Transaction = {
    id: string
    account_id: string
    amount: number
    currency: string
    description: string | null
    booked_at: string
}

export default function Dashboard({ user }: { user?: any }) {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(false);
    const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [period, setPeriod] = useState<'all' | 'year' | 'quarter'>('all');
    const [deleting, setDeleting] = useState<Record<string, boolean>>({})
    const [search, setSearch] = useState('')
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [categories, setCategories] = useState<any[]>([]);
    
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const fetchAccounts = async () => {
            const { data } = await supabase.from('BankAccounts').select('*');
            if (data) setLinkedAccounts(data);
        };

        const fetchTransactions = async () => {
            const { data } = await supabase.from('Transactions').select('*');
            if (data) setTransactions(data as Transaction[]);
        };

        const fetchCategories = async () => {
            try {
                const res = await fetch('/api/categories', { cache: 'no-store' })
                const json = await res.json()
                if (json?.ok) setCategories((json.rows || []).filter((c: any) => c?.enabled !== false))
            } catch {}
        };

        const handleCallback = async () => {
            const code = searchParams.get('code');
            if (code) {
                setIsLoading(true);
                try {
                    const resp = await fetch('/api/tink-callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
                    })
                    const data = await resp.json()
                    const error = data?.ok === false ? new Error(data?.error || data?.details || 'Callback failed') : null
                    if (error) throw error;
                    await fetchAccounts();
                    await fetchTransactions();
                    await fetchCategories();
                    router.replace('/dashboard');
                } catch (e: any) {
                    alert(`Error processing Tink callback: ${e.message}`);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        fetchAccounts();
        fetchTransactions();
        fetchCategories();
        handleCallback();
    }, [searchParams, supabase, router]);

    const handleConnectBank = async () => {
        setIsLoading(true);
        try {
            const resp = await fetch('/api/tink-connect', { method: 'POST' })
            const data = await resp.json()
            if (data?.link) {
                window.location.href = data.link
                return; // прервём, страница уйдёт на редирект
            } else if (data?.ok === false) {
                console.error('tink-connect error:', data)
                alert(`Error: ${data.error || data.details || 'Failed to create Tink session'}`)
            } else {
                alert('Error: Failed to create Tink session')
            }
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleExpanded = (accountId: string) => {
        setExpanded(prev => ({ ...prev, [accountId]: !prev[accountId] }))
    }

    const filteredByPeriod = (items: Transaction[]) => {
        if (period === 'all') return items
        const now = new Date()
        let from = new Date()
        if (period === 'year') {
            from.setFullYear(now.getFullYear() - 1)
        } else if (period === 'quarter') {
            from.setMonth(now.getMonth() - 3)
        }
        const fromStr = from.toISOString().slice(0,10)
        return items.filter(t => (t.booked_at || '') >= fromStr)
    }

    const filteredBySearch = (items: Transaction[]) => {
        if (!search.trim()) return items
        const q = search.trim().toLowerCase()
        return items.filter(t => (t.description || '').toLowerCase().includes(q))
    }

    const computeTotals = (items: Transaction[]) => {
        let income = 0, expense = 0
        for (const t of items) {
            if (t.amount >= 0) income += t.amount; else expense += t.amount
        }
        const total = income + expense
        return { total, income, expense }
    }

    const exportCsv = (items: Transaction[], accountName: string) => {
        const headers = ['date','description','amount','currency']
        const lines = items.map(t => [t.booked_at, (t.description||'').replaceAll('"','""'), String(t.amount), t.currency])
        const csv = [headers.join(','), ...lines.map(cols => cols.map(c => /[,"\n]/.test(c) ? `"${c}"` : c).join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${accountName || 'account'}-transactions.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="p-4 md:p-8">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { window.location.href = '/reports' }}>Reports</Button>
                    <Button variant="outline" onClick={() => { window.location.href = '/settings/categories' }}>Categories</Button>
                </div>
            </div>
            <p className="mb-4 text-muted-foreground">{`Welcome${user?.email ? `, ${user.email}` : ''}`}</p>

            <div className="mb-6 flex gap-2 items-center flex-wrap">
                <Button variant={period === 'all' ? 'default' : 'outline'} onClick={() => setPeriod('all')}>All</Button>
                <Button variant={period === 'year' ? 'default' : 'outline'} onClick={() => setPeriod('year')}>Year</Button>
                <Button variant={period === 'quarter' ? 'default' : 'outline'} onClick={() => setPeriod('quarter')}>Quarter</Button>
                <div className="ml-2">
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description" className="w-56" />
                </div>
            </div>
            
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Connected Bank Accounts</CardTitle>
                        <CardDescription>Connect with Tink (sandbox) to see demo accounts.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {linkedAccounts.length > 0 ? (
                            <ul>
                                {linkedAccounts.map((acc: any) => {
                                    const accTx = filteredBySearch(filteredByPeriod(transactions.filter(t => t.account_id === acc.id)))
                                    const isOpen = !!expanded[acc.id]
                                    const totals = computeTotals(accTx)
                                    return (
                                        <li key={acc.id} className="border-b py-2">
                                            <button className="w-full text-left" onClick={() => toggleExpanded(acc.id)}>
                                                <div className="flex items-center justify-between">
                                                    <span>{acc.account_name} ({acc.currency})</span>
                                                    <span className="text-sm text-muted-foreground">{isOpen ? 'Hide' : 'Show'} transactions ({accTx.length})</span>
                                                </div>
                                            </button>
                                            <div className="mt-2 flex gap-2 flex-wrap items-center">
                                                <span className="text-sm text-muted-foreground">
                                                    Total: {totals.total.toFixed(2)} {acc.currency} | Income: {totals.income.toFixed(2)} {acc.currency} | Expenses: {totals.expense.toFixed(2)} {acc.currency}
                                                </span>
                                                <Button variant="outline" size="sm" onClick={() => exportCsv(accTx, acc.account_name)}>Export CSV</Button>
                                                <Button variant="outline" size="sm" disabled={!!deleting[acc.id]} onClick={async () => {
                                                    if (!confirm('Delete this account and its transactions?')) return
                                                    try {
                                                        setDeleting(prev => ({ ...prev, [acc.id]: true }))
                                                        const resp = await fetch('/api/delete-account', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ accountId: acc.id })
                                                        })
                                                        const result = await resp.json()
                                                        if (result?.ok) {
                                                            // optimistic update + server refresh
                                                            setLinkedAccounts(prev => prev.filter((a: any) => a.id !== acc.id))
                                                            setTransactions(prev => prev.filter(t => t.account_id !== acc.id))
                                                            const { data: accs } = await supabase.from('BankAccounts').select('*')
                                                            if (accs) setLinkedAccounts(accs as any)
                                                            const { data: txs } = await supabase.from('Transactions').select('*')
                                                            if (txs) setTransactions((txs || []) as Transaction[])
                                                            // collapse accordion
                                                            setExpanded(prev => ({ ...prev, [acc.id]: false }))
                                                        } else {
                                                            console.error('delete-account error:', result)
                                                            alert(`Delete failed: ${result?.error || 'Unknown error'}`)
                                                        }
                                                    } catch (e: any) {
                                                        alert(`Delete failed: ${e.message}`)
                                                    } finally {
                                                        setDeleting(prev => ({ ...prev, [acc.id]: false }))
                                                    }
                                                }}>Delete</Button>
                                            </div>
                                            {isOpen && (
                                                <div className="mt-3 overflow-x-auto">
                                                    {accTx.length > 0 ? (
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="text-left text-muted-foreground">
                                                                    <th className="py-2 pr-4">Date</th>
                                                                    <th className="py-2 pr-4">Description</th>
                                                                    <th className="py-2 pr-4">Category</th>
                                                                    <th className="py-2 pr-4">Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {accTx.map(tx => (
                                                                    <tr key={tx.id} className="border-t">
                                                                        <td className="py-2 pr-4 whitespace-nowrap">{tx.booked_at}</td>
                                                                        <td className="py-2 pr-4">{tx.description || '-'}</td>
                                                                        <td className="py-2 pr-4">
                                                                            <select
                                                                                className="border rounded px-2 py-1 text-sm"
                                                                                value={(tx as any).category || ''}
                                                                                onChange={async (e) => {
                                                                                    const newCat = e.target.value
                                                                                    try {
                                                                                        const res = await fetch('/api/categorize/set', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ id: tx.id, category: newCat }) })
                                                                                        const data = await res.json()
                                                                                        if (!data?.ok) { alert(`Set category error: ${data?.error}`); return }
                                                                                        // локально обновим и знак суммы для мгновенного UI
                                                                                        const desc = String(tx.description || '')
                                                                                        const isRefund = /refund/i.test(desc)
                                                                                        const oldAmt = Number((tx as any).amount || 0)
                                                                                        const catRow = categories.find(c => String(c.name).toLowerCase() === String(newCat).toLowerCase())
                                                                                        const isIncomeType = String(catRow?.type).toLowerCase() === 'income' || String(newCat).toLowerCase() === 'income'
                                                                                        const desiredAmt = (isIncomeType || isRefund) ? Math.abs(oldAmt) : -Math.abs(oldAmt)
                                                                                        setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, category: newCat, amount: desiredAmt } : t))
                                                                                    } catch (err:any) { alert(`Set category error: ${err.message}`) }
                                                                                }}
                                                                            >
                                                                                <option value="">Uncategorized</option>
                                                                                {categories.filter(c => String(c.type) === 'income').map((c: any) => (
                                                                                    <option key={`inc-${c.id}`} value={c.name}>{c.name}</option>
                                                                                ))}
                                                                                {categories.filter(c => String(c.type) === 'expense').map((c: any) => (
                                                                                    <option key={`exp-${c.id}`} value={c.name}>{c.name}</option>
                                                                                ))}
                                                                                </select>
                                                                        </td>
                                                                        <td className="py-2 pr-4 whitespace-nowrap">{tx.amount} {tx.currency}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground">No transactions for selected period.</p>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">No bank accounts connected yet.</p>
                        )}
                        <div className="mt-4 flex gap-2">
                            <Button variant="outline" onClick={async ()=>{
                                try {
                                    const res = await fetch('/api/ai/categorize', { method:'POST' })
                                    const data = await res.json()
                                    if (!data?.ok) { alert(`AI categorize error: ${data?.error || data?.details}`); return }
                                    const { data: txs } = await supabase.from('Transactions').select('*')
                                    if (txs) setTransactions((txs || []) as Transaction[])
                                    alert(`AI categorized: ${data.updated} transactions`)
                                } catch (e:any) {
                                    alert(`AI categorize error: ${e.message}`)
                                }
                            }}>AI Categorize</Button>
                            <Button variant="outline" onClick={async ()=>{
                                try {
                                    const res = await fetch('/api/categorize/apply', { method:'POST' })
                                    const data = await res.json()
                                    if (!data?.ok) { alert(`Auto-categorize error: ${data?.error || data?.details}`); return }
                                    const { data: txs } = await supabase.from('Transactions').select('*')
                                    if (txs) setTransactions((txs || []) as Transaction[])
                                    alert(`Auto-categorized: ${data.updated} transactions`)
                                } catch (e:any) {
                                    alert(`Auto-categorize error: ${e.message}`)
                                }
                            }}>Auto-categorize (Rules)</Button>
                        </div>
                        <div className="mt-4 flex gap-2 flex-wrap">
                            {linkedAccounts.length === 0 && (
                                <Button onClick={handleConnectBank} disabled={isLoading}>
                                    {isLoading ? 'Processing...' : 'Connect Bank Account (Tink Sandbox)'}
                                </Button>
                            )}
                            <Button variant="outline" disabled={isLoading} onClick={async () => {
                                try {
                                    const res = await fetch('/api/plaid/link-token', { method: 'POST' })
                                    const data = await res.json()
                                    if (!data?.link_token) {
                                        alert(`Plaid error: ${data?.error || data?.details || 'Failed to create link token'}`)
                                        return
                                    }
                                    const ensureScript = () => new Promise<void>((resolve, reject) => {
                                        if ((window as any).Plaid) return resolve()
                                        const s = document.createElement('script')
                                        s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
                                        s.onload = () => resolve()
                                        s.onerror = () => reject(new Error('Failed to load Plaid Link script'))
                                        document.body.appendChild(s)
                                    })
                                    await ensureScript()
                                    const handler = (window as any).Plaid.create({
                                        token: data.link_token,
                                        onSuccess: async (public_token: string) => {
                                            try {
                                                const exRes = await fetch('/api/plaid/exchange', {
                                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ public_token })
                                                })
                                                const exData = await exRes.json()
                                                if (!exData?.ok) {
                                                    alert(`Plaid exchange error: ${exData?.error || exData?.details || 'Failed to exchange'}`)
                                                    return
                                                }
                                                const { data: accs } = await supabase.from('BankAccounts').select('*')
                                                if (accs) setLinkedAccounts(accs as any)
                                                const { data: txs } = await supabase.from('Transactions').select('*')
                                                if (txs) setTransactions((txs || []) as Transaction[])
                                                alert(`Plaid imported: ${exData.accounts} accounts, ${exData.transactions} transactions`)
                                            } catch (e: any) {
                                                alert(`Plaid exchange error: ${e.message}`)
                                            }
                                        },
                                        onExit: () => {},
                                    })
                                    handler.open()
                                } catch (e: any) {
                                    alert(`Plaid error: ${e.message}`)
                                }
                                }}>Connect via Plaid (Sandbox)</Button>
                            {linkedAccounts.length > 0 && (
                                <Button variant="outline" onClick={async ()=>{
                                    try {
                                        const res = await fetch('/api/plaid/refresh', { method: 'POST' })
                                        const data = await res.json()
                                        if (!data?.ok) {
                                            alert(`Refresh error: ${data?.error || data?.details || 'Failed to refresh'}`)
                                            return
                                        }
                                        const { data: txs } = await supabase.from('Transactions').select('*')
                                        if (txs) setTransactions((txs || []) as Transaction[])
                                        alert(`Refreshed: ${data.transactions} new/updated transactions`)
                                    } catch (e:any) {
                                        alert(`Refresh error: ${e.message}`)
                                    }
                                }}>Refresh data</Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
