# Исправление проблемы подключения к Supabase

## Текущая ситуация

✅ **Переменные окружения загружены** (envCheck показывает "SET")
❌ **Не удается подключиться к Supabase API** (NetworkError)

## Наиболее вероятные причины

### 1. Проект Supabase на паузе

**Проверка:**
1. Откройте: https://supabase.com/dashboard/project/zpqhzbthcqllbfnpgptpn
2. Проверьте статус проекта в верхней части страницы
3. Если проект на паузе, нажмите "Resume" или "Unpause"

**Решение:** Активируйте проект в Supabase Dashboard

### 2. Проблемы с CORS

**Проверка:**
1. Откройте консоль браузера (F12)
2. Перейдите на вкладку "Network"
3. Попробуйте загрузить `/test-connection` снова
4. Найдите запросы к Supabase
5. Проверьте, есть ли ошибки CORS (красные запросы)

**Решение:** 
- Проверьте настройки CORS в Supabase Dashboard
- Убедитесь, что `http://localhost:3004` разрешен

### 3. Прямая проверка доступности

**Проверка в браузере:**
Откройте в новой вкладке:
```
https://zpqhzbthcqllbfnpgptpn.supabase.co/rest/v1/
```

**Ожидаемый результат:**
- Если видите JSON ответ (даже с ошибкой) - подключение работает
- Если видите "This site can't be reached" - проект на паузе или URL неверный

### 4. Проверка через curl (PowerShell)

```powershell
Invoke-WebRequest -Uri "https://zpqhzbthcqllbfnpgptpn.supabase.co/rest/v1/" -Method GET -Headers @{"apikey"="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxcWh6YnRoY3FsbGJmbnBndHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNTAyOTUsImV4cCI6MjA3MTcyNjI5NX0.QufYCa4jQxsm7S_3NgsIKqZyiEQMP8NH5khUCiPGT6Q"}
```

Если команда выполняется успешно - проблема в браузере/CORS.
Если ошибка - проблема в Supabase проекте.

## Быстрое решение

1. **Проверьте статус проекта:**
   - https://supabase.com/dashboard/project/zpqhzbthcqllbfnpgptpn
   - Убедитесь, что проект **Active** (не Paused)

2. **Попробуйте в режиме инкогнито:**
   - Откройте новое окно в режиме инкогнито
   - Перейдите на `http://localhost:3004/test-connection`
   - Это исключит проблемы с расширениями браузера

3. **Проверьте консоль браузера:**
   - F12 → Console
   - Ищите ошибки CORS или Network
   - F12 → Network → попробуйте снова → проверьте запросы к Supabase

4. **Проверьте файрвол/антивирус:**
   - Убедитесь, что они не блокируют подключения к `*.supabase.co`

## Если ничего не помогает

1. Создайте новый проект Supabase
2. Скопируйте новые URL и ключи
3. Обновите `.env.local`
4. Перезапустите сервер

## Обновленный код

Я обновил `/test-connection` страницу, чтобы она:
- Правильно обрабатывала случай когда `testResponse` null
- Показывала более детальную диагностическую информацию
- Предлагала конкретные шаги для решения проблемы

**Обновите страницу** (`Ctrl+Shift+R` для hard refresh) и проверьте снова.
