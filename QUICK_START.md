# Quick Start Guide - Testing the App

This guide will help you quickly set up and test FinAssistant.ai locally.

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js 20+ installed (`node --version`)
- ✅ npm installed (`npm --version`)
- ✅ Git installed
- ✅ A Supabase account (free tier works)

## Step 1: Install Dependencies

```bash
cd finassistant-ai
npm install
```

This will install all required packages.

## Step 2: Set Up Supabase

### Option A: Use Supabase Cloud (Recommended for Testing)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to be ready (takes 1-2 minutes)
4. Go to **Settings > API** to get your credentials:
   - Project URL
   - `anon` public key
   - `service_role` secret key (keep this secure!)

### Option B: Use Local Supabase (Advanced)

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# This will give you local credentials
```

## Step 3: Run Database Migrations

### For Supabase Cloud:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order from `supabase/migrations/`:
   - `20250914211824_initial_schema.sql`
   - `20251015_create_bankaccounts.sql`
   - `20251016_create_transactions.sql`
   - `20251017_create_external_tokens.sql`
   - `20251018_categorization.sql`
   - `20251024_create_categories.sql`
   - `20251026_create_forecasts.sql`
   - `20251028_create_waitlist.sql`
   - `20251101000000_create_organizations.sql`
   - `20251101000001_add_user_id_to_bankaccounts.sql`
   - `20251101000002_add_user_id_to_transactions.sql`
   - `20251101000003_create_planned_items.sql`
   - `20251101000004_migrate_existing_data.sql`

**Tip**: You can copy all migration files' content and run them in one go, or use Supabase CLI:

```bash
supabase db push
```

### For Local Supabase:

```bash
supabase db reset
```

## Step 4: Configure Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

3. (Optional) Add AI keys for AI features:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   # OR
   GEMINI_API_KEY=your-gemini-key-here
   AI_PROVIDER=openai
   ```

## Step 5: Start the Development Server

```bash
npm run dev
```

The app will start at `http://localhost:3004` (port 3004 as configured).

You should see:
```
✓ Ready in X seconds
○ Local: http://localhost:3004
```

## Step 6: Test the Application

### 6.1 Create an Account

1. Open `http://localhost:3004` in your browser
2. Click "Sign Up" or navigate to `/login`
3. Enter your email and password
4. Check your email for confirmation (if email confirmation is enabled)
5. Log in with your credentials

### 6.2 Set Up Organization

1. After login, you'll be redirected to the dashboard
2. You should see a warning to set up your organization
3. Click "Settings" or navigate to `/settings/organization`
4. Enter:
   - Business Name: "Test Business"
   - Country: Select from dropdown
5. Click "Save"

### 6.3 Create a Bank Account

1. Go to Dashboard
2. Scroll to "Create Manual Account" section
3. Enter:
   - Account Name: "Test Account"
   - Currency: "GBP" (or your preferred currency)
4. Click "Add"
5. Verify the account appears in the list

### 6.4 Import Test Transactions

1. Use the example CSV file: `public/example-transactions.csv`
2. In Dashboard, scroll to "Import CSV" section
3. Click "Choose File" and select `example-transactions.csv`
4. Select the account you just created
5. Set Currency to "GBP"
6. Click "Import"
7. You should see a success message with the number of imported transactions

### 6.5 Test Categorization

1. In Dashboard, find your transactions
2. Click on a transaction to assign a category manually
3. Or click "AI Categorize" button (requires AI API key)
4. Or click "Auto-categorize (Rules)" for rule-based categorization

### 6.6 Test Planned Items

1. Navigate to `/settings/planned-items`
2. Add a Planned Income:
   - Description: "Monthly Retainer"
   - Amount: 2000
   - Expected Date: Next month
   - Recurrence: Monthly
3. Add a Planned Expense:
   - Description: "Office Rent"
   - Amount: 1200
   - Expected Date: Next month
   - Recurrence: Monthly
4. Verify items appear in the list
5. Test editing by clicking on any field
6. Test deletion

### 6.7 Test Financial Framework

1. Navigate to `/framework`
2. Wait for all data to load
3. Test each step:
   - **STATE**: Should show current balance, last month, this month
   - **DELTA**: Should show month-over-month comparison
   - **TRAJECTORY**: Should show 6-month forecast
   - **EXPOSURE**: Should show runway and risk flags
   - **CHOICE**: Should show decision recommendations

### 6.8 Test AI Assistant

1. On the Framework page, find the AI Assistant sidebar
2. Try a suggested question or type your own:
   - "Explain my current cash position"
   - "What should I do about my cash flow?"
3. Wait for AI response (requires API key)

### 6.9 Test Executive Summary

1. Navigate to `/executive-summary`
2. Verify all framework data is displayed
3. Click "Print/Export PDF"
4. Test browser print functionality

## Common Issues & Solutions

### Issue: "Failed to fetch" errors

**Solution**: 
- Check your `.env.local` file has correct Supabase credentials
- Verify Supabase project is active
- Check browser console for detailed errors

### Issue: "Not authenticated" errors

**Solution**:
- Make sure you're logged in
- Check Supabase Auth is enabled
- Clear browser cookies and try again

### Issue: Migrations fail

**Solution**:
- Run migrations one by one to identify the failing one
- Check if tables already exist (some migrations may fail if run twice)
- Verify you have proper permissions in Supabase

### Issue: AI features don't work

**Solution**:
- Check API keys are set in `.env.local`
- Verify API keys are valid and have credits
- Check browser console for API errors

### Issue: Port 3004 already in use

**Solution**:
```bash
# Change port in package.json or use:
PORT=3005 npm run dev
```

## Testing Checklist

Use the comprehensive checklist in `TESTING.md` for detailed testing procedures.

Quick checklist:
- [ ] User registration and login
- [ ] Organization setup
- [ ] Bank account creation
- [ ] CSV import
- [ ] Transaction categorization
- [ ] Planned items (income & expenses)
- [ ] Framework all 5 steps
- [ ] AI assistant
- [ ] Executive summary

## Next Steps

After local testing:
1. Review `TESTING.md` for comprehensive test procedures
2. Check `DEPLOYMENT.md` for production deployment
3. Read `USER_GUIDE.md` for user documentation

## Getting Help

If you encounter issues:
1. Check browser console for errors
2. Check terminal output for server errors
3. Verify all environment variables are set
4. Review Supabase dashboard for database issues
5. Check `TESTING.md` troubleshooting section
