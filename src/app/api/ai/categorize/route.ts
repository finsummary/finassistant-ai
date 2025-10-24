import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

type TxInput = { id: string; description?: string | null; merchant_name?: string | null; amount: number; currency: string; date?: string | null }

const CATEGORIES = [
  'Income','Transport','Restaurants','Cafes','Subscriptions','Groceries','Shopping','Housing','Utilities','Entertainment','Personal Care','Services','Taxes','Travel','Transfers','Cash','Home','Education','Healthcare','Other'
]

function buildPrompt(items: TxInput[]) {
  return `You are a transaction categorization engine. Map each transaction to exactly one category from this list: ${CATEGORIES.join(', ')}.
Return strict JSON with field "results" = array of objects { id, category, confidence }.
Use only the provided categories. If unsure, use "Other".
Transactions:\n` + JSON.stringify(items)
}

export async function POST() {
  try {
    const openaiKey = process.env.OPENAI_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY
    const provider = (process.env.AI_PROVIDER || (geminiKey ? 'gemini' : 'openai')).toLowerCase()
    if (provider === 'openai' && !openaiKey && !geminiKey) {
      return NextResponse.json({ ok: false, error: 'No AI key configured (OPENAI_API_KEY or GEMINI_API_KEY)' }, { status: 200 })
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 200 })

    // Take a batch of uncategorized transactions
    const { data: txs } = await supabase
      .from('Transactions')
      .select('id, description, amount, currency, booked_at, category')
      .or('category.is.null,category.eq.,category.eq.Uncategorized,category.eq.UNCATEGORIZED,category.eq.uncategorized')
      .limit(200)

    const items: TxInput[] = (txs || []).map(t => ({
      id: t.id,
      description: (t as any).description,
      amount: Number((t as any).amount || 0),
      currency: (t as any).currency || 'USD',
      date: (t as any).booked_at || null,
    }))

    if (items.length === 0) return NextResponse.json({ ok: true, updated: 0, message: 'No uncategorized transactions' }, { status: 200 })

    let parsed: any | null = null
    let lastError: any = null

    const tryOpenAI = async () => {
      const body = {
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You classify bank transactions into predefined categories.' },
          { role: 'user', content: buildPrompt(items) }
        ]
      }
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (!resp.ok) throw { provider: 'openai', data }
      try { return JSON.parse(data.choices?.[0]?.message?.content || '{}') } catch { throw { provider: 'openai-parse', data: data.choices?.[0]?.message?.content } }
    }

    const tryGemini = async () => {
      const models = ['gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.0-pro']
      const bodyBase = {
        contents: [ { role: 'user', parts: [ { text: buildPrompt(items) } ] } ],
        // For v1 models, omit responseMimeType; enforce JSON via prompt only
      }
      let last: any = null
      for (const m of models) {
        const url = `https://generativelanguage.googleapis.com/v1/models/${m}:generateContent?key=${geminiKey}`
        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyBase) })
        const data = await resp.json()
        if (!resp.ok) { last = { provider: 'gemini', model: m, data }; continue }
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
        try { return JSON.parse(text || '{}') } catch { last = { provider: 'gemini-parse', model: m, data: text }; continue }
      }
      throw last || { provider: 'gemini', data: 'unknown error' }
    }

    if (provider === 'gemini') {
      try { parsed = await tryGemini() } catch (e) { lastError = e; if (openaiKey) { try { parsed = await tryOpenAI() } catch (ee) { lastError = ee } } }
    } else {
      try { parsed = await tryOpenAI() } catch (e) { lastError = e; if (geminiKey) { try { parsed = await tryGemini() } catch (ee) { lastError = ee } } }
    }

    if (!parsed) return NextResponse.json({ ok: false, step: 'ai', details: lastError }, { status: 200 })
    const results: Array<{ id: string; category: string; confidence?: number }> = parsed?.results || []
    const threshold = 0.5
    // build case-insensitive canonical map
    const CANON: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.toLowerCase(), c]))
    const canonicalize = (cat: any): string | null => {
      const k = String(cat || '').trim().toLowerCase()
      return CANON[k] || null
    }
    const updates = results
      .filter(r => r?.id)
      .map(r => ({ id: r.id, category: canonicalize(r.category), confidence: r.confidence ?? 0.75 }))
      .filter(r => r.category && r.confidence! >= threshold)
      .map(r => ({ id: r.id, category: r.category as string }))

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

    return NextResponse.json({ ok: true, updated: updates.length }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}


