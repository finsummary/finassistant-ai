"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'landing' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setMessage(data?.message || 'Thanks! We will be in touch.');
      setEmail('');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">FinAssistant</CardTitle>
            <CardDescription>
              We are building a simple Financial Assistant to help track, understand, and plan your finances.
              Join the waitlist to get early access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="email"
                placeholder="your@email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" disabled={loading}>
                {loading ? 'Submitting…' : 'Join waitlist'}
              </Button>
            </form>
            {message && <p className="text-green-600 mt-3">{message}</p>}
            {error && <p className="text-red-600 mt-3">{error}</p>}
            <p className="text-xs text-muted-foreground mt-4">
              By joining, you agree to receive a single notification when we launch.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
