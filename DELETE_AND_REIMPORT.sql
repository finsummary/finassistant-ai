-- Удалить все транзакции и заново импортировать CSV
-- Выполните в Supabase SQL Editor

-- 1. Удалить все транзакции пользователя
DELETE FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- 2. Проверить, что транзакции удалены
SELECT COUNT(*) as remaining_count
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- Если remaining_count = 0, значит все транзакции удалены
-- Теперь заново импортируйте CSV через Dashboard → Import CSV
-- После импорта категории будут NULL (не будут установлены автоматически)
