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

-- Disallow selects by default (no select policy). You can add admin-only views later.





