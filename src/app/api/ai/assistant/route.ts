import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateTrajectory } from '@/app/api/framework/_utils'

export const dynamic = 'force-dynamic'

// Build AI input contract per PRD section 8
async function buildAIContext(supabase: any, userId: string, frameworkStep?: string) {
  // Get organization
  const { data: organization } = await supabase
    .from('Organizations')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Get current transactions summary
  const { data: transactions } = await supabase
    .from('Transactions')
    .select('*')
    .eq('user_id', userId)
    .order('booked_at', { ascending: false })
    .limit(100)
    .limit(100)

  // Calculate current balance
  let currentBalance = 0
  transactions?.forEach((tx: any) => {
    currentBalance += Number(tx.amount || 0)
  })

  // Get planned items
  const { data: plannedIncome } = await supabase
    .from('PlannedIncome')
    .select('*')
    .eq('user_id', userId)

  const { data: plannedExpenses } = await supabase
    .from('PlannedExpenses')
    .select('*')
    .eq('user_id', userId)

  // Get trajectory data
  let trajectoryData = null
  try {
    trajectoryData = await calculateTrajectory(supabase, userId)
  } catch (e) {
    // Ignore errors
  }

  // Get recent transactions summary
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  let lastMonthInflow = 0
  let lastMonthOutflow = 0
  let thisMonthInflow = 0
  let thisMonthOutflow = 0

  transactions?.forEach((tx: any) => {
    const txDate = new Date(tx.booked_at)
    const amount = Number(tx.amount || 0)
    if (txDate >= lastMonth && txDate < thisMonth) {
      if (amount >= 0) lastMonthInflow += amount
      else lastMonthOutflow += Math.abs(amount)
    } else if (txDate >= thisMonth) {
      if (amount >= 0) thisMonthInflow += amount
      else thisMonthOutflow += Math.abs(amount)
    }
  })

  return {
    framework_step: frameworkStep || null,
    country: organization?.country || null,
    cash_snapshot: {
      current_balance: currentBalance,
      last_month: {
        inflow: lastMonthInflow,
        outflow: lastMonthOutflow,
        net: lastMonthInflow - lastMonthOutflow,
      },
      this_month: {
        inflow: thisMonthInflow,
        outflow: thisMonthOutflow,
        net: thisMonthInflow - thisMonthOutflow,
      },
    },
    actuals: {
      recent_transactions_count: transactions?.length || 0,
      transactions: (transactions || []).slice(0, 10).map((tx: any) => ({
        date: tx.booked_at,
        description: tx.description,
        amount: tx.amount,
        category: tx.category,
      })),
    },
    planned_items: {
      income: (plannedIncome || []).map((pi: any) => ({
        description: pi.description,
        amount: pi.amount,
        expected_date: pi.expected_date,
        recurrence: pi.recurrence,
      })),
      expenses: (plannedExpenses || []).map((pe: any) => ({
        description: pe.description,
        amount: pe.amount,
        expected_date: pe.expected_date,
        recurrence: pe.recurrence,
      })),
    },
    forecast: trajectoryData ? {
      current_balance: trajectoryData.currentBalance,
      avg_monthly_change: trajectoryData.avgMonthlyChange,
      forecast_months: trajectoryData.forecast.slice(0, 6),
      low_points: trajectoryData.lowPoints,
    } : null,
  }
}

function buildSystemPrompt(frameworkStep?: string): string {
  const basePrompt = `You are a financial guide and narrator for FinAssistant.ai, a cash-flow clarity and decision assistant for solopreneurs and small business owners.

CRITICAL RULES:
1. You are a GUIDE, NOT a calculator. You explain numbers, not calculate them.
2. You MUST use the provided framework structure: STATE → DELTA → TRAJECTORY → EXPOSURE → CHOICE
3. You can explain numbers, ask clarifying questions, generate summaries, suggest decision options, and answer questions using stored data.
4. You MUST NOT calculate numbers, invent data, give tax or legal advice, or override deterministic logic.
5. Always be helpful, clear, and focused on cash-flow clarity.

Framework Steps:
- STATE: Where am I now? (current cash position)
- DELTA: What changed? (month-over-month changes)
- TRAJECTORY: Where am I heading? (forecast and trends)
- EXPOSURE: What could break? (risks and runway)
- CHOICE: What should I do next? (decision options)

When explaining, structure your response according to the current framework step.`

  if (frameworkStep) {
    return `${basePrompt}\n\nCurrent framework step: ${frameworkStep.toUpperCase()}\nFocus your explanation on this step.`
  }

  return basePrompt
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    // Rate limiting: 20 requests per minute per user
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const rateLimit = checkRateLimit(`ai-assistant:${userId}`, 20, 60000)
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
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetAt),
          }
        }
      )
    }

    const body = await req.json().catch(() => null) as {
      question?: string
      framework_step?: string
    } | null

    const question = String(body?.question || '').trim()
    const frameworkStep = body?.framework_step || null

    if (!question) {
      return NextResponse.json({ ok: false, error: 'Question is required' }, { status: 200 })
    }

    // Check for AI provider
    const openaiKey = process.env.OPENAI_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY
    const provider = (process.env.AI_PROVIDER || (geminiKey ? 'gemini' : 'openai')).toLowerCase()

    if (provider === 'openai' && !openaiKey && !geminiKey) {
      return NextResponse.json({ ok: false, error: 'No AI key configured (OPENAI_API_KEY or GEMINI_API_KEY)' }, { status: 200 })
    }

    // Build AI context
    const context = await buildAIContext(supabase, userId, frameworkStep || undefined)

    // Build user message
    const userMessage = `Context data:\n${JSON.stringify(context, null, 2)}\n\nUser question: ${question}`

    let response: string = ''
    let error: any = null

    if (provider === 'openai' && openaiKey) {
      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: buildSystemPrompt(frameworkStep || undefined) },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        })

        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error?.message || 'OpenAI API error')
        response = data.choices?.[0]?.message?.content || 'No response from AI'
      } catch (e: any) {
        error = e
      }
    }

    if (!response && geminiKey) {
      try {
        // First, try to list available models
        let availableModels: string[] = []
        try {
          const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${geminiKey}`
          console.log(`[AI Assistant] Listing available Gemini models...`)
          const listResp = await fetch(listUrl)
          const listData = await listResp.json()
          if (listResp.ok && listData.models) {
            availableModels = listData.models
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m: any) => m.name.replace('models/', ''))
            console.log(`[AI Assistant] Available Gemini models:`, availableModels.slice(0, 5))
          }
        } catch (e: any) {
          console.error(`[AI Assistant] ListModels exception:`, e.message)
        }

        // Use only available models from the list, or fallback to known working models
        const modelsToTry = availableModels.length > 0 
          ? availableModels 
          : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.5-pro']
        
        const bodyBase = {
          contents: [{
            role: 'user',
            parts: [{
              text: `${buildSystemPrompt(frameworkStep || undefined)}\n\n${userMessage}`,
            }],
          }],
        }

        let lastError: any = null
        for (const model of modelsToTry) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${geminiKey}`
            console.log(`[AI Assistant] Trying model: ${model}`)
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyBase),
            })

            const data = await resp.json()
            if (!resp.ok) {
              const errorMsg = data.error?.message || data.message || 'Unknown error'
              console.log(`[AI Assistant] Model ${model} failed:`, errorMsg)
              
              // Check for leaked key error
              if (errorMsg.includes('leaked') || errorMsg.includes('reported')) {
                throw new Error('API key was reported as leaked. Please generate a new API key in Google AI Studio.')
              }
              
              lastError = new Error(errorMsg)
              continue
            }
            
            response = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI'
            console.log(`[AI Assistant] Model ${model} success, response length:`, response.length)
            break // Success, exit loop
          } catch (e: any) {
            // If it's a leaked key error, throw immediately
            if (e.message && e.message.includes('leaked')) {
              throw e
            }
            console.error(`[AI Assistant] Model ${model} exception:`, e.message || e)
            lastError = e
          }
        }

        if (!response && lastError) {
          throw lastError
        }
      } catch (e: any) {
        error = e
      }
    }

    if (!response) {
      return NextResponse.json({
        ok: false,
        error: error?.message || 'Failed to get AI response. Please check your API keys.',
      }, { status: 200 })
    }

    return NextResponse.json({
      ok: true,
      response,
      framework_step: frameworkStep,
    }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 })
  }
}
