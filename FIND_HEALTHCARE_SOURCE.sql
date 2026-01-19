-- Диагностика: почему все транзакции получают категорию Healthcare
-- Выполните ВСЕ запросы по порядку в Supabase SQL Editor

-- 1. Проверить триггеры на INSERT/UPDATE
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Transactions'
ORDER BY event_manipulation, action_timing;

-- 2. Проверить DEFAULT значение для category
SELECT 
  column_name,
  column_default,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Transactions'
  AND column_name = 'category';

-- 3. Проверить CategoryRules (может быть есть правило, которое устанавливает Healthcare)
SELECT 
  id,
  user_id,
  field,
  pattern,
  category,
  enabled,
  created_at
FROM "CategoryRules"
WHERE (user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e' OR user_id IS NULL)
  AND enabled = true
ORDER BY user_id NULLS LAST, pattern;

-- 4. Проверить, может быть есть правило с пустым pattern, которое устанавливает Healthcare для всех
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

-- 5. Проверить, может быть есть триггер, который автоматически вызывает categorize/apply
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Transactions'
  AND (action_statement LIKE '%category%' 
       OR action_statement LIKE '%Healthcare%'
       OR action_statement LIKE '%categorize%');

-- 6. Показать полную структуру таблицы Transactions
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Transactions'
ORDER BY ordinal_position;
