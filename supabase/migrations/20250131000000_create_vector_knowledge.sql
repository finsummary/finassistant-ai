-- Enable pgvector extension for vector similarity search
create extension if not exists vector;

-- Financial Knowledge Base table (shared knowledge for all users)
create table if not exists public."financial_knowledge" (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  category text, -- cash_flow, runway, expenses, revenue, budgeting, risk
  tags text[],
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for vector similarity search (using cosine distance)
create index if not exists financial_knowledge_embedding_idx 
  on public."financial_knowledge" 
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index for category filtering
create index if not exists financial_knowledge_category_idx 
  on public."financial_knowledge" (category);

-- User Knowledge Base table (user-specific knowledge)
create table if not exists public."user_knowledge" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  type text not null, -- preference, decision_history, business_context, note
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for vector similarity search
create index if not exists user_knowledge_embedding_idx 
  on public."user_knowledge" 
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index for user_id and type filtering
create index if not exists user_knowledge_user_id_idx 
  on public."user_knowledge" (user_id);
create index if not exists user_knowledge_type_idx 
  on public."user_knowledge" (type);

-- RLS for user_knowledge (financial_knowledge is public, no RLS needed)
alter table public."user_knowledge" enable row level security;

do $$
begin
  -- Select policy: users can only see their own knowledge
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_knowledge' and policyname='user_knowledge_select'
  ) then
    create policy user_knowledge_select on public."user_knowledge"
      for select to authenticated using (auth.uid() = user_id);
  end if;

  -- Insert policy: users can only insert their own knowledge
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_knowledge' and policyname='user_knowledge_insert'
  ) then
    create policy user_knowledge_insert on public."user_knowledge"
      for insert to authenticated with check (auth.uid() = user_id);
  end if;

  -- Update policy: users can only update their own knowledge
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_knowledge' and policyname='user_knowledge_update'
  ) then
    create policy user_knowledge_update on public."user_knowledge"
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- Delete policy: users can only delete their own knowledge
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_knowledge' and policyname='user_knowledge_delete'
  ) then
    create policy user_knowledge_delete on public."user_knowledge"
      for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- Function for financial knowledge search
create or replace function match_financial_knowledge(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_category text default null
)
returns table (
  id uuid,
  content text,
  category text,
  tags text[],
  source text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    financial_knowledge.id,
    financial_knowledge.content,
    financial_knowledge.category,
    financial_knowledge.tags,
    financial_knowledge.source,
    1 - (financial_knowledge.embedding <=> query_embedding) as similarity
  from financial_knowledge
  where financial_knowledge.embedding is not null
    and 1 - (financial_knowledge.embedding <=> query_embedding) > match_threshold
    and (filter_category is null or financial_knowledge.category = filter_category)
  order by financial_knowledge.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Function for user knowledge search
create or replace function match_user_knowledge(
  p_user_id uuid,
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_type text default null
)
returns table (
  id uuid,
  content text,
  type text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    user_knowledge.id,
    user_knowledge.content,
    user_knowledge.type,
    user_knowledge.metadata,
    1 - (user_knowledge.embedding <=> query_embedding) as similarity
  from user_knowledge
  where user_knowledge.user_id = p_user_id
    and user_knowledge.embedding is not null
    and 1 - (user_knowledge.embedding <=> query_embedding) > match_threshold
    and (filter_type is null or user_knowledge.type = filter_type)
  order by user_knowledge.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Trigger to update updated_at timestamp
create or replace function touch_knowledge_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger financial_knowledge_updated_at
  before update on public."financial_knowledge"
  for each row
  execute function touch_knowledge_updated_at();

create trigger user_knowledge_updated_at
  before update on public."user_knowledge"
  for each row
  execute function touch_knowledge_updated_at();
