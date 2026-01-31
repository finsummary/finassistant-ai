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
  
  // Extract date from datetime format (e.g., "2026-01-12 02:48:31" -> "2026-01-12")
  const dateTimeMatch = s.match(/^(\d{4}-\d{1,2}-\d{1,2})(?:\s+\d{1,2}:\d{1,2}:\d{1,2})?/)
  if (dateTimeMatch) {
    const datePart = dateTimeMatch[1]
    const d = new Date(datePart)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
  }
  
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
 * Categorizes transactions using all available AI providers (OpenAI, Gemini, Groq, Ollama, Claude)
 * Uses the universal callAI utility for automatic fallback
 * Automatically batches large transaction lists to avoid token limits (especially for Groq)
 */
async function categorizeTransactionsWithAI(
  transactions: Array<{ id: string; description: string | null; amount: number; currency: string; booked_at: string }>,
  userId: string
): Promise<{ ok: boolean; categories?: Array<{ id: string; category: string }>; error?: string }> {
  try {
    const CATEGORIES = [
      'Income','Transport','Restaurants','Cafes','Subscriptions','Groceries','Shopping','Housing','Utilities','Entertainment','Personal Care','Services','Taxes','Travel','Transfers','Cash','Home','Education','Healthcare','Other'
    ]

    const items = transactions.map(t => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      currency: t.currency,
      date: t.booked_at
    }))

    const systemPrompt = `You are a transaction categorization engine. Map each transaction to exactly one category from this list: ${CATEGORIES.join(', ')}.
Return strict JSON with field "results" = array of objects { id, category, confidence }.
Use only the provided categories. If unsure, use "Other".
Each result must have: id (string), category (string from the list), confidence (number 0-1).`

    // Use the universal callAI utility which supports all providers with automatic fallback
    const { callAI } = await import('@/lib/ai-call')
    
    // Batch size: ~30 transactions per batch to stay well under Groq's 6000 TPM limit
    // Each transaction is ~100-150 tokens, so 30 transactions = ~3000-4500 tokens
    // This leaves room for system prompt and response, staying safely under 6000 TPM
    const BATCH_SIZE = 30
    const allCategories: Array<{ id: string; category: string }> = []
    let lastRetryWait = 0 // Track retry wait time from last error
    
    console.log(`[Import AI] Starting categorization for ${items.length} transactions in batches of ${BATCH_SIZE}`)
    
    // Process transactions in batches
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(items.length / BATCH_SIZE)
      
      console.log(`[Import AI] Processing batch ${batchNumber}/${totalBatches} (${batch.length} transactions)`)
      
      // If we have a retry wait time from previous error, wait before processing next batch
      if (lastRetryWait > 0) {
        const waitSeconds = Math.ceil(lastRetryWait)
        console.log(`[Import AI] Waiting ${waitSeconds}s before batch ${batchNumber} due to rate limit...`)
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))
        lastRetryWait = 0 // Reset after waiting
      }
      
      const userPrompt = `Categorize these ${batch.length} transactions:\n\n${JSON.stringify(batch, null, 2)}`
      
      let parsed: any
      try {
        const result = await callAI({
          systemPrompt,
          userPrompt,
          maxTokens: 3000, // Reduced per batch since we're processing smaller chunks
          temperature: 0.3, // Lower temperature for more consistent categorization
          section: `transaction-import-batch-${batchNumber}`
        })
        parsed = result.result
        console.log(`[Import AI] Batch ${batchNumber} success with provider: ${result.provider}`)
        lastRetryWait = 0 // Reset on success
      } catch (e: any) {
        const errorMessage = e?.message || String(e || '')
        console.error(`[Import AI] Batch ${batchNumber} failed:`, errorMessage)
        
        // Extract retry times from error message
        // Groq format: "Rate limit reached... Please try again in 17.02s"
        // Gemini format: "Please retry in 55.9s"
        // We want to use the SHORTEST retry time to proceed faster
        let minRetryTime: number | null = null
        
        // Try Groq format first (usually shorter)
        const groqRetryMatch = errorMessage.match(/Rate limit reached.*?Please try again in (\d+(?:\.\d+)?)\s*(?:second|sec|s)/i)
        if (groqRetryMatch) {
          minRetryTime = parseFloat(groqRetryMatch[1])
        }
        
        // Also check for general retry patterns (Gemini, etc.)
        const allRetryMatches = errorMessage.matchAll(/(?:try again|retry) (?:in|after) (\d+(?:\.\d+)?)\s*(?:second|sec|s)/gi)
        for (const match of allRetryMatches) {
          const retryTime = parseFloat(match[1])
          if (minRetryTime === null || retryTime < minRetryTime) {
            minRetryTime = retryTime
          }
        }
        
        // Use the shortest retry time found, or progressive delay
        if (minRetryTime !== null) {
          lastRetryWait = minRetryTime
          console.log(`[Import AI] Rate limit detected. Will wait ${Math.ceil(lastRetryWait)}s before next batch`)
        } else {
          // If no retry time specified, use a progressive delay
          // Increase delay with each failed batch to avoid hammering the API
          lastRetryWait = Math.min(5 + (batchNumber - 1) * 1, 30) // Max 30 seconds
          console.log(`[Import AI] No retry time found. Using progressive delay: ${lastRetryWait}s`)
        }
        
        // If one batch fails, continue with other batches but log the error
        // We'll return partial results if some batches succeed
        continue
      }

      if (!parsed || !parsed.results) {
        console.error(`[Import AI] Batch ${batchNumber} invalid response structure:`, parsed)
        continue
      }

      const results: Array<{ id: string; category: string; confidence?: number }> = parsed?.results || []
      const threshold = 0.5
      const CANON: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.toLowerCase(), c]))
      const canonicalize = (cat: any): string | null => {
        const k = String(cat || '').trim().toLowerCase()
        return CANON[k] || null
      }
      
      const batchCategories = results
        .filter(r => r?.id)
        .map(r => ({ id: r.id, category: canonicalize(r.category), confidence: r.confidence ?? 0.75 }))
        .filter(r => r.category && r.confidence! >= threshold)
        .map(r => ({ id: r.id, category: r.category as string }))

      allCategories.push(...batchCategories)
      console.log(`[Import AI] Batch ${batchNumber} processed ${batchCategories.length} categories from ${results.length} results`)
      
      // Base delay between batches to avoid rate limits (increased from 500ms to 2s)
      // This gives Groq time to reset its TPM counter
      if (i + BATCH_SIZE < items.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // 2s delay between batches
      }
    }

    console.log(`[Import AI] Total processed ${allCategories.length} categories from ${items.length} transactions`)
    console.log('[Import AI] Sample categories:', allCategories.slice(0, 3))

    if (allCategories.length === 0) {
      return { ok: false, error: 'All batches failed. No categories could be assigned.' }
    }

    return { ok: true, categories: allCategories }
  } catch (e: any) {
    console.error('[Import AI] Exception in categorizeTransactionsWithAI:', e)
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
    // This ALWAYS runs for every import - it's automatic
    let categorizedRows = rows
    let aiCategorizationAttempted = false
    let aiCategorizationSuccess = false
    
    console.log(`[Import] Starting AI categorization for ${rows.length} transactions`)
    try {
      aiCategorizationAttempted = true
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
        aiCategorizationSuccess = true
        console.log(`[Import] ✅ Successfully applied ${aiResult.categories.length} categories from AI`)
        console.log(`[Import] Sample categories:`, categorizedRows.slice(0, 3).map(r => ({ id: r.id, description: r.description?.slice(0, 30), category: r.category })))
      } else {
        const errorMsg = aiResult.error || 'Unknown error'
        console.warn(`[Import] ⚠️ AI categorization failed: ${errorMsg}. Importing with null categories.`)
        console.warn(`[Import] Transactions will be imported but will need manual or later AI categorization.`)
      }
    } catch (e: any) {
      // If AI fails, continue with null categories but log the error
      console.error('[Import] ❌ AI categorization exception:', e.message || e)
      console.error('[Import] Transactions will be imported but will need manual or later AI categorization.')
    }

    // Step 2: Insert transactions WITH categories already set
    // Recreate Supabase client after long AI categorization process to avoid connection timeout
    console.log('[Import] Recreating Supabase client before database operations...')
    
    let upserted = 0
    let duplicates = 0
    
    // Helper function to retry database operations with exponential backoff
    async function retryDbOperation<T>(
      operation: (client: Awaited<ReturnType<typeof createClient>>) => Promise<T>,
      operationName: string,
      maxRetries: number = 3
    ): Promise<T> {
      let lastError: any = null
      let client = await createClient()
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await operation(client)
        } catch (e: any) {
          lastError = e
          const errorMessage = e?.message || String(e || '')
          const isNetworkError = errorMessage.includes('fetch failed') || 
                                errorMessage.includes('TypeError') ||
                                errorMessage.includes('network') ||
                                errorMessage.includes('ECONNREFUSED') ||
                                errorMessage.includes('ETIMEDOUT')
          
          if (isNetworkError && attempt < maxRetries) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // Exponential backoff: 1s, 2s, 4s (max 5s)
            console.warn(`[Import] ${operationName} failed (attempt ${attempt}/${maxRetries}): ${errorMessage}. Retrying in ${waitTime}ms...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            // Recreate client on retry
            client = await createClient()
            continue
          }
          throw e
        }
      }
      throw lastError
    }
    
    const DB_CHUNK_SIZE = 200
    for (let i = 0; i < categorizedRows.length; i += DB_CHUNK_SIZE) {
      const chunk = categorizedRows.slice(i, i + DB_CHUNK_SIZE)
      const toInsert = chunk
      if (toInsert.length === 0) continue

      // Upsert with ignoreDuplicates to avoid a large pre-check query
      console.log(`[Import] Upserting ${toInsert.length} transactions`)
      console.log(`[Import] Sample BEFORE upsert:`, toInsert.slice(0, 3).map(t => ({ id: t.id.substring(0, 8), category: t.category, description: t.description?.slice(0, 30) })))

      const { error, data } = await retryDbOperation(
        async (client) => {
          const result = await client
            .from('Transactions')
            .upsert(toInsert, { onConflict: 'id', ignoreDuplicates: true })
            .select('id, category, description')
          if (result.error) {
            throw new Error(result.error.message)
          }
          return result
        },
        `Upserting transactions (chunk ${Math.floor(i / DB_CHUNK_SIZE) + 1})`
      )

      if (error) {
        console.error(`[Import] Upsert error:`, error)
        throw new Error(`Database error while upserting transactions: ${error.message}`)
      }

      const inserted = Array.isArray(data) ? data.length : 0
      upserted += inserted
      const chunkDuplicates = Math.max(0, toInsert.length - inserted)
      duplicates += chunkDuplicates
      console.log(`[Import] Upserted ${inserted} transactions (duplicates: ${chunkDuplicates})`)
      console.log(`[Import] Sample AFTER upsert:`, data?.slice(0, 3).map((t: any) => ({ id: t.id.substring(0, 8), category: t.category, description: t.description?.slice(0, 30) })))

      // Verify categories were saved correctly
      if (data && data.length > 0) {
        const healthcareCount = data.filter((t: any) => t.category === 'Healthcare').length
        if (healthcareCount > 0) {
          console.error(`[Import] WARNING: ${healthcareCount} transactions have Healthcare category after upsert!`)
          console.error(`[Import] This suggests a database trigger or default is overwriting categories`)
        }
      }
    }

    const categorizedCount = categorizedRows.filter(r => r.category).length
    
    return successResponse({
      received: rawItems.length,
      imported: upserted,
      duplicates,
      categorized: categorizedCount,
      aiAttempted: aiCategorizationAttempted,
      aiSuccess: aiCategorizationSuccess,
    })
  } catch (e: any) {
    console.error('[Import] Exception in POST handler:', e)
    console.error('[Import] Error stack:', e?.stack)
    console.error('[Import] Error message:', e?.message)
    return errorResponse(e, 'Failed to import transactions')
  }
}


