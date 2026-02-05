# Troubleshooting Waitlist API

## Проверка RLS политик в Supabase

1. **Откройте Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Выберите проект "FinAssistant.ai"

2. **Проверьте политики:**
   - Authentication → Policies
   - Найдите таблицу `Waitlist`
   - Должна быть политика `waitlist_insert_all` для INSERT

3. **Если политики нет, выполните SQL:**
   ```sql
   -- Удалить старую политику если есть
   DROP POLICY IF EXISTS waitlist_insert_all ON public."Waitlist";
   
   -- Создать новую политику
   CREATE POLICY waitlist_insert_all ON public."Waitlist"
     FOR INSERT
     TO public, anon, authenticated
     WITH CHECK (true);
   ```

## Проверка имени таблицы

Таблица должна называться **`Waitlist`** (с большой буквы) - это важно!

Проверьте в Table Editor, что таблица именно `Waitlist`, а не `waitlist`.

## Проверка через SQL Editor

Попробуйте вставить запись напрямую через SQL:

```sql
INSERT INTO public."Waitlist" (email, source)
VALUES ('test@example.com', 'test')
RETURNING *;
```

Если это работает, значит проблема в API или RLS политиках.

## Проверка логов

1. **В браузере (F12 → Console):** посмотрите детали ошибки
2. **В терминале:** где запущен `npm run dev` - там должны быть логи `[Waitlist API]`

## Возможные проблемы

### 1. RLS политика не работает
**Решение:** Пересоздайте политику (см. выше)

### 2. Имя таблицы неправильное
**Решение:** Убедитесь, что таблица называется `Waitlist` (с большой буквы)

### 3. Anon key не настроен
**Решение:** Проверьте `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 4. CORS ошибка
**Решение:** Проверьте настройки CORS в Supabase Dashboard

## Тестирование API напрямую

```bash
curl -X POST http://localhost:3004/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "source": "test"}'
```
