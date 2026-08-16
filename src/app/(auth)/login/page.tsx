import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in | HND Timetabler',
  description: 'Sign in to create and manage the department timetable.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const parameters = await searchParams;
  const nextPath = typeof parameters.next === 'string' ? parameters.next : undefined;

  return <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
    <section className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-md" aria-labelledby="login-title">
      <div className="flex h-[4.25rem] items-center gap-3 border-b border-institutional-accent-border bg-institutional-gold-soft px-6">
        <span className="flex size-10 items-center justify-center rounded-lg border border-institutional-accent-border bg-surface text-institutional-maroon shadow-sm"><CalendarDays className="size-5" aria-hidden="true" /></span>
        <div><p className="text-sm font-semibold text-text-primary">HND Timetabler</p><p className="text-xs text-institutional-maroon">Human Nutrition and Dietetics</p></div>
      </div>
      <div className="p-6">
        <h1 id="login-title" className="text-2xl font-semibold tracking-tight text-text-primary">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">Enter your department account details to continue.</p>
        <div className="mt-7"><LoginForm nextPath={nextPath} /></div>
      </div>
    </section>
  </main>;
}
