# Исправление проблемы очистки категорий

## Проблема
API `/api/transactions/clear-categories` возвращает успех (16 транзакций), но категории не обновляются в базе. Транзакции все еще имеют категорию "Healthcare".

## Причина
RLS (Row Level Security) политики блокируют UPDATE запросы, даже если пользователь аутентифицирован. Нужно использовать `SUPABASE_SERVICE_ROLE_KEY`.

## Решение

### Вариант 1: Добавить SUPABASE_SERVICE_ROLE_KEY (рекомендуется)

1. Откройте Supabase Dashboard
2. Перейдите в **Settings** → **API**
3. Найдите **service_role key** (секретный ключ, не путать с anon key)
4. Добавьте в `finassistant-ai/.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

5. Перезапустите dev server (`npm run dev`)

### Вариант 2: Очистить категории через SQL Editor

Если не хотите использовать service_role key, можно очистить категории напрямую через SQL:

1. Откройте Supabase Dashboard → **SQL Editor**
2. Выполните (замените `YOUR_USER_ID` на ваш user_id из консоли):

```sql
UPDATE "Transactions"
SET category = NULL
WHERE user_id = 'YOUR_USER_ID';
```

Чтобы найти ваш user_id:
- Откройте консоль браузера (F12)
- Найдите в логах: `[Clear Categories] User ...`

### Вариант 3: Проверить RLS политики

Проверьте, что RLS политики правильно настроены:

1. Supabase Dashboard → **Table Editor** → **Transactions**
2. Перейдите в **Policies**
3. Убедитесь, что есть политика `transactions_update`:

```sql
CREATE POLICY transactions_update ON "Transactions"
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

## Проверка

После применения решения:

1. Обновите страницу Dashboard
2. Нажмите "Clear & Re-categorize"
3. Проверьте консоль браузера - должны увидеть:
   - `[Clear Categories] Using service_role client` (если используется service_role key)
   - `Categories after refresh: 16 null/empty out of 16` (все категории должны быть null)

## Диагностика

### Проверить текущие категории:
В SQL Editor:
```sql
SELECT id, category, description, user_id 
FROM "Transactions" 
WHERE user_id = auth.uid()
LIMIT 10;
```

### Проверить, используется ли service_role key:
В консоли браузера после нажатия "Clear & Re-categorize" должно быть:
```
[Clear Categories] Using service_role client
```

Если видите `anon client`, значит service_role key не настроен.
