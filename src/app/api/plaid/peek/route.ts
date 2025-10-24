import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function peek() {
  try {
    const client_id = process.env.PLAID_CLIENT_ID
    const secret = process.env.PLAID_SECRET
    if (!client_id || !secret) {
      return NextResponse.json({ ok: false, error: 'Missing PLAID_CLIENT_ID/PLAID_SECRET' }, { status: 200 })
    }
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 200 })

    const { data: tokenRow } = await supabase
      .from('ExternalTokens')
      .select('access_token')
      .eq('user_id', userId)
      .eq('provider', 'Plaid')
      .limit(1)
      .maybeSingle()

    const access_token = tokenRow?.access_token
    if (!access_token) return NextResponse.json({ ok: false, error: 'No Plaid access token stored' }, { status: 200 })

    const start_date = new Date(); start_date.setMonth(start_date.getMonth() - 1)
    const end_date = new Date()
    const txRes = await fetch('https://sandbox.plaid.com/transactions/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id, secret, access_token,
        start_date: start_date.toISOString().slice(0,10),
        end_date: end_date.toISOString().slice(0,10),
        options: { include_personal_finance_category: true, count: 10 }
      })
    })
    const data = await txRes.json()
    if (!txRes.ok) return NextResponse.json({ ok: false, status: txRes.status, details: data }, { status: 200 })

    const sample = (data?.transactions ?? []).slice(0, 5).map((t: any) => ({
      name: t?.name,
      merchant_name: t?.merchant_name,
      plaid_category: t?.category,
      pfc_primary: t?.personal_finance_category?.primary,
      amount: t?.amount,
      date: t?.date,
    }))

    return NextResponse.json({ ok: true, sample }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}

export async function GET() { return peek() }
export async function POST() { return peek() }


