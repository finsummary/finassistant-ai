# AI Provider Quota Limits and Usage

## Overview

This document explains how AI provider quotas work and where you can check your usage.

## Gemini (Google)

### Free Tier Limits
- **Daily limit**: 20 requests per day
- **Reset time**: Midnight Pacific Time (PST/PDT)
- **Rate limit**: Temporary rate limits may apply (e.g., "retry in 30 seconds")

### Where to Check Usage
1. **Google AI Studio**: https://aistudio.google.com/
2. **API Dashboard**: https://ai.dev/rate-limit
3. **Documentation**: https://ai.google.dev/gemini-api/docs/rate-limits

### What Happens When Limit is Reached
- **Temporary rate limit**: "Please retry in X seconds" - wait for the specified time
- **Daily quota exceeded**: Wait until midnight Pacific Time for reset
- **Solution**: Upgrade to paid plan or wait for daily reset

## OpenAI

### Free Tier Limits
- **No free tier** - requires paid account
- **Rate limits**: Vary by plan (see OpenAI dashboard)

### Where to Check Usage
1. **OpenAI Dashboard**: https://platform.openai.com/usage
2. **API Keys**: https://platform.openai.com/api-keys
3. **Billing**: https://platform.openai.com/account/billing

### What Happens When Limit is Reached
- **Rate limit**: Temporary, usually resets quickly
- **Quota exceeded**: Check billing/usage in dashboard
- **Solution**: Upgrade plan or wait for rate limit reset

## Claude (Anthropic)

### Free Tier Limits
- **No free tier** - requires paid account
- **Rate limits**: Vary by plan

### Where to Check Usage
1. **Anthropic Console**: https://console.anthropic.com/
2. **Usage Dashboard**: Check in console for API usage

## How Our System Handles Limits

### Temporary Rate Limits (< 10 minutes)
- **Behavior**: System does NOT mark provider in cooldown
- **Action**: Automatically tries next available provider
- **Retry**: Can retry immediately with next provider

### Permanent Quota Errors
- **Behavior**: System marks provider in cooldown for 5 minutes
- **Action**: Automatically tries next available provider
- **Retry**: Provider will be available again after 5 minutes

### All Providers in Cooldown
- **Behavior**: Shows rule-based insights instead of AI analysis
- **Action**: Wait for cooldown to expire or add more API keys
- **Retry**: Click "Refresh Analysis" button after waiting

## Recommendations

1. **Use Multiple Providers**: Configure both OpenAI and Gemini for automatic fallback
2. **Monitor Usage**: Check provider dashboards regularly
3. **Upgrade Plans**: If you hit limits frequently, consider upgrading
4. **Cache Results**: Our system caches AI analysis for 7 days to reduce API calls

## Current Configuration

Check your `.env.local` file:
```env
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
AI_PROVIDER=openai  # Optional: preferred provider
```

## Troubleshooting

### "All AI providers exceeded quota"
- **Cause**: Both providers are in cooldown or have exceeded limits
- **Solution**: 
  1. Wait 5 minutes for cooldown to expire
  2. Check provider dashboards for actual quota status
  3. Add more API keys (e.g., Claude)
  4. Restart dev server to clear in-memory cooldown cache

### "Temporary rate limit"
- **Cause**: Provider has temporary rate limit (e.g., "retry in 30 seconds")
- **Solution**: Wait for the specified time, system will automatically retry

### "Daily quota exceeded" (Gemini)
- **Cause**: Reached 20 requests/day limit on Gemini free tier
- **Solution**: 
  1. Wait until midnight Pacific Time
  2. Use OpenAI instead (if configured)
  3. Upgrade Gemini to paid plan
