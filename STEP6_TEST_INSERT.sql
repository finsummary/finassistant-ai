-- ШАГ 6: Вставить тестовую транзакцию с NULL категорией
INSERT INTO "Transactions" (id, account_id, amount, currency, description, booked_at, user_id, category)
VALUES ('test-' || gen_random_uuid()::text, 'test-account', 100, 'USD', 'Test transaction', CURRENT_DATE, '8b8f208f-3778-4a84-aa0f-b94de8ff303e', NULL)
ON CONFLICT (id) DO NOTHING;
