-- Проверить триггеры на INSERT и DEFAULT значения
-- Выполните в Supabase SQL Editor

-- 1. Проверить триггеры на INSERT
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'Transactions'
  AND event_manipulation = 'INSERT';

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

-- 3. Проверить, может быть есть триггер BEFORE INSERT
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Transactions'
  AND action_timing = 'BEFORE'
  AND event_manipulation = 'INSERT';

-- 4. Проверить, может быть есть триггер AFTER INSERT
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Transactions'
  AND action_timing = 'AFTER'
  AND event_manipulation = 'INSERT';
