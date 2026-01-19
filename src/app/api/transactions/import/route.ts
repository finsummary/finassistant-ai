/**
 * CSV Transaction Import API
 * 
 * Handles importing transactions from CSV files uploaded by users.
 * Supports multiple date formats, amount formats (with comma or dot decimals),
 * and automatic duplicate detection based on transaction hash.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { requireAuth, errorResponse, successResponse, ApiError } from '../../_utils'

type CsvItem = {
  date?: string
  description?: string | null
  amount?: number | string
  currency?: string
  account_id?: string
}

/**
 * Convert various date formats to ISO date string (YYYY-MM-DD)
 * Supports:
 * - ISO format: 2025-01-15
 * - D-M-Y or M-D-Y: 15-01-2025 or 01-15-2025
 * - Various separators: /, -, .
 */
function toISODate(input: string): string | null {
  if (!input) return null
  const s = String(input).trim()
  // Normalize common separators
  const t = s.replace(/\./g, '-').replace(/\//g, '-')
  // ISO-like
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) {
    const d = new Date(t)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
  }
  // D-M-Y or M-D-Y → assume D-M-Y if first > 12
  const m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (m) {
    const a = Number(m[1]), b = Number(m[2]), c = Number(m[3])
    const yyyy = c < 100 ? 2000 + c : c
    const isDMY = a > 12 || (a <= 12 && b <= 12 && a > b)
    const dd = String(isDMY ? a : b).padStart(2,'0')
    const mm = String(isDMY ? b : a).padStart(2,'0')
    const d = new Date(`${yyyy}-${mm}-${dd}`)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
  }
  // Fallback
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
  return null
}

/**
 * Parse amount from various formats
 * Handles:
 * - Comma as decimal separator (European format): 1.234,56
 * - Dot as decimal separator (US format): 1,234.56
 * - Negative amounts with minus sign
 */
function toNumber(input: any): number | null {
  if (typeof input === 'number' && isFinite(input)) return input
  const s = String(input ?? '').replace(/[^0-9.,\-]/g, '').trim()
  if (!s) return null
  // Handle comma as decimal
  const normalized = (s.match(/,\d{1,2}$/)) ? s.replace('.', '').replace(',', '.') : s.replace(/,/g, '')
  const n = Number(normalized)
  return isFinite(n) ? n : null
}

/**
 * Generate unique transaction ID based on transaction details
 * Uses SHA-256 hash to ensure uniqueness and detect duplicates
 */
function makeId(userId: string, accountId: string, bookedAt: string, description: string, amount: number): string {
  const key = `${userId}|${accountId}|${bookedAt}|${description}|${amount}`
  return createHash('sha256').update(key).digest('hex')
}

/**
 * AI Categorization helper function
 * Categorizes transactions using OpenAI or Gemini
 */
async function categorizeTransactionsWithAI(
  transactions: Array<{ id: string; description: string | null; amount: number; currency: string; booked_at: string }>,
  userId: string
): Promise<{ ok: boolean; categories?: Array<{ id: string; category: string }>; error?: string }> {
  try {
    const openaiKey = process.env.OPENAI_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY
    const provider = (process.env.AI_PROVIDER || (geminiKey ? 'gemini' : 'openai')).toLowerCase()
    
    console.log(`[Import AI] Provider: ${provider}, Gemini key: ${geminiKey ? 'SET (' + geminiKey.substring(0, 10) + '...)' : 'MISSING'}, OpenAI key: ${openaiKey ? 'SET' : 'MISSING'}`)
    
    if (provider === 'openai' && !openaiKey && !geminiKey) {
      return { ok: false, error: 'No AI key configured' }
    }
    
    if (provider === 'gemini' && !geminiKey) {
      console.error('[Import AI] Gemini provider selected but GEMINI_API_KEY is missing')
      return { ok: false, error: 'GEMINI_API_KEY is missing' }
    }

    const CATEGORIES = [
      'Income','Transport','Restaurants','Cafes','Subscriptions','Groceries','Shopping','Housing','Utilities','Entertainment','Personal Care','Services','Taxes','Travel','Transfers','Cash','Home','Education','Healthcare','Other'
    ]

    const buildPrompt = (items: typeof transactions) => {
      return `You are a transaction categorization engine. Map each transaction to exactly one category from this list: ${CATEGORIES.join(', ')}.
Return strict JSON with field "results" = array of objects { id, category, confidence }.
Use only the provided categories. If unsure, use "Other".
\n` + JSON.stringify(items.map(t => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        currency: t.currency,
        date: t.booked_at
      })))
    }

    const items = transactions.map(t => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      currency: t.currency,
      date: t.booked_at
    }))

    let parsed: any | null = null
    let lastError: any = null

    const tryOpenAI = async () => {
      const body = {
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You classify bank transactions into predefined categories.' },
          { role: 'user', content: buildPrompt(transactions) }
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
      // First, try to list available models
      try {
        const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${geminiKey}`
        console.log(`[Import AI] Listing available Gemini models...`)
        const listResp = await fetch(listUrl)
        const listData = await listResp.json()
        if (listResp.ok && listData.models) {
          const availableModels = listData.models
            .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => m.name.replace('models/', ''))
          console.log(`[Import AI] Available Gemini models:`, availableModels.slice(0, 5))
          if (availableModels.length > 0) {
            // Use the first available model
            const model = availableModels[0]
            const bodyBase = {
              contents: [ { role: 'user', parts: [ { text: buildPrompt(transactions) } ] } ],
            }
            const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${geminiKey}`
            console.log(`[Import AI] Using model: ${model}`)
            const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyBase) })
            const data = await resp.json()
            if (!resp.ok) {
              console.error(`[Import AI] GenerateContent failed:`, data.error?.message || data)
              throw { provider: 'gemini', model, data }
            }
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
            console.log(`[Import AI] Success, response length:`, text.length)
            // Extract JSON from markdown code block if present
            let jsonText = text.trim()
            if (jsonText.startsWith('```')) {
              // Remove markdown code block markers
              jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
            }
            console.log(`[Import AI] Parsing JSON, first 100 chars:`, jsonText.substring(0, 100))
            return JSON.parse(jsonText || '{}')
          }
        } else {
          console.warn(`[Import AI] Failed to list models:`, listData.error?.message || listData)
        }
      } catch (e: any) {
        console.error(`[Import AI] ListModels exception:`, e.message)
      }

      // Fallback: try common model names
      const models = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.5-pro']
      const bodyBase = {
        contents: [ { role: 'user', parts: [ { text: buildPrompt(transactions) } ] } ],
      }
      let last: any = null
      for (const m of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1/models/${m}:generateContent?key=${geminiKey}`
          console.log(`[Import AI] Trying fallback model: ${m}`)
          const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyBase) })
          const data = await resp.json()
          if (!resp.ok) { 
            console.log(`[Import AI] Model ${m} failed:`, data.error?.message || data)
            last = { provider: 'gemini', model: m, data }; 
            continue 
          }
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          console.log(`[Import AI] Model ${m} success`)
          // Extract JSON from markdown code block if present
          let jsonText = text.trim()
          if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
          }
          return JSON.parse(jsonText || '{}')
        } catch (e: any) {
          console.error(`[Import AI] Model ${m} exception:`, e.message)
          last = { provider: 'gemini', model: m, error: e.message }
          continue
        }
      }
      throw last || { provider: 'gemini', data: 'No models available' }
    }

    if (provider === 'gemini') {
      try { parsed = await tryGemini() } catch (e) { lastError = e; if (openaiKey) { try { parsed = await tryOpenAI() } catch (ee) { lastError = ee } } }
    } else {
      try { parsed = await tryOpenAI() } catch (e) { lastError = e; if (geminiKey) { try { parsed = await tryGemini() } catch (ee) { lastError = ee } } }
    }

    if (!parsed) {
      console.error('[Import AI] Failed to parse AI response:', lastError)
      return { ok: false, error: String(lastError) }
    }

    console.log('[Import AI] Parsed AI response:', { resultsCount: parsed?.results?.length })
    const results: Array<{ id: string; category: string; confidence?: number }> = parsed?.results || []
    const threshold = 0.5
    const CANON: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.toLowerCase(), c]))
    const canonicalize = (cat: any): string | null => {
      const k = String(cat || '').trim().toLowerCase()
      return CANON[k] || null
    }
    const categories = results
      .filter(r => r?.id)
      .map(r => ({ id: r.id, category: canonicalize(r.category), confidence: r.confidence ?? 0.75 }))
      .filter(r => r.category && r.confidence! >= threshold)
      .map(r => ({ id: r.id, category: r.category as string }))

    console.log(`[Import AI] Processed ${categories.length} categories from ${results.length} results`)
    console.log('[Import AI] Sample categories:', categories.slice(0, 3))

    return { ok: true, categories }
  } catch (e: any) {
    return { ok: false, error: String(e) }
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const userId = await requireAuth()
    const supabase = await createClient()

    // Rate limiting: 10 imports per hour per user
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const rateLimit = checkRateLimit(`csv-import:${userId}`, 10, 3600000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          ok: false, 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetAt),
          }
        }
      )
    }

    const body = await req.json().catch(() => ({})) as { items?: CsvItem[], defaultCurrency?: string, invertSign?: boolean }
    const rawItems = body?.items || []
    const defaultCurrency = String(body?.defaultCurrency || '').trim().toUpperCase()
    const invert = !!body?.invertSign

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new ApiError('No items provided', 400, 'VALIDATION_ERROR')
    }
    if (rawItems.length > 5000) {
      throw new ApiError('Too many rows (limit 5000)', 400, 'VALIDATION_ERROR')
    }

    const rows: Array<{ id: string; account_id: string; amount: number; currency: string; description: string | null; booked_at: string; user_id: string; category: string | null }> = []
    for (const it of rawItems) {
      const account_id = String(it.account_id || '').trim()
      const currency = String(it.currency || defaultCurrency || '').trim().toUpperCase()
      const booked_at = toISODate(String(it.date || ''))
      const n = toNumber(it.amount)
      if (!account_id || !currency || !booked_at || n === null) continue
      const amount = invert ? -Math.abs(n) : Number(n)
      const description = (it.description == null ? '' : String(it.description)).slice(0, 500)
      const id = makeId(userId, account_id, booked_at, description, amount)
      rows.push({ id, account_id, amount, currency, description, booked_at, user_id: userId, category: null })
    }

    if (!rows.length) {
      throw new ApiError('No valid rows after parsing. Please check your CSV format.', 400, 'VALIDATION_ERROR')
    }

    // Step 1: Categorize transactions with AI BEFORE saving to database
    let categorizedRows = rows
    console.log(`[Import] Starting AI categorization for ${rows.length} transactions`)
    try {
      const aiResult = await categorizeTransactionsWithAI(rows, userId)
      console.log(`[Import] AI result:`, { ok: aiResult.ok, categoriesCount: aiResult.categories?.length, error: aiResult.error })
      if (aiResult.ok && aiResult.categories && aiResult.categories.length > 0) {
        // Map AI categories back to rows
        const categoryMap = new Map(aiResult.categories.map((c: any) => [c.id, c.category]))
        categorizedRows = rows.map(row => {
          const aiCategory = categoryMap.get(row.id)
          return {
            ...row,
            category: aiCategory || null // Use AI category or null
          }
        })
        console.log(`[Import] Applied ${aiResult.categories.length} categories from AI`)
        console.log(`[Import] Sample categories:`, categorizedRows.slice(0, 3).map(r => ({ id: r.id, description: r.description?.slice(0, 30), category: r.category })))
      } else {
        console.warn(`[Import] AI categorization failed or returned no categories, importing with null categories`)
      }
    } catch (e) {
      // If AI fails, continue with null categories
      console.error('[Import] AI categorization exception:', e)
    }

    // Step 2: Insert transactions WITH categories already set
    let upserted = 0
    let duplicates = 0
    for (let i = 0; i < categorizedRows.length; i += 500) {
      const chunk = categorizedRows.slice(i, i + 500)
      // Pre-check existing IDs
      const ids = chunk.map(r => r.id)
      const { data: existing, error: existErr } = await supabase
        .from('Transactions')
        .select('id')
        .in('id', ids)
      if (existErr) {
        throw new Error(`Database error while checking existing transactions: ${existErr.message}`)
      }
      const existingSet = new Set((existing || []).map(r => (r as any).id))
      const toInsert = chunk.filter(r => !existingSet.has(r.id))
      duplicates += (chunk.length - toInsert.length)
      if (toInsert.length === 0) continue
      
      // Insert with categories already set
      console.log(`[Import] Inserting ${toInsert.length} transactions`)
      console.log(`[Import] Sample BEFORE insert:`, toInsert.slice(0, 3).map(t => ({ id: t.id.substring(0, 8), category: t.category, description: t.description?.slice(0, 30) })))
      const { error, data } = await supabase
        .from('Transactions')
        .insert(toInsert)
        .select('id, category, description')
      if (error) {
        console.error(`[Import] Insert error:`, error)
        throw new Error(`Database error while inserting transactions: ${error.message}`)
      }
      const inserted = Array.isArray(data) ? data.length : 0
      upserted += inserted
      console.log(`[Import] Inserted ${inserted} transactions`)
      console.log(`[Import] Sample AFTER insert:`, data?.slice(0, 3).map((t: any) => ({ id: t.id.substring(0, 8), category: t.category, description: t.description?.slice(0, 30) })))
      
      // Verify categories were saved correctly
      if (data && data.length > 0) {
        const healthcareCount = data.filter((t: any) => t.category === 'Healthcare').length
        if (healthcareCount > 0) {
          console.error(`[Import] WARNING: ${healthcareCount} transactions have Healthcare category after insert!`)
          console.error(`[Import] This suggests a database trigger or default is overwriting categories`)
        }
      }
    }

    return successResponse({
      received: rawItems.length,
      imported: upserted,
      duplicates,
      categorized: categorizedRows.filter(r => r.category).length,
    })
  } catch (e) {
    return errorResponse(e, 'Failed to import transactions')
  }
}


