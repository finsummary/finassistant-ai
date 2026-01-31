# Fix: Gemini Daily Quota Exceeded (22/20 requests)

## Current Situation

- **Gemini**: 22/20 requests per day (exceeded daily limit)
- **OpenAI**: 0 usage (not being used)

## Problem

The system is trying to use Gemini first (because `AI_PROVIDER=gemini` in `.env.local`), but Gemini has exceeded its daily limit. OpenAI should be used as fallback, but it's not being called.

## Solution

### Option 1: Change Preferred Provider (Recommended)

Edit `.env.local` and change:
```env
AI_PROVIDER=openai
```

Or remove the line entirely to use default priority (OpenAI → Gemini).

**Then restart dev server:**
```bash
# Stop server (Ctrl+C)
cd finassistant-ai
npm run dev
```

### Option 2: Wait for Gemini Reset

Gemini daily limit resets at **midnight Pacific Time (PST/PDT)**.

You can check when it resets:
- Go to: https://ai.dev/rate-limit
- Look for "Daily limit" reset time

### Option 3: Upgrade Gemini Plan

If you need more than 20 requests/day:
1. Go to: https://aistudio.google.com/
2. Set up billing
3. Upgrade to paid plan

## Why OpenAI Isn't Being Used

The system respects `AI_PROVIDER=gemini` setting, which puts Gemini first in the provider list. When Gemini fails, it should fallback to OpenAI, but:

1. **If Gemini is in cooldown**: It's excluded from the list, so OpenAI should be used
2. **If Gemini error is temporary rate limit**: System doesn't mark it in cooldown, so it tries Gemini again

## Updated Logic

I've updated the system to:
- **Detect daily quota exceeded**: If error mentions "daily", "per day", "RPD", or "limit: 20", mark as quota error
- **Put Gemini in cooldown**: When daily quota is exceeded, Gemini will be in cooldown for 5 minutes (or until server restart)
- **Auto-fallback to OpenAI**: System will automatically use OpenAI when Gemini is in cooldown

## Check Your Configuration

Verify `.env.local` has:
```env
OPENAI_API_KEY=sk-...  # Must be set
GEMINI_API_KEY=...     # Optional
AI_PROVIDER=openai     # Change from 'gemini' to 'openai'
```

## After Making Changes

1. **Restart dev server** (required for `.env.local` changes)
2. **Check logs** - you should see:
   ```
   [AI Call] Attempting ... analysis with 2 provider(s): openai, gemini
   ```
3. **Try AI analysis again** - should use OpenAI now

## Monitor Usage

- **Gemini**: https://ai.dev/rate-limit
- **OpenAI**: https://platform.openai.com/usage
