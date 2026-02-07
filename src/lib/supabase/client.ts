import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = `Missing Supabase environment variables!
    
Please check:
1. GitHub Secrets are set correctly:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
2. Deployment was restarted after updating Secrets
3. Variables are available at build time

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

  // Log for debugging (only first few chars of key for security)
  console.log('Supabase client initialized:', {
    url: supabaseUrl,
    keyPrefix: supabaseAnonKey.substring(0, 20) + '...',
  })

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}


