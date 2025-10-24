import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { id, category, createRule } = await req.json() as { id?: string, category?: string, createRule?: boolean }
    if (!id || !category) return NextResponse.json({ ok: false, error: 'Missing id/category' }, { status: 200 })
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id || null

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    // Update category first
    if (serviceKey) {
      const admin = createAdminClient(url, serviceKey)
      const { error } = await admin.from('Transactions').update({ category }).eq('id', id)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    } else {
      const { error } = await supabase.from('Transactions').update({ category }).eq('id', id)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    }

    // Fetch current tx to adjust amount sign consistently with new category
    const { data: tx } = await supabase.from('Transactions').select('description, amount').eq('id', id).maybeSingle()
    const desc = String(tx?.description || '')
    const isRefund = /refund/i.test(desc)
    const oldAmt = Number(tx?.amount ?? 0)
    const desiredAmt = (category.toLowerCase() === 'income' || isRefund) ? Math.abs(oldAmt) : -Math.abs(oldAmt)
    if (!Number.isNaN(desiredAmt) && desiredAmt !== oldAmt) {
      if (serviceKey) {
        const admin = createAdminClient(url, serviceKey)
        const { error } = await admin.from('Transactions').update({ amount: desiredAmt }).eq('id', id)
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
      } else {
        const { error } = await supabase.from('Transactions').update({ amount: desiredAmt }).eq('id', id)
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
      }
    }

    if (createRule) {
      // Fetch transaction for description
      const { data: tx } = await supabase.from('Transactions').select('description').eq('id', id).maybeSingle()
      const desc = tx?.description || ''
      if (desc) {
        if (serviceKey) {
          const admin = createAdminClient(url, serviceKey)
          await admin.from('CategoryRules').insert({ user_id: userId, field: 'description', pattern: desc.slice(0, 32), category })
        } else {
          await supabase.from('CategoryRules').insert({ user_id: userId, field: 'description', pattern: desc.slice(0, 32), category })
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}


