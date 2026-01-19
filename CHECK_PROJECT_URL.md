# Проверка URL проекта Supabase

## Проблема

Проект не на паузе, но сайт недоступен. Возможно, **URL проекта в `.env.local` неправильный**.

## Замечена разница

В строке подключения PostgreSQL вы видите:
```
db.zqqhzbthcqllbfnpgtpn.supabase.co
```

Обратите внимание на ID: `npgtpn` (без второй "g")

Но в `.env.local` может быть другой ID. Нужно проверить!

## Решение

### Шаг 1: Получите правильный URL из Supabase Dashboard

1. **Откройте Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Проект "FinAssistant.ai"

2. **Перейдите в Settings → API:**
   - Левое меню → Settings (шестеренка ⚙️)
   - Выберите "API"

3. **Найдите "Project URL":**
   - Это должно быть что-то вроде: `https://xxxxx.supabase.co`
   - **Скопируйте этот URL полностью**

### Шаг 2: Проверьте `.env.local`

1. **Откройте файл:** `finassistant-ai/.env.local`

2. **Сравните URL:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   ```
   
   **Должен совпадать с URL из Dashboard!**

### Шаг 3: Обновите .env.local (если нужно)

Если URL в `.env.local` не совпадает с Dashboard:

1. **Замените URL в `.env.local`:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://правильный-url-из-dashboard.supabase.co
   ```

2. **Сохраните файл**

### Шаг 4: Перезапустите dev server

**КРИТИЧЕСКИ ВАЖНО** после изменения `.env.local`:

```bash
# Остановите сервер (Ctrl+C)
cd finassistant-ai
npm run dev
```

### Шаг 5: Проверьте подключение

1. **Откройте:** `http://localhost:3004/test-connection`
2. **Должно показать:** "✓ Connection successful!"

## Что искать в Dashboard

В Settings → API вы найдете:

```
Project URL
https://zqqhzbthcqllbfnpgtpn.supabase.co  ← ЭТО должно быть в .env.local

API Keys
anon public
eyJhbGciOiJIUzI1NiIs...                  ← ЭТО тоже должно быть в .env.local
```

## Важно о пароле PostgreSQL

**НЕ нужно** заменять `[YOUR-PASSWORD]` в строке подключения PostgreSQL для приложения Next.js!

Приложение использует:
- ✅ **Supabase REST API** (через `NEXT_PUBLIC_SUPABASE_URL`)
- ✅ **Supabase Auth** (через `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

Прямое подключение к PostgreSQL (`postgresql://...`) используется только для:
- Миграций базы данных
- Прямых SQL запросов из CLI
- НЕ используется в Next.js приложении

## Проверка

После обновления URL и перезапуска:

1. ✅ `/test-connection` показывает успех
2. ✅ Регистрация работает
3. ✅ Нет ошибок "Failed to fetch"

## Следующие шаги

1. **Проверьте URL в Dashboard** (Settings → API)
2. **Сравните с `.env.local`**
3. **Обновите если нужно**
4. **Перезапустите сервер**
5. **Попробуйте снова**
