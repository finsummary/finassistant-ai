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


