# Deploy to GitHub Pages - FinAssistant.ai

## ✅ Why GitHub Pages Works Now

I've updated the waitlist page to use **client-side Supabase** directly (no API routes needed). This means:
- ✅ Works with static hosting (GitHub Pages)
- ✅ No server required
- ✅ Free hosting
- ✅ Custom domain support

## Prerequisites

- [ ] GitHub repository (public or private with GitHub Actions)
- [ ] Supabase project with `waitlist` table created
- [ ] Domain `finassistant-ai.com` (optional)

---

## Step 1: Configure Next.js for Static Export

### 1.1 Update `next.config.ts`

**Important**: In `next.config.ts`, uncomment the `output: 'export'` line:

```typescript
const nextConfig: NextConfig = {
  output: 'export', // ✅ Uncomment this line for GitHub Pages
  // ... rest of config
};
```

**Note**: If you want to use Vercel later, comment this line back out (Vercel doesn't need static export).

### 1.2 Update Environment Variables

Create `.env.production` (or use GitHub Secrets):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Important**: These must start with `NEXT_PUBLIC_` to be included in the static build.

---

## Step 2: Setup GitHub Actions for Auto-Deploy

### 2.1 Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - master  # or 'main' if your default branch is main

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: finassistant-ai/package-lock.json
      
      - name: Install dependencies
        working-directory: finassistant-ai
        run: npm ci
      
      - name: Build
        working-directory: finassistant-ai
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
        run: npm run build
      
      - name: Setup Pages
        uses: actions/configure-pages@v4
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: finassistant-ai/out

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 2.2 Add GitHub Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key

### 2.3 Enable GitHub Pages

1. Go to repo → **Settings** → **Pages**
2. Under **"Source"**, select **"GitHub Actions"**
3. Save

---

## Step 3: Connect Custom Domain (Namecheap)

### 3.1 Add Domain to GitHub Pages

1. In repo → **Settings** → **Pages**
2. Under **"Custom domain"**, enter: `finassistant-ai.com`
3. Check **"Enforce HTTPS"**
4. GitHub will show you DNS records

### 3.2 Configure DNS in Namecheap

#### Option A: Use GitHub Nameservers (Easiest)
1. GitHub will show nameservers like:
   - `ns1.github.com`
   - `ns2.github.com`
2. In Namecheap → **Domain List** → **Manage** → **Advanced DNS**
3. Change to **"Custom DNS"**
4. Add GitHub nameservers
5. Save

#### Option B: Use Namecheap DNS
1. In Namecheap → **Advanced DNS**
2. Add **A Records**:
   - `@` → `185.199.108.153`
   - `@` → `185.199.109.153`
   - `@` → `185.199.110.153`
   - `@` → `185.199.111.153`
3. Add **CNAME Record**:
   - `www` → `your-username.github.io.` (note the trailing dot)
4. Save

### 3.3 Wait for DNS Propagation
- Usually 1-4 hours, up to 48 hours
- Check: https://www.whatsmydns.net
- GitHub will automatically issue SSL certificate

---

## Step 4: Build and Test Locally

```bash
cd finassistant-ai
npm run build
```

This will create an `out` folder with static files. Test locally:
```bash
npx serve out
```

---

## Step 5: Deploy

1. **Commit and push**:
   ```bash
   git add .
   git commit -m "Configure for GitHub Pages deployment"
   git push
   ```

2. **GitHub Actions will automatically**:
   - Build your site
   - Deploy to GitHub Pages
   - Update on every push to master/main

3. **Check deployment**:
   - Go to repo → **Actions** tab
   - Watch the workflow run
   - Once complete, your site is live!

---

## Troubleshooting

### Build Fails
- Check GitHub Actions logs
- Verify environment variables are set in Secrets
- Ensure `next.config.ts` has `output: 'export'`

### Domain Not Working
- Wait up to 48 hours for DNS propagation
- Verify DNS records in Namecheap
- Check GitHub Pages settings

### Supabase Connection Issues
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are in GitHub Secrets
- Check Supabase RLS policies allow public inserts
- Test Supabase connection in browser console

### Static Export Issues
- Remove any API routes (we already did this for waitlist)
- Ensure all images use `unoptimized: true` in next.config
- Check for any server-side code that needs to be moved to client-side

---

## Advantages of GitHub Pages

✅ **Free** - No cost  
✅ **Simple** - Just push to GitHub  
✅ **Fast** - CDN-backed  
✅ **Custom Domain** - Free SSL  
✅ **Auto-Deploy** - On every push  

## Limitations

⚠️ **Static Only** - No server-side features  
⚠️ **Build Time** - Can take a few minutes  
⚠️ **Public Repo** - For free tier (or use GitHub Actions with private)  

---

## Your Site Will Be Live At:

- **GitHub Pages URL**: `https://your-username.github.io/finassistant-ai`
- **Custom Domain**: `https://finassistant-ai.com` (after DNS setup)

---

## Next Steps

1. Update `next.config.ts` with static export settings
2. Create GitHub Actions workflow
3. Add secrets to GitHub
4. Push and deploy! 🚀
