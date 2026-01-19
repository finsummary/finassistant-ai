# Как найти учетные данные проекта Supabase

## Шаг 1: Откройте проект "FinAssistant.ai"

1. Перейдите на: https://supabase.com/dashboard
2. Найдите проект **"FinAssistant.ai"** в списке
3. Откройте его

## Шаг 2: Получите Project URL и API Keys

1. **В левом меню выберите:** Settings (шестеренка ⚙️)
2. **Выберите:** API
3. **Найдите следующие значения:**

### Project URL
- Это будет что-то вроде: `https://xxxxx.supabase.co`
- Скопируйте это значение

### API Keys
- **anon public** - это ключ, который начинается с `eyJ...`
- Это длинный JWT токен
- Скопируйте этот ключ

### (Опционально) service_role key
- Это секретный ключ для серверных операций
- НЕ используйте его в клиентском коде!
- Может понадобиться для миграций

## Шаг 3: Проверьте статус проекта

Убедитесь, что проект **Active** (не на паузе):
- В верхней части страницы должно быть "Active"
- Если видите "Paused" - нажмите "Resume" или "Unpause"

## Шаг 4: Обновите .env.local

Откройте файл `finassistant-ai/.env.local` и обновите:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ваш-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш-anon-key-здесь
```

## Шаг 5: Перезапустите сервер

```bash
# Остановите сервер (Ctrl+C)
cd finassistant-ai
npm run dev
```

## Шаг 6: Проверьте подключение

Откройте: `http://localhost:3004/test-connection`

Должно показать "✓ Connection successful!"
