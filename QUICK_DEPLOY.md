# Quick Deploy Guide - FinAssistant.ai

## 🚀 Fast Track to Production

### Prerequisites Checklist
- [ ] Code committed to GitHub
- [ ] Supabase project created and migrations run
- [ ] Environment variables ready (.env.local)
- [ ] Namecheap domain `finassistant-ai.com` ready

---

## Step 1: Deploy to Vercel (5 minutes)

1. **Go to Vercel**: https://vercel.com
2. **Sign up/Login** with GitHub
3. **Import Project**:
   - Click "Add New..." → "Project"
   - Select your GitHub repo
   - Root Directory: `finassistant-ai` (or `.` if repo is the project)
4. **Add Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ```
5. **Deploy** → Wait 2-5 minutes
6. **Get your Vercel URL**: `https://your-project.vercel.app`

---

## Step 2: Connect Domain (10 minutes)

### In Vercel:
1. Go to **Settings** → **Domains**
2. Click **"Add Domain"**
3. Enter: `finassistant-ai.com`
4. Copy the DNS records shown

### In Namecheap:
1. Login → **Domain List** → **Manage** `finassistant-ai.com`
2. Go to **"Advanced DNS"** tab

#### Option A: Use Vercel Nameservers (Easiest)
- Change to **"Custom DNS"**
- Add Vercel nameservers:
  - `ns1.vercel-dns.com`
  - `ns2.vercel-dns.com`
- Save

#### Option B: Use Namecheap DNS
- Keep **"Namecheap BasicDNS"**
- Add A Record: `@` → `76.76.21.21` (use IP from Vercel)
- Add CNAME: `www` → `cname.vercel-dns.com.` (from Vercel)
- Save

### Wait for DNS (1-24 hours, usually 1-4 hours)
- Check: https://www.whatsmydns.net
- Vercel will auto-issue SSL certificate

---

## Step 3: Verify Everything Works

- [ ] Visit `https://finassistant-ai.com`
- [ ] Test waitlist form
- [ ] Check SSL certificate (should be automatic)
- [ ] Test on mobile

---

## 🆘 Need Help?

- **DNS Issues**: Wait up to 48 hours, check whatsmydns.net
- **Build Errors**: Check Vercel build logs
- **Domain Not Working**: Verify DNS records in Namecheap
- **SSL Issues**: Wait 10-15 min after DNS propagates

---

## 📋 Environment Variables Checklist

Make sure these are set in Vercel:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ⚠️ `OPENAI_API_KEY` (optional, for AI features)
- ⚠️ `GEMINI_API_KEY` (optional, for AI features)
- ⚠️ `AI_PROVIDER` (optional)

---

## 🎉 You're Live!

Once DNS propagates, your site will be live at:
**https://finassistant-ai.com**

For detailed instructions, see: `DEPLOY_DOMAIN_SETUP.md`
