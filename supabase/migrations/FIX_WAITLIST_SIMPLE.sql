-- Simple fix for waitlist table - run this in Supabase SQL Editor
-- This script will completely recreate the table with proper permissions

-- Step 1: Drop existing table (WARNING: This deletes all data!)
DROP TABLE IF EXISTS public."Waitlist" CASCADE;
DROP TABLE IF EXISTS public.waitlist CASCADE;

-- Step 2: Create the table
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Create unique index
CREATE UNIQUE INDEX waitlist_email_unique ON public.waitlist (lower(email));

-- Step 4: Grant permissions on schema and table
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO anon, authenticated;

-- Step 5: Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Step 6: Create insert policy (allow anyone to insert)
DROP POLICY IF EXISTS waitlist_insert_all ON public.waitlist;
CREATE POLICY waitlist_insert_all 
  ON public.waitlist
  FOR INSERT 
  TO anon, authenticated
  WITH CHECK (true);

-- Step 7: Verify everything is set up correctly
DO $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'waitlist'
  ) THEN
    RAISE EXCEPTION 'Table waitlist was not created!';
  END IF;
  
  -- Check if policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'waitlist' 
    AND policyname = 'waitlist_insert_all'
  ) THEN
    RAISE EXCEPTION 'Policy waitlist_insert_all was not created!';
  END IF;
  
  RAISE NOTICE 'Waitlist table and policy created successfully!';
END $$;
