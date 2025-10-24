'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignUp = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      })
      if (error) {
        alert(`Error signing up: ${error.message}`)
      } else {
        alert('Check your email for the confirmation link!')
      }
    } catch (error) {
      alert(`An unexpected error occurred: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        alert(`Error signing in: ${error.message}`)
      } else {
        router.push('/')
        router.refresh() // Ensures the server component re-renders
      }
    } catch (error) {
      alert(`An unexpected error occurred: ${error.message}`)
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


