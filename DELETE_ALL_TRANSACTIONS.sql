-- Удалить все транзакции пользователя
-- Выполните в Supabase SQL Editor

-- Замените user_id на ваш ID (можно найти в Supabase Dashboard → Authentication → Users)
DELETE FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- Проверить результат (должно быть 0)
SELECT COUNT(*) as remaining_count
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';
