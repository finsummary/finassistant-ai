import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 415 });
    }

    const body = await request.json().catch(() => null) as { email?: string; source?: string } | null;
    const rawEmail = (body?.email || '').trim();
    const source = (body?.source || '').trim() || 'landing';

    if (!rawEmail || !isValidEmail(rawEmail)) {
      return NextResponse.json({ error: 'Please provide a valid email' }, { status: 400 });
    }

    const email = rawEmail.toLowerCase();

    const supabase = await createClient();
    const { error } = await supabase.from('Waitlist').insert({ email, source });

    if (error) {
      // Unique violation (duplicate)
      const isDuplicate =
        typeof error.code === 'string' && (error.code === '23505' || error.message.toLowerCase().includes('duplicate'));
      if (isDuplicate) {
        return NextResponse.json({ ok: true, message: 'You are already on the list' });
      }
      return NextResponse.json({ error: 'Failed to save email' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'Thanks! We will be in touch.' });
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}





