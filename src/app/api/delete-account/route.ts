import { NextResponse } from 'next/server'
import { createClient as createSSRClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { accountId } = await req.json() as { accountId?: string }
    if (!accountId) return NextResponse.json({ ok: false, error: 'Missing accountId' }, { status: 200 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (serviceKey) {
      // Use service role to bypass RLS and guarantee deletion
      const admin = createAdminClient(url, serviceKey)
      const { error: txErr } = await admin.from('Transactions').delete().eq('account_id', accountId)
      if (txErr) return NextResponse.json({ ok: false, error: txErr.message }, { status: 200 })
      const { error: accErr } = await admin.from('BankAccounts').delete().eq('id', accountId)
      if (accErr) return NextResponse.json({ ok: false, error: accErr.message }, { status: 200 })
      return NextResponse.json({ ok: true, mode: 'service' }, { status: 200 })
    }

    // Fallback: use user session (RLS must allow delete)
    const supabase = await createSSRClient()
    const { error: txErr } = await supabase.from('Transactions').delete().eq('account_id', accountId)
    if (txErr) return NextResponse.json({ ok: false, error: txErr.message }, { status: 200 })
    const { error: accErr } = await supabase.from('BankAccounts').delete().eq('id', accountId)
    if (accErr) return NextResponse.json({ ok: false, error: accErr.message }, { status: 200 })
    return NextResponse.json({ ok: true, mode: 'rls' }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}


