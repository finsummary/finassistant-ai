-- Диагностика проблемы с UPDATE
-- Выполните по порядку в Supabase SQL Editor

-- 1. Проверить текущее состояние
SELECT 
  id,
  category,
  description,
  user_id
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
LIMIT 5;

-- 2. Попробовать UPDATE с RETURNING (чтобы увидеть, что действительно обновляется)
BEGIN;

UPDATE "Transactions"
SET category = 'TEST_VALUE_12345'
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
RETURNING id, category;

-- Проверить внутри транзакции
SELECT id, category FROM "Transactions" 
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
LIMIT 5;

-- Откатить, чтобы не сохранить TEST_VALUE
ROLLBACK;

-- 3. Проверить, может быть UPDATE не находит строки (другая таблица или схема?)
SELECT 
  schemaname,
  tablename,
  COUNT(*) as row_count
FROM pg_tables 
WHERE tablename = 'Transactions'
GROUP BY schemaname, tablename;

-- 4. Проверить, что user_id правильный (может быть разный формат)
SELECT DISTINCT user_id FROM "Transactions" LIMIT 10;

-- 5. Попробовать UPDATE одной строки по ID
SELECT id, category FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
LIMIT 1;

-- Затем используйте ID из результата:
-- UPDATE "Transactions"
-- SET category = NULL
-- WHERE id = 'ID_ИЗ_РЕЗУЛЬТАТА_ВЫШЕ';

-- 6. Проверить, может быть есть другая таблица с транзакциями?
SELECT 
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_name LIKE '%Transaction%'
ORDER BY table_schema, table_name;
