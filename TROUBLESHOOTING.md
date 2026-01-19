# Troubleshooting Guide

## Common Issues and Solutions

### Issue: "Failed to fetch" when trying to sign up/login

**Possible Causes:**
1. Environment variables not loaded
2. Supabase project not configured
3. CORS issues
4. Network connectivity

**Solutions:**

1. **Restart the dev server** after creating/updating `.env.local`:
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

2. **Verify environment variables are loaded:**
   - Check that `.env.local` exists in `finassistant-ai/` folder
   - Verify the file contains:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://zpqhzbthcqllbfnpgptpn.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     ```
   - Note: Variables starting with `NEXT_PUBLIC_` are exposed to the browser

3. **Check Supabase project status:**
   - Go to https://supabase.com/dashboard/project/zpqhzbthcqllbfnpgptpn
   - Verify project is active (not paused)
   - Check that Auth is enabled

4. **Verify Supabase URL and keys:**
   - Go to Supabase Dashboard > Settings > API
   - Compare with your `.env.local` values
   - Make sure there are no extra spaces or quotes

5. **Check browser console:**
   - Open browser DevTools (F12)
   - Check Console tab for detailed error messages
   - Check Network tab to see if requests are being made

6. **Test Supabase connection:**
   - Open browser console
   - Try: `fetch('https://zpqhzbthcqllbfnpgptpn.supabase.co/rest/v1/', { headers: { 'apikey': 'your-anon-key' } })`
   - Should return a response (even if 404, it means connection works)

### Issue: "Missing Supabase environment variables"

**Solution:**
- Ensure `.env.local` file exists in the `finassistant-ai/` directory
- Restart the dev server after creating/updating `.env.local`
- Variables must start with `NEXT_PUBLIC_` to be available in the browser

### Issue: "Email confirmation required" but no email received

**Solutions:**
1. **Check Supabase Auth settings:**
   - Go to Supabase Dashboard > Authentication > Settings
   - Check "Enable email confirmations" setting
   - For development, you can disable email confirmation temporarily

2. **Check spam folder**

3. **Use Supabase Auth UI to manage users:**
   - Go to Authentication > Users
   - You can manually confirm users there

4. **For development, disable email confirmation:**
   - In Supabase Dashboard > Authentication > Settings
   - Turn off "Enable email confirmations"
   - Users can sign in immediately after signup

### Issue: Database connection errors

**Solutions:**
1. **Verify migrations are applied:**
   - Check Supabase Dashboard > Table Editor
   - All tables should exist

2. **Check RLS policies:**
   - Go to Authentication > Policies
   - Ensure policies are enabled

3. **Verify user_id is set:**
   - After signup, check that user exists in `auth.users`
   - Check that `user_id` is being set correctly in API calls

### Issue: "Rate limit exceeded"

**Solution:**
- Wait a few minutes and try again
- Rate limits are:
  - AI Assistant: 20 requests/minute
  - CSV Import: 10 imports/hour
  - AI Categorize: 5 categorizations/hour

### Issue: App shows landing page instead of redirecting

**Solution:**
- Navigate directly to `/login` or `/dashboard`
- The landing page should redirect if you're logged in
- Clear browser cookies and try again

### Issue: TypeScript/ESLint errors

**Solutions:**
1. **Restart TypeScript server in your IDE**
2. **Run:** `npm run lint` to see all errors
3. **Fix or ignore:** Some `any` types are acceptable for MVP

## Debugging Steps

1. **Check environment variables:**
   ```bash
   # In browser console (after page load):
   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
   ```

2. **Test Supabase connection:**
   - Open browser DevTools > Network tab
   - Try to sign up
   - Check if requests are being made to Supabase
   - Look at request URLs and status codes

3. **Check Supabase logs:**
   - Go to Supabase Dashboard > Logs
   - Check for errors related to your requests

4. **Verify Auth is enabled:**
   - Supabase Dashboard > Authentication > Providers
   - Email provider should be enabled

## Getting Help

If issues persist:
1. Check browser console for detailed errors
2. Check Supabase Dashboard logs
3. Verify all environment variables
4. Ensure dev server was restarted after `.env.local` changes
5. Check that Supabase project is active and not paused
