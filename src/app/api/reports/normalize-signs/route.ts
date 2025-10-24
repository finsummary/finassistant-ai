import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

async function handle(req: Request) {
  try {
    const urlObj = new URL(req.url)
    const accountId = urlObj.searchParams.get('accountId')
    const dry = urlObj.searchParams.get('dry') === '1'

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 200 })

    let query = supabase
      .from('Transactions')
      .select('id, description, amount, category')
    if (accountId) query = query.eq('account_id', accountId)
    const { data: rows, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 })

    let pos = 0, neg = 0
    const updates: Array<{ id: string; amount: number }> = []
    for (const r of rows || []) {
      const desc = String((r as any).description || '')
      const isRefund = /refund/i.test(desc)
      const cat = String((r as any).category || '')
      const isIncome = cat.toLowerCase() === 'income'
      let amt = Number((r as any).amount || 0)
      if (amt >= 0) pos++; else neg++
      const desired = (isIncome || isRefund) ? Math.abs(amt) : -Math.abs(amt)
      if (amt !== desired) updates.push({ id: (r as any).id, amount: desired })
    }

    if (dry || !updates.length) return NextResponse.json({ ok: true, dryRun: dry, updated: 0, debug: { count: (rows||[]).length, pos, neg, willChange: updates.length } }, { status: 200 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    let updatedCount = 0
    if (serviceKey) {
      const admin = createAdminClient(url, serviceKey)
      for (const u of updates) {
        const { error: upErr } = await admin.from('Transactions').update({ amount: u.amount }).eq('id', u.id)
        if (upErr) return NextResponse.json({ ok: false, step: 'update-admin', id: u.id, error: upErr.message }, { status: 200 })
        updatedCount++
      }
    } else {
      for (const u of updates) {
        const { error: upErr } = await supabase.from('Transactions').update({ amount: u.amount }).eq('id', u.id)
        if (upErr) return NextResponse.json({ ok: false, step: 'update-user', id: u.id, error: upErr.message }, { status: 200 })
        updatedCount++
      }
    }

    return NextResponse.json({ ok: true, updated: updatedCount, debug: { count: (rows||[]).length, pos, neg, sample: updates.slice(0,5) } }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}

export async function POST(req: Request) { return handle(req) }
export async function GET(req: Request) { return handle(req) }
