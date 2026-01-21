# Setup Budget Table

## Важно: Выполните миграцию!

Для работы функции сохранения бюджета необходимо выполнить миграцию базы данных.

## Инструкция:

1. Откройте Supabase Dashboard: https://supabase.com/dashboard
2. Выберите ваш проект FinAssistant.ai
3. Перейдите в "SQL Editor" (в левом меню)
4. Нажмите "New query"
5. Скопируйте и вставьте содержимое файла `supabase/migrations/20251103000000_create_budget.sql`
6. Нажмите "Run" (или Ctrl+Enter)
7. Дождитесь сообщения "Success"

## Альтернативный способ:

Если вы используете `ALL_MIGRATIONS.sql`, убедитесь, что миграция Budget добавлена в конец файла.

## Проверка:

После выполнения миграции проверьте:
- В "Table Editor" должна появиться таблица `Budget`
- В таблице должны быть колонки: `id`, `user_id`, `horizon`, `forecast_months`, `category_growth_rates`, `budget_data`

## Если миграция уже выполнена:

Если вы видите ошибку "relation already exists", это нормально - таблица уже создана.
