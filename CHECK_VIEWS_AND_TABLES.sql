-- Проверить, может быть есть view или другая таблица
-- Выполните в Supabase SQL Editor

-- 1. Проверить все таблицы и views с именем Transactions
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name LIKE '%Transaction%'
ORDER BY table_schema, table_name;

-- 2. Проверить, может быть есть view на Transactions
SELECT 
  table_schema,
  table_name,
  view_definition
FROM information_schema.views
WHERE table_name LIKE '%Transaction%';

-- 3. Проверить, что мы обновляем правильную таблицу
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables
WHERE tablename = 'Transactions';

-- 4. Попробовать обновить через полное имя таблицы
UPDATE public."Transactions"
SET category = NULL
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- 5. Проверить результат
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN category IS NULL THEN 1 END) as null_count,
  COUNT(CASE WHEN category = 'Healthcare' THEN 1 END) as healthcare_count
FROM public."Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- 6. Проверить, может быть категории устанавливаются через триггер AFTER UPDATE
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Transactions'
  AND action_timing = 'AFTER'
  AND event_manipulation = 'UPDATE';
