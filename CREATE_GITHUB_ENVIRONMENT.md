# Как создать GitHub Environment для Pages

## Проблема
Вы видите сообщение: "There are no environments for this repository"

## Решение: Создать Environment вручную

### Шаг 1: Откройте настройки Environments
1. Откройте ваш GitHub репозиторий
2. Нажмите **"Settings"** (вкладка вверху)
3. В левом меню найдите раздел **"Environments"** (в разделе "Code, planning and automation")
4. Нажмите на **"Environments"**

### Шаг 2: Создайте новый Environment
1. Нажмите кнопку **"New environment"** (справа вверху)
2. В поле **"Environment name"** введите точно: `github-pages`
   - ⚠️ **Важно**: Название должно быть точно `github-pages` (с дефисом, маленькими буквами)
   - Это должно совпадать с названием в workflow файле
3. Нажмите **"Configure environment"**

### Шаг 3: Настройте Environment (опционально)
1. **Deployment branches**: Оставьте по умолчанию (All branches) или выберите "Selected branches" и добавьте `master` (или `main`)
2. **Environment protection rules**: Можно оставить пустым для начала
3. **Environment secrets**: Не нужно добавлять (мы используем Repository secrets)
4. Нажмите **"Save protection rules"** (или просто закройте, если ничего не меняли)

### Шаг 4: Проверьте, что Environment создан
1. Вы должны увидеть в списке Environments:
   - ✅ `github-pages`
2. Теперь можно закрыть эту страницу

### Шаг 5: Запустите workflow снова
1. Перейдите на вкладку **"Actions"**
2. Если workflow уже запущен, он должен продолжить работу
3. Если нет, сделайте новый push или перезапустите workflow:
   - Откройте последний workflow run
   - Нажмите **"Re-run all jobs"**

---

## Альтернативное решение: Обновить workflow (если не хотите создавать environment)

Если вы не хотите создавать environment вручную, можно обновить workflow чтобы он работал без явного указания environment. GitHub Pages создаст его автоматически при первом деплое.

Но **рекомендую создать environment вручную** - это более надёжный способ.

---

## Проверка

После создания environment и запуска workflow:
1. Откройте **Actions** → ваш workflow run
2. В job **"deploy"** вы должны увидеть, что он использует environment `github-pages`
3. Деплой должен пройти успешно

---

## Если всё ещё не работает

1. Убедитесь, что:
   - Environment назван точно `github-pages` (не `GitHub Pages`, не `github_pages`)
   - GitHub Pages включён в Settings → Pages (Source: GitHub Actions)
   - Workflow файл `.github/workflows/deploy.yml` существует и закоммичен

2. Попробуйте:
   - Удалить environment и создать заново
   - Перезапустить workflow
   - Сделать новый commit и push
