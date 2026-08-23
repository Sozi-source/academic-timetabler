import {
  redirect,
} from 'next/navigation';
import {
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';

import {
  Card,
} from '@/components/ui/card';
import {
  StudentLoginForm,
} from '@/features/student-portal/student-login-form';
import {
  getStudentPortalSession,
} from '@/features/student-portal/session';

export default async function StudentPortalLoginPage() {
  const session =
    await getStudentPortalSession();

  if (session) {
    redirect(
      '/student',
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-subtle px-4 py-10">
      <div className="w-full max-w-md">
        <div
          className="mb-4 h-1.5 rounded-full bg-institutional-yellow"
          aria-hidden="true"
        />

        <Card className="overflow-hidden">
          <div className="border-b border-border bg-white px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
                <GraduationCap
                  className="size-5"
                  aria-hidden="true"
                />
              </span>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Academic Planning System
                </p>

                <h1 className="mt-0.5 text-lg font-bold text-text-primary">
                  Student access
                </h1>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-subtle px-3 py-2.5">
              <ShieldCheck
                className="mt-0.5 size-3.5 shrink-0 text-text-muted"
                aria-hidden="true"
              />

              <p className="text-[11px] leading-5 text-text-secondary">
                Use your admission number
                and department-issued PIN.
              </p>
            </div>
          </div>

          <div className="px-6 py-5">
            <StudentLoginForm />

            <div className="mt-4 border-t border-border pt-3 text-center">
              <p className="text-xs text-text-muted">
                Staff member or Trainer?{' '}
                <Link
                  href="/login"
                  className="font-semibold text-primary hover:underline"
                >
                  Staff Sign In →
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
