import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = `Missing Supabase environment variables!
    
Please check:
1. .env.local file exists in finassistant-ai/ directory
2. File contains:
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
3. Server was restarted after creating .env.local

Current values:
- URL: ${supabaseUrl ? '✓ Set' : '✗ Missing'}
- Key: ${supabaseAnonKey ? '✓ Set' : '✗ Missing'}
`
    console.error(errorMsg)
    throw new Error('Missing Supabase environment variables. Check console for details.')
  }

  // Validate URL format
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
    console.warn('⚠️ Supabase URL format looks incorrect:', supabaseUrl)
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}


