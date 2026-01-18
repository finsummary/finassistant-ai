-- Forecasts table: per-user monthly forecast values per category key
create table if not exists public."Forecasts" (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  key text not null,
  value numeric not null default 0,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forecasts_pkey primary key (user_id, month, key)
);

-- Helpful indexes
create index if not exists forecasts_user_month_idx on public."Forecasts" (user_id, month);

-- RLS
alter table public."Forecasts" enable row level security;

-- Policies: users can manage only their own rows
drop policy if exists forecasts_select on public."Forecasts";
create policy forecasts_select on public."Forecasts"
  for select using ( auth.uid() = user_id );

drop policy if exists forecasts_upsert on public."Forecasts";
create policy forecasts_upsert on public."Forecasts"
  for insert with check ( auth.uid() = user_id );

drop policy if exists forecasts_update on public."Forecasts";
create policy forecasts_update on public."Forecasts"
  for update using ( auth.uid() = user_id ) with check ( auth.uid() = user_id );

drop policy if exists forecasts_delete on public."Forecasts";
create policy forecasts_delete on public."Forecasts"
  for delete using ( auth.uid() = user_id );

-- Trigger to keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_forecasts_updated_at on public."Forecasts";
create trigger trg_forecasts_updated_at
  before update on public."Forecasts"
  for each row execute procedure public.touch_updated_at();





