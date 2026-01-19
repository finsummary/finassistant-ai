-- УДАЛИТЬ ТРИГГЕР, КОТОРЫЙ УСТАНАВЛИВАЕТ HEALTHCARE
-- Выполните в Supabase SQL Editor

-- 1. Найти ВСЕ триггеры на Transactions
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Transactions'
ORDER BY trigger_name;

-- 2. УДАЛИТЬ ВСЕ триггеры на Transactions автоматически
-- (этот скрипт найдет и удалит все триггеры)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'Transactions'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON "Transactions"';
        RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
    END LOOP;
END $$;

-- 3. Проверить функции, которые могут вызываться триггерами
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_definition LIKE '%Healthcare%' OR routine_definition LIKE '%category%')
  AND routine_type = 'FUNCTION';

-- 4. Проверить, есть ли DEFAULT значение для category
SELECT 
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Transactions'
  AND column_name = 'category';

-- 5. УДАЛИТЬ DEFAULT значение для category (выполните только если в шаге 4 показан DEFAULT)
-- Раскомментируйте следующую строку, если DEFAULT есть:
-- ALTER TABLE "Transactions" ALTER COLUMN category DROP DEFAULT;

-- 6. Попробовать вставить тестовую транзакцию с NULL категорией
-- (замените user_id на ваш)
INSERT INTO "Transactions" (id, account_id, amount, currency, description, booked_at, user_id, category)
VALUES ('test-' || gen_random_uuid()::text, 'test-account', 100, 'USD', 'Test transaction', CURRENT_DATE, '8b8f208f-3778-4a84-aa0f-b94de8ff303e', NULL)
ON CONFLICT (id) DO NOTHING;

-- 7. Проверить, какая категория установилась (если Healthcare - значит есть триггер)
SELECT id, description, category
FROM "Transactions"
WHERE id LIKE 'test-%'
ORDER BY created_at DESC
LIMIT 1;

-- 8. Если категория все еще Healthcare - удалить тестовую транзакцию и искать дальше
-- DELETE FROM "Transactions" WHERE id LIKE 'test-%';
