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

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const parameters = await searchParams;

  const nextPath =
    typeof parameters.next === 'string'
      ? parameters.next
      : undefined;

  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-[#0f172a] px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-slate-700"
          aria-hidden="true"
        />

        <div>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/5 text-slate-300 ring-1 ring-inset ring-white/10">
            <CalendarDays
              className="size-6"
              aria-hidden="true"
            />
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
            HND App
          </p>

          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-tight">
            Intelligent academic planning for the
            Nutrition and Dietetics department.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Manage academic periods, cohorts, trainers,
            teaching rooms and timetable preparation
            from one secure platform.
          </p>

          <div className="mt-10 grid max-w-xl gap-4">
            {[
              'Secure role-based departmental access',
              'Reliable timetable preparation',
              'Designed for future academic modules',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <CheckCircle2
                  className="size-4 shrink-0 text-slate-300"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/10 pt-6 text-sm text-slate-400">
          <ShieldCheck
            className="size-5 text-slate-300"
            aria-hidden="true"
          />
          Protected departmental access
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:min-h-0">
        <div
          className="absolute inset-x-0 top-0 h-1.5 bg-slate-700 lg:hidden"
          aria-hidden="true"
        />

        <div className="w-full max-w-md">
          <div className="mb-7 lg:hidden">
            <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <CalendarDays
                className="size-5"
                aria-hidden="true"
              />
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
              HND App
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              Department access
            </p>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Sign in to continue
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use your authorized departmental email
              address and password.
            </p>

            <div className="mt-7">
              <LoginForm nextPath={nextPath} />
            </div>
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            Human Nutrition and Dietetics Academic
            Management Platform
          </p>
        </div>
      </section>
    </main>
  );
}