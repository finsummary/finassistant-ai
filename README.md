# FinAssistant.ai - MVP

Cash-first financial clarity and decision support for solopreneurs and small business owners.

## Overview

FinAssistant.ai is a web-based SaaS application that helps business owners understand their cash flow, plan ahead, and make informed financial decisions. The MVP focuses on:

- **CSV Upload**: Import bank transactions from CSV files
- **Transaction Categorization**: Organize transactions with AI assistance
- **Planned Income & Expenses**: Track expected cash flows
- **5-Step Financial Framework**: STATE → DELTA → TRAJECTORY → EXPOSURE → CHOICE
- **AI Assistant**: Get explanations and guidance on your financial data
- **Executive Summary**: One-page export of your financial snapshot

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, Shadcn UI components
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: OpenAI (GPT-4o-mini) or Google Gemini

## Prerequisites

- Node.js 20+ and npm
- Supabase account (or local Supabase CLI)
- (Optional) OpenAI API key or Google Gemini API key for AI features

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd finassistant-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Supabase (Required)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # AI Provider (Optional - for AI features)
   # Choose one:
   OPENAI_API_KEY=your_openai_api_key
   # OR
   GEMINI_API_KEY=your_gemini_api_key
   
   # AI Provider Selection (Optional)
   # If both keys are present, specify: 'openai' or 'gemini'
   AI_PROVIDER=openai
   ```

4. **Set up Supabase Database**

   If using local Supabase:
   ```bash
   # Install Supabase CLI (if not already installed)
   npm install -g supabase

   # Start local Supabase
   supabase start

   # Run migrations
   supabase db reset
   ```

   If using Supabase Cloud:
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to SQL Editor and run all migration files from `supabase/migrations/` in order:
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

5. **Run the development server**
   ```bash
   npm run dev
   ```

   The application will be available at [http://localhost:3004](http://localhost:3004)

## Database Schema

### Core Tables

- **Organizations**: Business information (1:1 with user)
- **BankAccounts**: Manual or imported bank accounts
- **Transactions**: Imported transactions from CSV
- **Categories**: Transaction categories
- **PlannedIncome**: Expected income items
- **PlannedExpenses**: Expected expense items

### Row Level Security (RLS)

All tables have RLS enabled to ensure users can only access their own data. Policies are defined in the migration files.

## Project Structure

```
finassistant-ai/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── ai/          # AI assistant endpoints
│   │   │   ├── framework/   # 5-step framework endpoints
│   │   │   ├── planned-income/
│   │   │   ├── planned-expenses/
│   │   │   ├── organizations/
│   │   │   └── transactions/
│   │   ├── dashboard/       # Main dashboard
│   │   ├── framework/        # 5-step framework UI
│   │   ├── settings/         # Settings pages
│   │   ├── executive-summary/ # Summary export
│   │   └── login/            # Authentication
│   ├── components/
│   │   └── ui/              # Shadcn UI components
│   └── lib/
│       └── supabase/        # Supabase client utilities
├── supabase/
│   └── migrations/          # Database migrations
└── package.json
```

## Features

### 1. CSV Import
- Upload bank statement CSV files
- Automatic column detection (date, description, amount)
- Support for multiple currencies
- Duplicate detection

### 2. Transaction Categorization
- Manual categorization
- AI-powered categorization (requires API key)
- Rule-based auto-categorization

### 3. Planned Items
- Add expected income and expenses
- Set recurrence (one-off or monthly)
- 6-month forecast calculation

### 4. 5-Step Financial Framework

**STATE**: Current cash position
- Current balance
- Last month inflow/outflow
- Category breakdown

**DELTA**: Change analysis
- Current month vs previous month
- Top increases/decreases

**TRAJECTORY**: Cash forecast
- 6-month projection
- Based on historical averages and planned items
- Low point identification

**EXPOSURE**: Risk assessment
- Cash runway calculation
- Upcoming large expenses
- Risk flags

**CHOICE**: Decision support
- Decision cards with cash impact
- Risk and reversibility analysis

### 5. AI Assistant
- Framework-based explanations
- Answers questions about your financial data
- Provides guidance (not calculations)
- Context-aware responses

### 6. Executive Summary
- One-page narrative summary
- Structured by 5-step framework
- PDF export via browser print

## Usage

1. **Sign Up / Login**
   - Create an account or sign in
   - Set up your organization (business name, country)

2. **Import Transactions**
   - Go to Dashboard
   - Create a manual bank account
   - Upload CSV file with transactions
   - Map columns if needed

3. **Categorize Transactions**
   - Review uncategorized transactions
   - Use AI categorize or manual assignment

4. **Add Planned Items**
   - Go to Settings → Planned Items
   - Add expected income and expenses

5. **View Framework**
   - Navigate to Framework page
   - Review each step (STATE → CHOICE)
   - Ask AI assistant questions

6. **Export Summary**
   - Go to Executive Summary
   - Review and print/export as PDF

## API Routes

### Authentication Required
All API routes (except `/api/waitlist`) require authentication via Supabase session.

### Key Endpoints

- `GET /api/organizations` - Get user's organization
- `POST /api/organizations` - Create/update organization
- `GET /api/planned-income` - Get planned income items
- `POST /api/planned-income` - Create planned income
- `GET /api/planned-expenses` - Get planned expenses
- `POST /api/planned-expenses` - Create planned expense
- `POST /api/transactions/import` - Import CSV transactions
- `GET /api/framework/state` - Get STATE data
- `GET /api/framework/delta` - Get DELTA data
- `GET /api/framework/trajectory` - Get TRAJECTORY data
- `GET /api/framework/exposure` - Get EXPOSURE data
- `GET /api/framework/choice` - Get CHOICE data
- `POST /api/ai/assistant` - AI assistant query
- `GET /api/executive-summary` - Get executive summary

## Development

### Scripts

```bash
npm run dev      # Start development server (port 3004)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Code Style

- TypeScript strict mode
- ESLint with Next.js config
- Prefer functional components
- Use Shadcn UI components from `@/components/ui`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (for admin operations) |
| `OPENAI_API_KEY` | Optional | OpenAI API key for AI features |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for AI features |
| `AI_PROVIDER` | Optional | `'openai'` or `'gemini'` (defaults to gemini if both keys present) |

## Troubleshooting

### Database Connection Issues
- Verify Supabase URL and keys in `.env.local`
- Check that migrations have been run
- Ensure RLS policies are enabled

### AI Features Not Working
- Verify API key is set in `.env.local`
- Check API key has sufficient credits/quota
- Review browser console for error messages

### CSV Import Fails
- Ensure CSV has Date and Amount columns
- Check file size (max 10MB)
- Verify CSV format (comma or semicolon delimited)

## MVP Scope

### Included
- ✅ User accounts (single business per account)
- ✅ Country selection (context only)
- ✅ Bank CSV upload
- ✅ Transaction categorization
- ✅ Planned income & expenses
- ✅ Cash-based budget/plan
- ✅ Actual vs plan comparison
- ✅ 3-6 month cash forecast
- ✅ Cash runway calculation
- ✅ 5-step financial framework
- ✅ AI assistant
- ✅ Executive summary export

### Explicitly Excluded
- ❌ Bank connections (Plaid, Tink, GoCardless)
- ❌ Accounting integrations
- ❌ Accrual P&L
- ❌ Tax calculations
- ❌ Multi-business accounts
- ❌ Personal/family mode

## Documentation

- **[User Guide](./USER_GUIDE.md)**: Complete guide for end users
- **[Testing Guide](./TESTING.md)**: Testing checklist and procedures
- **[Deployment Guide](./DEPLOYMENT.md)**: Production deployment instructions

## License

[Add your license here]

## Support

For issues or questions, please [create an issue](link-to-issues) or contact [your-email].

## Changelog

### MVP v0.1.0
- ✅ User authentication and organization setup
- ✅ CSV transaction import
- ✅ Transaction categorization (manual, AI, rules-based)
- ✅ Planned income & expenses management
- ✅ 5-step financial framework (STATE → DELTA → TRAJECTORY → EXPOSURE → CHOICE)
- ✅ AI assistant for financial guidance
- ✅ Executive summary export
- ✅ Rate limiting for API endpoints
- ✅ Comprehensive error handling and validation
- ✅ Loading states and UX improvements
