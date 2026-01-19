-- ПРИНУДИТЕЛЬНОЕ УДАЛЕНИЕ ВСЕХ ТРИГГЕРОВ И DEFAULT ЗНАЧЕНИЙ
-- Выполните ВСЕ команды по порядку в Supabase SQL Editor

-- 1. Показать ВСЕ триггеры на Transactions
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Transactions';

-- 2. УДАЛИТЬ ВСЕ триггеры на Transactions (выполните для каждого триггера из шага 1)
-- Замените trigger_name на реальные имена из шага 1
-- DROP TRIGGER IF EXISTS trigger_name ON "Transactions";

-- 3. Проверить DEFAULT значение для category
SELECT 
  column_name,
  column_default,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Transactions'
  AND column_name = 'category';

-- 4. УДАЛИТЬ DEFAULT значение (если есть)
ALTER TABLE "Transactions" ALTER COLUMN category DROP DEFAULT;

-- 5. Установить category в NULL для всех транзакций пользователя
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

-- 7. Показать примеры транзакций
SELECT 
  id,
  description,
  amount,
  category
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
LIMIT 5;
