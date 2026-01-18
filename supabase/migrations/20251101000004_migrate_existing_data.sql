-- Migration script to populate user_id for existing records
-- This handles the case where records were created before user_id was added

-- For BankAccounts: try to derive user_id from account_id pattern or set to null (will be filtered by RLS)
-- Note: Manual accounts have pattern 'manual_{userId}_{timestamp}_{random}'
-- For existing accounts without user_id, we'll leave them as null (RLS will hide them)

-- For Transactions: try to derive user_id from account_id via BankAccounts
-- If account has user_id, update transaction
update public."Transactions" t
set user_id = b.user_id
from public."BankAccounts" b
where t.account_id = b.id
  and t.user_id is null
  and b.user_id is not null;

-- For transactions with account_id matching manual pattern, extract user_id
-- Pattern: manual_{userId}_{timestamp}_{random}
update public."Transactions" t
set user_id = (
  select substring(t.account_id from 'manual_([^_]+)')::uuid
)
where t.user_id is null
  and t.account_id like 'manual_%'
  and substring(t.account_id from 'manual_([^_]+)') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Clean up: delete transactions without user_id (orphaned records)
-- These are likely test data or records that can't be associated with a user
delete from public."Transactions"
where user_id is null;

-- Clean up: delete bank accounts without user_id
delete from public."BankAccounts"
where user_id is null;
