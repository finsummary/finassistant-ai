# Deploy FinAssistant.ai to Vercel & Connect Namecheap Domain

## Step 1: Prepare Your Code for Deployment

### 1.1 Check Git Status
```bash
cd finassistant-ai
git status
```

### 1.2 Commit All Changes
```bash
git add .
git commit -m "Prepare for production deployment with waitlist landing page"
git push
```

## Step 2: Deploy to Vercel

### 2.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (recommended) or email
3. Complete account setup

### 2.2 Import Project
1. Click **"Add New..."** → **"Project"**
2. Click **"Import Git Repository"**
3. Select your GitHub repository
4. If repo is private, authorize Vercel to access it

### 2.3 Configure Project Settings
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `finassistant-ai` (if repo is in parent folder) or `.` (if repo is the project root)
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

### 2.4 Add Environment Variables
In Vercel project settings → **Environment Variables**, add:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Optional (for AI features):**
```
OPENAI_API_KEY=your_openai_key
# OR
GEMINI_API_KEY=your_gemini_key
AI_PROVIDER=openai
```

**Important**: 
- Add these for **Production**, **Preview**, and **Development** environments
- Click **"Save"** after adding each variable

### 2.5 Deploy
1. Click **"Deploy"**
2. Wait for build to complete (usually 2-5 minutes)
3. You'll get a URL like: `https://finassistant-ai.vercel.app`

## Step 3: Connect Namecheap Domain (FinAssistant.ai)

### 3.1 Add Domain in Vercel
1. Go to your Vercel project → **Settings** → **Domains**
2. Click **"Add Domain"**
3. Enter: `finassistant-ai.com` (or `www.finassistant-ai.com` for www subdomain)
4. Click **"Add"**
5. Vercel will show you DNS records to configure

### 3.2 Configure DNS in Namecheap

#### Option A: Use Vercel Nameservers (Recommended - Easier)
1. In Vercel, you'll see nameservers like:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
2. Go to [Namecheap](https://www.namecheap.com)
3. Log in → **Domain List** → Click **"Manage"** next to `finassistant-ai.com`
4. Go to **"Advanced DNS"** tab
5. Find **"Nameservers"** section
6. Select **"Custom DNS"**
7. Replace existing nameservers with Vercel's nameservers:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
8. Click **"Save"**
9. Wait 24-48 hours for DNS propagation

#### Option B: Use Namecheap DNS (More Control)
1. In Vercel, you'll see DNS records to add:
   - **A Record**: `@` → `76.76.21.21` (or IP shown by Vercel)
   - **CNAME Record**: `www` → `cname.vercel-dns.com.` (or value shown by Vercel)
2. Go to Namecheap → **Domain List** → **Manage** → **Advanced DNS**
3. Keep **"Namecheap BasicDNS"** selected
4. In **"Host Records"** section:
   - **Delete** any existing A or CNAME records for `@` and `www`
   - **Add A Record**:
     - Type: `A Record`
     - Host: `@`
     - Value: `76.76.21.21` (use the IP Vercel provides)
     - TTL: `Automatic` or `30 min`
   - **Add CNAME Record**:
     - Type: `CNAME Record`
     - Host: `www`
     - Value: `cname.vercel-dns.com.` (use the value Vercel provides - note the trailing dot)
     - TTL: `Automatic` or `30 min`
5. Click **"Save All Changes"**
6. Wait 1-24 hours for DNS propagation

### 3.3 Verify Domain Connection
1. In Vercel → **Domains**, you'll see status:
   - **"Valid Configuration"** = ✅ Ready
   - **"Pending"** = ⏳ Waiting for DNS propagation
2. Check DNS propagation: [whatsmydns.net](https://www.whatsmydns.net)
3. Once DNS propagates, Vercel will automatically issue SSL certificate
4. Your site will be live at `https://finassistant-ai.com`

## Step 4: Post-Deployment Checklist

### 4.1 Test Your Site
- [ ] Visit `https://finassistant-ai.com` (or your Vercel URL)
- [ ] Test waitlist form submission
- [ ] Check that Supabase connection works
- [ ] Verify all pages load correctly
- [ ] Test responsive design on mobile

### 4.2 Verify Environment Variables
- [ ] Check Vercel logs for any errors
- [ ] Verify Supabase connection in browser console
- [ ] Test API endpoints if needed

### 4.3 SSL Certificate
- [ ] Vercel automatically provisions SSL (Let's Encrypt)
- [ ] Should be active within minutes after DNS propagates
- [ ] Check: `https://finassistant-ai.com` loads without warnings

### 4.4 Redirect www to non-www (Optional)
If you want `www.finassistant-ai.com` → `finassistant-ai.com`:
1. In Vercel → **Domains**
2. Add both `finassistant-ai.com` and `www.finassistant-ai.com`
3. Vercel will handle redirect automatically

## Step 5: Update Supabase Settings (If Needed)

### 5.1 Update Allowed URLs
1. Go to Supabase Dashboard → **Settings** → **API**
2. Under **"URL Configuration"**:
   - Add `https://finassistant-ai.com` to **Site URL**
   - Add `https://finassistant-ai.com/**` to **Redirect URLs**
3. Save changes

## Troubleshooting

### DNS Not Propagating
- Wait up to 48 hours (usually 1-4 hours)
- Check [whatsmydns.net](https://www.whatsmydns.net)
- Clear browser cache
- Try different DNS servers (8.8.8.8, 1.1.1.1)

### Build Fails
- Check Vercel build logs
- Verify all environment variables are set
- Check `package.json` for correct Node.js version
- Run `npm run build` locally to test

### Domain Not Connecting
- Verify DNS records are correct in Namecheap
- Check Vercel domain settings
- Ensure domain is unlocked in Namecheap
- Contact Vercel support if issues persist

### SSL Certificate Issues
- Wait 10-15 minutes after DNS propagation
- Check Vercel domain status
- Ensure domain is properly configured
- Vercel support can help with SSL issues

## Quick Reference

**Vercel Dashboard**: https://vercel.com/dashboard
**Namecheap Dashboard**: https://www.namecheap.com/myaccount/login/
**DNS Check**: https://www.whatsmydns.net
**Vercel Docs**: https://vercel.com/docs

## Next Steps After Deployment

1. Set up monitoring (Vercel Analytics)
2. Configure error tracking (Sentry - optional)
3. Set up backups for Supabase
4. Test all features in production
5. Share your landing page! 🚀
