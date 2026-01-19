# Исправление проблемы с пере-категоризацией

## Проблема
После нажатия "Clear & Re-categorize" ничего не происходит.

## Диагностика

### 1. Откройте консоль браузера

**Chrome/Edge:**
- Нажмите `F12` или `Ctrl+Shift+I`
- Откройте вкладку **Console**

**Firefox:**
- Нажмите `F12` или `Ctrl+Shift+I`
- Откройте вкладку **Консоль**

### 2. Нажмите кнопку "Clear & Re-categorize"

Вы должны увидеть в консоли:
- `Step 1: Clearing categories...`
- `Clear categories response: {...}`
- `Step 2: Running AI categorize...`
- `AI categorize response: {...}`

### 3. Проверьте возможные ошибки

Если видите ошибки в консоли, сообщите их текст.

## Возможные причины

### Причина 1: Вы отклонили confirm dialog
**Решение:** При нажатии кнопки появится диалог "Clear all categories and re-categorize with AI?". Нужно нажать **OK**.

### Причина 2: API endpoint не найден
**Решение:** Проверьте, что файл существует:
```
finassistant-ai/src/app/api/transactions/clear-categories/route.ts
```

Если файла нет, создайте его с содержимым из предыдущего ответа.

### Причина 3: Ошибка сети
**Решение:** 
1. Проверьте, что dev server запущен (`npm run dev`)
2. Проверьте Network tab в браузере (F12 → Network)
3. Найдите запрос к `/api/transactions/clear-categories`
4. Посмотрите статус и ответ

## Альтернативный способ

Если кнопка не работает, можно очистить категории вручную:

### В SQL Editor Supabase:

```sql
-- Очистить все категории для вашего user_id
UPDATE "Transactions" 
SET category = NULL 
WHERE user_id = auth.uid();
```

### Затем в Dashboard:
1. Нажмите "AI Categorize"
2. Категории будут назначены автоматически

## Проверка результата

После успешной пере-категоризации:
1. Откройте Dashboard
2. Проверьте категории транзакций (должны быть разные, не только "Healthcare")
3. Откройте Reports - данные должны отображаться правильно
4. Откройте Settings → Categories - статистика должна быть корректной

## Логирование

Код теперь логирует все шаги в консоль:
- `Step 1: Clearing categories...`
- `Clear categories response: {...}`
- `Step 2: Running AI categorize...`
- `AI categorize response: {...}`

Если видите эти сообщения, значит процесс запустился.
