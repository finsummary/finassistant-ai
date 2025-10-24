import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 200 })

    const url = new URL(req.url)
    const accountId = url.searchParams.get('accountId') || undefined
    const q = url.searchParams.get('q') || undefined
    const limit = Number(url.searchParams.get('limit') || '50')

    let query = supabase
      .from('Transactions')
      .select('id, account_id, booked_at, description, amount, currency, category')
      .order('booked_at', { ascending: false })
      .limit(Math.max(1, Math.min(500, limit)))

    if (accountId) query = query.eq('account_id', accountId)
    if (q) query = query.ilike('description', `%${q}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })

    return NextResponse.json({ ok: true, rows: data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}


