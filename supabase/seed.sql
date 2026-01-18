-- Seed script for test data
-- This script creates sample data for testing the application
-- Run with: supabase db reset (if seed is enabled in config.toml)

-- Note: This seed script requires an authenticated user
-- In a real scenario, you would need to:
-- 1. Create a test user via Supabase Auth
-- 2. Get the user_id
-- 3. Use that user_id in the seed data

-- Example seed data structure (commented out - requires actual user_id):
/*
-- Sample Organization
INSERT INTO public."Organizations" (user_id, business_name, country)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Test Business Ltd', 'United Kingdom')
ON CONFLICT (user_id) DO NOTHING;

-- Sample Bank Account
INSERT INTO public."BankAccounts" (id, provider, account_name, currency, user_id)
VALUES 
  ('manual_test_001', 'Manual', 'Main Business Account', 'GBP', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Sample Transactions (last 3 months)
INSERT INTO public."Transactions" (id, account_id, amount, currency, description, booked_at, user_id)
VALUES 
  -- January 2025
  ('tx_001', 'manual_test_001', 5000.00, 'GBP', 'Client Payment - Project Alpha', '2025-01-15', '00000000-0000-0000-0000-000000000001'),
  ('tx_002', 'manual_test_001', -1200.00, 'GBP', 'Office Rent', '2025-01-16', '00000000-0000-0000-0000-000000000001'),
  ('tx_003', 'manual_test_001', -29.99, 'GBP', 'Software Subscription', '2025-01-17', '00000000-0000-0000-0000-000000000001'),
  ('tx_004', 'manual_test_001', 3000.00, 'GBP', 'Client Payment - Project Beta', '2025-01-18', '00000000-0000-0000-0000-000000000001'),
  ('tx_005', 'manual_test_001', -45.00, 'GBP', 'Internet Bill', '2025-01-19', '00000000-0000-0000-0000-000000000001'),
  -- February 2025
  ('tx_006', 'manual_test_001', 4000.00, 'GBP', 'Client Payment - Project Gamma', '2025-02-10', '00000000-0000-0000-0000-000000000001'),
  ('tx_007', 'manual_test_001', -1200.00, 'GBP', 'Office Rent', '2025-02-16', '00000000-0000-0000-0000-000000000001'),
  ('tx_008', 'manual_test_001', -320.00, 'GBP', 'Marketing Expenses', '2025-02-20', '00000000-0000-0000-0000-000000000001'),
  ('tx_009', 'manual_test_001', 2500.00, 'GBP', 'Client Payment - Project Delta', '2025-02-25', '00000000-0000-0000-0000-000000000001'),
  -- March 2025
  ('tx_010', 'manual_test_001', 3500.00, 'GBP', 'Client Payment - Project Epsilon', '2025-03-05', '00000000-0000-0000-0000-000000000001'),
  ('tx_011', 'manual_test_001', -1200.00, 'GBP', 'Office Rent', '2025-03-16', '00000000-0000-0000-0000-000000000001'),
  ('tx_012', 'manual_test_001', -850.00, 'GBP', 'Equipment Purchase', '2025-03-22', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Sample Planned Income
INSERT INTO public."PlannedIncome" (user_id, description, amount, expected_date, recurrence)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Monthly Retainer - Client A', 2000.00, '2025-04-01', 'monthly'),
  ('00000000-0000-0000-0000-000000000001', 'Project Payment - New Client', 5000.00, '2025-04-15', 'one-off')
ON CONFLICT DO NOTHING;

-- Sample Planned Expenses
INSERT INTO public."PlannedExpenses" (user_id, description, amount, expected_date, recurrence)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Office Rent', 1200.00, '2025-04-16', 'monthly'),
  ('00000000-0000-0000-0000-000000000001', 'Annual Software License', 1200.00, '2025-04-30', 'one-off'),
  ('00000000-0000-0000-0000-000000000001', 'Marketing Campaign', 500.00, '2025-05-01', 'one-off')
ON CONFLICT DO NOTHING;

-- Sample Categories
INSERT INTO public."Categories" (name, type, user_id)
VALUES 
  ('Income', 'income', '00000000-0000-0000-0000-000000000001'),
  ('Rent', 'expense', '00000000-0000-0000-0000-000000000001'),
  ('Software', 'expense', '00000000-0000-0000-0000-000000000001'),
  ('Marketing', 'expense', '00000000-0000-0000-0000-000000000001'),
  ('Equipment', 'expense', '00000000-0000-0000-0000-000000000001'),
  ('Utilities', 'expense', '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;
*/

-- Instructions for using this seed file:
-- 1. Create a test user via Supabase Auth UI or API
-- 2. Copy the user_id from auth.users
-- 3. Replace '00000000-0000-0000-0000-000000000001' with the actual user_id
-- 4. Uncomment the INSERT statements above
-- 5. Run: supabase db reset (if seed is enabled)
