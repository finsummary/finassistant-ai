# Исправление ошибки NetworkError при регистрации

## Проблема

При попытке зарегистрироваться возникает `NetworkError when attempting to fetch resource`.

## Решение

### Шаг 1: Проверьте настройки аутентификации в Supabase

1. **Откройте Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Проект "FinAssistant.ai"

2. **Настройте URL Configuration:**
   - Authentication → URL Configuration
   - **Site URL**: `http://localhost:3004`
   - **Redirect URLs**: добавьте:
     ```
     http://localhost:3004/**
     http://localhost:3004/auth/callback
     ```

3. **Проверьте Email Provider:**
   - Authentication → Providers → Email
   - Убедитесь, что Email включен
   - Для разработки можно отключить "Confirm email" (Disable email confirmations)

### Шаг 2: Перезапустите dev server

**КРИТИЧЕСКИ ВАЖНО**: После изменения настроек в Supabase или .env.local:

1. **Остановите сервер:**
   - Нажмите `Ctrl+C` в терминале

2. **Запустите снова:**
   ```bash
   cd finassistant-ai
   npm run dev
   ```

3. **Дождитесь "Ready":**
   ```
   ✓ Ready in X seconds
   ○ Local: http://localhost:3004
   ```

### Шаг 3: Проверьте .env.local

Убедитесь, что файл содержит правильные значения:

```env
NEXT_PUBLIC_SUPABASE_URL=https://zqqhzbthcqllbfnpgptpn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Шаг 4: Очистите кеш браузера

1. Откройте DevTools (F12)
2. Правый клик на кнопке обновления
3. Выберите "Empty Cache and Hard Reload"

Или просто:
- `Ctrl+Shift+R` (hard refresh)

### Шаг 5: Проверьте консоль браузера

1. Откройте DevTools (F12) → Console
2. Попробуйте зарегистрироваться снова
3. Посмотрите, какие ошибки появляются

## Частые причины

1. **Site URL не настроен** в Supabase → настройте в Authentication → URL Configuration
2. **Сервер не перезапущен** после изменения .env.local → перезапустите
3. **Email confirmations включены** → отключите для разработки
4. **CORS проблемы** → проверьте настройки в Supabase

## После исправления

Попробуйте зарегистрироваться снова. Если проблема сохраняется:
- Проверьте консоль браузера (F12) для детальных ошибок
- Убедитесь, что проект Supabase активен (не на паузе)
