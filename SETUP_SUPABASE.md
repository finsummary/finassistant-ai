# Настройка нового проекта Supabase

## Шаг 1: Создание проекта в Supabase

1. **Откройте Supabase Dashboard:**
   - Перейдите на: https://supabase.com/dashboard
   - Войдите в свой аккаунт (или создайте новый)

2. **Создайте новый проект:**
   - Нажмите "New Project"
   - Заполните форму:
     - **Name**: `FinAssistant` (или любое другое имя)
     - **Database Password**: придумайте надежный пароль (сохраните его!)
     - **Region**: выберите ближайший регион
     - **Pricing Plan**: выберите "Free" для начала

3. **Дождитесь создания проекта:**
   - Это займет 1-2 минуты
   - Дождитесь сообщения "Your project is ready"

## Шаг 2: Получение учетных данных

1. **Откройте Settings → API:**
   - В левом меню выберите "Settings" (шестеренка)
   - Выберите "API"

2. **Скопируйте следующие значения:**
   - **Project URL** (например: `https://xxxxx.supabase.co`)
   - **anon/public key** (длинный JWT токен)

## Шаг 3: Обновление .env.local

1. **Откройте файл:** `finassistant-ai/.env.local`

2. **Замените значения:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://ваш-проект.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш-anon-key-здесь
   ```

3. **Сохраните файл**

## Шаг 4: Запуск миграций

1. **Откройте SQL Editor в Supabase:**
   - В левом меню выберите "SQL Editor"
   - Нажмите "New query"

2. **Выполните миграции:**
   - Откройте файл: `finassistant-ai/supabase/migrations/ALL_MIGRATIONS.sql`
   - Скопируйте весь содержимое
   - Вставьте в SQL Editor
   - Нажмите "Run" (или Ctrl+Enter)

3. **Проверьте результат:**
   - Должно быть сообщение "Success. No rows returned"
   - Проверьте, что таблицы созданы: Database → Tables

## Шаг 5: Настройка аутентификации

1. **Откройте Authentication → Providers:**
   - В левом меню выберите "Authentication"
   - Выберите "Providers"

2. **Включите Email provider:**
   - Найдите "Email"
   - Убедитесь, что он включен
   - Настройте "Confirm email" по необходимости:
     - Для разработки можно отключить (Disable email confirmations)
     - Для продакшена лучше включить

3. **Настройте Site URL:**
   - Authentication → URL Configuration
   - Site URL: `http://localhost:3004`
   - Redirect URLs: добавьте `http://localhost:3004/**`

## Шаг 6: Перезапуск dev server

1. **Остановите сервер:**
   - Нажмите `Ctrl+C` в терминале

2. **Запустите снова:**
   ```bash
   cd finassistant-ai
   npm run dev
   ```

3. **Проверьте подключение:**
   - Откройте: `http://localhost:3004/test-connection`
   - Должно показать "✓ Connection successful!"

## Готово!

Теперь вы можете:
- Зарегистрироваться: `http://localhost:3004/login`
- Войти в систему
- Начать использовать приложение

## Полезные ссылки

- Supabase Dashboard: https://supabase.com/dashboard
- Документация: https://supabase.com/docs
- SQL Editor: доступен в Dashboard → SQL Editor
