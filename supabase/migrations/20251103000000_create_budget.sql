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
