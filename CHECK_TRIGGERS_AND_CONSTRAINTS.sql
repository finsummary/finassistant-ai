-- Проверить триггеры на таблице Transactions
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'Transactions';

-- Проверить constraints на поле category
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public."Transactions"'::regclass
  AND conname LIKE '%category%';

-- Проверить RLS политики
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'Transactions';

-- Попробовать обновить одну транзакцию напрямую
UPDATE "Transactions"
SET category = NULL
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
  AND id = (SELECT id FROM "Transactions" WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e' LIMIT 1)
RETURNING id, category;

-- Проверить результат
SELECT id, category, description
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
LIMIT 5;
