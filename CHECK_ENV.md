# Environment Variables Check

## Quick Check Script

Run this in your browser console (F12) on any page:

```javascript
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING')
```

## Expected Values

- **URL**: Should start with `https://` and end with `.supabase.co`
- **Key**: Should be a long JWT token starting with `eyJ...`

## If Variables are Undefined

This means Next.js didn't load them. Solutions:

1. **Restart the dev server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. **Check file location:**
   - `.env.local` must be in `finassistant-ai/` directory (same level as `package.json`)
   - NOT in `FinAssistant/` directory

3. **Check file format:**
   - No spaces around `=`
   - No quotes around values
   - Each variable on its own line

4. **Verify file exists:**
   ```bash
   cd finassistant-ai
   dir .env.local
   # Should show the file
   ```

## Common Issues

### Issue: Variables show as `undefined` in browser

**Cause**: Server wasn't restarted after creating `.env.local`

**Fix**: Stop and restart `npm run dev`

### Issue: NetworkError

**Possible causes:**
1. Supabase project is paused
2. URL is incorrect
3. CORS issues
4. Network/firewall blocking

**Check:**
- Visit Supabase Dashboard to verify project is active
- Try accessing URL directly in browser
- Check browser console for CORS errors
