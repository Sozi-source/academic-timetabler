import type { Metadata } from 'next';
import { CalendarDays, UserRoundPlus } from 'lucide-react';

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
        <div className="flex h-12 items-center gap-2.5 border-b border-primary/20 bg-institutional-yellow px-5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary-deeper text-white shadow-2xs">
            <CalendarDays className="size-4" aria-hidden="true" />
          </span>
          <p className="truncate text-xs font-bold tracking-tight text-primary-deeper">
            Academic Planning System
          </p>
        </div>

        <div className="p-5">
          <h1 id="register-title" className="mb-3 text-sm font-bold text-text-primary">
            Staff Registration
          </h1>

          <TrainerRegistrationForm />
        </div>
      </section>
    </main>
  );
}
