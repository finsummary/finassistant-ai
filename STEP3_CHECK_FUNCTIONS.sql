-- ШАГ 3: Проверить функции, которые могут устанавливать Healthcare
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_definition LIKE '%Healthcare%' OR routine_definition LIKE '%category%')
  AND routine_type = 'FUNCTION';
