import { CalendarDays, GraduationCap, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { StudentActivationForm } from '@/features/student-portal/student-activation-form';
import { getStudentPortalSession } from '@/features/student-portal/session';

export default async function StudentAccountActivationPage() {
  const session = await getStudentPortalSession();

  if (session) {
    redirect('/student');
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-institutional-yellow" aria-hidden="true" />

      <section className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        {/* Top Brand Banner */}
        <div className="flex h-12 items-center justify-between border-b border-primary/20 bg-institutional-yellow px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary-deeper text-white shadow-2xs">
              <CalendarDays className="size-4" aria-hidden="true" />
            </span>
            <p className="truncate text-xs font-bold tracking-tight text-primary-deeper">
              Academic Planning System
            </p>
          </div>

          <Link
            href="/student/login"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-deeper hover:underline"
          >
            <ArrowLeft className="size-3" />
            Sign in
          </Link>
        </div>

        <div className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary font-bold shadow-2xs">
              <GraduationCap className="size-5" />
            </span>
            <div>
              <h1 className="text-base font-bold text-text-primary">Activate Account</h1>
              <p className="text-xs text-text-muted">Set up your preferred PIN/password.</p>
            </div>
          </div>

          <StudentActivationForm />
        </div>
      </section>
    </main>
  );
}
