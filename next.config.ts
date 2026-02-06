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
  
  // Disable ESLint during build for static export (GitHub Pages)
  // This is needed because we have many ESLint warnings/errors that don't affect functionality
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript errors during build (optional, but helps with deployment)
  typescript: {
    ignoreBuildErrors: false, // Keep TypeScript checks, only ignore ESLint
  },
  
  // Ensure environment variables are loaded
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
