# Free Open-Source AI Models Setup

## Overview

I've added support for **free open-source AI models** as alternatives to paid providers. This gives you unlimited AI analysis without quota limits!

## Available Options

### 1. Groq (Recommended - Free API)

**Best for**: Fast, free API access to open-source models

**Models Available**:
- `llama-3.1-8b-instant` (fast, free)
- `llama-3.1-70b-versatile` (more capable)
- `mixtral-8x7b-32768` (Mistral)
- `gemma-7b-it`

**Setup**:
1. Get free API key: https://console.groq.com/
2. Add to `.env.local`:
   ```env
   GROQ_API_KEY=your-groq-api-key-here
   GROQ_MODEL=llama-3.1-8b-instant  # Optional, defaults to llama-3.1-8b-instant
   ```

**Benefits**:
- ✅ Completely free
- ✅ Very fast (uses special chips)
- ✅ No daily limits
- ✅ Multiple model options
- ✅ No local setup required

### 2. Ollama (Local - Completely Free)

**Best for**: Privacy, offline use, unlimited requests

**Models Available**:
- `llama3.1:8b` (default)
- `llama3.1:70b`
- `mistral`
- `codellama`
- And many more...

**Setup**:
1. Install Ollama: https://ollama.ai/
2. Pull a model:
   ```bash
   ollama pull llama3.1:8b
   ```
3. Add to `.env.local`:
   ```env
   OLLAMA_BASE_URL=http://localhost:11434  # Default Ollama URL
   OLLAMA_MODEL=llama3.1:8b  # Optional, defaults to llama3.1:8b
   ```

**Benefits**:
- ✅ Completely free
- ✅ No API limits
- ✅ Works offline
- ✅ Privacy (data stays local)
- ✅ Multiple model options

**Note**: Requires local installation and running Ollama service

## Priority Order

The system will try providers in this order:
1. **OpenAI** (if configured)
2. **Claude** (if configured)
3. **Groq** (free open-source) ⭐
4. **Gemini** (if configured)
5. **Ollama** (local open-source) ⭐

## Recommended Setup

For maximum reliability with free options:

```env
# Paid (if available)
OPENAI_API_KEY=sk-...

# Free open-source (recommended)
GROQ_API_KEY=your-groq-key

# Optional: Local fallback
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Preferred provider (optional)
AI_PROVIDER=groq  # Use Groq first
```

## How It Works

1. System tries providers in priority order
2. If one fails (quota/error), automatically tries next
3. Groq and Ollama are free, so they won't hit quota limits
4. You get unlimited AI analysis! 🎉

## Getting Groq API Key

1. Go to: https://console.groq.com/
2. Sign up (free)
3. Create API key
4. Copy key to `.env.local`

**No credit card required!**

## Getting Started with Ollama

1. **Install Ollama**:
   - Windows: Download from https://ollama.ai/
   - Mac: `brew install ollama`
   - Linux: `curl -fsSL https://ollama.ai/install.sh | sh`

2. **Start Ollama service**:
   ```bash
   ollama serve
   ```

3. **Pull a model**:
   ```bash
   ollama pull llama3.1:8b
   ```

4. **Add to `.env.local`**:
   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.1:8b
   ```

5. **Restart dev server**

## Model Recommendations

### For Speed (Groq)
- `llama-3.1-8b-instant` - Fastest, good quality
- `mixtral-8x7b-32768` - Balanced speed/quality

### For Quality (Ollama)
- `llama3.1:8b` - Good balance
- `llama3.1:70b` - Best quality (requires more RAM)

## Troubleshooting

### Groq not working
- Check API key is correct
- Verify key at: https://console.groq.com/
- Check model name is valid

### Ollama not working
- Ensure Ollama service is running: `ollama serve`
- Check model is pulled: `ollama list`
- Verify URL in `.env.local` matches your Ollama setup
- Check firewall allows localhost:11434

## Cost Comparison

| Provider | Cost | Limits |
|----------|------|--------|
| OpenAI | Paid | Based on usage |
| Gemini | Free tier | 20 requests/day |
| Groq | **Free** | **No limits** ⭐ |
| Ollama | **Free** | **No limits** ⭐ |

## Next Steps

1. **Get Groq API key** (easiest option)
2. **Add to `.env.local`**
3. **Restart dev server**
4. **Enjoy unlimited AI analysis!** 🚀
