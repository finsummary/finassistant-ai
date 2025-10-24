import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 200 })
    const userId = session.user.id
    const update: any = {}
    if (typeof body?.name === 'string') update.name = String(body.name).trim()
    if (typeof body?.type === 'string') update.type = String(body.type).toLowerCase() === 'income' ? 'income' : 'expense'
    if (typeof body?.enabled === 'boolean') update.enabled = !!body.enabled
    if (typeof body?.sort_order !== 'undefined') update.sort_order = Number(body.sort_order)
    const { error } = await supabase.from('Categories').update(update).eq('id', params.id).in('user_id', [userId, null])
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 200 })
    const userId = session.user.id
    const { error } = await supabase.from('Categories').delete().eq('id', params.id).eq('user_id', userId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}


