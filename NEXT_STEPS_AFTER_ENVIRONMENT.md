# Следующие шаги после создания Environment

## ✅ Что уже сделано:
- [x] Environment `github-pages` создан
- [x] Настройки сохранены

## 📋 Что нужно проверить и сделать:

### Шаг 1: Проверить GitHub Secrets
1. GitHub → ваш репозиторий → **Settings** → **Secrets and variables** → **Actions**
2. Убедитесь, что есть два secrets:
   - ✅ `NEXT_PUBLIC_SUPABASE_URL`
   - ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Если их нет — добавьте (см. инструкцию ниже)

### Шаг 2: Включить GitHub Pages
1. GitHub → **Settings** → **Pages**
2. В разделе **"Source"** выберите **"GitHub Actions"**
3. Сохраните (если нужно)

### Шаг 3: Проверить, что изменения закоммичены
1. Убедитесь, что `next.config.ts` имеет `output: 'export'` (раскомментирован)
2. Убедитесь, что `.github/workflows/deploy.yml` существует

### Шаг 4: Commit и Push (если ещё не сделали)
```powershell
cd finassistant-ai
git add .
git commit -m "Configure GitHub Pages deployment"
git push
```

### Шаг 5: Проверить деплой
1. GitHub → вкладка **"Actions"**
2. Дождитесь завершения workflow **"Deploy to GitHub Pages"**
3. После успешного завершения откройте ссылку на сайт

---

## Если Secrets не добавлены:

### Добавить NEXT_PUBLIC_SUPABASE_URL:
1. GitHub → Settings → Secrets and variables → Actions
2. New repository secret
3. Name: `NEXT_PUBLIC_SUPABASE_URL`
4. Secret: ваш Supabase URL (например: `https://xxxxx.supabase.co`)
5. Add secret

### Добавить NEXT_PUBLIC_SUPABASE_ANON_KEY:
1. New repository secret
2. Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Secret: ваш Supabase anon key (начинается с `eyJ...`)
4. Add secret

---

## После push:

1. **Workflow запустится автоматически**
2. **Проверьте Actions** → должен быть запущен workflow
3. **Дождитесь завершения** (обычно 2-5 минут)
4. **Откройте сайт** по ссылке из workflow или в Settings → Pages

---

## Готово! 🎉

После успешного деплоя ваш сайт будет доступен по адресу:
- `https://your-username.github.io/finassistant-ai`
- Или `https://finassistant-ai.com` (после настройки DNS)
