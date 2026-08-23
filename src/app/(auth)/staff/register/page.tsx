import type { Metadata } from 'next';
import { CalendarDays, ShieldCheck, UserRoundCheck } from 'lucide-react';
import Link from 'next/link';

import { TrainerRegistrationForm } from '@/features/trainer-access/trainer-registration-form';

export const metadata: Metadata = {
  title: 'Staff Registration | Academic Planning System',
  description: 'Create a trainer staff account using a pre-registered departmental email.',
};

export default function StaffRegistrationPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-institutional-yellow" aria-hidden="true" />

      <section
        className="relative z-10 w-full max-w-[390px] overflow-hidden rounded-2xl border border-border bg-white shadow-lg"
        aria-labelledby="register-title"
      >
        {/* Top Brand Banner */}
        <div className="flex h-14 items-center gap-3 border-b border-primary/20 bg-institutional-yellow px-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-deeper text-white shadow-2xs">
            <CalendarDays className="size-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold tracking-tight text-primary-deeper">
              Academic Planning System
            </p>
            <p className="truncate text-[10px] font-medium text-primary-deep/80">
              Imperial College of Medical & Health Sciences
            </p>
          </div>
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRoundCheck className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h1 id="register-title" className="text-sm font-bold text-text-primary">
                Staff Account Setup
              </h1>
              <p className="text-[11px] text-text-muted">
                Create password for your trainer profile
              </p>
            </div>
          </div>

          {/* Info Banner */}
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/15 bg-[#f3f8f7] px-3 py-2 text-[11px] leading-relaxed text-[#184f4b]">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#2f706b]" aria-hidden="true" />
            <p>
              Use the email recorded in the department trainer roster.
            </p>
          </div>

          <TrainerRegistrationForm />
        </div>
      </section>
    </main>
  );
}
