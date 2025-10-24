import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const client_id = process.env.PLAID_CLIENT_ID
    const secret = process.env.PLAID_SECRET
    if (!client_id || !secret) {
      return NextResponse.json({ ok: false, error: 'Missing PLAID_CLIENT_ID/PLAID_SECRET' }, { status: 200 })
    }

    const body = {
      client_id,
      secret,
      client_name: 'FinAssistant.ai',
      language: 'en',
      country_codes: ['GB'],
      products: ['transactions'],
      user: { client_user_id: 'sandbox-user' },
    }

    const res = await fetch('https://sandbox.plaid.com/link/token/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok || !data?.link_token) {
      return NextResponse.json({ ok: false, step: 'link_token', status: res.status, details: data }, { status: 200 })
    }
    return NextResponse.json({ ok: true, link_token: data.link_token }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}


