-- ШАГ 1: Проверить триггеры на Transactions
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'Transactions'
ORDER BY trigger_name;
