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
    <section className="w-full max-w-md overflow-hidden rounded-[1.35rem] border border-border bg-surface shadow-md" aria-labelledby="login-title">
      <div className="flex h-[4.5rem] items-center gap-3 bg-[#f5bd22] px-6">
        <span className="flex size-11 items-center justify-center rounded-xl bg-white text-[#7b1421] shadow-sm"><CalendarDays className="size-5" aria-hidden="true" /></span>
        <div><p className="text-sm font-bold text-[#32140c]">HND Timetabler</p><p className="text-xs text-[#5f3514]">Human Nutrition and Dietetics</p></div>
      </div>
      <div className="p-6 sm:p-8">
        <h1 id="login-title" className="text-2xl font-semibold tracking-tight text-text-primary">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">Enter your department account details to continue.</p>
        <div className="mt-7"><LoginForm nextPath={nextPath} /></div>
      </div>
    </section>
  </main>;
}
