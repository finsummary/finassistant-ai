-- ШАГ 12: Финальный тест - вставить транзакцию и проверить категорию
-- Удалить старые тестовые транзакции
DELETE FROM "Transactions" WHERE id LIKE 'test-%';

-- Вставить новую тестовую транзакцию
INSERT INTO "Transactions" (id, account_id, amount, currency, description, booked_at, user_id, category)
VALUES ('test-final-' || gen_random_uuid()::text, 'test-account', -100, 'USD', 'Test Office Rent', CURRENT_DATE, '8b8f208f-3778-4a84-aa0f-b94de8ff303e', NULL)
ON CONFLICT (id) DO NOTHING;

-- Проверить категорию
SELECT id, description, category, created_at
FROM "Transactions"
WHERE id LIKE 'test-final-%'
ORDER BY created_at DESC
LIMIT 1;

-- Если category = NULL или category != 'Healthcare' - УСПЕХ!
-- Если category = 'Healthcare' - значит проблема еще не решена
