import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 200 })
    const { data, error } = await supabase
      .from('Categories')
      .select('*')
      .order('type', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    return NextResponse.json({ ok: true, rows: data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 200 })
    const userId = session.user.id
    const row = { user_id: userId, name: String(body?.name || '').trim(), type: String(body?.type || '').toLowerCase() === 'income' ? 'income' : 'expense', enabled: body?.enabled ?? true, sort_order: Number(body?.sort_order || 0) }
    if (!row.name) return NextResponse.json({ ok: false, error: 'Name required' }, { status: 200 })
    const { error } = await supabase.from('Categories').insert(row)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}


