# Обновление .env.local

## Текущие учетные данные

Если автоматическое обновление не сработало, обновите файл `finassistant-ai/.env.local` вручную:

```env
NEXT_PUBLIC_SUPABASE_URL=https://zqqhzbthcqllbfnpgtpn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxcWh6YnRoY3FsbGJmbnBndHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNTAyOTUsImV4cCI6MjA3MTcyNjI5NX0.QufYCa4jQxsm7S_3NgsIKqZyiEQMP8NH5khUCiPGT6Q
NEXT_PUBLIC_APP_URL=http://localhost:3004
```

## Важно

1. **Нет пробелов** вокруг `=`
2. **Нет кавычек** вокруг значений
3. **Каждая переменная** на отдельной строке
4. **Сохраните файл** после редактирования

## После обновления

1. **Перезапустите dev server:**
   ```bash
   # Остановите (Ctrl+C)
   cd finassistant-ai
   npm run dev
   ```

2. **Проверьте подключение:**
   - Откройте: `http://localhost:3004/test-connection`
   - Должно показать "✓ Connection successful!"
