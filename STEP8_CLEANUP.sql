-- ШАГ 8: Удалить тестовую транзакцию
DELETE FROM "Transactions" WHERE id LIKE 'test-%';
