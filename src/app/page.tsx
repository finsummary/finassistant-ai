import { createClient } from '@/lib/supabase/server';
import Dashboard from './dashboard/page';
import LoginPage from './login/page';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return <Dashboard user={user} />;
  }

  return <LoginPage />;
}
