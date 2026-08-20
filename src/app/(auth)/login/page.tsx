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

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
    <div className="absolute inset-x-0 top-0 h-1.5 bg-institutional-yellow" aria-hidden="true" />

    <section className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-lg" aria-labelledby="login-title">
      <div className="flex h-[4.75rem] items-center gap-3 border-b border-primary/20 bg-institutional-yellow px-6">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary-deeper text-white shadow-sm ring-1 ring-black/10">
          <CalendarDays className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold tracking-tight text-primary-deeper">HND Timetabler</p>
          <p className="text-xs font-medium text-institutional-yellow-ink">Human Nutrition and Dietetics</p>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-6 h-1 w-10 rounded-full bg-primary" aria-hidden="true" />
        <h1 id="login-title" className="text-2xl font-semibold tracking-tight text-text-primary">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">Enter your department account details to continue.</p>
        <div className="mt-7"><LoginForm nextPath={nextPath} /></div>
      </div>
    </section>
  </main>;
}