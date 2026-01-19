# Проверка логов импорта

После импорта CSV проверьте логи сервера (терминал, где запущен `npm run dev`).

Вы должны увидеть:
1. `[Import] Starting AI categorization for X transactions`
2. `[Import AI] Parsed AI response: { resultsCount: X }`
3. `[Import AI] Processed X categories from X results`
4. `[Import] Applied X categories from AI`
5. `[Import] Inserting X transactions with categories:`
6. `[Import] Inserted X transactions. Sample after insert:`

Если вы видите:
- `[Import] AI categorization exception:` - AI не работает, проверьте GEMINI_API_KEY
- `[Import AI] Failed to parse AI response:` - AI вернул неверный формат
- Категории в логах показывают "Healthcare" - значит AI возвращает Healthcare

Если категории в логах правильные, но в БД все еще Healthcare - значит есть триггер в БД, который перезаписывает категории.
