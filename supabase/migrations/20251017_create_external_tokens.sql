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


