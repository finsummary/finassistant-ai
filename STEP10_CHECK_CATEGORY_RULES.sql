-- ШАГ 10: Проверить CategoryRules - может быть там есть правило, которое устанавливает Healthcare
SELECT 
  id,
  user_id,
  field,
  pattern,
  category,
  enabled
FROM "CategoryRules"
WHERE category = 'Healthcare'
   OR pattern = ''
   OR pattern IS NULL
   OR (user_id IS NULL AND enabled = true);
