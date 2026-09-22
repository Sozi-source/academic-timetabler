import { redirect } from 'next/navigation';
import { UnifiedLoginCard } from '@/features/auth/unified-login-card';
import { getStudentPortalSession } from '@/features/student-portal/session';

export default async function StudentPortalLoginPage() {
  const session = await getStudentPortalSession();

  if (session) {
    redirect('/student');
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-institutional-yellow" aria-hidden="true" />
      <UnifiedLoginCard defaultRole="student" />
    </main>
  );
}
