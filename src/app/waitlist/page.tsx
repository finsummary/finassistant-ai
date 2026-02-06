'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { 
  CheckCircle2, 
  Loader2, 
  ArrowRight,
  Sparkles,
  Clock,
  AlertTriangle,
  Calculator,
  MessageSquare,
  FileText,
  Lock
} from 'lucide-react'

export default function WaitlistPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Validate email
      if (!email || typeof email !== 'string') {
        throw new Error('Email is required')
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        throw new Error('Invalid email format')
      }

      // Normalize email
      const normalizedEmail = email.trim().toLowerCase()

      // Use client-side Supabase (works with GitHub Pages)
      const supabase = createClient()
      
      const { data, error: supabaseError } = await supabase
        .from('waitlist')
        .insert({
          email: normalizedEmail,
          source: 'landing_page',
        })
        .select()
        .single()

      if (supabaseError) {
        // Handle duplicate email
        if (supabaseError.code === '23505' || supabaseError.message.includes('duplicate') || supabaseError.message.includes('unique')) {
          throw new Error('This email is already registered')
        }
        
        // Handle RLS/permission errors
        if (supabaseError.message.includes('policy') || supabaseError.message.includes('permission') || supabaseError.message.includes('RLS')) {
          throw new Error('Permission denied. Please check database policies.')
        }
        
        throw new Error(supabaseError.message || 'Failed to add email to waitlist')
      }

      setIsSuccess(true)
      setEmail('')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const valueBullets = [
    {
      icon: Clock,
      title: 'See your real runway across all accounts',
      description: 'Understand your actual cash position across banks, cards, credit, and personal accounts',
    },
    {
      icon: AlertTriangle,
      title: 'Understand the risk of hiring or spending more',
      description: 'Get clear insights into financial risks before making major decisions',
    },
    {
      icon: Calculator,
      title: 'Model what happens if revenue drops or costs rise',
      description: 'Run scenarios and see the impact on your runway and financial health',
    },
    {
      icon: MessageSquare,
      title: 'Ask questions and get answers based on your exact business data',
      description: 'Not generic theory—get personalized insights from your actual financial situation',
    },
    {
      icon: FileText,
      title: 'Get clear, CFO-style explanations — not dashboards',
      description: 'Understand your finances through expert explanations, not just numbers and charts',
    },
  ]


  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="container mx-auto px-4 py-16 md:py-24 lg:py-32">
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="mb-6 flex justify-center">
              <Badge variant="secondary" className="px-4 py-1.5 text-sm">
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Early Access
              </Badge>
            </div>

            {/* Main Heading */}
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              We're building an
              <br />
              <span className="bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] bg-clip-text text-transparent">
                AI CFO for entrepreneurs,
              </span>
              <br />
              freelancers, and small businesses
            </h1>

            {/* Subheading */}
            <p className="mx-auto mb-8 max-w-3xl text-lg text-muted-foreground sm:text-xl md:text-2xl">
              FinAssistant is an AI CFO designed to help you understand your <strong>real runway</strong>, 
              <strong> hiring risk</strong>, and <strong>financial options</strong> — even when your money is spread 
              across banks, cards, cash, credit, and personal fallback options.
            </p>

            {/* CTA */}
            <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <div className="w-full sm:w-auto">
                <Card className="border-2 shadow-lg">
                  <CardContent className="p-6">
                    {!isSuccess ? (
                      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:gap-2">
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isLoading}
                          className="h-12 min-w-[280px] text-base"
                          aria-label="Email address"
                        />
                        <Button
                          type="submit"
                          disabled={isLoading || !email.trim()}
                          size="lg"
                          className="h-12 px-8 text-base font-semibold"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Joining...
                            </>
                          ) : (
                            <>
                              Join the early access waitlist
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </form>
                    ) : (
                      <div className="flex items-center justify-center gap-3 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-6 w-6" />
                        <span className="text-lg font-semibold">You're on the list! We'll be in touch soon.</span>
                      </div>
                    )}
                    {error && (
                      <p className="mt-2 text-sm text-destructive">{error}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Value line */}
            <p className="mb-4 text-lg font-semibold text-foreground sm:text-xl">
              CFO-level decisions — at ~1/100 the cost of hiring a full-time CFO.
            </p>

            {/* Trust line */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Lock className="h-4 w-4" />
                <span>Read-only access</span>
              </div>
              <span>·</span>
              <span>No transactions</span>
              <span>·</span>
              <span>You control what you share</span>
            </div>

            {/* Early access note */}
            <p className="mt-6 text-sm text-muted-foreground">
              We're onboarding early users in small batches.
            </p>
          </div>
        </div>
      </section>

      {/* Value Bullets Section */}
      <section className="border-b bg-[#F9FAFB] py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                With FinAssistant, you'll be able to:
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
              {valueBullets.map((bullet, index) => {
                const Icon = bullet.icon
                return (
                  <Card key={index} className="border-2 transition-all hover:shadow-lg">
                    <CardContent className="p-6">
                      <div className="mb-4 flex items-start gap-4">
                        <div className="inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 shrink-0">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="mb-2 text-xl font-semibold leading-tight">{bullet.title}</h3>
                          <p className="text-muted-foreground">{bullet.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-[#F9FAFB] py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Ready for
              <br />
              <span className="text-primary">CFO-Level Insights?</span>
            </h2>
            <p className="mb-4 text-lg font-semibold text-foreground">
              CFO-level decisions — at ~1/100 the cost of hiring a full-time CFO.
            </p>
            <p className="mb-8 text-lg text-muted-foreground">
              Join the early access waitlist. We're onboarding early users in small batches.
            </p>
            
            {!isSuccess && (
              <Card className="mx-auto max-w-md border-2 shadow-lg">
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-12 text-base"
                      aria-label="Email address"
                    />
                    <Button
                      type="submit"
                      disabled={isLoading || !email.trim()}
                      size="lg"
                      className="w-full h-12 text-base font-semibold"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          Join the early access waitlist
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                  {error && (
                    <p className="mt-2 text-sm text-destructive">{error}</p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      <span>Read-only access</span>
                    </div>
                    <span>·</span>
                    <span>No transactions</span>
                    <span>·</span>
                    <span>You control what you share</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {isSuccess && (
              <div className="mx-auto max-w-md rounded-lg border-2 border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/20">
                <div className="flex items-center justify-center gap-3 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-6 w-6" />
                  <span className="text-lg font-semibold">Successfully joined! We'll notify you soon.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-[#F9FAFB] py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              © 2026 FinAssistant.ai. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              We respect your privacy. Your email will only be used to notify you about early access.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
