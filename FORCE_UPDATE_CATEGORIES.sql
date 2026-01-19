-- Принудительное обновление категорий через service_role
-- Выполните это в Supabase SQL Editor

-- Вариант 1: Отключить RLS временно (только для этого запроса)
ALTER TABLE "Transactions" DISABLE ROW LEVEL SECURITY;

UPDATE "Transactions"
SET category = NULL
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- Включить RLS обратно
ALTER TABLE "Transactions" ENABLE ROW LEVEL SECURITY;

-- Проверить результат
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN category IS NULL THEN 1 END) as null_count,
  COUNT(CASE WHEN category = 'Healthcare' THEN 1 END) as healthcare_count
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- Если healthcare_count = 0 и null_count = 16, значит успешно!
