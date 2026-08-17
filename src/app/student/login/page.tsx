import { redirect } from 'next/navigation';
import { BookOpenCheck } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { StudentLoginForm } from '@/features/student-portal/student-login-form';
import { getStudentPortalSession } from '@/features/student-portal/session';

export default async function StudentPortalLoginPage() {
  const session = await getStudentPortalSession();
  if (session) redirect('/student/unit-registration');

  return (
    <main className="min-h-screen bg-surface-subtle px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-4 h-1.5 rounded-full bg-accent" />
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-white px-6 py-5">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary text-white">
              <BookOpenCheck className="size-5" />
            </div>
            <h1 className="text-xl font-bold text-text-primary">Student unit registration</h1>
            <p className="mt-1 text-sm text-text-muted">Confirm your current units.</p>
          </div>
          <div className="px-6 py-5">
            <StudentLoginForm />
          </div>
        </Card>
      </div>
    </main>
  );
}
