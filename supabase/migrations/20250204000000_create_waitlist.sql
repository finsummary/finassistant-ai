-- Create waitlist table for collecting email addresses
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT DEFAULT 'pending', -- pending, approved, notified
  metadata JSONB, -- для дополнительной информации
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS waitlist_email_idx ON public.waitlist(email);
CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON public.waitlist(created_at);
CREATE INDEX IF NOT EXISTS waitlist_status_idx ON public.waitlist(status);

-- Enable Row Level Security
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone (anon) can insert (add email to waitlist)
CREATE POLICY waitlist_insert ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users can read (for admin panel)
CREATE POLICY waitlist_select ON public.waitlist
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only authenticated users can update (for admin panel)
CREATE POLICY waitlist_update ON public.waitlist
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_waitlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER waitlist_updated_at
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_waitlist_updated_at();

-- Add comment to table
COMMENT ON TABLE public.waitlist IS 'Waitlist for collecting email addresses from landing page';
