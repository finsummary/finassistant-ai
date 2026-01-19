# Отладка категорий

## Проблема
AI Categorize говорит "No uncategorized transactions", но категории должны быть очищены.

## Проверка в Supabase SQL Editor

Выполните эти запросы, чтобы проверить состояние категорий:

```sql
-- Проверить все транзакции пользователя
SELECT id, category, description, amount
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
ORDER BY booked_at DESC
LIMIT 10;

-- Проверить транзакции с пустой категорией
SELECT id, category, description
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
  AND (category IS NULL OR category = '' OR category = 'Uncategorized')
LIMIT 10;

-- Проверить транзакции с категорией Healthcare
SELECT COUNT(*) as healthcare_count
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
  AND category = 'Healthcare';

-- Очистить категории (если еще не очищены)
UPDATE "Transactions"
SET category = ''
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- Проверить после очистки
SELECT id, category, description
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
LIMIT 10;
```

## Проверка API запроса

AI categorize использует такой фильтр:
```
.or('category.is.null,category.eq.,category.eq.Uncategorized,category.eq.UNCATEGORIZED,category.eq.uncategorized')
```

Это должно находить:
- `category IS NULL`
- `category = ''`
- `category = 'Uncategorized'`
- и т.д.

## Возможные проблемы

1. **Категории не очищены** - UPDATE не работает из-за RLS или другой проблемы
2. **Фильтр не работает** - `.or()` запрос не находит пустые строки
3. **Кэш** - данные в кэше, не обновляются

## Решение

Если категории все еще "Healthcare", выполните в SQL Editor:

```sql
-- Принудительно очистить все категории
UPDATE "Transactions"
SET category = NULL
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e'
  AND category IS NOT NULL;

-- Проверить результат
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN category IS NULL THEN 1 END) as null_count,
  COUNT(CASE WHEN category = '' THEN 1 END) as empty_count,
  COUNT(CASE WHEN category = 'Healthcare' THEN 1 END) as healthcare_count
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';
```

Если `null_count` или `empty_count` = 16, значит категории очищены.
Если `healthcare_count` > 0, значит UPDATE не работает - попробуйте использовать `NULL` вместо `''`.
