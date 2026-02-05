-- Fix waitlist table - create if doesn't exist or ensure correct name
-- Run this in Supabase SQL Editor if table is missing
-- 
-- WARNING: This will DROP the existing waitlist table if it exists!
-- If you have important data, export it first.

-- Drop old tables if they exist (both variants)
DROP TABLE IF EXISTS public."Waitlist" CASCADE;
DROP TABLE IF EXISTS public.waitlist CASCADE;

-- Create waitlist table (lowercase, no quotes)
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index by lower(email) to avoid duplicates with case differences
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique 
  ON public.waitlist (lower(email));

-- Grant table permissions BEFORE enabling RLS
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.waitlist TO anon, authenticated;

-- Enable Row Level Security
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Drop ALL old policies if they exist
DROP POLICY IF EXISTS waitlist_insert_all ON public.waitlist;
DROP POLICY IF EXISTS waitlist_insert ON public.waitlist;
DROP POLICY IF EXISTS waitlist_select ON public.waitlist;
DROP POLICY IF EXISTS waitlist_update ON public.waitlist;

-- Allow inserts from anyone (anon or authenticated)
-- For INSERT policies, only WITH CHECK is needed (USING is not used for INSERT)
CREATE POLICY waitlist_insert_all ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Verify the policy was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'waitlist' 
    AND policyname = 'waitlist_insert_all'
  ) THEN
    RAISE EXCEPTION 'Policy waitlist_insert_all was not created!';
  END IF;
END $$;
