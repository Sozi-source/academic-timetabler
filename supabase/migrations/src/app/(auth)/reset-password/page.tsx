import type { Metadata } from 'next';
import { CalendarDays, LockKeyhole } from 'lucide-react';

import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Set New Password | Academic Planning System',
  description: 'Set a new secure password for your staff account.',
};

export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-institutional-yellow" aria-hidden="true" />

      <section
        className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-2xl border border-border bg-white shadow-lg"
        aria-labelledby="reset-password-title"
      >
        {/* Top Brand Banner */}
        <div className="flex h-12 items-center gap-2.5 border-b border-primary/20 bg-institutional-yellow px-5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary-deeper text-white shadow-2xs">
            <CalendarDays className="size-4" aria-hidden="true" />
          </span>
          <p className="truncate text-xs font-bold tracking-tight text-primary-deeper">
            Academic Planning System
          </p>
        </div>

        <div className="p-6">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </div>
            <h1 id="reset-password-title" className="text-base font-bold text-gray-900">
              Set New Password
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Create a new secure password for your staff account.
            </p>
          </div>

          <ResetPasswordForm />
        </div>
      </section>
    </main>
  );
}
