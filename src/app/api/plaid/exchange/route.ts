import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const client_id = process.env.PLAID_CLIENT_ID
    const secret = process.env.PLAID_SECRET
    if (!client_id || !secret) {
      return NextResponse.json({ ok: false, error: 'Missing PLAID_CLIENT_ID/PLAID_SECRET' }, { status: 200 })
    }
    const { public_token } = await req.json() as { public_token?: string }
    if (!public_token) return NextResponse.json({ ok: false, error: 'Missing public_token' }, { status: 200 })

    // Exchange public_token -> access_token
    const res = await fetch('https://sandbox.plaid.com/item/public_token/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id, secret, public_token }),
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok || !data?.access_token) {
      return NextResponse.json({ ok: false, step: 'exchange', status: res.status, details: data }, { status: 200 })
    }
    const access_token = data.access_token as string

    // Fetch accounts
    const accRes = await fetch('https://sandbox.plaid.com/accounts/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id, secret, access_token })
    })
    const accData = await accRes.json()
    if (!accRes.ok) return NextResponse.json({ ok: false, step: 'accounts', status: accRes.status, details: accData }, { status: 200 })

    // Fetch transactions (90 days)
    const start_date = new Date()
    start_date.setMonth(start_date.getMonth() - 3)
    const end_date = new Date()
    const txRes = await fetch('https://sandbox.plaid.com/transactions/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id,
        secret,
        access_token,
        start_date: start_date.toISOString().slice(0,10),
        end_date: end_date.toISOString().slice(0,10),
        options: { include_personal_finance_category: true }
      })
    })
    const txData = await txRes.json()
    if (!txRes.ok) return NextResponse.json({ ok: false, step: 'transactions', status: txRes.status, details: txData }, { status: 200 })

    // Save to DB (and persist access_token for refresh)
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    const accounts = (accData?.accounts ?? []).map((a: any) => ({
      id: a?.account_id,
      provider: 'Plaid',
      account_name: a?.name || a?.official_name || 'Account',
      currency: a?.balances?.iso_currency_code || 'USD',
    }))
    if (accounts.length) await supabase.from('BankAccounts').upsert(accounts, { onConflict: 'id' })

    const mapPlaidCategory = (primary: string) => {
      switch (String(primary || '').toUpperCase()) {
        case 'INCOME': return 'Income'
        case 'TRANSFERS': return 'Transfers'
        case 'TRANSPORTATION': return 'Transport'
        case 'FOOD_AND_DRINK': return 'Restaurants'
        case 'GENERAL_MERCHANDISE': return 'Shopping'
        case 'RENT_AND_UTILITIES': return 'Utilities'
        case 'ENTERTAINMENT': return 'Entertainment'
        case 'PERSONAL_CARE': return 'Personal Care'
        case 'HEALTHCARE': return 'Healthcare'
        case 'EDUCATION': return 'Education'
        case 'GENERAL_SERVICES': return 'Services'
        case 'CASH_AND_CHECKS': return 'Cash'
        case 'HOME_IMPROVEMENT': return 'Home'
        case 'TAXES': return 'Taxes'
        case 'TRAVEL': return 'Travel'
        default: return ''
      }
    }

    const transactions = (txData?.transactions ?? []).map((t: any) => {
      const pcat = t?.personal_finance_category?.primary || (Array.isArray(t?.category) && t.category[0]) || ''
      const mapped = mapPlaidCategory(pcat)
      const description = t?.name || t?.merchant_name || t?.original_description || 'Transaction'
      const isRefund = /refund/i.test(String(description))
      let amt = Number(t?.amount ?? 0)
      // Sign heuristic: Income and Refunds are positive; other categories are expenses (negative)
      if (mapped === 'Income' || isRefund) amt = Math.abs(amt); else amt = -Math.abs(amt)
      return {
        id: t?.transaction_id,
        account_id: t?.account_id,
        amount: amt,
        currency: t?.iso_currency_code || 'USD',
        description,
        booked_at: (t?.date || new Date().toISOString()).slice(0,10),
        category: mapped || null,
      }
    })
    if (transactions.length) await supabase.from('Transactions').upsert(transactions, { onConflict: 'id' })

    if (userId) {
      await supabase.from('ExternalTokens').upsert({ user_id: userId, provider: 'Plaid', access_token })
    }

    return NextResponse.json({ ok: true, accounts: accounts.length, transactions: transactions.length }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}


