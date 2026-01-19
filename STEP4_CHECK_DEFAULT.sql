-- ШАГ 4: Проверить DEFAULT значение для category
SELECT 
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Transactions'
  AND column_name = 'category';
