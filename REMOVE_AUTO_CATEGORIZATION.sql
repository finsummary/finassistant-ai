-- Удалить автоматическую категоризацию из базы данных
-- Выполните в Supabase SQL Editor

-- 1. Проверить все триггеры на Transactions
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Transactions';

-- 2. Если есть триггеры, которые устанавливают категории - удалить их
-- (замените trigger_name на реальное имя из шага 1)
-- DROP TRIGGER IF EXISTS trigger_name ON "Transactions";

-- 3. Проверить DEFAULT значение для category (должно быть NULL)
SELECT 
  column_name,
  column_default,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Transactions'
  AND column_name = 'category';

-- 4. Если DEFAULT не NULL - установить NULL
-- ALTER TABLE "Transactions" ALTER COLUMN category DROP DEFAULT;

-- 5. Очистить все категории для вашего пользователя
UPDATE "Transactions"
SET category = NULL
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- 6. Проверить результат
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN category IS NULL THEN 1 END) as null_count,
  COUNT(CASE WHEN category = 'Healthcare' THEN 1 END) as healthcare_count
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';
