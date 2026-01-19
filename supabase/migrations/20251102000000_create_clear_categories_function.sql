-- Create a function to clear categories from user's transactions
-- This bypasses REST API issues with UPDATE queries

CREATE OR REPLACE FUNCTION clear_user_transaction_categories(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE "Transactions"
  SET category = ''
  WHERE user_id = target_user_id;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION clear_user_transaction_categories(UUID) TO authenticated;
