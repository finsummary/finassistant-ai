-- Organizations table (1:1 with user per PRD)
create table if not exists public."Organizations" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for user lookup
create index if not exists organizations_user_id_idx on public."Organizations" (user_id);

-- RLS
alter table public."Organizations" enable row level security;

-- Policies: users can manage only their own organization
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Organizations' and policyname='organizations_select'
  ) then
    create policy organizations_select on public."Organizations"
      for select to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Organizations' and policyname='organizations_insert'
  ) then
    create policy organizations_insert on public."Organizations"
      for insert to authenticated with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Organizations' and policyname='organizations_update'
  ) then
    create policy organizations_update on public."Organizations"
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='Organizations' and policyname='organizations_delete'
  ) then
    create policy organizations_delete on public."Organizations"
      for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- Trigger to keep updated_at fresh
create or replace function public.touch_organizations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_organizations_updated_at on public."Organizations";
create trigger trg_organizations_updated_at
  before update on public."Organizations"
  for each row execute procedure public.touch_organizations_updated_at();
