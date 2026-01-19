-- ШАГ 7: Проверить, какая категория установилась
SELECT id, description, category, created_at
FROM "Transactions"
WHERE id LIKE 'test-%'
ORDER BY created_at DESC
LIMIT 1;
