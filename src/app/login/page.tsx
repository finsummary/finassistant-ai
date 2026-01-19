'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  
  // Check environment variables on mount
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase environment variables!')
      console.error('URL:', supabaseUrl ? '✓' : '✗')
      console.error('Key:', supabaseKey ? '✓' : '✗')
      alert('Configuration error: Supabase credentials not found. Please check .env.local file and restart the server.')
    } else {
      console.log('✓ Supabase URL:', supabaseUrl)
      console.log('✓ Supabase Key:', supabaseKey.substring(0, 20) + '...')
    }
  }, [])
  
  const supabase = createClient()

  const handleSignUp = async () => {
    if (!email || !password) {
      alert('Please enter both email and password')
      return
    }
    
    setIsLoading(true)
    
    // Debug: Check Supabase client
    console.log('Attempting sign up...')
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      
      if (error) {
        console.error('Sign up error:', error)
        alert(`Error signing up: ${error.message}`)
      } else {
        console.log('Sign up success:', data)
        alert('Check your email for the confirmation link!')
        // Optionally redirect to login or dashboard
        if (data.user) {
          router.push('/dashboard')
        }
      }
    } catch (error: any) {
      console.error('Sign up exception:', error)
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      })
      
      const errorMessage = error?.message || 'Failed to connect to Supabase'
      alert(`Error: ${errorMessage}\n\nPlease check:\n1. .env.local file exists\n2. Server was restarted after creating .env.local\n3. Supabase project is active`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async () => {
    if (!email || !password) {
      alert('Please enter both email and password')
      return
    }
    
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        alert(`Error signing in: ${error.message}`)
        console.error('Sign in error:', error)
      } else {
        router.push('/dashboard')
        router.refresh() // Ensures the server component re-renders
      }
    } catch (error: any) {
      console.error('Sign in exception:', error)
      alert(`An unexpected error occurred: ${error?.message || 'Failed to connect to Supabase. Please check your configuration.'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button onClick={handleSignIn} className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
            <Button onClick={handleSignUp} variant="outline" className="w-full" disabled={isLoading}>
              Sign up
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


