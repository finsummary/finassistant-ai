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
