import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function seed() {
  try {
    const supabase = await createClient()

    // Fetch accounts
    const { data: accounts, error: accErr } = await supabase.from('BankAccounts').select('*')
    if (accErr) return NextResponse.json({ ok: false, error: accErr.message }, { status: 200 })

    let totalInserted = 0
    for (const acc of accounts ?? []) {
      // Check existing count
      const { count } = await supabase
        .from('Transactions')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', acc.id)

      if ((count ?? 0) > 0) continue

      const rows = Array.from({ length: 25 }).map((_, idx) => {
        const daysAgo = getRandomInt(0, 330)
        const d = new Date()
        d.setDate(d.getDate() - daysAgo)
        const amount = getRandomInt(-25000, 25000) / 100 // -250.00 .. 250.00
        return {
          id: crypto.randomUUID(),
          account_id: acc.id as string,
          amount,
          currency: acc.currency || 'EUR',
          description: amount < 0 ? 'Card purchase' : 'Incoming transfer',
          booked_at: d.toISOString().slice(0, 10),
        }
      })

      const { error: insErr } = await supabase.from('Transactions').insert(rows)
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 200 })
      totalInserted += rows.length
    }

    return NextResponse.json({ ok: true, inserted: totalInserted }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}

export async function POST() {
  return seed()
}

// Для удобства тестирования разрешим и GET (в браузере)
export async function GET() {
  return seed()
}


