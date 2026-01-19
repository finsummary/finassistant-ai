-- ШАГ 13: Проверить, что триггер действительно удален
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'Transactions'
  AND trigger_name = 'trg_fn_transactions_categorize';

-- Если результат пустой (No rows returned) - триггер удален успешно!
