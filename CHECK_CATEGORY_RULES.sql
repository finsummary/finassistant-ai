-- Проверить CategoryRules, которые могут устанавливать Healthcare
-- Выполните в Supabase SQL Editor

-- 1. Проверить все CategoryRules для вашего пользователя
SELECT 
  id,
  user_id,
  field,
  pattern,
  category,
  enabled
FROM "CategoryRules"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
   OR user_id IS NULL
ORDER BY user_id NULLS LAST, pattern;

-- 2. Проверить, может быть есть правило, которое устанавливает Healthcare для всех транзакций
SELECT 
  id,
  user_id,
  field,
  pattern,
  category,
  enabled
FROM "CategoryRules"
WHERE category = 'Healthcare'
  AND (user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e' OR user_id IS NULL);

-- 3. Удалить все CategoryRules для вашего пользователя (если они есть)
DELETE FROM "CategoryRules"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- 4. Проверить, может быть есть триггер, который автоматически категоризирует транзакции
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Transactions'
  AND (action_statement LIKE '%category%' OR action_statement LIKE '%Healthcare%');
