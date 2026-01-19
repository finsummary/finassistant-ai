# Исправление ошибки CORS при регистрации

## Проблема

```
Запрос из постороннего источника заблокирован: Политика одного источника запрещает чтение удалённого ресурса
```

Это означает, что Supabase блокирует запросы с `localhost:3004` из-за настроек CORS.

## Решение (обязательно!)

### Шаг 1: Настройте URL Configuration в Supabase

1. **Откройте Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Выберите проект "FinAssistant.ai"

2. **Перейдите в Authentication → URL Configuration:**
   - В левом меню: Authentication (иконка замка)
   - Выберите "URL Configuration"

3. **Установите Site URL:**
   ```
   http://localhost:3004
   ```
   ⚠️ **Важно**: Без слэша в конце, с `http://`

4. **Добавьте Redirect URLs:**
   Нажмите "Add URL" и добавьте каждую по отдельности:
   ```
   http://localhost:3004/**
   http://localhost:3004/auth/callback
   http://localhost:3004/dashboard
   ```

5. **Сохраните изменения** (кнопка "Save" внизу)

### Шаг 2: Отключите Email Confirmations (для разработки)

1. **Authentication → Providers → Email**
2. **Отключите "Confirm email"** (Disable email confirmations)
   - Это позволит сразу входить после регистрации
   - Для продакшена можно будет включить обратно

3. **Сохраните изменения**

### Шаг 3: Перезапустите dev server

**ОБЯЗАТЕЛЬНО** после изменения настроек в Supabase:

1. Остановите сервер: `Ctrl+C`
2. Запустите снова:
   ```bash
   cd finassistant-ai
   npm run dev
   ```

### Шаг 4: Очистите кеш браузера

1. Нажмите `Ctrl+Shift+R` (hard refresh)
2. Или откройте в режиме инкогнито (Ctrl+Shift+N)

### Шаг 5: Попробуйте снова

Попробуйте зарегистрироваться снова. Если ошибка сохраняется:

1. Проверьте в консоли браузера (F12):
   - Убедитесь, что ошибка CORS исчезла
   - Если есть другие ошибки - сообщите

2. Проверьте, что URL правильно настроен:
   - В Supabase Dashboard → Authentication → URL Configuration
   - Site URL должен быть `http://localhost:3004`
   - Redirect URLs должны включать `http://localhost:3004/**`

## Визуальное руководство

### Шаг 1: Откройте URL Configuration

```
Supabase Dashboard
  └─> Authentication (левое меню)
      └─> URL Configuration
```

### Шаг 2: Заполните поля

```
Site URL:
[ http://localhost:3004                    ]

Redirect URLs:
[ http://localhost:3004/**              ] [Remove]
[ http://localhost:3004/auth/callback   ] [Remove]
[ http://localhost:3004/dashboard       ] [Remove]
[ + Add URL                             ]
```

### Шаг 3: Сохраните

Нажмите кнопку **"Save"** внизу страницы.

## Почему это важно

Supabase использует CORS (Cross-Origin Resource Sharing) для безопасности. 
Если Site URL не настроен, Supabase будет блокировать все запросы с `localhost:3004`.

**После настройки Site URL и Redirect URLs**, CORS политика разрешит запросы с вашего локального сервера.

## Проверка

После настройки, в консоли браузера НЕ должно быть:
- ❌ "Запрос из постороннего источника заблокирован"
- ❌ "CORS policy"
- ❌ "NetworkError when attempting to fetch resource" (из-за CORS)

Вместо этого должна быть успешная регистрация! ✅
