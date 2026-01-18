/**
 * CSV Transaction Import API
 * 
 * Handles importing transactions from CSV files uploaded by users.
 * Supports multiple date formats, amount formats (with comma or dot decimals),
 * and automatic duplicate detection based on transaction hash.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'node:crypto'
import { requireAuth, errorResponse, successResponse, ApiError } from '../_utils'

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

    const rows: Array<{ id: string; account_id: string; amount: number; currency: string; description: string | null; booked_at: string; user_id: string }> = []
    for (const it of rawItems) {
      const account_id = String(it.account_id || '').trim()
      const currency = String(it.currency || defaultCurrency || '').trim().toUpperCase()
      const booked_at = toISODate(String(it.date || ''))
      const n = toNumber(it.amount)
      if (!account_id || !currency || !booked_at || n === null) continue
      const amount = invert ? -Math.abs(n) : Number(n)
      const description = (it.description == null ? '' : String(it.description)).slice(0, 500)
      const id = makeId(userId, account_id, booked_at, description, amount)
      rows.push({ id, account_id, amount, currency, description, booked_at, user_id: userId })
    }

    if (!rows.length) {
      throw new ApiError('No valid rows after parsing. Please check your CSV format.', 400, 'VALIDATION_ERROR')
    }

    // Insert in chunks
    let upserted = 0
    let duplicates = 0
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      // Pre-check existing IDs to produce accurate "imported" count and avoid counting updates as zero
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
      const { error, data } = await supabase
        .from('Transactions')
        .insert(toInsert)
        .select('id')
      if (error) {
        throw new Error(`Database error while inserting transactions: ${error.message}`)
      }
      upserted += (Array.isArray(data) ? data.length : 0)
    }

    return successResponse({
      received: rawItems.length,
      imported: upserted,
      duplicates,
    })
  } catch (e) {
    return errorResponse(e, 'Failed to import transactions')
  }
}


