import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const DEFAULT_RULES = [
  // Transport
  { field: 'description', pattern: 'uber', category: 'Transport' },
  { field: 'description', pattern: 'taxi', category: 'Transport' },
  { field: 'description', pattern: 'trainline', category: 'Transport' },
  { field: 'description', pattern: 'rail', category: 'Transport' },
  { field: 'description', pattern: 'bolt', category: 'Transport' },
  { field: 'description', pattern: 'lyft', category: 'Transport' },
  { field: 'description', pattern: 'shell', category: 'Transport' },
  { field: 'description', pattern: 'bp', category: 'Transport' },
  { field: 'description', pattern: 'esso', category: 'Transport' },
  { field: 'description', pattern: 'fuel', category: 'Transport' },
  { field: 'description', pattern: 'petrol', category: 'Transport' },
  // Cafes/Restaurants
  { field: 'description', pattern: 'coffee', category: 'Cafes' },
  { field: 'description', pattern: 'starbucks', category: 'Cafes' },
  { field: 'description', pattern: 'pret', category: 'Cafes' },
  { field: 'description', pattern: 'costa', category: 'Cafes' },
  { field: 'description', pattern: 'restaurant', category: 'Restaurants' },
  { field: 'description', pattern: 'mcdonald', category: 'Restaurants' },
  { field: 'description', pattern: 'kfc', category: 'Restaurants' },
  { field: 'description', pattern: 'deliveroo', category: 'Restaurants' },
  { field: 'description', pattern: 'ubereats', category: 'Restaurants' },
  // Subscriptions
  { field: 'description', pattern: 'netflix', category: 'Subscriptions' },
  { field: 'description', pattern: 'spotify', category: 'Subscriptions' },
  { field: 'description', pattern: 'youtube', category: 'Subscriptions' },
  { field: 'description', pattern: 'prime', category: 'Subscriptions' },
  { field: 'description', pattern: 'itunes', category: 'Subscriptions' },
  // Shopping
  { field: 'description', pattern: 'amazon', category: 'Shopping' },
  { field: 'description', pattern: 'ebay', category: 'Shopping' },
  { field: 'description', pattern: 'monzo', category: 'Transfers' },
  // Groceries
  { field: 'description', pattern: 'tesco', category: 'Groceries' },
  { field: 'description', pattern: 'sainsbury', category: 'Groceries' },
  { field: 'description', pattern: 'asda', category: 'Groceries' },
  { field: 'description', pattern: 'aldi', category: 'Groceries' },
  { field: 'description', pattern: 'lidl', category: 'Groceries' },
  { field: 'description', pattern: 'hellofresh', category: 'Groceries' },
  // Housing/Utilities
  { field: 'description', pattern: 'mortgage', category: 'Housing' },
  { field: 'description', pattern: 'rent', category: 'Housing' },
  { field: 'description', pattern: 'council', category: 'Utilities' },
  { field: 'description', pattern: 'edf', category: 'Utilities' },
  { field: 'description', pattern: 'octopus', category: 'Utilities' },
  { field: 'description', pattern: 'thames water', category: 'Utilities' },
  // Taxes
  { field: 'description', pattern: 'hmrc', category: 'Taxes' },
  { field: 'description', pattern: 'revenue and customs', category: 'Taxes' },
  { field: 'description', pattern: 'revenue', category: 'Taxes' },
  // Personal care / Entertainment / Travel
  { field: 'description', pattern: 'spa', category: 'Personal Care' },
  { field: 'description', pattern: 'hotel', category: 'Entertainment' },
  { field: 'description', pattern: 'airbnb', category: 'Travel' },
  { field: 'description', pattern: 'booking.com', category: 'Travel' },
  // Income / Transfers
  { field: 'description', pattern: 'salary', category: 'Income' },
  { field: 'description', pattern: 'payroll', category: 'Income' },
  { field: 'description', pattern: 'transfer', category: 'Transfers' },
]

function normalize(s: any) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
}

function categorizeHeuristic(text: string, amount: number): string | null {
  const t = text
  // Try default rules first via includes
  for (const r of DEFAULT_RULES) {
    if (t.includes(normalize(r.pattern))) return r.category
  }
  // Amount-based fallback
  if (amount > 0) return 'Income'
  return null
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 200 })

    // Fetch rules (user + global)
    const { data: userRules } = await supabase.from('CategoryRules').select('*').or(`user_id.eq.${userId},user_id.is.null`).eq('enabled', true)
    const rules = [...DEFAULT_RULES, ...((userRules || []).map(r => ({ field: r.field, pattern: r.pattern, category: r.category })))]

    // Fetch uncategorized transactions (treat NULL, empty string, and literal 'Uncategorized' as uncategorized)
    const { data: txs } = await supabase
      .from('Transactions')
      .select('id, description, amount, currency, category')
      .or('category.is.null,category.eq.,category.eq.Uncategorized,category.ilike.*uncategorized*')
    const updates: any[] = []
    let cntNull = 0, cntEmpty = 0, cntUncat = 0
    for (const t of txs || []) {
      const catRaw = (t as any).category
      if (catRaw == null) cntNull++
      else if (String(catRaw) === '') cntEmpty++
      else if (String(catRaw).toLowerCase().includes('uncategorized')) cntUncat++
      const text = normalize(t.description)
      let cat: string | null = null
      for (const r of rules) {
        const hay = r.field === 'description' ? text : text
        if (hay.includes(normalize(r.pattern))) { cat = r.category; break }
      }
      if (!cat) cat = categorizeHeuristic(text, t.amount)
      // Final fallback to avoid leaving it uncategorized
      if (!cat) cat = 'Other'
      if (cat) updates.push({ id: t.id, category: cat })
    }

    if (updates.length) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceKey) {
        const admin = createAdminClient(url, serviceKey)
        await admin.from('Transactions').upsert(updates, { onConflict: 'id' })
      } else {
        await supabase.from('Transactions').upsert(updates, { onConflict: 'id' })
      }
    }

    return NextResponse.json({ ok: true, updated: updates.length, debug: { cntNull, cntEmpty, cntUncat, scanned: (txs||[]).length } }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}

// Для удобства тестирования можно вызвать в браузере (GET)
export async function GET() {
  return POST()
}


