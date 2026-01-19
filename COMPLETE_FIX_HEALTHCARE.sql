-- ПОЛНОЕ ИСПРАВЛЕНИЕ: Удалить все автоматические категоризации
-- Выполните ВСЕ команды по порядку в Supabase SQL Editor

-- ============================================
-- ШАГ 1: Проверить триггеры
-- ============================================
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Transactions';

-- Если есть триггеры - удалите их вручную:
-- DROP TRIGGER IF EXISTS trigger_name ON "Transactions";

-- ============================================
-- ШАГ 2: Проверить CategoryRules (может быть есть правило, которое устанавливает Healthcare)
-- ============================================
SELECT 
  id,
  user_id,
  field,
  pattern,
  category,
  enabled
FROM "CategoryRules"
WHERE category = 'Healthcare'
   OR pattern = ''
   OR pattern IS NULL;

-- УДАЛИТЬ все правила, которые устанавливают Healthcare:
DELETE FROM "CategoryRules"
WHERE category = 'Healthcare';

-- УДАЛИТЬ все правила с пустым pattern:
DELETE FROM "CategoryRules"
WHERE pattern = '' OR pattern IS NULL;

-- ============================================
-- ШАГ 3: Проверить DEFAULT значение
-- ============================================
SELECT 
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Transactions'
  AND column_name = 'category';

-- УДАЛИТЬ DEFAULT (если есть):
ALTER TABLE "Transactions" ALTER COLUMN category DROP DEFAULT IF EXISTS;

-- ============================================
-- ШАГ 4: Очистить все категории
-- ============================================
UPDATE "Transactions"
SET category = NULL
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- ============================================
-- ШАГ 5: Проверить результат
-- ============================================
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN category IS NULL THEN 1 END) as null_count,
  COUNT(CASE WHEN category = 'Healthcare' THEN 1 END) as healthcare_count
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- Если null_count = total и healthcare_count = 0 - УСПЕХ!
