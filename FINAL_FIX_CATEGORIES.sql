-- ФИНАЛЬНОЕ РЕШЕНИЕ: Принудительное обновление категорий
-- Выполните ВСЕ команды по порядку в Supabase SQL Editor

-- ШАГ 1: Проверить триггеры
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'Transactions';

-- ШАГ 2: Если есть триггеры - отключить их временно
-- (замените trigger_name на реальное имя из шага 1)
-- ALTER TABLE "Transactions" DISABLE TRIGGER trigger_name;

-- ШАГ 3: Отключить RLS
ALTER TABLE "Transactions" DISABLE ROW LEVEL SECURITY;

-- ШАГ 4: Обновить категории
UPDATE "Transactions"
SET category = NULL
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- ШАГ 5: Включить RLS обратно
ALTER TABLE "Transactions" ENABLE ROW LEVEL SECURITY;

-- ШАГ 6: Включить триггеры обратно (если отключали)
-- ALTER TABLE "Transactions" ENABLE TRIGGER trigger_name;

-- ШАГ 7: Проверить результат
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN category IS NULL THEN 1 END) as null_count,
  COUNT(CASE WHEN category = 'Healthcare' THEN 1 END) as healthcare_count
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- Если null_count = 16 и healthcare_count = 0 - УСПЕХ!
