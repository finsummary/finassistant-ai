# Deployment Guide

This guide covers deploying FinAssistant.ai MVP to production.

## Prerequisites

- Supabase project (cloud or self-hosted)
- Node.js 20+ environment
- Domain name (optional, for custom domain)

## Deployment Options

### Option 1: Vercel (Recommended)

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Select the `finassistant-ai` directory as root

3. **Configure Environment Variables**
   In Vercel project settings, add:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   OPENAI_API_KEY=your_openai_key (optional)
   GEMINI_API_KEY=your_gemini_key (optional)
   AI_PROVIDER=openai (optional)
   ```

4. **Deploy**
   - Vercel will automatically build and deploy
   - Check build logs for any errors

### Option 2: Self-Hosted (Docker)

1. **Create Dockerfile**
   ```dockerfile
   FROM node:20-alpine AS base
   RUN apk add --no-cache libc6-compat
   WORKDIR /app

   FROM base AS deps
   COPY package*.json ./
   RUN npm ci

   FROM base AS builder
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build

   FROM base AS runner
   ENV NODE_ENV production
   COPY --from=builder /app/public ./public
   COPY --from=builder /app/.next/standalone ./
   COPY --from=builder /app/.next/static ./.next/static
   EXPOSE 3000
   CMD ["node", "server.js"]
   ```

2. **Build and run**
   ```bash
   docker build -t finassistant-ai .
   docker run -p 3000:3000 --env-file .env.local finassistant-ai
   ```

## Database Setup

### Supabase Cloud

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run all migration files from `supabase/migrations/` in order:
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

4. Verify RLS policies are enabled:
   - Go to Authentication > Policies
   - Ensure all tables have RLS enabled

### Local Supabase

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Run migrations
supabase db reset
```

## Environment Variables

Create `.env.local` (or set in your deployment platform):

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional (for AI features)
OPENAI_API_KEY=sk-...
# OR
GEMINI_API_KEY=...
AI_PROVIDER=openai
```

## Post-Deployment Checklist

- [ ] Verify all migrations are applied
- [ ] Test user registration/login
- [ ] Test CSV import functionality
- [ ] Test framework endpoints
- [ ] Verify RLS policies are working
- [ ] Test AI assistant (if API keys configured)
- [ ] Check error logs for any issues
- [ ] Verify HTTPS is enabled
- [ ] Test executive summary export

## Monitoring

### Recommended Tools

- **Vercel Analytics**: Built-in for Vercel deployments
- **Sentry**: Error tracking
- **Supabase Dashboard**: Database monitoring

### Key Metrics to Monitor

- API response times
- Database query performance
- Error rates
- User authentication success rate
- CSV import success rate

## Troubleshooting

### Build Failures

- Check Node.js version (requires 20+)
- Verify all dependencies are in `package.json`
- Check for TypeScript errors: `npm run lint`

### Database Connection Issues

- Verify Supabase URL and keys
- Check network connectivity
- Verify RLS policies allow authenticated users

### AI Features Not Working

- Verify API keys are set correctly
- Check API quota/credits
- Review API logs for errors

## Security Considerations

1. **Never commit `.env.local`** to version control
2. **Use environment variables** for all secrets
3. **Enable RLS** on all database tables
4. **Use HTTPS** in production
5. **Regularly update dependencies**: `npm audit fix`

## Scaling Considerations

- **Database**: Supabase handles scaling automatically
- **API Routes**: Vercel/serverless scales automatically
- **File Uploads**: CSV files are processed in-memory (max 10MB)
- **AI Requests**: Consider rate limiting for AI endpoints

## Backup Strategy

- **Database**: Supabase provides automatic backups
- **Code**: Use Git for version control
- **Environment Variables**: Store securely (e.g., Vercel env vars)

## Support

For deployment issues:
1. Check build logs
2. Review error messages
3. Verify environment variables
4. Test locally first: `npm run dev`
