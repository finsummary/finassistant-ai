# Исправление опечатки в URL

## Проблема

В `.env.local` URL проекта неправильный - опечатка в ID проекта.

**Текущий (неправильный) URL в `.env.local`:**
```
https://zqqhzbthcqllbfnpgptpn.supabase.co
                              ^^^^
                              здесь лишняя "g"
```

**Правильный URL из Supabase Dashboard:**
```
https://zqqhzbthcqllbfnpgtpn.supabase.co
                              ^^^
                              правильный вариант
```

## Решение

### Шаг 1: Обновите `.env.local`

Откройте файл `finassistant-ai/.env.local` и **исправьте URL**:

**Измените:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://zqqhzbthcqllbfnpgptpn.supabase.co
```

**На:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://zqqhzbthcqllbfnpgtpn.supabase.co
```

**Изменение:** `npgptpn` → `npgtpn` (убераем одну "g")

### Шаг 2: Полная версия .env.local

После исправления файл должен выглядеть так:

```env
NEXT_PUBLIC_SUPABASE_URL=https://zqqhzbthcqllbfnpgtpn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxcWh6YnRoY3FsbGJmbnBndHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNTAyOTUsImV4cCI6MjA3MTcyNjI5NX0.QufYCa4jQxsm7S_3NgsIKqZyiEQMP8NH5khUCiPGT6Q
NEXT_PUBLIC_APP_URL=http://localhost:3004
```

### Шаг 3: Сохраните файл

После изменения:
1. Сохраните файл (`Ctrl+S`)
2. Убедитесь, что изменения сохранены

### Шаг 4: Перезапустите dev server

**КРИТИЧЕСКИ ВАЖНО**: После изменения `.env.local`:

```bash
# Остановите сервер (Ctrl+C в терминале)
cd finassistant-ai
npm run dev
```

**Дождитесь "Ready":**
```
✓ Ready in X seconds
○ Local: http://localhost:3004
```

### Шаг 5: Проверьте подключение

1. **Откройте:** `http://localhost:3004/test-connection`
2. **Должно показать:** "✓ Connection successful!"

### Шаг 6: Попробуйте зарегистрироваться

1. **Откройте:** `http://localhost:3004/login`
2. **Попробуйте зарегистрироваться**
3. **Теперь должно работать!** ✅

## Проверка правильности

После исправления URL должен быть **точно таким же**, как в Supabase Dashboard:

**Dashboard → Settings → API → Project URL:**
```
https://zqqhzbthcqllbfnpgtpn.supabase.co
```

**`.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=https://zqqhzbthcqllbfnpgtpn.supabase.co
```

**Должны совпадать буква в букву!**

## Ожидаемый результат

После исправления опечатки и перезапуска:

✅ `/test-connection` показывает успех
✅ Регистрация работает
✅ Нет ошибок "Failed to fetch"
✅ Нет ошибок "Cannot connect to server"

## Готово!

После исправления опечатки и перезапуска сервера все должно работать! 🎉
