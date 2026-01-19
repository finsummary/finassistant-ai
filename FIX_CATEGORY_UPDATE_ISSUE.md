# Исправление проблемы обновления категорий

## Проблема
SQL функция `clear_user_transaction_categories` выполняется успешно, но категории остаются "Healthcare".

## Решение через SQL Editor (надежный способ)

1. Откройте **Supabase Dashboard → SQL Editor**
2. Выполните этот SQL **напрямую** (не через функцию):

```sql
-- Проверить текущее состояние
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN category IS NULL THEN 1 END) as null_count,
  COUNT(CASE WHEN category = '' THEN 1 END) as empty_count,
  COUNT(CASE WHEN category = 'Healthcare' THEN 1 END) as healthcare_count
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- Очистить категории (использовать NULL, не пустую строку)
UPDATE "Transactions"
SET category = NULL
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- Проверить результат
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN category IS NULL THEN 1 END) as null_count,
  COUNT(CASE WHEN category = '' THEN 1 END) as empty_count,
  COUNT(CASE WHEN category = 'Healthcare' THEN 1 END) as healthcare_count
FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- Если healthcare_count = 0 и null_count = 16, значит успешно очищено!
```

3. После успешного UPDATE:
   - Обновите Dashboard (F5)
   - Нажмите "AI Categorize" - должно найти 16 транзакций

## Возможные причины проблемы

1. **RLS блокирует UPDATE** - даже через service_role (невероятно, но возможно)
2. **Триггер перезаписывает категории** - проверьте триггеры на таблице Transactions
3. **Кэширование** - данные в кэше, не обновляются
4. **SQL функция выполняется, но не сохраняет изменения** - возможно, проблема с транзакциями

## Проверка триггеров

Выполните в SQL Editor:

```sql
-- Проверить триггеры на таблице Transactions
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'Transactions';
```

Если есть триггеры, которые обновляют `category`, их нужно отключить или изменить.

## Альтернативное решение

Если UPDATE все еще не работает, можно удалить и заново импортировать транзакции:

```sql
-- Удалить все транзакции пользователя
DELETE FROM "Transactions"
WHERE user_id = '8b8f208f-3778-4a84-aa0f-b94de8ff303e';

-- Затем заново импортировать CSV через Dashboard
```

Но это крайняя мера - сначала попробуйте UPDATE с NULL напрямую в SQL Editor.
