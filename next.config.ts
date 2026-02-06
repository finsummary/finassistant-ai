import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Enable static export for GitHub Pages (comment out for Vercel)
  output: 'export',  // ✅ Раскомментировано для GitHub Pages
  
  // Fix workspace root warning
  outputFileTracingRoot: path.join(__dirname),
  
  // For static export, images need to be unoptimized
  images: {
    unoptimized: true,
  },
  
  // Ensure environment variables are loaded
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
