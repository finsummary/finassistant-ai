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


