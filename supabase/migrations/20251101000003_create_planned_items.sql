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
