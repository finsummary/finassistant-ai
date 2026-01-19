# Fixing "NetworkError" / "Failed to fetch"

## The Problem

NetworkError means the browser cannot connect to Supabase. This is usually because:
1. **Environment variables are not loaded in the browser** (most common)
2. Supabase project is paused or inactive
3. Network/firewall blocking the connection

## Solution Steps

### Step 1: Verify .env.local File

1. Check file exists: `finassistant-ai/.env.local`
2. Verify content:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://zpqhzbthcqllbfnpgptpn.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. **Important**: No spaces around `=`, no quotes

### Step 2: Restart Dev Server

**CRITICAL**: After creating/updating `.env.local`, you MUST restart the server:

1. **Stop the server:**
   - Press `Ctrl+C` in the terminal where `npm run dev` is running
   - Wait for it to fully stop

2. **Start again:**
   ```bash
   cd finassistant-ai
   npm run dev
   ```

3. **Wait for "Ready" message:**
   ```
   ✓ Ready in X seconds
   ○ Local: http://localhost:3004
   ```

### Step 3: Verify Variables in Browser

1. Open `http://localhost:3004/test-connection`
2. Open browser console (F12)
3. Check what it shows for environment variables

**OR** run this in browser console:
```javascript
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING')
```

### Step 4: Check Supabase Project

1. Go to: https://supabase.com/dashboard/project/zpqhzbthcqllbfnpgptpn
2. Verify project status is **"Active"** (not paused)
3. Check Settings > API to verify URL and keys match

### Step 5: Test Direct Connection

Try accessing Supabase directly:
```
https://zpqhzbthcqllbfnpgptpn.supabase.co/rest/v1/
```

Should return a response (even if 404, it means connection works).

## Common Mistakes

❌ **Creating .env.local but not restarting server**
✅ **Solution**: Always restart after creating/updating .env.local

❌ **File in wrong location** (e.g., `FinAssistant/.env.local` instead of `finassistant-ai/.env.local`)
✅ **Solution**: File must be in `finassistant-ai/` directory

❌ **Variables without NEXT_PUBLIC_ prefix**
✅ **Solution**: Browser variables MUST start with `NEXT_PUBLIC_`

❌ **Spaces or quotes in .env.local**
✅ **Solution**: 
```env
# Wrong:
NEXT_PUBLIC_SUPABASE_URL = "https://..."
NEXT_PUBLIC_SUPABASE_URL="https://..."

# Correct:
NEXT_PUBLIC_SUPABASE_URL=https://...
```

## Still Not Working?

1. **Clear browser cache** and hard refresh (Ctrl+Shift+R)
2. **Check browser console** for CORS errors
3. **Try incognito/private window**
4. **Check firewall/antivirus** isn't blocking localhost:3004
5. **Verify Supabase project is not paused** in dashboard

## Quick Test

After restarting server, open browser console and run:
```javascript
fetch('https://zpqhzbthcqllbfnpgptpn.supabase.co/rest/v1/', {
  headers: { 'apikey': 'your-anon-key-here' }
}).then(r => console.log('Status:', r.status)).catch(e => console.error('Error:', e))
```

If this works, the problem is with environment variables loading.
If this fails, the problem is with Supabase project or network.
