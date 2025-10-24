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


