-- ШАГ 9: УДАЛИТЬ триггер, который автоматически категоризирует транзакции
DROP TRIGGER IF EXISTS trg_fn_transactions_categorize ON "Transactions";

-- Проверить, что триггер удален
SELECT 
  trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'Transactions'
  AND trigger_name = 'trg_fn_transactions_categorize';
