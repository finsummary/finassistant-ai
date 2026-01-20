'use client'

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [period, setPeriod] = useState<'all' | 'year' | 'quarter'>('all');
    const [deleting, setDeleting] = useState<Record<string, boolean>>({})
    const [search, setSearch] = useState('')
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [categories, setCategories] = useState<any[]>([]);
    const [csvFile, setCsvFile] = useState<File | null>(null)
    const [importAccountId, setImportAccountId] = useState<string>('')
    const [importCurrency, setImportCurrency] = useState<string>('GBP')
    const [invertSign, setInvertSign] = useState<boolean>(false)
    const [organization, setOrganization] = useState<any>(null)
    const [isCategorizing, setIsCategorizing] = useState(false)
    const [isAutoCategorizing, setIsAutoCategorizing] = useState(false)
    const [isDeletingAll, setIsDeletingAll] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    
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
                if (json?.ok) {
                    // Filter enabled categories and remove duplicates by name (prefer user-defined over global)
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
                    setCategories(uniqueCats)
                }
            } catch {}
        };

        const fetchOrganization = async () => {
            try {
                const res = await fetch('/api/organizations', { cache: 'no-store' })
                const json = await res.json()
                if (json?.ok) setOrganization(json.data)
            } catch {}
        };

        fetchAccounts();
        fetchTransactions();
        fetchCategories();
        fetchOrganization();
    }, [supabase, router]);

    useEffect(() => {
        if (linkedAccounts.length > 0 && !importAccountId) {
            setImportAccountId(String(linkedAccounts[0].id))
        }
    }, [linkedAccounts, importAccountId])

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

    const parseCSVLine = (line: string, delimiter: string): string[] => {
        const out: string[] = []
        let cur = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
            const ch = line[i]
            if (ch === '"') {
                if (inQuotes && line[i+1] === '"') { cur += '"'; i++; continue }
                inQuotes = !inQuotes
                continue
            }
            if (!inQuotes && ch === delimiter) { out.push(cur); cur = ''; continue }
            cur += ch
        }
        out.push(cur)
        return out.map(s => s.trim())
    }

    const handleImportCsv = async () => {
        if (!csvFile) { addToast('Choose a CSV file', 'error'); return }
        if (!importAccountId) { addToast('Select account', 'error'); return }
        
        // Validate file type
        if (!csvFile.name.toLowerCase().endsWith('.csv')) {
            addToast('Please select a CSV file', 'error')
            return
        }
        
        // Validate file size (max 10MB)
        if (csvFile.size > 10 * 1024 * 1024) {
            addToast('File size must be less than 10MB', 'error')
            return
        }
        
        const text = await csvFile.text()
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
        if (lines.length < 2) { addToast('CSV file is empty or has no data rows', 'error'); return }
        const headerRaw = lines[0].replace(/^\uFEFF/, '')
        const delim = (headerRaw.split(';').length > headerRaw.split(',').length) ? ';' : ','
        const rawHeaders = parseCSVLine(headerRaw, delim)
        const normalizeHeader = (s: string) => {
            const trimmed = String(s || '').trim().toLowerCase()
            const noParens = trimmed.replace(/\([^)]*\)/g, '')
            const onlyLetters = noParens.replace(/[^a-z0-9\s]/g, ' ')
            return onlyLetters.replace(/\s+/g, ' ').trim()
        }
        const header = rawHeaders.map(normalizeHeader)
        const findIdx = (cands: string[]) => header.findIndex(h => cands.includes(h))
        const idxDate = findIdx(['date','booking date','booked at','transaction date','posted date'])
        const idxDesc = (() => {
            const i1 = findIdx(['transaction description','description','details','narrative','merchant','name'])
            if (i1 >= 0) return i1
            const i2 = findIdx(['reference'])
            return i2
        })()
        const idxAmt = findIdx(['amount','amt','value'])
        const idxPaidIn  = findIdx(['paid in','money in','credit','credit amount'])
        const idxPaidOut = findIdx(['paid out','money out','debit','debit amount'])
        const idxCurr = findIdx(['currency','curr','transaction currency'])
        const idxStatus = findIdx(['status'])
        if (idxDate < 0 || (idxAmt < 0 && (idxPaidIn < 0 && idxPaidOut < 0))) {
            addToast('CSV must include Date and either Amount or Paid in/Paid out columns', 'error')
            return
        }
        const items: any[] = []
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i], delim)
            if (!cols || cols.length < rawHeaders.length) continue
            if (idxStatus >= 0) {
                const statusVal = String(cols[idxStatus] || '').trim().toLowerCase()
                if (statusVal === 'cancelled') continue
            }
            let dateRaw = String(idxDate >= 0 ? (cols[idxDate] || '') : '')
            dateRaw = dateRaw.replace(/^\uFEFF/, '').trim()
            const date = /^\d{4}-\d{2}-\d{2}\b/.test(dateRaw) ? dateRaw.slice(0,10) : dateRaw
            let description = idxDesc >= 0 ? String(cols[idxDesc] || '') : ''
            const idxRef = findIdx(['reference'])
            if ((!description || description.trim().length < 2) && idxRef >= 0) {
                description = String(cols[idxRef] || '')
            } else if (idxRef >= 0) {
                const refVal = String(cols[idxRef] || '').trim()
                if (refVal) description = `${description} | ${refVal}`
            }
            const parseAmountSmart = (raw: any): number | null => {
                const s = String(raw ?? '').replace(/[^0-9.,\-]/g, '').trim()
                if (!s) return null
                const normalized = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
                const n = Number(normalized)
                return isFinite(n) ? n : null
            }
            let amount: number | null = null
            if (idxAmt >= 0) {
                amount = parseAmountSmart(cols[idxAmt])
            } else {
                const inVal  = idxPaidIn  >= 0 ? (parseAmountSmart(cols[idxPaidIn])  || 0) : 0
                const outVal = idxPaidOut >= 0 ? (parseAmountSmart(cols[idxPaidOut]) || 0) : 0
                if (inVal || outVal) amount = inVal - outVal
            }
            if (amount === null) continue
            const currency = (idxCurr >= 0 ? (cols[idxCurr] || '') : importCurrency).toUpperCase()
            const finalAmount = invertSign ? (amount > 0 ? -Math.abs(amount) : Math.abs(amount)) : amount
            items.push({ date, description, amount: finalAmount, currency, account_id: importAccountId })
        }
        if (!items.length) { addToast('No valid rows found', 'error'); return }
        setIsLoading(true)
        try {
            const res = await fetch('/api/transactions/import', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, defaultCurrency: importCurrency, invertSign })
            })
            const json = await res.json()
            if (!json?.ok) { addToast(`Import error: ${json?.error || json?.details}`, 'error'); return }
            const { data: txs } = await supabase.from('Transactions').select('*')
            if (txs) setTransactions((txs || []) as Transaction[])
            
            // Show detailed import results
            const imported = json.imported || 0
            const received = json.received || 0
            const categorized = json.categorized || 0
            const duplicates = json.duplicates || 0
            
            if (categorized > 0) {
                addToast(`Imported ${imported} transactions. ${categorized} automatically categorized with AI.`, 'success')
            } else if (imported > 0) {
                addToast(`Imported ${imported} transactions, but AI categorization failed. Use "AI Categorize" button to categorize them.`, 'warning')
            } else {
                addToast(`Imported ${imported} of ${received} rows${duplicates > 0 ? ` (${duplicates} duplicates skipped)` : ''}`, 'info')
            }
            
            setCsvFile(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (e: any) {
            addToast(`Import failed: ${e.message}`, 'error')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-4 md:p-8">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <div className="flex gap-2">
                    <Button variant="default" onClick={() => { window.location.href = '/framework' }}>Framework</Button>
                    <Button variant="outline" onClick={() => { window.location.href = '/cash-flow' }}>Cash Flow</Button>
                    <Button variant="outline" onClick={() => { window.location.href = '/settings/planned-items' }}>Planned Items</Button>
                    <Button variant="outline" onClick={() => { window.location.href = '/reports' }}>Reports</Button>
                    <Button variant="outline" onClick={() => { window.location.href = '/settings/categories' }}>Categories</Button>
                    <Button variant="outline" onClick={() => { window.location.href = '/settings/organization' }}>Settings</Button>
                </div>
            </div>
            <div className="mb-4">
                <p className="text-muted-foreground">{`Welcome${user?.email ? `, ${user.email}` : ''}`}</p>
                {organization && (
                    <p className="text-sm text-muted-foreground">
                        {organization.business_name}{organization.country ? ` • ${organization.country}` : ''}
                    </p>
                )}
                {!organization && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm text-yellow-800">
                            Please set up your organization in{' '}
                            <button
                                onClick={() => { window.location.href = '/settings/organization' }}
                                className="underline font-medium"
                            >
                                Settings
                            </button>
                            {' '}to get started.
                        </p>
                    </div>
                )}
            </div>

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
                        <CardTitle>Bank Accounts</CardTitle>
                        <CardDescription>Manage your bank accounts and transactions from CSV uploads.</CardDescription>
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
                                                            addToast(`Delete failed: ${result?.error || 'Unknown error'}`, 'error')
                                                        }
                                                    } catch (e: any) {
                                                        addToast(`Delete failed: ${e.message}`, 'error')
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
                                                                                        if (!data?.ok) { addToast(`Set category error: ${data?.error}`, 'error'); return }
                                                                                        // локально обновим и знак суммы для мгновенного UI
                                                                                        const desc = String(tx.description || '')
                                                                                        const isRefund = /refund/i.test(desc)
                                                                                        const oldAmt = Number((tx as any).amount || 0)
                                                                                        const catRow = categories.find(c => String(c.name).toLowerCase() === String(newCat).toLowerCase())
                                                                                        const isIncomeType = String(catRow?.type).toLowerCase() === 'income' || String(newCat).toLowerCase() === 'income'
                                                                                        const desiredAmt = (isIncomeType || isRefund) ? Math.abs(oldAmt) : -Math.abs(oldAmt)
                                                                                        setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, category: newCat, amount: desiredAmt } : t))
                                                                                    } catch (err:any) { addToast(`Set category error: ${err.message}`, 'error') }
                                                                                }}
                                                                            >
                                                                                <option value="">Uncategorized</option>
                                                                                {Array.from(
                                                                                    new Map(
                                                                                        categories
                                                                                            .filter(c => String(c.type) === 'income')
                                                                                            .map((c: any) => [String(c.name).toLowerCase(), c.name])
                                                                                    ).values()
                                                                                ).map((name: string, idx: number) => (
                                                                                    <option key={`inc-${idx}-${name}`} value={name}>{name}</option>
                                                                                ))}
                                                                                {Array.from(
                                                                                    new Map(
                                                                                        categories
                                                                                            .filter(c => String(c.type) === 'expense')
                                                                                            .map((c: any) => [String(c.name).toLowerCase(), c.name])
                                                                                    ).values()
                                                                                ).map((name: string, idx: number) => (
                                                                                    <option key={`exp-${idx}-${name}`} value={name}>{name}</option>
                                                                                ))}
                                                                                </select>
                                                                        </td>
                                                                        <td className="py-2 pr-4 whitespace-nowrap">{tx.amount} {tx.currency}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    ) : (
                                                        <div className="text-center py-6">
                                                            <p className="text-muted-foreground mb-2">No transactions for selected period.</p>
                                                            <p className="text-sm text-muted-foreground">Upload a CSV file to import your transactions.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-muted-foreground mb-2">No bank accounts connected yet.</p>
                                <p className="text-sm text-muted-foreground mb-4">Create a manual account below to start importing transactions.</p>
                            </div>
                        )}
                        <div className="mt-4 flex gap-2">
                            <Button variant="outline" onClick={async ()=>{
                                setIsCategorizing(true)
                                try {
                                    console.log('[Dashboard] Starting AI categorize...')
                                    
                                    // First, check how many uncategorized transactions we have
                                    const { data: uncategorizedTxs, error: checkError } = await supabase
                                        .from('Transactions')
                                        .select('id, category')
                                        .or('category.is.null,category.eq.')
                                        .limit(10)
                                    
                                    if (checkError) {
                                        console.error('[Dashboard] Error checking uncategorized:', checkError)
                                    } else {
                                        console.log(`[Dashboard] Found ${uncategorizedTxs?.length || 0} uncategorized transactions (sample)`)
                                    }
                                    
                                    const res = await fetch('/api/ai/categorize', { method:'POST' })
                                    
                                    if (!res.ok) {
                                        const text = await res.text()
                                        console.error('[Dashboard] AI categorize HTTP error:', res.status, text)
                                        addToast(`AI categorize HTTP error: ${res.status}. Check console for details.`, 'error')
                                        return
                                    }
                                    
                                    const data = await res.json()
                                    console.log('[Dashboard] AI categorize response:', data)
                                    
                                    if (!data?.ok) { 
                                        // Try to extract a user-friendly error message
                                        let errorMsg = 'Unknown error'
                                        if (data?.error) {
                                            errorMsg = data.error
                                        } else if (data?.details?.data?.error?.message) {
                                            errorMsg = `Gemini API: ${data.details.data.error.message}`
                                        } else if (data?.details?.data?.message) {
                                            errorMsg = `Gemini API: ${data.details.data.message}`
                                        } else if (data?.details?.error) {
                                            errorMsg = data.details.error
                                        } else if (data?.details) {
                                            errorMsg = JSON.stringify(data.details).substring(0, 200)
                                        }
                                        console.error('[Dashboard] AI categorize failed:', data)
                                        addToast(`AI categorize error: ${errorMsg}`, 'error')
                                        return 
                                    }
                                    
                                    // Refresh transactions after categorization
                                    const { data: txs, error: refreshError } = await supabase
                                        .from('Transactions')
                                        .select('*')
                                        .order('booked_at', { ascending: false })
                                    
                                    if (refreshError) {
                                        console.error('[Dashboard] Error refreshing transactions:', refreshError)
                                    } else {
                                        console.log(`[Dashboard] Refreshed ${txs?.length || 0} transactions`)
                                    }
                                    
                                    if (txs) setTransactions((txs || []) as Transaction[])
                                    
                                    if (data.updated > 0) {
                                        addToast(`AI categorized: ${data.updated} transactions`, 'success')
                                    } else {
                                        addToast(data?.message || 'No uncategorized transactions found. All transactions already have categories.', 'info')
                                    }
                                } catch (e:any) {
                                    console.error('[Dashboard] AI categorize exception:', e)
                                    addToast(`AI categorize error: ${e.message}. Check console for details.`, 'error')
                                } finally {
                                    setIsCategorizing(false)
                                }
                            }} disabled={isCategorizing}>
                              {isCategorizing ? (
                                <>
                                  <LoadingSpinner size="sm" className="mr-2" />
                                  Categorizing...
                                </>
                              ) : (
                                'AI Categorize'
                              )}
                            </Button>
                            <Button variant="outline" onClick={async ()=>{
                                if (!confirm('Clear all categories and re-categorize with AI? This will reset all transaction categories.')) return
                                setIsAutoCategorizing(true)
                                try {
                                    console.log('Step 1: Clearing categories...')
                                    // First clear all categories
                                    const clearRes = await fetch('/api/transactions/clear-categories', { method:'POST' })
                                    if (!clearRes.ok) {
                                        const text = await clearRes.text()
                                        console.error('Clear categories HTTP error:', clearRes.status, text)
                                        addToast(`Clear categories HTTP error: ${clearRes.status}`, 'error')
                                        return
                                    }
                                    const clearData = await clearRes.json()
                                    console.log('Clear categories response:', clearData)
                                    if (!clearData?.ok) { 
                                        addToast(`Clear categories error: ${clearData?.error}`, 'error')
                                        return
                                    }
                                    addToast(`Cleared ${clearData.data?.cleared || 0} categories`, 'success')
                                    
                                    // Refresh transactions after clearing - wait a bit for DB to update
                                    await new Promise(resolve => setTimeout(resolve, 500))
                                    const { data: txsAfterClear, error: refreshError } = await supabase
                                        .from('Transactions')
                                        .select('*')
                                        .order('booked_at', { ascending: false })
                                    
                                    if (refreshError) {
                                        console.error('Error refreshing transactions:', refreshError)
                                    } else {
                                        console.log('Refreshed transactions:', txsAfterClear?.length, 'transactions')
                                        const sampleCategories = txsAfterClear?.slice(0, 5).map((t: any) => ({ id: t.id, category: t.category, description: t.description?.slice(0, 30) }))
                                        console.log('Sample categories after refresh:', sampleCategories)
                                        const nullCount = txsAfterClear?.filter((t: any) => !t.category || t.category === null || t.category === '').length || 0
                                        console.log(`Categories after refresh: ${nullCount} null/empty out of ${txsAfterClear?.length || 0}`)
                                        if (txsAfterClear) {
                                            setTransactions((txsAfterClear || []) as Transaction[])
                                        }
                                    }
                                    
                                    console.log('Step 2: Running AI categorize...')
                                    // Then run AI categorize
                                    const res = await fetch('/api/ai/categorize', { method:'POST' })
                                    if (!res.ok) {
                                        const text = await res.text()
                                        console.error('AI categorize HTTP error:', res.status, text)
                                        addToast(`AI categorize HTTP error: ${res.status}`, 'error')
                                        return
                                    }
                                    const data = await res.json()
                                    console.log('AI categorize response:', data)
                                    if (!data?.ok) { 
                                        addToast(`AI categorize error: ${data?.error || data?.details}`, 'error')
                                        return
                                    }
                                    
                                    // Refresh transactions after categorization
                                    const { data: txs } = await supabase.from('Transactions').select('*')
                                    if (txs) setTransactions((txs || []) as Transaction[])
                                    
                                    if (data.updated > 0) {
                                        addToast(`Cleared and re-categorized: ${data.updated} transactions`, 'success')
                                    } else {
                                        addToast(data?.message || 'No transactions to categorize', 'info')
                                    }
                                } catch (e:any) {
                                    console.error('Re-categorize error:', e)
                                    addToast(`Re-categorize error: ${e.message}`, 'error')
                                } finally {
                                    setIsAutoCategorizing(false)
                                }
                            }} disabled={isAutoCategorizing}>
                              {isAutoCategorizing ? (
                                <>
                                  <LoadingSpinner size="sm" className="mr-2" />
                                  Re-categorizing...
                                </>
                              ) : (
                                'Clear & Re-categorize'
                              )}
                            </Button>
                            <Button variant="destructive" onClick={async ()=>{
                                if (!confirm('Delete ALL transactions? This action cannot be undone.')) return
                                setIsDeletingAll(true)
                                try {
                                    const res = await fetch('/api/transactions/delete-all', { method:'DELETE' })
                                    const data = await res.json()
                                    if (!data?.ok) { 
                                        addToast(`Delete error: ${data?.error}`, 'error')
                                        return
                                    }
                                    addToast(`Deleted ${data.data?.deleted || 0} transactions`, 'success')
                                    // Refresh transactions list
                                    const { data: txs } = await supabase.from('Transactions').select('*').order('booked_at', { ascending: false })
                                    if (txs) setTransactions((txs || []) as Transaction[])
                                } catch (e:any) {
                                    addToast(`Delete error: ${e.message}`, 'error')
                                } finally {
                                    setIsDeletingAll(false)
                                }
                            }} disabled={isDeletingAll}>
                              {isDeletingAll ? (
                                <>
                                  <LoadingSpinner size="sm" className="mr-2" />
                                  Deleting...
                                </>
                              ) : (
                                'Delete All'
                              )}
                            </Button>
                        </div>
                        <div className="mt-6 border-t pt-4">
                            <div className="text-sm font-medium mb-2">Add manual account</div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Input
                                    placeholder="Account name"
                                    className="w-64"
                                    onKeyDown={e => { if (e.key === 'Enter') (document.getElementById('btn-add-account') as HTMLButtonElement)?.click() }}
                                    id="manual-account-name"
                                />
                                <Input
                                    placeholder="Currency"
                                    className="w-28"
                                    defaultValue={importCurrency}
                                    onKeyDown={e => { if (e.key === 'Enter') (document.getElementById('btn-add-account') as HTMLButtonElement)?.click() }}
                                    id="manual-account-currency"
                                />
                                <Button id="btn-add-account" variant="outline" disabled={isLoading} onClick={async ()=>{
                                    try {
                                        const nameEl = document.getElementById('manual-account-name') as HTMLInputElement
                                        const currEl = document.getElementById('manual-account-currency') as HTMLInputElement
                                        const name = String(nameEl?.value || '').trim()
                                        const curr = String(currEl?.value || '').trim().toUpperCase()
                                        if (!name || !curr) { addToast('Enter account name and currency', 'error'); return }
                                        setIsLoading(true)
                                        const res = await fetch('/api/accounts/create', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ name, currency: curr })
                                        })
                                        const json = await res.json()
                                        if (!json?.ok) { addToast(`Create account error: ${json?.error || 'Unknown error'}`, 'error'); return }
                                        const account = json.account
                                        const { data: accs } = await supabase.from('BankAccounts').select('*')
                                        if (accs) setLinkedAccounts(accs as any)
                                        if (account?.id) {
                                            setImportAccountId(String(account.id))
                                        }
                                        nameEl.value = ''
                                        currEl.value = curr
                                        addToast('Account created', 'success')
                                    } catch (e:any) {
                                        addToast(`Create account error: ${e.message}`, 'error')
                                    } finally {
                                        setIsLoading(false)
                                    }
                                }}>
                                  {isLoading ? (
                                    <>
                                      <LoadingSpinner size="sm" className="mr-2" />
                                      Adding...
                                    </>
                                  ) : (
                                    'Add'
                                  )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Import CSV</CardTitle>
                        <CardDescription>Upload transactions from a CSV file. Required headers: Date, Amount. Optional: Description, Currency.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <Input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="max-w-md" />
                                <select className="h-9 px-2 border rounded" value={importAccountId} onChange={e => setImportAccountId(e.target.value)}>
                                    <option value="">Select account</option>
                                    {linkedAccounts.map((a: any) => (
                                        <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>
                                    ))}
                                </select>
                                <Input className="w-28" placeholder="Currency" value={importCurrency} onChange={e => setImportCurrency(e.target.value.toUpperCase())} />
                                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <input type="checkbox" checked={invertSign} onChange={e => setInvertSign(e.target.checked)} />
                                    Invert sign
                                </label>
                                <Button onClick={handleImportCsv} disabled={isLoading || !csvFile || !importAccountId}>
                                  {isLoading ? (
                                    <>
                                      <LoadingSpinner size="sm" className="mr-2" />
                                      Importing...
                                    </>
                                  ) : (
                                    'Import'
                                  )}
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Example headers: <code>date,description,amount,currency</code>. Amount decimals: dot or comma. Dates like <code>2025-10-31</code> or <code>31/10/2025</code>.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
