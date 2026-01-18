import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TINK_TOKEN_URL = "https://api.tink.com/api/v1/oauth/token"
const TINK_ACCOUNTS_URL = "https://api.tink.com/data/v2/accounts"
const TINK_TRANSACTIONS_URL = "https://api.tink.com/data/v2/transactions"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code } = await req.json()
    if (!code) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing code' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const clientId = Deno.env.get('TINK_CLIENT_ID')
    const clientSecret = Deno.env.get('TINK_CLIENT_SECRET')
    const redirectUri = Deno.env.get('TINK_REDIRECT_URI')
    if (!clientId || !clientSecret || !redirectUri) {
      return new Response(JSON.stringify({ ok: false, error: 'Tink secrets missing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const parseJsonSafe = async (res: Response) => {
      const text = await res.text()
      try { return { json: JSON.parse(text), text } } catch { return { json: null, text } }
    }

    // Exchange code -> access token
    const tokenRes = await fetch(TINK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      })
    })
    const tokenParsed = await parseJsonSafe(tokenRes)
    if (!tokenRes.ok || !tokenParsed.json?.access_token) {
      return new Response(JSON.stringify({ ok: false, step: 'exchange_code', status: tokenRes.status, details: tokenParsed.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const accessToken: string = tokenParsed.json.access_token

    // Fetch accounts
    const accRes = await fetch(TINK_ACCOUNTS_URL, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
    })
    const accParsed = await parseJsonSafe(accRes)
    if (!accRes.ok) {
      return new Response(JSON.stringify({ ok: false, step: 'fetch_accounts', status: accRes.status, details: accParsed.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Save to DB (BankAccounts) minimal demo
    const authHeader = req.headers.get('Authorization') || ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
    const accounts = accParsed.json?.accounts ?? []
    const accountRows = accounts.map((a: any) => ({
      id: a?.id ?? crypto.randomUUID(),
      provider: 'Tink',
      account_name: a?.name ?? 'Account',
      currency: a?.currencyCode ?? 'EUR'
    }))
    if (accountRows.length > 0) {
      // Upsert to avoid duplicates on repeated callbacks
      await supabase.from('BankAccounts').upsert(accountRows as any, { onConflict: 'id' })
    }

    // Fetch transactions (first page)
    const txRes = await fetch(TINK_TRANSACTIONS_URL, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
    })
    const txParsed = await parseJsonSafe(txRes)
    if (!txRes.ok) {
      return new Response(JSON.stringify({ ok: false, step: 'fetch_transactions', status: txRes.status, details: txParsed.text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const txs: any[] = txParsed.json?.transactions ?? []
    const txRows = txs.map((t: any) => {
      // Tink v2 transaction fields may vary; try common fields safely
      const id = String(t?.id ?? crypto.randomUUID())
      const accountId = String(t?.accountId ?? t?.account?.id ?? '')
      const currency = String(t?.currencyCode ?? t?.amount?.currencyCode ?? 'EUR')
      const rawAmount = Number(
        (t?.amount && (t.amount.value ?? t.amount?.value?.unscaledValue)) ??
        t?.amount?.value ?? t?.amount ?? 0
      )
      const description = String(
        t?.descriptions?.display ?? t?.description ?? t?.merchantName ?? t?.originalText ?? ''
      )
      const booked = String(
        t?.dates?.booked ?? t?.bookingDate ?? t?.date ?? new Date().toISOString().slice(0,10)
      ).slice(0,10)
      return {
        id,
        account_id: accountId,
        amount: isFinite(rawAmount) ? rawAmount : 0,
        currency,
        description,
        booked_at: booked,
      }
    }).filter((r: any) => r.id && r.account_id)

    if (txRows.length > 0) {
      await supabase.from('Transactions').upsert(txRows as any, { onConflict: 'id' })
    }

    return new Response(JSON.stringify({ ok: true, accounts: accountRows.length, transactions: txRows.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})


