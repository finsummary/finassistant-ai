-- ШАГ 11: УДАЛИТЬ все правила, которые могут устанавливать Healthcare неправильно
-- (выполните только если в шаге 10 найдены проблемные правила)

-- Удалить все правила с пустым pattern
DELETE FROM "CategoryRules"
WHERE pattern = '' OR pattern IS NULL;

-- Удалить все глобальные правила для Healthcare (если они есть)
DELETE FROM "CategoryRules"
WHERE category = 'Healthcare' AND user_id IS NULL;
