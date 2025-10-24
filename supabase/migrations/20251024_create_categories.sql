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


