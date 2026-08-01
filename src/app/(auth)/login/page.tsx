import type { Metadata } from 'next';
import {
  CalendarDays,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = {
  title: 'HOD Login',
  description:
    'Secure access to the HND App departmental academic management platform.',
};

interface LoginPageProps {
  searchParams: Promise<{
    next?: string | string[];
  }>;
}

const platformFeatures = [
  'Structured academic-period planning',
  'Reliable timetable preparation',
  'Secure departmental administration',
];

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const parameters = await searchParams;

  const nextPath =
    typeof parameters.next === 'string'
      ? parameters.next
      : undefined;

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[1fr_0.92fr]">
      <section className="relative hidden border-r border-border bg-surface-subtle px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-surface text-primary shadow-sm">
            <CalendarDays
              className="size-6"
              aria-hidden="true"
            />
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            HND App
          </p>

          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-tight text-text-primary">
            Academic operations designed for clarity,
            accuracy and control.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-text-secondary">
            Prepare academic periods, teaching resources,
            cohort schedules and departmental timetables
            through one structured workspace.
          </p>

          <div className="mt-10 grid max-w-xl gap-3">
            {platformFeatures.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-xl border border-border-soft bg-surface px-4 py-3 text-sm text-text-secondary shadow-sm"
              >
                <CheckCircle2
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />

                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-6 text-sm text-text-muted">
          <ShieldCheck
            className="size-5 text-primary"
            aria-hidden="true"
          />

          Protected departmental access
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:min-h-0">
        <div className="w-full max-w-md">
          <div className="mb-7 lg:hidden">
            <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface text-primary shadow-sm">
              <CalendarDays
                className="size-5"
                aria-hidden="true"
              />
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              HND App
            </p>
          </div>

          <div className="rounded-[1.35rem] border border-border bg-surface p-6 shadow-[var(--shadow-md)] sm:p-8">
            <div className="mb-7">
              <div className="inline-flex rounded-full border border-border bg-primary-subtle px-3 py-1 text-xs font-semibold text-primary">
                Department access
              </div>

              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">
                Sign in to continue
              </h2>

              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Enter your authorized departmental
                credentials.
              </p>
            </div>

            <LoginForm nextPath={nextPath} />
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-text-muted">
            Human Nutrition and Dietetics Academic
            Management Platform
          </p>
        </div>
      </section>
    </main>
  );
}