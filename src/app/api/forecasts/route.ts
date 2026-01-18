import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ForecastItem = { month: string; key: string; value: number }

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 200 })

    const { data, error } = await supabase
      .from('Forecasts')
      .select('month, key, value')
      .order('month', { ascending: true })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })

    return NextResponse.json({ ok: true, rows: data || [] }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items: ForecastItem[] = Array.isArray(body?.items) ? body.items : []
    if (!items.length) return NextResponse.json({ ok: false, error: 'No items' }, { status: 200 })

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 200 })

    const rows = items.map(it => ({ user_id: userId, month: it.month, key: it.key, value: Number(it.value || 0) }))
    const { error } = await supabase.from('Forecasts').upsert(rows, { onConflict: 'user_id,month,key' })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })

    return NextResponse.json({ ok: true, upserted: rows.length }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}





