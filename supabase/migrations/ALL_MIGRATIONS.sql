-- ============================================
-- FinAssistant.ai - All Migrations Combined
-- ============================================
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard: https://supabase.com/dashboard/project/zpqhzbthcqllbfnpgptpn
-- 2. Go to "SQL Editor" in the left sidebar
-- 3. Click "New query"
-- 4. Copy ALL content from this file (Ctrl+A, Ctrl+C)
-- 5. Paste into SQL Editor (Ctrl+V)
-- 6. Click "Run" button or press Ctrl+Enter
-- 7. Wait for "Success" message
-- ============================================

-- Migration 1: BankAccounts base table
-- ============================================
-- BankAccounts base table for MVP
create table if not exists public."BankAccounts" (
  id text primary key,
  provider text not null,
  account_name text not null,
  currency text not null,
  created_at timestamptz not null default now()
);

alter table public."BankAccounts" enable row level security;

-- Simple permissive policies for authenticated users (MVP)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'BankAccounts' and policyname = 'bankaccounts_select'
  ) then
    create policy bankaccounts_select on public."BankAccounts"
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'BankAccounts' and policyname = 'bankaccounts_insert'
  ) then
    create policy bankaccounts_insert on public."BankAccounts"
      for insert to authenticated with check (true);
  end if;
end $$;

-- Migration 2: Transactions table
-- ============================================
-- Transactions table for storing Tink transactions (MVP)
create table if not exists public."Transactions" (
  id text primary key,
  account_id text not null,
  amount numeric not null,
  currency text not null,
  description text,
  booked_at date not null,
  created_at timestamptz not null default now()
);

alter table public."Transactions" enable row level security;

-- Permissive RLS for MVP
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'Transactions' and policyname = 'transactions_select'
  ) then
    create policy transactions_select on public."Transactions"
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'Transactions' and policyname = 'transactions_insert'
  ) then
    create policy transactions_insert on public."Transactions"
      for insert to authenticated with check (true);
  end if;
end $$;

-- Migration 3: External Tokens
-- ============================================
create table if not exists public."ExternalTokens" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,
  access_token text not null,
  created_at timestamptz not null default now()
);

alter table public."ExternalTokens" enable row level security;

-- Minimal RLS: user can manage only their own tokens
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ExternalTokens' and policyname = 'externaltokens_select'
  ) then
    create policy externaltokens_select on public."ExternalTokens"
      for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ExternalTokens' and policyname = 'externaltokens_insert'
  ) then
    create policy externaltokens_insert on public."ExternalTokens"
      for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ExternalTokens' and policyname = 'externaltokens_delete'
  ) then
    create policy externaltokens_delete on public."ExternalTokens"
      for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- Migration 4: Categorization
-- ============================================
-- Add category column to Transactions
alter table if exists public."Transactions"
  add column if not exists category text;

-- Rules table for categorization
create table if not exists public."CategoryRules" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  field text not null default 'description', -- description | merchant
  pattern text not null,
  category text not null,
  sign text, -- '+' or '-' or null
  min_amount numeric,
  max_amount numeric,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public."CategoryRules" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='CategoryRules' and policyname='categoryrules_select'
  ) then
    create policy categoryrules_select on public."CategoryRules"
      for select to authenticated using (user_id is null or auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='CategoryRules' and policyname='categoryrules_insert'
  ) then
    create policy categoryrules_insert on public."CategoryRules"
      for insert to authenticated with check (user_id is null or auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='CategoryRules' and policyname='categoryrules_delete'
  ) then
    create policy categoryrules_delete on public."CategoryRules"
      for delete to authenticated using (user_id is null or auth.uid() = user_id);
  end if;
end $$;

-- Migration 5: Categories
-- ============================================
-- Categories table for user-defined income/expense categories
create table if not exists public."Categories" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  enabled boolean not null default true,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  constraint categories_name_unique unique (user_id, name)
);

alter table public."Categories" enable row level security;

-- Read: authenticated users can read global (user_id is null) and their own
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Categories' and policyname='categories_select'
  ) then
    create policy categories_select on public."Categories"
      for select to authenticated using (user_id is null or user_id = auth.uid());
  end if;
end $$;

-- Insert/Update/Delete: only own rows (user_id = auth.uid())
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Categories' and policyname='categories_iud'
  ) then
    create policy categories_iud on public."Categories"
      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Seed global defaults (will no-op on duplicates)
insert into public."Categories" (user_id, name, type, sort_order)
values
  (null, 'Income', 'income', 0),
  (null, 'Transport', 'expense', 0),
  (null, 'Restaurants', 'expense', 0),
  (null, 'Cafes', 'expense', 0),
  (null, 'Subscriptions', 'expense', 0),
  (null, 'Groceries', 'expense', 0),
  (null, 'Shopping', 'expense', 0),
  (null, 'Housing', 'expense', 0),
  (null, 'Utilities', 'expense', 0),
  (null, 'Entertainment', 'expense', 0),
  (null, 'Personal Care', 'expense', 0),
  (null, 'Services', 'expense', 0),
  (null, 'Taxes', 'expense', 0),
  (null, 'Travel', 'expense', 0),
  (null, 'Cash', 'expense', 0),
  (null, 'Home', 'expense', 0),
  (null, 'Education', 'expense', 0),
  (null, 'Healthcare', 'expense', 0),
  (null, 'Other', 'expense', 0)
on conflict (user_id, name) do nothing;

-- Migration 6: Forecasts
-- ============================================
-- Forecasts table: per-user monthly forecast values per category key
create table if not exists public."Forecasts" (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  key text not null,
  value numeric not null default 0,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forecasts_pkey primary key (user_id, month, key)
);

-- Helpful indexes
create index if not exists forecasts_user_month_idx on public."Forecasts" (user_id, month);

-- RLS
alter table public."Forecasts" enable row level security;

-- Policies: users can manage only their own rows
drop policy if exists forecasts_select on public."Forecasts";
create policy forecasts_select on public."Forecasts"
  for select using ( auth.uid() = user_id );

drop policy if exists forecasts_upsert on public."Forecasts";
create policy forecasts_upsert on public."Forecasts"
  for insert with check ( auth.uid() = user_id );

drop policy if exists forecasts_update on public."Forecasts";
create policy forecasts_update on public."Forecasts"
  for update using ( auth.uid() = user_id ) with check ( auth.uid() = user_id );

drop policy if exists forecasts_delete on public."Forecasts";
create policy forecasts_delete on public."Forecasts"
  for delete using ( auth.uid() = user_id );

-- Trigger to keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_forecasts_updated_at on public."Forecasts";
create trigger trg_forecasts_updated_at
  before update on public."Forecasts"
  for each row execute procedure public.touch_updated_at();

-- Migration 7: Waitlist
-- ============================================
-- Waitlist table to collect emails for early access
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  created_at timestamptz not null default now()
);

-- Unique by lower(email) to avoid duplicates with case differences
create unique index if not exists waitlist_email_unique on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- Allow inserts from anyone (anon or authenticated)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='waitlist' and policyname='waitlist_insert_all'
  ) then
    create policy waitlist_insert_all on public.waitlist
      for insert to anon, authenticated with check (true);
  end if;
end $$;

-- Grant necessary permissions
grant insert on public.waitlist to anon;
grant insert on public.waitlist to authenticated;

-- Migration 8: Organizations
-- ============================================
-- Organizations table (1:1 with user per PRD)
create table if not exists public."Organizations" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for user lookup
create index if not exists organizations_user_id_idx on public."Organizations" (user_id);

-- RLS
alter table public."Organizations" enable row level security;

-- Policies: users can manage only their own organization
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Organizations' and policyname='organizations_select'
  ) then
    create policy organizations_select on public."Organizations"
      for select to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Organizations' and policyname='organizations_insert'
  ) then
    create policy organizations_insert on public."Organizations"
      for insert to authenticated with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Organizations' and policyname='organizations_update'
  ) then
    create policy organizations_update on public."Organizations"
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Organizations' and policyname='organizations_delete'
  ) then
    create policy organizations_delete on public."Organizations"
      for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- Trigger to keep updated_at fresh
create or replace function public.touch_organizations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_organizations_updated_at on public."Organizations";
create trigger trg_organizations_updated_at
  before update on public."Organizations"
  for each row execute procedure public.touch_organizations_updated_at();

-- Migration 9: Add user_id to BankAccounts
-- ============================================
-- Add user_id to BankAccounts for proper RLS per PRD
alter table if exists public."BankAccounts"
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Create index for user lookup
create index if not exists bankaccounts_user_id_idx on public."BankAccounts" (user_id);

-- Update RLS policies: users can manage only their own accounts
drop policy if exists bankaccounts_select on public."BankAccounts";
create policy bankaccounts_select on public."BankAccounts"
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists bankaccounts_insert on public."BankAccounts";
create policy bankaccounts_insert on public."BankAccounts"
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists bankaccounts_update on public."BankAccounts";
create policy bankaccounts_update on public."BankAccounts"
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists bankaccounts_delete on public."BankAccounts";
create policy bankaccounts_delete on public."BankAccounts"
  for delete to authenticated using (auth.uid() = user_id);

-- Migration 10: Add user_id to Transactions
-- ============================================
-- Add user_id to Transactions for proper RLS per PRD
-- user_id can be derived from account_id via BankAccounts, but direct link is safer for RLS
alter table if exists public."Transactions"
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Create index for user lookup
create index if not exists transactions_user_id_idx on public."Transactions" (user_id);

-- Update RLS policies: users can manage only their own transactions
drop policy if exists transactions_select on public."Transactions";
create policy transactions_select on public."Transactions"
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists transactions_insert on public."Transactions";
create policy transactions_insert on public."Transactions"
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists transactions_update on public."Transactions";
create policy transactions_update on public."Transactions"
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists transactions_delete on public."Transactions";
create policy transactions_delete on public."Transactions"
  for delete to authenticated using (auth.uid() = user_id);

-- Migration 11: Planned Items
-- ============================================
-- PlannedIncome table per PRD section 7.2.B
create table if not exists public."PlannedIncome" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric not null,
  expected_date date not null,
  recurrence text not null check (recurrence in ('one-off', 'monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PlannedExpenses table per PRD section 7.2.B
create table if not exists public."PlannedExpenses" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric not null,
  expected_date date not null,
  recurrence text not null check (recurrence in ('one-off', 'monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for user and date lookups
create index if not exists planned_income_user_id_idx on public."PlannedIncome" (user_id);
create index if not exists planned_income_date_idx on public."PlannedIncome" (expected_date);
create index if not exists planned_expenses_user_id_idx on public."PlannedExpenses" (user_id);
create index if not exists planned_expenses_date_idx on public."PlannedExpenses" (expected_date);

-- RLS for PlannedIncome
alter table public."PlannedIncome" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='PlannedIncome' and policyname='planned_income_select'
  ) then
    create policy planned_income_select on public."PlannedIncome"
      for select to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='PlannedIncome' and policyname='planned_income_insert'
  ) then
    create policy planned_income_insert on public."PlannedIncome"
      for insert to authenticated with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='PlannedIncome' and policyname='planned_income_update'
  ) then
    create policy planned_income_update on public."PlannedIncome"
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='PlannedIncome' and policyname='planned_income_delete'
  ) then
    create policy planned_income_delete on public."PlannedIncome"
      for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- RLS for PlannedExpenses
alter table public."PlannedExpenses" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='PlannedExpenses' and policyname='planned_expenses_select'
  ) then
    create policy planned_expenses_select on public."PlannedExpenses"
      for select to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='PlannedExpenses' and policyname='planned_expenses_insert'
  ) then
    create policy planned_expenses_insert on public."PlannedExpenses"
      for insert to authenticated with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='PlannedExpenses' and policyname='planned_expenses_update'
  ) then
    create policy planned_expenses_update on public."PlannedExpenses"
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='PlannedExpenses' and policyname='planned_expenses_delete'
  ) then
    create policy planned_expenses_delete on public."PlannedExpenses"
      for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- Triggers to keep updated_at fresh
create or replace function public.touch_planned_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_planned_income_updated_at on public."PlannedIncome";
create trigger trg_planned_income_updated_at
  before update on public."PlannedIncome"
  for each row execute procedure public.touch_planned_updated_at();

drop trigger if exists trg_planned_expenses_updated_at on public."PlannedExpenses";
create trigger trg_planned_expenses_updated_at
  before update on public."PlannedExpenses"
  for each row execute procedure public.touch_planned_updated_at();

-- Migration 12: Migrate Existing Data
-- ============================================
-- Migration script to populate user_id for existing records
-- This handles the case where records were created before user_id was added

-- For Transactions: try to derive user_id from account_id via BankAccounts
-- If account has user_id, update transaction
update public."Transactions" t
set user_id = b.user_id
from public."BankAccounts" b
where t.account_id = b.id
  and t.user_id is null
  and b.user_id is not null;

-- For transactions with account_id matching manual pattern, extract user_id
-- Pattern: manual_{userId}_{timestamp}_{random}
update public."Transactions" t
set user_id = (
  select substring(t.account_id from 'manual_([^_]+)')::uuid
)
where t.user_id is null
  and t.account_id like 'manual_%'
  and substring(t.account_id from 'manual_([^_]+)') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Clean up: delete transactions without user_id (orphaned records)
-- These are likely test data or records that can't be associated with a user
delete from public."Transactions"
where user_id is null;

-- Clean up: delete bank accounts without user_id
delete from public."BankAccounts"
where user_id is null;

-- ============================================
-- ✅ ALL MIGRATIONS COMPLETE!
-- ============================================
-- You should see "Success. No rows returned" message
-- 
-- Next steps:
-- Migration 13: Budget Table
-- ============================================
-- Budget table to store user's budget forecasts
create table if not exists public."Budget" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  horizon text not null check (horizon in ('6months', 'yearend')),
  forecast_months text[] not null,
  category_growth_rates jsonb not null default '{}',
  budget_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for user lookups
create index if not exists budget_user_id_idx on public."Budget" (user_id);

-- RLS for Budget
alter table public."Budget" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Budget' and policyname='budget_select'
  ) then
    create policy budget_select on public."Budget"
      for select to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Budget' and policyname='budget_insert'
  ) then
    create policy budget_insert on public."Budget"
      for insert to authenticated with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Budget' and policyname='budget_update'
  ) then
    create policy budget_update on public."Budget"
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Budget' and policyname='budget_delete'
  ) then
    create policy budget_delete on public."Budget"
      for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================
-- POST-MIGRATION CHECKLIST:
-- 1. Go to "Table Editor" to verify tables were created
-- 2. Check that RLS is enabled on all tables
-- 3. Start your app: npm run dev
-- ============================================
-- Budget table to store user's budget forecasts
create table if not exists public."Budget" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  horizon text not null check (horizon in ('6months', 'yearend')),
  forecast_months text[] not null,
  category_growth_rates jsonb not null default '{}',
  budget_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for user lookups
create index if not exists budget_user_id_idx on public."Budget" (user_id);

-- RLS for Budget
alter table public."Budget" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Budget' and policyname='budget_select'
  ) then
    create policy budget_select on public."Budget"
      for select to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Budget' and policyname='budget_insert'
  ) then
    create policy budget_insert on public."Budget"
      for insert to authenticated with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Budget' and policyname='budget_update'
  ) then
    create policy budget_update on public."Budget"
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Budget' and policyname='budget_delete'
  ) then
    create policy budget_delete on public."Budget"
      for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;
