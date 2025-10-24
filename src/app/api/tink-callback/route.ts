import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!baseUrl || !anonKey) {
      return NextResponse.json({ ok: false, error: 'Supabase env not configured' }, { status: 500 })
    }
    const { code } = await req.json()
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userJwt = session?.access_token

    const res = await fetch(`${baseUrl}/functions/v1/tink-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userJwt || anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({ code }),
      cache: 'no-store',
    })

    const text = await res.text()
    let data: any = null
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    return NextResponse.json(data, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 200 })
  }
}


