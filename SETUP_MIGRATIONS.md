# Database Migrations Setup Guide

This guide will help you run all database migrations for FinAssistant.ai.

## Your Supabase Project

- **Project Reference**: `zpqhzbthcqllbfnpgptpn`
- **URL**: `https://zpqhzbthcqllbfnpgptpn.supabase.co`

## Option 1: Using Supabase Dashboard (Recommended) ⭐ EASIEST

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard/project/zpqhzbthcqllbfnpgptpn
   - Navigate to **SQL Editor** in the left sidebar

2. **Run All Migrations at Once** (Easiest Method)
   
   **Step-by-step:**
   - Click **"New query"** button (top right)
   - Open the file `supabase/migrations/ALL_MIGRATIONS.sql` in your project
   - Select ALL content (Ctrl+A or Cmd+A)
   - Copy it (Ctrl+C or Cmd+C)
   - Paste into the SQL Editor (Ctrl+V or Cmd+V)
   - Click **"Run"** button (or press Ctrl+Enter / Cmd+Enter)
   - Wait for "Success. No rows returned" message
   - ✅ Done!

   **Alternative: Run migrations one by one**
   - If you prefer, you can run each migration file separately
   - This helps identify any issues with specific migrations
   - Open each file from `supabase/migrations/` in order and run them individually

3. **Verify Migrations**
   - Go to **Table Editor** in the left sidebar
   - You should see these tables:
     - `Organizations`
     - `BankAccounts`
     - `Transactions`
     - `Categories`
     - `PlannedIncome`
     - `PlannedExpenses`
     - `Waitlist`
     - And others

4. **Verify RLS Policies**
   - Go to **Authentication > Policies**
   - Ensure Row Level Security (RLS) is enabled on all tables
   - Check that policies are set correctly

## Option 2: Using Supabase CLI

1. **Install Supabase CLI** (if not already installed)
   ```bash
   npm install -g supabase
   ```

2. **Link to your project**
   ```bash
   cd finassistant-ai
   supabase link --project-ref zpqhzbthcqllbfnpgptpn
   ```
   You'll be prompted to enter your database password.

3. **Push migrations**
   ```bash
   supabase db push
   ```

## Option 3: Manual Migration (If needed)

If you encounter issues, you can manually run each migration:

1. Open Supabase Dashboard > SQL Editor
2. For each migration file in `supabase/migrations/`:
   - Open the file
   - Copy its contents
   - Paste into SQL Editor
   - Run the query
   - Check for errors

## Verification Checklist

After running migrations, verify:

- [ ] All tables are created
- [ ] RLS is enabled on all tables
- [ ] Indexes are created
- [ ] Foreign key constraints are set
- [ ] Policies allow authenticated users to access their own data

## Common Issues

### Issue: "relation already exists"
**Solution**: Some tables might already exist. You can either:
- Drop existing tables and re-run migrations (⚠️ deletes data)
- Skip migrations that create existing tables
- Use `CREATE TABLE IF NOT EXISTS` (already in migrations)

### Issue: "permission denied"
**Solution**: 
- Make sure you're using the service_role key for migrations
- Check that you have proper permissions in Supabase

### Issue: "foreign key constraint fails"
**Solution**: 
- Run migrations in the correct order (they're numbered)
- Check that referenced tables exist before creating foreign keys

## Next Steps

After migrations are complete:
1. ✅ Your `.env.local` is already configured
2. Start the dev server: `npm run dev`
3. Test the application following `QUICK_START.md`

## Need Help?

- Check Supabase Dashboard logs for detailed error messages
- Review migration files for syntax errors
- Ensure you're running migrations in the correct order
