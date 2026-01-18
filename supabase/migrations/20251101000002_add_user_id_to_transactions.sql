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
