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
    const rows = accounts.map((a: any) => ({
      id: a?.id ?? crypto.randomUUID(),
      provider: 'Tink',
      account_name: a?.name ?? 'Account',
      currency: a?.currencyCode ?? 'EUR'
    }))
    if (rows.length > 0) {
      await supabase.from('BankAccounts').insert(rows)
    }

    return new Response(JSON.stringify({ ok: true, accounts: rows.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})


